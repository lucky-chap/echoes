import {
  destinations,
  residents,
  type DestinationId,
  type ResidentId,
  type Situation,
  type Taste,
} from "./profiles"
export type Provenance = "MOCK" | "LIVE Qloo"
export interface TasteRecommendation {
  residentId: ResidentId
  destinationId: DestinationId
  score: number
  reasons: string[]
  source: Provenance
}
export interface TasteRequest {
  profiles: typeof residents
  destinations: typeof destinations
  situation: Situation
}
/** A real adapter should fetch via a server route, keeping the Qloo key server-side.
 * Network calls complete before a simulation transition; playback never depends on audio or networking. */
export interface TasteProvider {
  readonly source: Provenance
  recommend(request: TasteRequest): Promise<TasteRecommendation[]>
}
export const mockTasteProvider: TasteProvider = {
  source: "MOCK",
  async recommend(request) {
    return request.profiles.flatMap((r) =>
      request.destinations.map((d) => {
        const keys = Object.keys(r.taste) as (keyof Taste)[]
        const weight = keys.reduce((s, k) => s + r.taste[k], 0)
        const base =
          (keys.reduce((s, k) => s + r.taste[k] * d.traits[k], 0) / weight) *
          100
        const matches = keys.toSorted(
          (a, b) => r.taste[b] * d.traits[b] - r.taste[a] * d.traits[a]
        )
        const reasons = [
          `${matches[0]} and ${matches[1]} fit ${r.name}'s tastes`,
        ]
        let adjustment = 0
        if (request.situation === "rain") {
          adjustment =
            d.id === "cafe"
              ? 18 + 5 * r.taste.quiet
              : d.id === "music"
                ? -7
                : -4
          reasons.push(
            d.id === "cafe"
              ? "warm drinks and covered seating suit a wet afternoon"
              : "the longer exposed approach is less appealing in rain"
          )
        }
        if (request.situation === "performance" && d.id === "music") {
          adjustment = 12 + 15 * r.taste.music + 7 * r.taste.discovery
          reasons.push(
            "a rare intimate acoustic performance adds music and discovery value"
          )
        }
        return {
          residentId: r.id,
          destinationId: d.id,
          score: Math.round(Math.max(0, Math.min(100, base + adjustment))),
          reasons,
          source: "MOCK" as const,
        }
      })
    )
  },
}
