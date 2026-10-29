import { z } from "zod"
import { sessionKitSchema } from "@/lib/echoes/storage-validation"
import { residentSchema, feedbackSchema } from "@/lib/echoes/validation"
import {
  limitedJson,
  privateHeaders,
  requireCaregiverIfConfigured,
  routeError,
} from "@/lib/echoes/access"
import { retryDateChecks } from "@/lib/echoes/recheck"
import { allowEchoesRequest } from "@/lib/echoes/rate-limit"
export const runtime = "nodejs"
const schema = z.object({
  kit: sessionKitSchema,
  resident: residentSchema,
  feedback: z.array(feedbackSchema).max(5000),
})
export async function POST(request: Request) {
  try {
    requireCaregiverIfConfigured(request)
    if (!allowEchoesRequest(request))
      return Response.json(
        { error: "Please wait a moment before retrying." },
        { status: 429, headers: privateHeaders }
      )
    const { kit, resident, feedback } = schema.parse(
      await limitedJson(request, 2_000_000)
    )
    if (
      !resident.consent ||
      kit.residents.length !== 1 ||
      kit.residents[0].id !== resident.id ||
      kit.era.from !== resident.birthYear + 10 ||
      kit.era.to !== resident.birthYear + 25
    )
      return Response.json(
        { error: "Check the resident and consent before retrying." },
        { status: 400, headers: privateHeaders }
      )
    return Response.json(
      { kit: await retryDateChecks(kit, resident, feedback) },
      { headers: privateHeaders }
    )
  } catch (error) {
    return routeError(error)
  }
}
