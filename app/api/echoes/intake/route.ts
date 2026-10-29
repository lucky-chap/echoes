import { extractIntake } from "@/lib/echoes/prose"
import { allowEchoesRequest } from "@/lib/echoes/rate-limit"
import { z } from "zod"
import {
  limitedJson,
  privateHeaders,
  requireCaregiverIfConfigured,
  routeError,
} from "@/lib/echoes/access"

export async function POST(request: Request) {
  if (!allowEchoesRequest(request))
    return Response.json(
      { error: "Please wait a moment before trying again." },
      { status: 429 }
    )
  try {
    requireCaregiverIfConfigured(request)
    return Response.json(
      await extractIntake(
        z
          .object({
            note: z.string().trim().min(8).max(6000),
            authority: z.literal(true),
          })
          .parse(await limitedJson(request, 30000)).note
      ),
      { headers: privateHeaders }
    )
  } catch (error) {
    return routeError(error)
  }
}
