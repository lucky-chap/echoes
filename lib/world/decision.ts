import {
  destinations,
  residents,
  destination,
  type DestinationId,
  type ResidentId,
} from "./profiles"
import type { TasteRecommendation } from "./taste-provider"
export interface Alternative {
  id: DestinationId
  scores: Record<ResidentId, number>
  mean: number
  minimum: number
  collective: number
}
export interface Decision {
  alternatives: Alternative[]
  winner: Alternative
  proposals: Record<ResidentId, DestinationId>
  recommendations: TasteRecommendation[]
  explanation: string
}
export function negotiate(recommendations: TasteRecommendation[]): Decision {
  // Reject incomplete or malformed provider results instead of silently inventing scores.
  for (const r of residents)
    for (const d of destinations) {
      const rows = recommendations.filter(
        (s) => s.residentId === r.id && s.destinationId === d.id
      )
      if (
        rows.length !== 1 ||
        !Number.isFinite(rows[0].score) ||
        rows[0].score < 0 ||
        rows[0].score > 100
      )
        throw Error("Incomplete or invalid taste recommendations")
    }
  const alternatives = destinations
    .map((d) => {
      const scores = Object.fromEntries(
        residents.map((r) => [
          r.id,
          recommendations.find(
            (s) => s.residentId === r.id && s.destinationId === d.id
          )!.score,
        ])
      ) as Record<ResidentId, number>
      const values = Object.values(scores),
        mean = values.reduce((a, b) => a + b, 0) / values.length,
        minimum = Math.min(...values)
      return {
        id: d.id,
        scores,
        mean,
        minimum,
        collective: Math.round((0.65 * mean + 0.35 * minimum) * 10) / 10,
      }
    })
    .sort(
      (a, b) =>
        b.collective - a.collective ||
        b.minimum - a.minimum ||
        a.id.localeCompare(b.id)
    )
  const proposals = Object.fromEntries(
    residents.map((r) => [
      r.id,
      [...alternatives].sort(
        (a, b) => b.scores[r.id] - a.scores[r.id] || a.id.localeCompare(b.id)
      )[0].id,
    ])
  ) as Record<ResidentId, DestinationId>
  const winner = alternatives[0]
  return {
    alternatives,
    winner,
    proposals,
    recommendations,
    explanation: `${destination(winner.id).name} balances everyone's preferences: ${winner.collective.toFixed(1)} collective satisfaction (65% group average + 35% lowest score). Individual scores: ${residents.map((r) => `${r.name} ${winner.scores[r.id]}`).join(", ")}. ${alternatives[1].collective === winner.collective ? "Ties favor the highest minimum, then a stable destination ID." : `The next option scores ${alternatives[1].collective.toFixed(1)}.`}`,
  }
}
