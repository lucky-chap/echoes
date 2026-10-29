import type {
  FeedbackRecord,
  KitItem,
  ResidentInput,
  SessionKit,
} from "./types"
import { lookupYearFact } from "./year-facts"
import { lookupMedia } from "./media"
import { planSession, rebalancePlan } from "./planner"
import { coverageSummary } from "./coverage"
import { exclusionsFor } from "./feedback"
import { unsuitable, avoidMatch, relevanceFor } from "./suitability"
import { sentences } from "./text"

/** Re-check only failures: never repeat discovery, resolved names, or completed checks. */
export async function retryDateChecks(
  kit: SessionKit,
  resident: ResidentInput,
  feedback: FeedbackRecord[],
  tools = { year: lookupYearFact, media: lookupMedia }
) {
  const signal = AbortSignal.timeout(
    process.env.DEMO_MODE === "true" ? 12_000 : 60_000
  )
  const excluded = new Set(exclusionsFor(feedback, resident.id))
  const checks = [...(kit.dateChecks ?? [])]
  const items = [...kit.items]
  const added: KitItem[] = []
  for (let i = 0; i < checks.length; i++) {
    const check = checks[i]
    if (check.status !== "unchecked_unavailable") continue
    if (
      excluded.has(check.entity.entityId) ||
      unsuitable(check.entity, resident.sensitivities)
    ) {
      checks.splice(i--, 1)
      continue
    }
    const seedEntity = checks.find(
      (c) => c.entity.entityId === check.seed?.entityId
    )?.entity
    if (
      !check.favorite &&
      !relevanceFor(check.entity, seedEntity, resident).relevant
    )
      continue
    const result = await tools.year(
      check.entity.name,
      check.entity.type,
      [resident],
      signal,
      check.entity
    )
    const evidence = result.evidence
    const verified =
      result.status === "verified" &&
      evidence &&
      evidence.year >= kit.era.from &&
      evidence.year <= kit.era.to &&
      evidence.residentIds.includes(resident.id) &&
      !avoidMatch(evidence.title ?? check.entity.name, resident.sensitivities)
    checks[i] = {
      ...check,
      status: verified
        ? "verified_in_window"
        : result.status === "outside_window"
          ? "verified_out_of_window"
          : result.status === "unavailable"
            ? "unchecked_unavailable"
            : "unknown_date",
      reason: result.reason,
      checkedAt: new Date().toISOString(),
      cached: result.cached,
    }
    if (
      verified &&
      !items.some((item) => item.entityId === check.entity.entityId)
    ) {
      const e = check.entity
      const item: KitItem = {
        seed: check.seed,
        traits: check.traits,
        namedFavorite: check.favorite,
        entityId: e.entityId,
        name: e.name,
        type: e.type,
        kind:
          e.type === "urn:entity:artist"
            ? "music"
            : e.type === "urn:entity:movie"
              ? "film"
              : e.type === "urn:entity:tv_show"
                ? "television"
                : e.type === "urn:entity:book"
                  ? "book"
                  : "place",
        affinity: e.affinity,
        matchedResidentIds: [resident.id],
        yearEvidence: evidence,
        imageUrl: e.imageUrl,
        whyItFits: [
          check.favorite
            ? "A caregiver-supplied favourite, resolved by Qloo"
            : check.seed
              ? `Because you chose ${check.seed.name}, Qloo suggested this item; personal familiarity is unconfirmed`
              : "A Qloo suggestion; personal familiarity is unconfirmed",
          `${evidence.title ?? e.name} (${evidence.year}), dated by ${evidence.source}`,
        ],
        media:
          e.type === "urn:entity:book"
            ? []
            : await tools.media(e, evidence.title, signal),
      }
      item.whyItFits = item.whyItFits.map((s) => sentences([s]))
      items.push(item)
      added.push(item)
    }
  }
  const next: SessionKit = { ...kit, items, dateChecks: checks }
  const summary = coverageSummary(next)
  next.coverage = {
    ...kit.coverage,
    level: summary.level,
    domainCount: new Set(items.map((i) => i.kind)).size,
    percent: items.length ? 100 : 0,
    servedResidentIds: items.length ? [resident.id] : [],
    underservedNames: items.length ? [] : [resident.nickname],
  }
  next.diagnostics = kit.diagnostics
    ? {
        ...kit.diagnostics,
        unavailable: summary.pending.length,
        verified: summary.inWindow,
      }
    : undefined
  // Keep existing activity edits; insert only newly verified media into free slots.
  if (added.length && kit.activities?.length) {
    const mediaCount = kit.activities.filter((a) => a.kind === "media").length
    const newActivities = planSession(resident, added, [])
      .filter((a) => a.kind === "media")
      .slice(0, Math.max(0, 3 - mediaCount))
    const activities = [...kit.activities]
    const at = activities.findIndex(
      (a) => a.kind === "conversation" || a.kind === "closing"
    )
    activities.splice(at < 0 ? activities.length : at, 0, ...newActivities)
    next.activities = rebalancePlan(activities, resident)
    next.prompts = next.activities
      .filter((a) => a.kind !== "media")
      .map((a) => a.prompt)
  }
  next.alternatives = [...(kit.alternatives ?? []), ...added].filter(
    (item, index, list) =>
      list.findIndex((i) => i.entityId === item.entityId) === index
  )
  next.notes = kit.notes.filter(
    (note) =>
      !note.includes("release-date check was unavailable") &&
      !note.startsWith("No verified media") &&
      !(
        (note === "Film or TV date checks are still incomplete." ||
          note === "No film or TV match passed checks.") &&
        next.items.some(
          (item) => item.kind === "film" || item.kind === "television"
        )
      )
  )
  return next
}
