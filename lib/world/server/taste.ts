import { mockSignals } from "../living/mock"
import type { CulturalSignal, Snapshot } from "../living/types"
import { residents } from "../profiles"
export interface TasteProvider {
  recommend(world: Snapshot): Promise<CulturalSignal[]>
}
export class MockTasteProvider implements TasteProvider {
  async recommend() {
    return mockSignals
  }
}
/** Seed IDs are real cultural entities supplied after Qloo access is granted, never village buildings. */
export class QlooTasteProvider implements TasteProvider {
  async recommend(): Promise<CulturalSignal[]> {
    const signals: CulturalSignal[] = []
    for (const resident of residents) {
      const seeds = process.env[`QLOO_${resident.id.toUpperCase()}_ENTITY_IDS`]
      if (!seeds)
        throw Error(`Qloo cultural seed entities missing for ${resident.name}`)
      const url = new URL("https://hackathon.api.qloo.com/v2/insights")
      url.searchParams.set("filter.type", "urn:entity:artist")
      url.searchParams.set("signal.interests.entities", seeds)
      url.searchParams.set("take", "2")
      const response = await fetch(url, {
        headers: { "X-Api-Key": process.env.QLOO_API_KEY! },
        signal: AbortSignal.timeout(6000),
        cache: "no-store",
      })
      if (!response.ok) throw Error(`Qloo returned HTTP ${response.status}`)
      const data = await response.json()
      const rows = data.results?.entities
      if (!Array.isArray(rows) || !rows.length)
        throw Error("Qloo returned no cultural evidence")
      for (const row of rows.slice(0, 2)) {
        if (typeof row.name !== "string" || typeof row.entity_id !== "string")
          throw Error("Invalid Qloo entity")
        const affinity = row.query?.affinity
        if (
          affinity !== undefined &&
          (typeof affinity !== "number" ||
            !Number.isFinite(affinity) ||
            affinity < 0 ||
            affinity > 1)
        )
          throw Error("Invalid Qloo affinity")
        signals.push({
          residentId: resident.id,
          name: row.name.slice(0, 100),
          category: "artist",
          entityId: row.entity_id,
          affinity: affinity ?? null,
          source: "LIVE Qloo",
        })
      }
    }
    return signals
  }
}
type TasteResult = { signals: CulturalSignal[]; reason: string | null }
let cache: { until: number; result: Promise<TasteResult> } | null = null
export async function culturalSignals(): Promise<TasteResult> {
  if (process.env.QLOO_MODE !== "live" || !process.env.QLOO_API_KEY)
    return {
      signals: mockSignals,
      reason: "Qloo key pending; illustrative cultural interests.",
    }
  // Coalesce concurrent requests and cache failures too, so playback cannot flood Qloo.
  if (!cache || cache.until < Date.now())
    cache = {
      until: Date.now() + 3600000,
      result: new QlooTasteProvider()
        .recommend()
        .then((signals) => ({ signals, reason: null }))
        .catch((e) => ({
          signals: mockSignals,
          reason: e instanceof Error ? e.message : "Qloo unavailable",
        })),
    }
  return cache.result
}
