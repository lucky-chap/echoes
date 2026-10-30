import {
  unsuitable,
  unsuitableReason,
  avoidMatch,
  matchedAvoidTopic,
  relevanceFor,
  cautionText,
} from "./suitability"
import {
  migrateResidentNotes,
  confirmedPreferences,
  traitEvidence,
} from "./preferences"
import { sentences, logisticsSentence, itemDateLabel } from "./text"
import { assignReplacements } from "./replacements"
import { sameName } from "./names"
import { resolveFavorite } from "./resolution"
import { demoMode } from "./provider-cache"
import { eraWindow } from "./era"
import { exclusionsFor } from "./feedback"
import { EchoesQlooClient } from "./qloo"
import { lookupYearFact } from "./year-facts"
import type { YearResult } from "./year-facts"
import { lookupMedia } from "./media"
import { relevantMemories } from "./memory"
import { generateItemPrompts } from "./prompts"
import { planSession, itemPrompt } from "./planner"
import type {
  AgentTrace,
  DateCheck,
  EchoesEntity,
  EchoesEntityType,
  FeedbackRecord,
  KitItem,
  MemoryRecord,
  ResidentInput,
  SessionKit,
} from "./types"

const domains: EchoesEntityType[] = [
  "urn:entity:artist",
  "urn:entity:movie",
  "urn:entity:tv_show",
  "urn:entity:book",
]
const kindFor = (type: EchoesEntityType): KitItem["kind"] =>
  type === "urn:entity:artist"
    ? "music"
    : type === "urn:entity:movie"
      ? "film"
      : type === "urn:entity:tv_show"
        ? "television"
        : "book"
const unique = (rows: EchoesEntity[]) => [
  ...new Map(
    rows.filter((r) => r.entityId).map((r) => [r.entityId, r])
  ).values(),
]

/** Qloo can supply a publication year for books, where this MVP has no
 * independent book catalogue configured. Unknown or malformed values are never
 * treated as evidence. */
function qlooPublicationYear(entity: EchoesEntity) {
  const properties = entity.properties
  const values = [
    properties.publication_year,
    properties.release_year,
    properties.year,
    properties.publication_date,
    properties.release_date,
  ]
  for (const value of values) {
    const match = String(value ?? "").match(/^(\d{4})/)
    if (match) return Number(match[1])
  }
  return null
}
export interface OrchestratorTools {
  client: Pick<EchoesQlooClient, "search" | "insights"> &
    Partial<Pick<EchoesQlooClient, "tags" | "details">>
  year: typeof lookupYearFact
  media: typeof lookupMedia
  prompts?: typeof generateItemPrompts
}

export { unsuitable } from "./suitability"

/** One policy-driven tool orchestrator; no pretend autonomous agents or invented tool results.
 * At most 64 tool invocations, 16 independent date checks plus two music swap
 * checks, one discovery replan, and a 60s deadline.
 * Individual providers have their own shorter timeouts. Tests inject explicit fixtures.
 */
export async function generateSessionKit(
  input: {
    residents: ResidentInput[]
    feedback: FeedbackRecord[]
    memories?: MemoryRecord[]
  },
  injected?: OrchestratorTools
): Promise<SessionKit> {
  if (input.residents.length !== 1)
    throw Error(
      "Prepare one resident’s session at a time. Small-group planning is not part of this MVP."
    )
  const resident = migrateResidentNotes(input.residents[0])
  const signal = AbortSignal.timeout(
    process.env.ECHOES_WARM_DEMO === "true"
      ? 240_000
      : demoMode()
        ? 12_000
        : 60_000
  )
  let client: OrchestratorTools["client"]
  try {
    client = injected?.client ?? new EchoesQlooClient(undefined, signal)
  } catch {
    client = {
      search: async () => {
        throw Error("Qloo is not configured.")
      },
      insights: async () => {
        throw Error("Qloo is not configured.")
      },
    }
  }
  const tools = {
    client,
    year: injected?.year ?? lookupYearFact,
    media: injected?.media ?? lookupMedia,
  }
  const agentTrace: AgentTrace[] = []
  let calls = 0
  const trace = (
    role: AgentTrace["role"],
    tool: AgentTrace["tool"],
    summary: string,
    outcome: AgentTrace["outcome"] = "ok",
    details?: Pick<AgentTrace, "input" | "output">
  ) => {
    agentTrace.push({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      role,
      tool,
      summary,
      outcome,
      ...details,
    })
  }
  const call = async <T>(
    role: AgentTrace["role"],
    tool: AgentTrace["tool"],
    args: Record<string, unknown>,
    run: () => Promise<T>,
    describe: (value: T) => Record<string, unknown>
  ): Promise<T | null> => {
    if (calls >= 64 || signal.aborted) {
      trace(
        role,
        tool,
        "Tool/time budget reached; no further provider call made.",
        "unavailable"
      )
      return null
    }
    calls++
    try {
      const result = await run()
      const output = describe(result)
      trace(
        role,
        tool,
        `${tool.replaceAll("_", " ")}: ${String(output.summary ?? "completed")}`,
        output.unavailable
          ? "unavailable"
          : output.count === 0
            ? "empty"
            : "ok",
        { input: args, output }
      )
      return result
    } catch (error) {
      trace(
        role,
        tool,
        error instanceof Error ? error.message : "Provider unavailable.",
        "unavailable",
        { input: args }
      )
      return null
    }
  }
  const memory = relevantMemories(input.memories ?? [], resident.id)
  const excluded = new Set([
    ...exclusionsFor(input.feedback, resident.id),
    ...memory
      .filter((m) => m.response === "distress" && m.entityId)
      .map((m) => m.entityId!),
  ])
  const liked = [
    ...new Set([
      ...input.feedback
        .filter(
          (f) =>
            f.residentId === resident.id &&
            f.status === "sparked" &&
            !excluded.has(f.entityId)
        )
        .map((f) => f.entityId),
      ...memory
        .filter(
          (m) =>
            m.entityId &&
            (m.response === "engaged" || m.response === "shared_story") &&
            !excluded.has(m.entityId)
        )
        .map((m) => m.entityId!),
    ]),
  ].slice(-5)
  const likedNames = new Map(
    memory
      .filter((m) => m.entityId && liked.includes(m.entityId))
      .map((m) => [m.entityId!, m.text.split(":")[0] || "a past activity"])
  )
  trace(
    "Response Adapter",
    "memory_read",
    `Retrieved ${memory.length} relevant memories; ${excluded.size} distress exclusions; ${liked.length} previously engaging seeds. Suggestions are not biography.`,
    "ok",
    {
      output: {
        memoryIds: memory.map((m) => m.id),
        excludedIds: [...excluded],
        positiveSeedIds: liked,
      },
    }
  )
  trace(
    "Session Planner",
    "memory_read",
    `Notes preferences confirmed: ${confirmedPreferences(resident).confirmed ? "yes" : "no"}`,
    "ok",
    {
      output: {
        notesReceived: Boolean(resident.notes?.trim()),
        confirmedPreferences: confirmedPreferences(resident),
      },
    }
  )
  const era = eraWindow(resident.birthYear)
  trace(
    "Cultural Researcher",
    "context_research",
    `Research scope: ${resident.hometown}, ${resident.country}; ${era.from}–${era.to}. Location is caregiver-supplied, not a guarantee of cultural fit.`,
    "ok",
    {
      input: { hometown: resident.hometown, country: resident.country, era },
      output: {
        source: "caregiver profile",
        geographicRelevance: "requires review",
      },
    }
  )
  const anchors: EchoesEntity[] = []
  const favoriteNotes: string[] = []
  const favoriteCautions = new Map<string, NonNullable<KitItem["cautions"]>>()
  let resolved = 0
  const resolutionChoices: NonNullable<SessionKit["resolutionChoices"]> = []
  for (const favorite of resident.lovedThings.slice(0, 3)) {
    let lookupUnavailable = false
    const resolution = await resolveFavorite(
      favorite,
      async (query, type) => {
        const rows = await call(
          "Qloo Taste Explorer",
          "qloo_search",
          { query, type },
          () => client.search(query, type),
          (rows) => ({
            count: rows.length,
            entities: rows,
            summary: `${rows.length} Qloo results`,
          })
        )
        if (!rows) lookupUnavailable = true
        return rows ?? []
      },
      resident.resolvedFavorites?.find((choice) =>
        sameName(choice.query, favorite)
      ),
      injected
        ? false
        : (query) =>
            import("./musicbrainz").then((m) => m.searchArtists(query, signal))
    )
    if (resolution.entity) {
      let entity = resolution.entity
      if (entity.type === "urn:entity:artist" && client.details) {
        const rows = await call(
          "Qloo Taste Explorer",
          "qloo_insights",
          {
            entityId: entity.entityId,
            purpose: "named favourite catalogue enrichment",
          },
          () => client.details!(entity),
          (entities) => ({
            count: entities.length,
            entities,
            summary: "Named favourite catalogue metadata",
          })
        )
        const enriched = rows?.find((row) => row.entityId === entity.entityId)
        if (enriched)
          entity = {
            ...entity,
            ...enriched,
            properties: { ...entity.properties, ...enriched.properties },
          }
      }
      anchors.push(entity)
      resolved++
    } else if (resolution.candidates.length)
      resolutionChoices.push({
        query: favorite,
        candidates: resolution.candidates,
      })
    else
      favoriteNotes.push(
        lookupUnavailable
          ? `We couldn’t finish checking your favourite, ${favorite}, because a lookup was unavailable. Try preparing a new kit later.`
          : `We couldn’t find a plausible match for ${favorite}. Add a song or film instead.`
      )
  }
  const history = resident.responseHistory ?? []
  for (const response of history
    .filter((h) => h.response === "sparked")
    .slice(-3)) {
    const anchor = anchors.find((a) => sameName(a.name, response.item))
    let id = anchor?.entityId ?? response.entityId
    if (!id) {
      const type: EchoesEntityType =
        response.domain === "music"
          ? "urn:entity:artist"
          : response.domain === "film"
            ? "urn:entity:movie"
            : response.domain === "television"
              ? "urn:entity:tv_show"
              : response.domain === "book"
                ? "urn:entity:book"
                : "urn:entity:place"
      const rows = await call(
        "Response Adapter",
        "qloo_search",
        { query: response.item, source: "response history" },
        () => client.search(response.item, type),
        (rows) => ({
          count: rows.length,
          entities: rows,
          summary: "Resolve a stored sparked item",
        })
      )
      const matches = rows?.filter((r) => sameName(r.name, response.item)) ?? []
      if (matches.length === 1) id = matches[0].entityId
    }
    if (id && !excluded.has(id)) {
      liked.push(id)
      likedNames.set(id, response.item)
    }
  }
  const seeds = [...new Set([...liked, ...anchors.map((a) => a.entityId)])]
    .filter((id) => !excluded.has(id))
    .slice(0, 3)
  const candidates = unique(anchors)
  const provenance = new Map<string, NonNullable<KitItem["seed"]>>()
  const seedInfo = (id: string): NonNullable<KitItem["seed"]> => ({
    entityId: id,
    name:
      anchors.find((a) => a.entityId === id)?.name ??
      likedNames.get(id) ??
      "a previously engaging item",
    evidence: liked.includes(id) ? "sparked" : "named",
  })
  const candidateScore = (
    candidate: EchoesEntity,
    seed?: NonNullable<KitItem["seed"]>
  ) => {
    const traits = traitEvidence(resident, candidate)
    const anchor = anchors.find((a) => a.entityId === seed?.entityId)
    const shared = anchor
      ? traitEvidence(resident, anchor).traits.filter((t) =>
          traits.traits.includes(t)
        ).length
      : 0
    const relevance = relevanceFor(candidate, anchor, resident)
    const pastNo = history.some(
      (h) => h.response === "not_for_us" && sameName(h.item, candidate.name)
    )
    return (
      (candidate.affinity ?? 0) * 10 +
      traits.matches.length * 8 -
      traits.conflicts.length * 30 -
      (pastNo ? 30 : 0) +
      shared * 3 +
      (relevance.regional ? 35 : 0) +
      relevance.signals.length * 4 +
      (seed?.evidence === "sparked" ? 8 : 3)
    )
  }
  const regionalTagQuery = /^united kingdom|^uk$|^great britain$/i.test(
    resident.country.trim()
  )
    ? "British"
    : /^united states|^usa?$/i.test(resident.country.trim())
      ? "American"
      : resident.country
  const regionalTags = client.tags
    ? ((await call(
        "Qloo Taste Explorer",
        "qloo_search",
        {
          query: regionalTagQuery,
          type: "urn:tag:genre:music",
          purpose: "regional request constraint",
        },
        () => client.tags!(regionalTagQuery, "urn:tag:genre:music"),
        (ids) => ({
          count: ids.length,
          tagIds: ids,
          summary: ids.length
            ? "Resolved regional music tags for request filtering"
            : "No exact regional music tag; local relevance checks remain required",
        })
      )) ?? [])
    : []
  const discover = async (broaden: boolean) => {
    const eligibleSeeds = seeds.filter(
      (id) =>
        !dateChecks.some(
          (check) =>
            check.entity.entityId === id &&
            check.status === "verified_out_of_window" &&
            !verified.some((item) => item.entityId === id)
        )
    )
    for (const seedId of eligibleSeeds) {
      const seed = seedInfo(seedId)
      const requests = domains.map((type) => ({ type, tags: [] as string[] }))
      if (regionalTags.length)
        requests.push({ type: "urn:entity:artist", tags: regionalTags })
      for (const { type, tags } of requests) {
        const result = await call(
          "Qloo Taste Explorer",
          "qloo_insights",
          {
            type,
            seeds: [seedId],
            seed,
            era,
            country: resident.country,
            regionalTags: tags,
            excludedIds: [...excluded],
            broaden,
          },
          () =>
            client.insights({
              type,
              entityIds: [seedId],
              era,
              country: resident.country,
              regionalTags: tags,
              excludedEntityIds: [...excluded],
              broaden,
            }),
          (rows) => ({
            count: rows.length,
            entities: rows,
            seed,
            summary: `${rows.length} ${kindFor(type)} candidates from ${seed.name}, before local filtering`,
          })
        )
        for (const row of result ?? []) {
          const existing = candidates.find((c) => c.entityId === row.entityId)
          if (existing) {
            trace(
              "Qloo Taste Explorer",
              "qloo_score",
              `Deduplicated ${row.name} from ${seed.name}.`,
              "excluded",
              { output: { entityId: row.entityId, seed, reason: "dedupe" } }
            )
            const previous = provenance.get(row.entityId)
            if (
              !previous ||
              candidateScore(row, seed) > candidateScore(existing, previous)
            )
              provenance.set(row.entityId, seed)
          } else {
            candidates.push(row)
            provenance.set(row.entityId, seed)
          }
        }
      }
    }
  }
  const checked = new Set<string>()
  const leftOutSeeds = new Map<
    string,
    { topic: string; source: "caregiver" | "conservative_default" | "feedback" }
  >()
  const verified: KitItem[] = []
  const dateChecks: DateCheck[] = []
  const research: NonNullable<SessionKit["research"]> = []
  let unavailable = 0
  let datedCount = 0
  const verifyPool = async () => {
    // Use provider dates to order the limited independent checks, never to approve a work.
    const startsAfterWindow = (candidate: EchoesEntity) =>
      candidate.type === "urn:entity:artist" && Number(candidate.properties.start_year) > era.to
    const ranked = unique(candidates)
      .filter((c) => !checked.has(c.entityId))
      .sort(
        (a, b) =>
          Number(startsAfterWindow(a)) - Number(startsAfterWindow(b)) ||
          candidateScore(b, provenance.get(b.entityId)) -
          candidateScore(a, provenance.get(a.entityId))
      )
    // Interleave domains after the initial favourite pass so date budgets cover film and TV.
    const queue: EchoesEntity[] = []
    const seedChecks = new Map<string, number>()
    while (ranked.length) {
      for (const type of domains) {
        const available = ranked.filter((c) => c.type === type)
        const eraCandidates = available.filter((c) => !startsAfterWindow(c))
        const key = (c: EchoesEntity) => `${type}:${provenance.get(c.entityId)?.entityId ?? "favourite"}`
        // Give each producing seed a turn, so one favourite cannot consume all swap checks.
        const next = (eraCandidates.length ? eraCandidates : available).sort((a, b) =>
          type === "urn:entity:artist" ? (seedChecks.get(key(a)) ?? 0) - (seedChecks.get(key(b)) ?? 0) : 0)[0]
        if (next) {
          queue.push(...ranked.splice(ranked.indexOf(next), 1))
          seedChecks.set(key(next), (seedChecks.get(key(next)) ?? 0) + 1)
        }
      }
      if (ranked.length && !ranked.some((c) => domains.includes(c.type)))
        queue.push(...ranked.splice(0))
    }
    if (!checked.size)
      queue.sort((a, b) => anchors.indexOf(a) - anchors.indexOf(b))
    for (const candidate of queue) {
      // Reserve two additional music checks for swaps after the mixed-domain pass.
      const dateLimit = candidate.type === "urn:entity:artist" ? 18 : 16
      if (datedCount >= dateLimit || checked.has(candidate.entityId)) {
        trace(
          "Session Planner",
          "qloo_score",
          `Held back ${candidate.name}: date-check budget reached.`,
          "excluded",
          {
            output: {
              entityId: candidate.entityId,
              seed: provenance.get(candidate.entityId),
              reason: "budget",
            },
          }
        )
        continue
      }
      checked.add(candidate.entityId)
      const isFavorite = anchors.some((a) => a.entityId === candidate.entityId)
      const feedbackBlocked = excluded.has(candidate.entityId)
      const avoidReason = unsuitableReason(candidate, resident.sensitivities)
      if (isFavorite && avoidReason && !feedbackBlocked) {
        favoriteCautions.set(candidate.entityId, [
          {
            ...avoidReason,
            topic: avoidReason.topic,
            sourceField: avoidReason.sourceField ?? "provider metadata",
          },
        ])
        trace(
          "Response Adapter",
          "safety_filter",
          `Caution for named favourite ${candidate.name}: ${avoidReason.sourceField ?? "provider metadata"} matches ${avoidReason.topic}; kept because the caregiver named it.`,
          "ok",
          { output: { entityId: candidate.entityId, caution: avoidReason } }
        )
      }
      if (feedbackBlocked || (avoidReason && !isFavorite)) {
        const blocked = feedbackBlocked
          ? ({ topic: "saved distress response", source: "feedback" } as const)
          : avoidReason!
        if (isFavorite) {
          leftOutSeeds.set(candidate.entityId, blocked)
          dateChecks.push({
            entity: candidate,
            seed: provenance.get(candidate.entityId),
            status: "unknown_date",
            reason:
              blocked.source === "conservative_default"
                ? `Held back by the conservative default for ${blocked.topic}.`
                : blocked.source === "feedback"
                  ? `Held back because of the ${blocked.topic}.`
                  : `Held back because provider metadata matches ${blocked.topic}.`,
            favorite: true,
            checkedAt: new Date().toISOString(),
            blocked,
          })
          favoriteNotes.push(
            blocked.source === "conservative_default"
              ? `${candidate.name} was left out by the conservative default for ${blocked.topic}. Use Include anyway if it is suitable for this person.`
              : blocked.source === "feedback"
                ? `${candidate.name} was left out because of the ${blocked.topic}. Use Include anyway if it is suitable for this person.`
                : `${candidate.name} was left out because provider metadata matches ${blocked.topic}. Use Include anyway if it is suitable for this person.`
          )
        }
        if (!isFavorite && (candidate.type === "urn:entity:tv_show" || blocked.source === "conservative_default"))
          favoriteNotes.push(
            `${candidate.name} was left out: ${blocked.source === "conservative_default" ? "conservative default" : "provider metadata"} matched ${blocked.topic}.`
          )
        trace(
          "Response Adapter",
          "safety_filter",
          `Excluded ${candidate.name}: ${blocked.source === "conservative_default" ? "conservative default" : blocked.topic} matched provider metadata.`,
          "excluded",
          { output: { entityId: candidate.entityId, blocked } }
        )
        continue
      }
      const traits = traitEvidence(resident, candidate)
      const score = candidateScore(
        candidate,
        provenance.get(candidate.entityId)
      )
      trace(
        "Session Planner",
        "qloo_score",
        `Ranked ${candidate.name}: ${score.toFixed(1)}.`,
        "ok",
        {
          output: {
            entityId: candidate.entityId,
            seed: provenance.get(candidate.entityId),
            traits,
            score,
          },
        }
      )
      if (
        !isFavorite &&
        (traits.conflicts.length ||
          history.some(
            (h) =>
              h.response === "not_for_us" && sameName(h.item, candidate.name)
          ))
      ) {
        trace(
          "Response Adapter",
          "qloo_score",
          `Deprioritized ${candidate.name}: ${traits.conflicts.join(", ") || "past not-for-us response"}; held back from this plan.`,
          "excluded",
          {
            output: {
              entityId: candidate.entityId,
              seed: provenance.get(candidate.entityId),
              reason: "preference ranking",
              traits,
            },
          }
        )
        continue
      }
      const relevance = relevanceFor(
        candidate,
        anchors.find(
          (a) => a.entityId === provenance.get(candidate.entityId)?.entityId
        ),
        resident
      )
      if (!isFavorite && !relevance.relevant) {
        trace(
          "Session Planner",
          "safety_filter",
          `Held back ${candidate.name}: no person-specific origin, language, availability or producing-seed genre evidence.`,
          "excluded",
          {
            output: {
              entityId: candidate.entityId,
              seed: provenance.get(candidate.entityId),
              reason: "plausibility",
              relevance,
            },
          }
        )
        continue
      }
      // Books use the publication year already in the Qloo payload; preserve the
      // independent-provider allowance for music, film and TV checks.
      if (candidate.type !== "urn:entity:book") datedCount++
      const bookYear =
        candidate.type === "urn:entity:book"
          ? qlooPublicationYear(candidate)
          : null
      const result =
        candidate.type === "urn:entity:book"
          ? await call(
              "Cultural Researcher",
              "era_verify",
              {
                entityId: candidate.entityId,
                name: candidate.name,
                type: candidate.type,
                era,
                seed: provenance.get(candidate.entityId),
              },
              async (): Promise<YearResult> => ({
                status:
                  bookYear && bookYear >= era.from && bookYear <= era.to
                    ? "verified"
                    : bookYear
                      ? "outside_window"
                      : "missing",
                outsideEvidence: bookYear
                  ? {
                      year: bookYear,
                      source: "Qloo" as const,
                      residentIds: [resident.id],
                      title: candidate.name,
                    }
                  : undefined,
                evidence:
                  bookYear && bookYear >= era.from && bookYear <= era.to
                    ? {
                        year: bookYear,
                        source: "Qloo" as const,
                        cached: process.env.ECHOES_OFFLINE === "true",
                        residentIds: [resident.id],
                        title: candidate.name,
                      }
                    : null,
                reason: bookYear
                  ? `Qloo publication year ${bookYear} is ${bookYear >= era.from && bookYear <= era.to ? "within" : "outside"} ${era.from}–${era.to}.`
                  : "Qloo did not supply a publication year for this book.",
              }),
              (result) => ({
                status: result.status,
                evidence: result.evidence,
                summary: result.reason,
              })
            )
          : await call(
              "Cultural Researcher",
              "era_verify",
              {
                entityId: candidate.entityId,
                name: candidate.name,
                type: candidate.type,
                era,
                seed: provenance.get(candidate.entityId),
              },
              () =>
                tools.year(
                  candidate.name,
                  candidate.type,
                  [resident],
                  AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
                  candidate
                ),
              (result) => ({
                status: result.status,
                evidence: result.evidence,
                summary: result.reason,
                unavailable: result.status === "unavailable",
              })
            )
      const status =
        !result || result.status === "unavailable"
          ? "unchecked_unavailable"
          : result.status === "verified" &&
              result.evidence &&
              result.evidence.year >= era.from &&
              result.evidence.year <= era.to &&
              result.evidence.residentIds.includes(resident.id)
            ? "verified_in_window"
            : result.status === "outside_window" ||
                (result.evidence &&
                  (result.evidence.year < era.from ||
                    result.evidence.year > era.to))
              ? "verified_out_of_window"
              : "unknown_date"
      dateChecks.push({
        entity: candidate,
        seed: provenance.get(candidate.entityId),
        traits: traits.traits,
        status,
        reason: result?.reason ?? "Date check budget reached",
        favorite: isFavorite,
        checkedAt: new Date().toISOString(),
        cached: result?.cached,
      })
      if (result?.ranking) {
        trace(
          "Cultural Researcher",
          "qloo_score",
          result.ranking.popularityCoverageIncomplete
            ? `${candidate.name}: popularity coverage incomplete; ranked the checked in-window singles by Qloo notable-song match, official release count, widely-released status, then year.`
            : `${candidate.name}: ranked in-window singles by Qloo notable-song match, official release count, widely-released status, then year.`,
          "ok",
          {
            output: {
              entityId: candidate.entityId,
              popularityCoverageIncomplete:
                result.ranking.popularityCoverageIncomplete,
              candidates: result.ranking.candidates,
              decision: result.ranking.decision,
              minimumLead: result.ranking.minimumLead,
            },
          }
        )
      }
      trace(
        "Cultural Researcher",
        "era_verify",
        `${candidate.name}: ${result?.reason ?? "date check budget reached"}`,
        status === "verified_in_window"
          ? "ok"
          : status === "unchecked_unavailable"
            ? "unavailable"
            : "excluded",
        {
          output: {
            entityId: candidate.entityId,
            seed: provenance.get(candidate.entityId),
            status,
            favorite: isFavorite,
          },
        }
      )
      if (!result || result.status === "unavailable") unavailable++
      if (result?.context)
        research.push({
          context: result.context,
          source: "MusicBrainz",
          url: result.evidence?.url,
        })
      const evidence =
        result?.evidence ?? (isFavorite ? result?.outsideEvidence : undefined)
      if (!evidence) {
        if (isFavorite)
          favoriteNotes.push(
            !result || result.status === "unavailable"
              ? `${candidate.name} was matched by Qloo, but its release-date check was unavailable. It has not been ruled out; try preparing a new kit later.`
              : result.status === "outside_window"
                ? `${candidate.name} remains a named favourite; ${result.originalDateUnknown ? "original date unknown" : "its checked dates fall outside the discovery window"}. Review its favourite row to include it anyway.`
                : `${candidate.name} was matched by Qloo, but we couldn’t verify a release from ${era.from}–${era.to}. It is still a recorded favourite.`
          )
        continue
      }
      // Enforce the invariant here as well as inside the tool boundary.
      if (
        (!isFavorite && (evidence.year < era.from || evidence.year > era.to)) ||
        !evidence.residentIds.includes(resident.id)
      )
        continue
      const workAvoid = matchedAvoidTopic(
        evidence.title ?? candidate.name,
        resident.sensitivities,
        candidate.type === "urn:entity:artist" ||
          candidate.type === "urn:entity:book"
      )
      if (workAvoid) {
        const at = dateChecks.findIndex(
          (c) => c.entity.entityId === candidate.entityId
        )
        if (isFavorite) {
          favoriteCautions.set(candidate.entityId, [
            ...(favoriteCautions.get(candidate.entityId) ?? []),
            { ...workAvoid, sourceField: "selected work title" },
          ])
        } else if (at >= 0) dateChecks.splice(at, 1)
        trace(
          "Response Adapter",
          "safety_filter",
          `Held back ${candidate.name}: ${workAvoid.source === "conservative_default" ? "conservative default" : workAvoid.topic} matched the selected work.`,
          isFavorite ? "ok" : "excluded",
          {
            output: {
              entityId: candidate.entityId,
              seed: provenance.get(candidate.entityId),
              reason: "work safety",
              blocked: workAvoid,
            },
          }
        )
        if (!isFavorite) {
          if (workAvoid.source === "conservative_default")
            favoriteNotes.push(`${candidate.name} was left out by the conservative default for ${workAvoid.topic}. This is separate from the caregiver’s avoid list.`)
          continue
        }
      }
      const seed = provenance.get(candidate.entityId)
      const eraLabel =
        isFavorite && (evidence.year < era.from || evidence.year > era.to)
          ? `${evidence.year < era.from ? "Earlier" : "Later"} than ${era.from}–${era.to}, included because you named it${evidence.year >= resident.birthYear + 5 && evidence.year < era.from ? " · childhood" : ""}`
          : undefined
      const item: KitItem = {
        namedFavorite: isFavorite,
        eraLabel,
        seed,
        traits: traits.traits,
        score,
        cautions: favoriteCautions.get(candidate.entityId),
        entityId: candidate.entityId,
        name: candidate.name,
        type: candidate.type,
        kind: kindFor(candidate.type),
        affinity: candidate.affinity,
        matchedResidentIds: [resident.id],
        yearEvidence: evidence,
        whyItFits: [
          isFavorite
            ? "A caregiver-supplied favourite, resolved by Qloo"
            : liked.includes(candidate.entityId)
              ? `Because ${likedNames.get(candidate.entityId) ?? "this item"} got a response last time, it is included again.`
              : seed?.evidence === "sparked"
                ? `Because ${resident.nickname} responded to ${seed.name} last time, we added ${candidate.name}`
                : seed && leftOutSeeds.has(seed.entityId)
                  ? `Suggested from ${seed.name}, which was left out. Personal familiarity is unconfirmed`
                  : `Because you chose ${seed?.name ?? "a named favourite"}, Qloo suggested this ${candidate.type === "urn:entity:tv_show" ? "TV show" : kindFor(candidate.type)}. Personal familiarity is unconfirmed`,
          evidence.artistLevel
            ? `${candidate.name} has releases in your window: ${era.from}–${era.to}, checked by ${evidence.source}`
            : `${evidence.title ?? candidate.name} (${itemDateLabel({ yearEvidence: evidence } as KitItem, era)}), dated by ${evidence.source}`,
          ...(eraLabel ? [eraLabel] : []),
          ...(favoriteCautions.get(candidate.entityId) ?? []).map(cautionText),
          ...(traits.matches.length
            ? [
                `Chosen because confirmed notes or stored responses mention ${traits.matches.join(", ")}`,
              ]
            : []),
          ...(liked.includes(candidate.entityId)
            ? ["Previously marked engaging by the caregiver"]
            : []),
        ],
        imageUrl: candidate.imageUrl,
      }
      item.media =
        candidate.type === "urn:entity:book"
          ? []
          : ((await call(
              "Session Planner",
              "media_lookup",
              { entityId: candidate.entityId },
              () => tools.media(candidate, evidence.title, signal),
              (links) => ({
                summary:
                  "Provider-checked destinations or explicitly labelled search instructions",
                links,
              })
            )) ?? [])
      item.whyItFits = item.whyItFits.map((reason) => sentences([reason]))
      trace(
        "Session Planner",
        "plan_session",
        sentences(item.whyItFits),
        "ok",
        {
          output: {
            entityId: item.entityId,
            seed,
            notesInfluence: traits.matches,
            namedFavorite: isFavorite,
          },
        }
      )
      verified.push(item)
    }
  }
  // Check explicit favourites before spending time on related discoveries.
  await verifyPool()
  await discover(false)
  await verifyPool()
  if (
    verified.filter((i) => !i.namedFavorite).length < 2 &&
    seeds.length &&
    !signal.aborted &&
    datedCount < 16
  ) {
    trace(
      "Session Planner",
      "replan",
      "Too few suitable, dated activities. One broader discovery pass removes the popularity floor, keeping era and distress rules.",
      "replanned"
    )
    await discover(true)
    await verifyPool()
  }
  if (!verified.length)
    trace(
      "Session Planner",
      "replan",
      "No independently verified media survived. Planning a consent-led conversation and quiet-company option instead; no invented media.",
      "replanned"
    )
  const entityById = new Map(
    candidates.map((entity) => [entity.entityId, entity])
  )
  // Greedy diversity ranking keeps named favourites and makes room for another domain.
  const rankedItems = [...verified].sort(
    (a, b) =>
      Number(Boolean(b.namedFavorite)) - Number(Boolean(a.namedFavorite)) ||
      (b.score ?? 0) - (a.score ?? 0)
  )
  const items: KitItem[] = []
  while (rankedItems.length && items.length < 5) {
    rankedItems.sort(
      (a, b) =>
        (b.score ?? 0) +
        (b.namedFavorite ? 100 : 0) -
        items.filter((i) => i.kind === b.kind).length * 6 -
        ((a.score ?? 0) +
          (a.namedFavorite ? 100 : 0) -
          items.filter((i) => i.kind === a.kind).length * 6)
    )
    items.push(rankedItems.shift()!)
  }
  const screenItem = verified
    .filter((i) => i.kind === "film" || i.kind === "television")
    .sort(
      (a, b) =>
        seeds.indexOf(a.seed?.entityId ?? "") -
          seeds.indexOf(b.seed?.entityId ?? "") ||
        (b.score ?? 0) - (a.score ?? 0)
    )[0]
  if (screenItem && !items.includes(screenItem))
    items.splice(items.length - 1, 1, screenItem)
  if (screenItem) {
    const at = items.indexOf(screenItem)
    if (at > 2) {
      items.splice(at, 1)
      items.splice(2, 0, screenItem)
    }
  }
  const eraFitDiscovery = verified
    .filter((item) => !item.namedFavorite && item.kind === "music")
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]
  if (eraFitDiscovery && !items.includes(eraFitDiscovery)) {
    const replaceAt = items.findLastIndex(
      (item) => !item.namedFavorite && item !== screenItem
    )
    items.splice(
      replaceAt >= 0 ? replaceAt : items.length - 1,
      1,
      eraFitDiscovery
    )
  }
  const screenDiscovery = verified
    .filter(
      (item) =>
        !item.namedFavorite &&
        (item.kind === "television" || item.kind === "film")
    )
    .sort(
      (a, b) =>
        Number(
          Boolean(
            anchors.find(
              (seed) =>
                seed.entityId === b.seed?.entityId && seed.type === b.type
            )
          )
        ) -
          Number(
            Boolean(
              anchors.find(
                (seed) =>
                  seed.entityId === a.seed?.entityId && seed.type === a.type
              )
            )
          ) || (b.score ?? 0) - (a.score ?? 0)
    )[0]
  if (screenDiscovery && !items.includes(screenDiscovery)) {
    if (items.length < 5) items.push(screenDiscovery)
    else {
      const at = items.findLastIndex(
        (item) => !item.namedFavorite && item !== eraFitDiscovery
      )
      if (at >= 0) items.splice(at, 1, screenDiscovery)
    }
  }
  const domainCount = new Set(items.map((item) => item.kind)).size
  const coverageLevel =
    items.length >= 5 && domainCount >= 2
      ? "strong"
      : items.length >= 2
        ? "partial"
        : "thin"
  trace(
    "Session Planner",
    "plan_session",
    `Coverage is ${coverageLevel}: ${items.length} dated items across ${domainCount} domains.`,
    coverageLevel === "strong" ? "ok" : "replanned",
    { output: { coverageLevel, itemCount: items.length, domainCount } }
  )
  const promptResult =
    injected && !injected.prompts
      ? null
      : await (injected?.prompts ?? generateItemPrompts)(
          resident,
          items,
          signal
        )
  if (promptResult) {
    for (const row of promptResult.prompts) {
      const item = items.find((i) => i.entityId === row.entityId)
      if (item) item.prompt = row.prompt
    }
    trace(
      "Session Planner",
      "plan_session",
      `Media prompts: ${promptResult.source}; ${promptResult.attempts} generation attempts.`,
      "ok"
    )
  }
  const activities = planSession(resident, items, memory)
  verified.forEach((item, index) => {
    item.prompt ??= itemPrompt(item, index, resident)
  })
  const plannedIds = new Set(
    activities.flatMap((a) => (a.itemId ? [a.itemId] : []))
  )
  for (const row of assignReplacements(
    verified,
    plannedIds,
    entityById,
    resident
  ))
    trace(
      "Session Planner",
      "qloo_score",
      `Swap choices for ${entityById.get(row.entityId)?.name}: ${row.reason}.`,
      "ok",
      { output: { ...row, purpose: "replacement qualification" } }
    )
  for (const item of verified.filter((i) => !plannedIds.has(i.entityId))) {
    trace(
      "Session Planner",
      "qloo_score",
      `Held as a verified alternative: ${item.name}.`,
      "excluded",
      {
        output: {
          entityId: item.entityId,
          seed: item.seed,
          reason: "running-order capacity",
          score: item.score,
        },
      }
    )
  }
  trace(
    "Session Planner",
    "plan_session",
    `Prepared ${activities.length} activities totalling 30 minutes; ready for caregiver review.`,
    "ok",
    {
      output: {
        activities: activities.map((a) => ({
          title: a.title,
          minutes: a.minutes,
          reason: a.rationale,
        })),
      },
    }
  )
  const discoveries = verified.filter((i) => !i.namedFavorite)
  const notes = [
    ...favoriteNotes,
    ...(!discoveries.some(
      (item) =>
        plannedIds.has(item.entityId) &&
        relevanceFor(entityById.get(item.entityId)!, undefined, resident)
          .regional
    )
      ? ["Few region-specific discoveries found."]
      : []),
    ...(discoveries.length < 2
      ? [
          `Less personalised: few items found from ${resident.country}/${era.from}–${era.to}.`,
        ]
      : []),
    ...(!verified.some((i) => i.kind === "film" || i.kind === "television")
      ? [
          dateChecks.some(
            (check) =>
              check.status === "unchecked_unavailable" &&
              ["urn:entity:movie", "urn:entity:tv_show"].includes(
                check.entity.type
              )
          )
            ? "Film or TV date checks are still incomplete."
            : "No film or TV match passed checks.",
        ]
      : []),
    ...(!verified.some((i) => i.kind === "book")
      ? ["No book match passed checks."]
      : []),
    "Preview all media, check volume and suitability, and follow the person’s lead. Stop the stimulus if distress appears and follow the established comfort approach.",
  ]
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    residents: [
      {
        id: resident.id,
        nickname: resident.nickname,
        language: resident.language,
        hometown: resident.hometown,
      },
    ],
    era,
    items: items.filter((i) => plannedIds.has(i.entityId)),
    alternatives: verified.filter((i) => !plannedIds.has(i.entityId)),
    activities,
    logistics: confirmedPreferences(resident).logistics.map(logisticsSentence),
    dateChecks,
    resolutionChoices,
    research,
    prompts: activities.filter((a) => a.kind !== "media").map((a) => a.prompt),
    aboutMe: {
      title: `A few things for ${resident.nickname}`,
      opening:
        "Caregiver-confirmed profile. Ask what feels welcome today; this is not a memory test.",
      details: [
        `Preferred language: ${resident.language}. Grew up in ${resident.hometown}, ${resident.country}.`,
        `Known favourites (caregiver): ${resident.lovedThings.join(", ")}.`,
        `Topics to avoid: ${resident.sensitivities.join(", ") || "none recorded"}.`,
        ...confirmedPreferences(resident).logistics.map(
          (detail) => `Practical detail: ${logisticsSentence(detail)}`
        ),
        ...(resident.notes
          ? [`Caregiver-confirmed context: ${resident.notes}`]
          : []),
        ...memory
          .filter((m) => m.kind === "observation")
          .slice(-3)
          .map(
            (m) =>
              `${m.createdAt.slice(0, 10)} · Caregiver observation: ${m.text}`
          ),
        "If distress appears: stop the stimulus and follow the established comfort approach.",
      ],
    },
    coverage: {
      percent: items.length ? 100 : 0,
      servedResidentIds: items.length ? [resident.id] : [],
      underservedNames: items.length ? [] : [resident.nickname],
      level: coverageLevel,
      domainCount,
    },
    notes,
    agentTrace,
    diagnostics: {
      resolved,
      requested: resident.lovedThings.length,
      candidates: checked.size,
      verified: verified.length,
      unavailable,
      toolCalls: calls,
    },
  }
}
