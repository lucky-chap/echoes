import { writeSessionNote } from "@/lib/echoes/prose"
import { allowEchoesRequest } from "@/lib/echoes/rate-limit"
import { z } from "zod"

export async function POST(request: Request) {
  if (!allowEchoesRequest(request)) return Response.json({ error: "Please wait a moment before drafting another note." }, { status: 429 })
  try {
    const body = z.object({ resident: z.any(), items: z.array(z.any()).max(8), feedback: z.array(z.any()).max(100), engagement: z.union([z.literal(1), z.literal(2), z.literal(3), z.null()]) }).parse(await request.json())
    return Response.json({ note: await writeSessionNote(body) })
  } catch { return Response.json({ error: "Echoes could not draft that note." }, { status: 400 }) }
}
