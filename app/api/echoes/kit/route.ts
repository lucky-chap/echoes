import { generateSessionKit } from "@/lib/echoes/pipeline"
import { allowEchoesRequest } from "@/lib/echoes/rate-limit"
import { kitRequestSchema } from "@/lib/echoes/validation"
import { ZodError } from "zod"

export const runtime = "nodejs"

export async function POST(request: Request) {
  if (!allowEchoesRequest(request)) return Response.json({ error: "Please wait a moment before creating another kit." }, { status: 429 })
  try {
    const body = kitRequestSchema.parse(await request.json())
    return Response.json({ kit: await generateSessionKit(body) })
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: "Please check the intake details and try again." }, { status: 400 })
    const message = error instanceof Error ? error.message : "Echoes could not prepare a kit."
    return Response.json({ error: message }, { status: 503 })
  }
}
