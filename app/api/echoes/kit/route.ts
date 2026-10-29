import { generateSessionKit } from "@/lib/echoes/pipeline"
import { allowEchoesRequest } from "@/lib/echoes/rate-limit"
import { kitRequestSchema } from "@/lib/echoes/validation"
import { ZodError } from "zod"
import {
  limitedJson,
  privateHeaders,
  requireCaregiverIfConfigured,
  routeError,
} from "@/lib/echoes/access"
import { StoreError } from "@/lib/echoes/secure-store"

export const runtime = "nodejs"

export async function POST(request: Request) {
  if (!allowEchoesRequest(request))
    return Response.json(
      { error: "Please wait a moment before creating another kit." },
      { status: 429 }
    )
  try {
    requireCaregiverIfConfigured(request)
    const body = kitRequestSchema.parse(await limitedJson(request, 2_000_000))
    if (!body.residents[0].consent)
      return Response.json(
        { error: "Confirm consent or authority before cultural discovery." },
        { status: 400, headers: privateHeaders }
      )
    return Response.json(
      { kit: await generateSessionKit(body) },
      { headers: privateHeaders }
    )
  } catch (error) {
    if (error instanceof StoreError) return routeError(error)
    if (error instanceof ZodError)
      return Response.json(
        { error: "Please check the intake details and try again." },
        { status: 400 }
      )
    const message =
      error instanceof Error ? error.message : "Echoes could not prepare a kit."
    return Response.json({ error: message }, { status: 503 })
  }
}
