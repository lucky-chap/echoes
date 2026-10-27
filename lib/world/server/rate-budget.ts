import type { ResidentId } from "../profiles"

export interface Clock {
  now(): number
}

export class SceneRateBudget {
  private entries: { at: number; bucket: ResidentId | "shared" }[] = []
  constructor(private readonly clock: Clock = { now: () => Date.now() }) {}

  private reset() {
    this.entries = this.entries.filter(
      (entry) => entry.at > this.clock.now() - 60000
    )
  }

  charge(candidates: ResidentId[]) {
    const usage = this.snapshot()
    if (!candidates.length || usage.total >= 25) return null
    const lead = candidates.find((id) => usage.residents[id] < 6)
    if (lead) {
      this.entries.push({ at: this.clock.now(), bucket: lead })
      return lead
    }
    if (usage.shared >= 7) return null
    this.entries.push({ at: this.clock.now(), bucket: "shared" })
    return candidates[0] ?? null
  }

  snapshot() {
    this.reset()
    const residents = { mia: 0, kai: 0, luna: 0 }
    let shared = 0
    for (const entry of this.entries) {
      if (entry.bucket === "shared") shared++
      else residents[entry.bucket]++
    }
    return { total: this.entries.length, shared, residents }
  }
}

// Process-local smoothing supplements the durable quota ledger. It is not an
// authorization mechanism: `reserve` remains the cross-request authority.
export const sceneRateBudget = new SceneRateBudget()
