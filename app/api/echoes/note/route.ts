import { z } from "zod"
import {
  limitedJson,
  privateHeaders,
  requireCaregiverIfConfigured,
  routeError,
} from "@/lib/echoes/access"
import { sessionKitSchema, wrapUpSchema } from "@/lib/echoes/storage-validation"
import { draftWrapUpNote } from "@/lib/echoes/note"
export async function POST(request: Request) {
  try {
    requireCaregiverIfConfigured(request)
    const { kit, wrapUp } = z
      .object({ kit: sessionKitSchema, wrapUp: wrapUpSchema })
      .parse(await limitedJson(request))
    return Response.json(
      { note: draftWrapUpNote(kit, wrapUp) },
      { headers: privateHeaders }
    )
  } catch (error) {
    return routeError(error)
  }
}
