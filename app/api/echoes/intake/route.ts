import { extractIntake } from "@/lib/echoes/prose"
import { allowEchoesRequest } from "@/lib/echoes/rate-limit"
import { z } from "zod"

export async function POST(request: Request) {
  if (!allowEchoesRequest(request)) return Response.json({ error: "Please wait a moment before trying again." }, { status: 429 })
  try { return Response.json(await extractIntake(z.object({ note: z.string().trim().min(8).max(1200) }).parse(await request.json()).note)) }
  catch { return Response.json({ error: "Add a little more detail so Echoes can help." }, { status: 400 }) }
}
