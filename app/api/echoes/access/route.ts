import { randomBytes, timingSafeEqual, createHash } from "node:crypto"
import { z } from "zod"
import {
  cookieToken,
  limitedJson,
  privateHeaders,
  routeError,
  sameSite,
} from "@/lib/echoes/access"
import {
  hashToken,
  storageConfigured,
  StoreError,
  transaction,
  validSession,
} from "@/lib/echoes/secure-store"
import { allowEchoesRequest } from "@/lib/echoes/rate-limit"
export const runtime = "nodejs"
const cookie = (token: string, maxAge: number) =>
  `echoes_access=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${process.env.ECHOES_ORIGIN?.startsWith("https:") ? "; Secure" : ""}`
export async function GET(request: Request) {
  if (!storageConfigured())
    return Response.json(
      { configured: false, unlocked: false },
      { headers: privateHeaders }
    )
  try {
    return Response.json(
      {
        configured: true,
        unlocked: transaction((data) =>
          validSession(data, cookieToken(request))
        ),
      },
      { headers: privateHeaders }
    )
  } catch (error) {
    return routeError(error)
  }
}
export async function POST(request: Request) {
  try {
    if (!sameSite(request))
      throw new StoreError("Same-origin request required.", 403)
    // Global in-process throttle; deploy behind an additional trusted edge limiter.
    if (
      !allowEchoesRequest(
        new Request("http://local/access", {
          headers: { "x-real-ip": "echoes-access-global" },
        }),
        8,
        60_000
      )
    )
      throw new StoreError("Too many unlock attempts. Wait one minute.", 429)
    const { code } = z
      .object({ code: z.string().min(1).max(200) })
      .parse(await limitedJson(request, 1000))
    if (!storageConfigured())
      throw new StoreError("Protected workspace is not configured.")
    const digest = (s: string) => createHash("sha256").update(s).digest()
    if (
      !timingSafeEqual(digest(code), digest(process.env.ECHOES_CAREGIVER_CODE!))
    )
      throw new StoreError("Could not unlock this workspace.", 401)
    const token = randomBytes(32).toString("hex")
    transaction((data) => {
      data.sessions.push({
        hash: hashToken(token),
        expires: Date.now() + 30 * 60_000,
      })
      data.sessions = data.sessions.slice(-100)
    })
    return Response.json(
      { unlocked: true },
      { headers: { ...privateHeaders, "Set-Cookie": cookie(token, 1800) } }
    )
  } catch (error) {
    return routeError(error)
  }
}
export async function DELETE(request: Request) {
  try {
    if (!sameSite(request))
      throw new StoreError("Same-origin request required.", 403)
    if (storageConfigured())
      transaction((data) => {
        data.sessions = data.sessions.filter(
          (s) => s.hash !== hashToken(cookieToken(request))
        )
      })
    return Response.json(
      { unlocked: false },
      { headers: { ...privateHeaders, "Set-Cookie": cookie("", 0) } }
    )
  } catch (error) {
    return routeError(error)
  }
}
