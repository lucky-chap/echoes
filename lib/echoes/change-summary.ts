import type {
  FeedbackRecord,
  KitItem,
  MemoryRecord,
  ResidentInput,
  SessionKit,
} from "./types"
import { normalizeName } from "./names"

export type ChangeReason = "marked engaging last time" | "named favourite"

export interface ChangeSummary {
  kept: { entityId: string; name: string; reason: ChangeReason }[]
  added: { entityId: string; name: string; reason: string }[]
  leftOut: {
    name: string
    reason: "not for us last time" | "caused distress"
  }[]
}

/**
 * Explain a plan using only stored feedback, stored memories and the kit's
 * existing trace. No new ranking or filtering is performed here.
 */
export function changeSummary(
  kit: SessionKit,
  resident: ResidentInput,
  feedback: FeedbackRecord[] = [],
  memories: MemoryRecord[] = []
): ChangeSummary | null {
  const ownFeedback = feedback.filter(
    (record) => record.residentId === resident.id
  )
  const ownMemories = memories.filter(
    (record) => record.residentId === resident.id
  )
  const history = resident.responseHistory ?? []

  const positiveIds = new Set<string>()
  const positiveNames = new Set<string>()
  for (const record of ownFeedback)
    if (record.status === "sparked") positiveIds.add(record.entityId)
  for (const memory of ownMemories) {
    if (memory.response !== "engaged" && memory.response !== "shared_story")
      continue
    if (memory.entityId) positiveIds.add(memory.entityId)
    const name = memory.text.split(":")[0]?.trim()
    if (name) positiveNames.add(normalizeName(name))
  }
  for (const entry of history) {
    if (entry.response !== "sparked") continue
    if (entry.entityId) positiveIds.add(entry.entityId)
    positiveNames.add(normalizeName(entry.item))
  }
  const hasPositive = (item: KitItem) =>
    positiveIds.has(item.entityId) ||
    positiveNames.has(normalizeName(item.name))
  const hasPositiveSeed = (seed: NonNullable<KitItem["seed"]>) =>
    positiveIds.has(seed.entityId) ||
    positiveNames.has(normalizeName(seed.name))

  const kept: ChangeSummary["kept"] = []
  const keptIds = new Set<string>()
  for (const item of kit.items) {
    const responded = hasPositive(item)
    if (!responded && !item.namedFavorite) continue
    kept.push({
      entityId: item.entityId,
      name: item.name,
      reason: responded ? "marked engaging last time" : "named favourite",
    })
    keptIds.add(item.entityId)
  }

  const added: ChangeSummary["added"] = []
  for (const item of kit.items) {
    if (item.namedFavorite || keptIds.has(item.entityId)) continue
    if (!item.seed || item.seed.evidence !== "sparked") continue
    if (!hasPositiveSeed(item.seed)) continue
    const reason = item.whyItFits.find(
      (entry) =>
        entry.startsWith("Because ") && entry.includes(" responded to ")
    )
    if (!reason) continue
    added.push({ entityId: item.entityId, name: item.name, reason })
  }

  // Only react to not-for-us entries already stored on the resident.
  const notForUsNames = new Set(
    history
      .filter((entry) => entry.response === "not_for_us")
      .map((entry) => normalizeName(entry.item))
  )
  const leftOut = new Map<string, ChangeSummary["leftOut"][number]>()
  const remember = (
    name: string,
    reason: ChangeSummary["leftOut"][number]["reason"]
  ) => {
    const key = normalizeName(name)
    const previous = leftOut.get(key)
    if (previous?.reason === "caused distress") return
    leftOut.set(key, { name, reason })
  }
  for (const check of kit.dateChecks ?? [])
    if (check.blocked?.source === "feedback")
      remember(check.entity.name, "caused distress")
  for (const entry of kit.agentTrace) {
    if (entry.outcome !== "excluded") continue
    if (entry.tool === "safety_filter") {
      const match = entry.summary.match(
        /^Excluded (.+?): .*saved distress response/i
      )
      if (match) remember(match[1], "caused distress")
    }
    if (entry.tool === "qloo_score") {
      const match = entry.summary.match(
        /^Deprioritized (.+?): (.*); held back from this plan\.?$/
      )
      if (!match) continue
      if (
        /past not-for-us response/i.test(match[2]) ||
        notForUsNames.has(normalizeName(match[1]))
      )
        remember(match[1], "not for us last time")
    }
  }

  const summary: ChangeSummary = {
    kept,
    added,
    leftOut: [...leftOut.values()],
  }
  const hasStoredFeedback =
    ownFeedback.length > 0 ||
    ownMemories.length > 0 ||
    history.length > 0 ||
    summary.leftOut.length > 0
  if (!hasStoredFeedback) return null
  if (!summary.kept.length && !summary.added.length && !summary.leftOut.length)
    return null
  return summary
}
