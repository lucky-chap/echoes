import "server-only"
import {
  storageConfigured,
  StoreError,
  transaction,
  validSession,
  type StoreData,
} from "./secure-store"

export const privateHeaders = {
  "Cache-Control": "no-store, private",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
}
export function sameSite(request: Request) {
  const origin = request.headers.get("origin")
  if (!origin) return false
  try {
    const expected = process.env.ECHOES_ORIGIN
      ? new URL(process.env.ECHOES_ORIGIN).origin
      : new URL(request.url).origin
    return new URL(origin).origin === expected
  } catch {
    return false
  }
}
export function cookieToken(request: Request) {
  return (
    request.headers
      .get("cookie")
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("echoes_access="))
      ?.slice("echoes_access=".length) ?? ""
  )
}
export function withCaregiver<T>(
  request: Request,
  fn: (data: StoreData) => T
): T {
  if (request.method !== "GET" && !sameSite(request))
    throw new StoreError("Same-origin request required.", 403)
  return transaction((data) => {
    if (!validSession(data, cookieToken(request)))
      throw new StoreError("Unlock the caregiver workspace to continue.", 401)
    return fn(data)
  })
}
export function requireCaregiverIfConfigured(request: Request) {
  if (!sameSite(request))
    throw new StoreError("Same-origin request required.", 403)
  if (storageConfigured()) withCaregiver(request, () => true)
}
export function routeError(error: unknown) {
  return Response.json(
    {
      error:
        error instanceof StoreError
          ? error.message
          : "The request could not be saved. Check the details and retry.",
    },
    {
      status: error instanceof StoreError ? error.status : 400,
      headers: privateHeaders,
    }
  )
}
export async function limitedJson(request: Request, maxBytes = 100_000) {
  const reader = request.body?.getReader()
  if (!reader) throw new StoreError("A request body is required.", 400)
  const chunks: Uint8Array[] = []
  let length = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    length += value.byteLength
    if (length > maxBytes) {
      await reader.cancel()
      throw new StoreError("Request is too large.", 413)
    }
    chunks.push(value)
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"))
}
