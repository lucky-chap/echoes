import type { AgentTrace, EchoesKind, SessionKit } from "./types"

export type HeldBackReason =
  "outside_years" | "region" | "avoid_topic" | "other"

export interface QlooAddedSummary {
  candidatesByDomain: { kind: EchoesKind; count: number }[]
  passedChecks: number
  heldBack: { reason: HeldBackReason; count: number }[]
  filters: {
    country?: string
    years?: string
    regionalTag?: string
  }
  hasData: boolean
}

const domainOrder: EchoesKind[] = [
  "music",
  "film",
  "television",
  "book",
  "place",
]

const domainForType = (type: unknown): EchoesKind | undefined => {
  switch (type) {
    case "urn:entity:artist":
      return "music"
    case "urn:entity:movie":
      return "film"
    case "urn:entity:tv_show":
      return "television"
    case "urn:entity:book":
      return "book"
    case "urn:entity:place":
      return "place"
    default:
      return undefined
  }
}

const numberValue = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined

const textValues = (value: unknown) =>
  Array.isArray(value)
    ? value.filter(
        (entry): entry is string => typeof entry === "string" && Boolean(entry)
      )
    : []

const traceEntityId = (entry: AgentTrace) => {
  const id = entry.output?.entityId
  return typeof id === "string" && id ? id : undefined
}

const traceEntityType = (entry: AgentTrace) => {
  const type = entry.input?.type
  if (typeof type === "string") return type
  const entities = entry.output?.entities
  if (!Array.isArray(entities)) return undefined
  const first = entities.find((entity): entity is { type: string } =>
    Boolean(
      entity &&
      typeof entity === "object" &&
      typeof (entity as { type?: unknown }).type === "string"
    )
  )
  return first?.type
}

/**
 * Build the transparency panel from the kit's existing trace. This does not
 * call Qloo, rescore anything, or make a prediction about the resident.
 */
export function qlooAdded(
  kit: Pick<SessionKit, "agentTrace">
): QlooAddedSummary {
  const candidates = new Map<EchoesKind, number>()
  const passed = new Set<string>()
  const heldBack = new Map<string, HeldBackReason>()
  const countries = new Set<string>()
  const eras = new Set<string>()
  const regionalTags = new Set<string>()
  let sawItemPlan = false

  const hold = (entityId: string, reason: HeldBackReason) => {
    const priority: Record<HeldBackReason, number> = {
      other: 0,
      outside_years: 1,
      region: 2,
      avoid_topic: 3,
    }
    const previous = heldBack.get(entityId)
    if (!previous || priority[reason] > priority[previous])
      heldBack.set(entityId, reason)
  }

  for (const entry of kit.agentTrace ?? []) {
    if (entry.tool === "qloo_insights") {
      const kind = domainForType(traceEntityType(entry))
      const count =
        numberValue(entry.output?.count) ??
        (Array.isArray(entry.output?.entities)
          ? entry.output.entities.length
          : 0)
      if (kind && count > 0)
        candidates.set(kind, (candidates.get(kind) ?? 0) + count)

      const country = entry.input?.country
      if (typeof country === "string" && country.trim())
        countries.add(country.trim())
      const era = entry.input?.era
      if (era && typeof era === "object") {
        const from = numberValue((era as { from?: unknown }).from)
        const to = numberValue((era as { to?: unknown }).to)
        if (from !== undefined && to !== undefined) eras.add(`${from}–${to}`)
      }
      for (const tag of textValues(entry.input?.regionalTags))
        regionalTags.add(tag)
    }

    if (entry.tool === "plan_session" && traceEntityId(entry)) {
      sawItemPlan = true
      if (entry.output?.namedFavorite !== true)
        passed.add(traceEntityId(entry)!)
    }

    if (entry.outcome !== "excluded") continue
    const entityId = traceEntityId(entry)
    if (!entityId) continue

    if (entry.tool === "era_verify") {
      if (entry.output?.favorite === true) continue
      if (entry.output?.status === "verified_out_of_window")
        hold(entityId, "outside_years")
      else hold(entityId, "other")
      continue
    }

    if (entry.tool === "safety_filter") {
      if (entry.output?.reason === "plausibility") hold(entityId, "region")
      else if (entry.output?.reason === "work safety" || entry.output?.blocked)
        hold(entityId, "avoid_topic")
      else hold(entityId, "other")
      continue
    }

    if (entry.tool === "qloo_score") {
      const reason = entry.output?.reason
      if (reason === "dedupe" || reason === "running-order capacity") continue
      hold(entityId, "other")
      continue
    }

    hold(entityId, "other")
  }

  // Older kits may predate the per-item planning trace. Fall back to the
  // independent date-check result rather than inventing a count.
  if (!sawItemPlan) {
    for (const entry of kit.agentTrace ?? []) {
      if (entry.tool !== "era_verify") continue
      if (
        entry.outcome === "ok" &&
        entry.output?.status === "verified_in_window" &&
        entry.output?.favorite !== true
      ) {
        const entityId = traceEntityId(entry)
        if (entityId) passed.add(entityId)
      }
    }
  }

  const heldBackSummary = (
    ["outside_years", "region", "avoid_topic", "other"] as const
  )
    .map((reason) => ({
      reason,
      count: [...heldBack.values()].filter((value) => value === reason).length,
    }))
    .filter((entry) => entry.count > 0)

  const filters = {
    country: countries.size ? [...countries].join(" / ") : undefined,
    years: eras.size ? [...eras].join(" / ") : undefined,
    regionalTag: regionalTags.size ? [...regionalTags].join(" / ") : undefined,
  }

  const candidatesByDomain = domainOrder
    .map((kind) => ({ kind, count: candidates.get(kind) ?? 0 }))
    .filter((entry) => entry.count > 0)

  return {
    candidatesByDomain,
    passedChecks: passed.size,
    heldBack: heldBackSummary,
    filters,
    hasData: Boolean(
      candidatesByDomain.length ||
      passed.size ||
      heldBackSummary.length ||
      filters.country ||
      filters.years ||
      filters.regionalTag
    ),
  }
}

/** The source chip is decided only from stored item provenance. */
export function planItemSource(
  item: { namedFavorite?: boolean } | undefined,
  manuallyNamed = false
): "named" | "qloo" | undefined {
  if (manuallyNamed || item?.namedFavorite) return "named"
  return item ? "qloo" : undefined
}
