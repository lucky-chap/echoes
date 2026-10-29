import { demoProfiles } from "@/lib/echoes/demos"
import { generateSessionKit } from "@/lib/echoes/pipeline"
import { allowEchoesRequest } from "@/lib/echoes/rate-limit"
import { privateHeaders, routeError, withCaregiver } from "@/lib/echoes/access"
import { storageConfigured } from "@/lib/echoes/secure-store"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    if (storageConfigured()) withCaregiver(request, () => true)
  } catch (error) {
    return routeError(error)
  }
  if (!allowEchoesRequest(request, 4, 60_000))
    return Response.json(
      { error: "Evaluation is temporarily rate limited." },
      { status: 429 }
    )
  const profiles = demoProfiles
  const kits = await Promise.all(
    profiles.map(async (resident) => {
      try {
        return await generateSessionKit({ residents: [resident], feedback: [] })
      } catch {
        return null
      }
    })
  )
  const completed = kits.filter(
    (kit): kit is NonNullable<typeof kit> => kit !== null
  )
  const itemCount = completed.reduce(
    (total, kit) => total + kit.items.length,
    0
  )
  const inWindowItems = completed.reduce(
    (total, kit) =>
      total +
      kit.items.filter(
        (item) =>
          item.yearEvidence &&
          item.yearEvidence.year >= kit.era.from &&
          item.yearEvidence.year <= kit.era.to &&
          item.yearEvidence.residentIds.includes(kit.residents[0].id)
      ).length,
    0
  )
  const resolved = completed.reduce(
    (total, kit) => total + (kit.diagnostics?.resolved ?? 0),
    0
  )
  const requested = profiles.reduce(
    (total, p) => total + p.lovedThings.length,
    0
  )
  const result = {
    sampleProfiles: profiles.length,
    pipeline: {
      label: "Qloo pipeline",
      entityResolutionRate: Math.round((resolved / requested) * 100),
      eraWindowRate: itemCount
        ? Math.round((inWindowItems / itemCount) * 100)
        : null,
      profileMediaCoverage: Math.round(
        (completed.filter((kit) => kit.items.length).length / profiles.length) *
          100
      ),
      requestedFavorites: requested,
      resolvedFavorites: resolved,
      itemsMeasured: itemCount,
    },
    baseline: {
      label: "LLM-only baseline",
      status:
        "Not measured: Echoes does not permit unverified generative items into caregiver kits.",
      entityResolutionRate: null,
      eraWindowRate: null,
      groupCoverage: null,
    },
    profiles: completed.map((kit) => ({
      name: kit.residents[0].nickname,
      diagnostics: kit.diagnostics,
      notes: kit.notes,
    })),
    note: `Live, fictional-profile runs. ${completed.reduce((n, kit) => n + (kit.diagnostics?.unavailable ?? 0), 0)} date checks unavailable. Entity resolution measures exact favourite matches, not recommendation count. In-window rate checks displayed evidence against each profile’s era; no items means not measured. These are verification metrics, not clinical outcomes.`,
  }
  return Response.json(result, { headers: privateHeaders })
}
