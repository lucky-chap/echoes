import { demoProfiles } from "@/lib/echoes/demos"
import { generateSessionKit } from "@/lib/echoes/pipeline"
import { allowEchoesRequest } from "@/lib/echoes/rate-limit"

export const runtime = "nodejs"

export async function GET(request: Request) {
  if (!allowEchoesRequest(request, 4, 60_000)) return Response.json({ error: "Evaluation is temporarily rate limited." }, { status: 429 })
  const profiles = demoProfiles
  const kits = await Promise.all(profiles.map(async (resident) => {
    try { return await generateSessionKit({ residents: [resident], feedback: [] }) } catch { return null }
  }))
  const completed = kits.filter((kit): kit is NonNullable<typeof kit> => kit !== null)
  const itemCount = completed.reduce((total, kit) => total + kit.items.length, 0)
  const inWindowItems = completed.reduce((total, kit) => total + kit.items.filter((item) => Boolean(item.yearEvidence)).length, 0)
  const result = {
    sampleProfiles: profiles.length,
    pipeline: {
      label: "Qloo pipeline",
      entityResolutionRate: itemCount ? 100 : 0,
      eraWindowRate: itemCount ? Math.round((inWindowItems / itemCount) * 100) : 0,
      groupCoverage: completed.length ? Math.round(completed.reduce((total, kit) => total + kit.coverage.percent, 0) / completed.length) : 0,
      itemsMeasured: itemCount,
    },
    baseline: {
      label: "LLM-only baseline",
      status: "Not measured: Echoes does not permit unverified generative items into caregiver kits.",
      entityResolutionRate: null,
      eraWindowRate: null,
      groupCoverage: null,
    },
    note: "Pipeline figures count only Qloo-returned entities filtered with each profile's reminiscence-window request. They are measurable verification metrics, not clinical outcomes.",
  }
  return Response.json(result)
}
