import { z } from "zod"
import { residents } from "../profiles"
import { compactMetadata } from "../living/metadata"
import type {
  CulturalSignal,
  QlooEntityType,
  Snapshot,
  TasteProfile,
  VerifiedInterest,
} from "../living/types"

export const QLOO_HACKATHON_ORIGIN = "https://hackathon.api.qloo.com" as const
const entityType = z.enum([
  "urn:entity:artist",
  "urn:entity:book",
  "urn:entity:movie",
  "urn:entity:place",
  "urn:entity:tv_show",
  "urn:entity:podcast",
])
const looseRecord = z.record(z.string(), z.unknown())
const rawEntity = z
  .object({
    entity_id: z.string().min(4).max(120),
    name: z.string().min(1).max(240),
    type: z.string().optional(),
    types: z.array(z.string()).optional(),
    subtype: z.string().optional(),
    description: z.string().nullable().optional(),
    properties: looseRecord.optional(),
    query: z
      .object({
        affinity: z.number().finite().nullable().optional(),
        explainability: looseRecord.nullable().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough()

type Fetch = typeof fetch
type CacheEntry<T> = { expires: number; value: T }
const responseCache = new Map<string, CacheEntry<unknown>>()
const pending = new Map<string, Promise<unknown>>()
let nextRequestAt = 0
let lastSuccessfulCall: string | null = null

export class QlooError extends Error {
  constructor(
    message: string,
    readonly kind:
      | "configuration"
      | "authentication"
      | "rate_limit"
      | "timeout"
      | "network"
      | "response",
    readonly status: number | null = null
  ) {
    super(message)
  }
}

export interface QlooEntity {
  entityId: string
  name: string
  type: QlooEntityType
  description: string | null
  properties: Record<string, unknown>
  affinity: number | null
  explainability: Record<string, unknown> | null
}

interface Delivery<T> {
  data: T
  delivery: "live" | "cache"
}

interface ClientOptions {
  apiKey?: string
  baseUrl?: string
  fetch?: Fetch
  timeoutMs?: number
  now?: () => number
  sleep?: (ms: number) => Promise<void>
}

function configuredBaseUrl(value = process.env.QLOO_BASE_URL) {
  const normalized = (value || QLOO_HACKATHON_ORIGIN).replace(/\/$/, "")
  if (normalized !== QLOO_HACKATHON_ORIGIN)
    throw new QlooError(
      `QLOO_BASE_URL must be ${QLOO_HACKATHON_ORIGIN}`,
      "configuration"
    )
  return QLOO_HACKATHON_ORIGIN
}

function rowsFromPayload(payload: unknown, endpoint: "search" | "insights") {
  const root = z.object({ results: z.unknown() }).passthrough().parse(payload)
  const rows = Array.isArray(root.results)
    ? root.results
    : z
        .object({ entities: z.array(z.unknown()) })
        .passthrough()
        .parse(root.results).entities
  const parsed = z.array(rawEntity).parse(rows)
  if (!parsed.length)
    throw new QlooError(
      `Qloo ${endpoint} returned no entities`,
      "response",
      200
    )
  return parsed
}

function normalizeEntity(
  row: z.infer<typeof rawEntity>,
  requestedType: QlooEntityType
): QlooEntity {
  const declared = [row.type, ...(row.types ?? [])].find((candidate) =>
    candidate?.startsWith("urn:entity:")
  )
  const type = entityType.safeParse(declared ?? requestedType)
  return {
    entityId: row.entity_id,
    name: row.name,
    type: type.success ? type.data : requestedType,
    description: row.description ?? null,
    properties: compactMetadata(row.properties ?? {}),
    affinity: row.query?.affinity ?? null,
    explainability: row.query?.explainability
      ? compactMetadata(row.query.explainability)
      : null,
  }
}

export class QlooClient {
  private readonly apiKey: string
  private readonly baseUrl: typeof QLOO_HACKATHON_ORIGIN
  private readonly transport: Fetch
  private readonly timeoutMs: number
  private readonly now: () => number
  private readonly sleep: (ms: number) => Promise<void>
  liveRequests = 0
  cachedRequests = 0
  requestCategories: string[] = []
  lastError: string | null = null

  constructor(options: ClientOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.QLOO_API_KEY ?? ""
    if (!this.apiKey)
      throw new QlooError("Qloo API key is not configured", "configuration")
    this.baseUrl = configuredBaseUrl(options.baseUrl)
    this.transport = options.fetch ?? fetch
    this.timeoutMs = Math.max(
      1000,
      options.timeoutMs ?? Number(process.env.QLOO_TIMEOUT_MS || 7000)
    )
    this.now = options.now ?? Date.now
    this.sleep =
      options.sleep ??
      ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
  }

  private async get<T>(
    pathname: "/search" | "/v2/insights",
    params: URLSearchParams,
    parse: (value: unknown) => T,
    ttlMs: number
  ): Promise<Delivery<T>> {
    const url = new URL(pathname, this.baseUrl)
    url.search = params.toString()
    const key = url.toString()
    const cached = responseCache.get(key) as CacheEntry<T> | undefined
    if (cached && cached.expires > this.now()) {
      this.cachedRequests++
      return { data: cached.value, delivery: "cache" }
    }
    const existing = pending.get(key) as Promise<T> | undefined
    if (existing) {
      try {
        this.cachedRequests++
        return { data: await existing, delivery: "cache" }
      } catch (error) {
        this.lastError =
          error instanceof Error ? error.message : "Qloo request failed"
        if (cached && cached.expires + 24 * 60 * 60 * 1000 > this.now())
          return { data: cached.value, delivery: "cache" }
        throw error
      }
    }
    const request = (async () => {
      let failure: unknown
      for (let attempt = 0; attempt < 2; attempt++) {
        const wait = Math.max(0, nextRequestAt - this.now())
        if (wait) await this.sleep(wait)
        nextRequestAt = this.now() + 250
        try {
          const response = await this.transport(url, {
            method: "GET",
            headers: { Accept: "application/json", "X-Api-Key": this.apiKey },
            cache: "no-store",
            signal: AbortSignal.timeout(this.timeoutMs),
          })
          this.liveRequests++
          if (!response.ok) {
            const kind =
              response.status === 401 || response.status === 403
                ? "authentication"
                : response.status === 429
                  ? "rate_limit"
                  : "response"
            const error = new QlooError(
              kind === "authentication"
                ? `Qloo authentication failed (HTTP ${response.status})`
                : kind === "rate_limit"
                  ? "Qloo rate limit reached (HTTP 429)"
                  : `Qloo request failed (HTTP ${response.status})`,
              kind,
              response.status
            )
            if (
              attempt === 0 &&
              (response.status === 429 || response.status >= 500)
            ) {
              const seconds = Number(response.headers.get("retry-after"))
              await this.sleep(
                Number.isFinite(seconds) ? Math.min(2000, seconds * 1000) : 500
              )
              failure = error
              continue
            }
            throw error
          }
          const result = parse(await response.json())
          lastSuccessfulCall = new Date(this.now()).toISOString()
          responseCache.set(key, { expires: this.now() + ttlMs, value: result })
          return result
        } catch (error) {
          if (error instanceof QlooError) throw error
          if (error instanceof z.ZodError || error instanceof SyntaxError)
            throw new QlooError(
              "Qloo response validation failed",
              "response",
              200
            )
          failure = error
          if (attempt === 0) {
            await this.sleep(350)
            continue
          }
        }
      }
      throw new QlooError(
        failure instanceof DOMException && failure.name === "TimeoutError"
          ? "Qloo request timed out"
          : "Qloo network request failed",
        failure instanceof DOMException && failure.name === "TimeoutError"
          ? "timeout"
          : "network"
      )
    })()
    pending.set(key, request)
    try {
      return { data: await request, delivery: "live" }
    } catch (error) {
      this.lastError =
        error instanceof Error ? error.message : "Qloo request failed"
      if (cached && cached.expires + 24 * 60 * 60 * 1000 > this.now()) {
        this.cachedRequests++
        return { data: cached.value, delivery: "cache" }
      }
      throw error
    } finally {
      pending.delete(key)
    }
  }

  async search(query: string, type: QlooEntityType) {
    this.requestCategories.push(`search:${type}`)
    const params = new URLSearchParams({ query, types: type, take: "5" })
    return this.get(
      "/search",
      params,
      (payload) =>
        rowsFromPayload(payload, "search").map((row) =>
          normalizeEntity(row, type)
        ),
      24 * 60 * 60 * 1000
    )
  }

  async insights(input: {
    type: QlooEntityType
    entityIds: string[]
    excludeEntityIds?: string[]
    locationQuery?: string
    explainability?: boolean
    take?: number
  }) {
    if (!input.entityIds.length)
      throw new QlooError(
        "Qloo Insights requires verified entity IDs",
        "configuration"
      )
    this.requestCategories.push(`insights:${input.type}`)
    const params = new URLSearchParams({
      "filter.type": input.type,
      "signal.interests.entities": input.entityIds.join(","),
      "feature.explainability": String(input.explainability ?? true),
      take: String(Math.max(1, Math.min(5, input.take ?? 3))),
    })
    if (input.excludeEntityIds?.length)
      params.set("filter.exclude.entities", input.excludeEntityIds.join(","))
    if (input.locationQuery)
      params.set("filter.location.query", input.locationQuery)
    return this.get(
      "/v2/insights",
      params,
      (payload) =>
        rowsFromPayload(payload, "insights").map((row) =>
          normalizeEntity(row, input.type)
        ),
      60 * 60 * 1000
    )
  }
}

function chooseSearchResult(
  entities: QlooEntity[],
  name: string,
  type: QlooEntityType
) {
  const exact = entities.find(
    (entity) =>
      entity.type === type &&
      entity.name.localeCompare(name, undefined, { sensitivity: "accent" }) ===
        0
  )
  const compatible = entities.find((entity) => entity.type === type)
  return exact ?? compatible ?? null
}

export interface CulturalIntelligenceResult {
  signals: CulturalSignal[]
  tasteProfiles: TasteProfile[]
  reason: string | null
  diagnostics: {
    configured: boolean
    baseUrl: typeof QLOO_HACKATHON_ORIGIN
    lastSuccessfulCall: string | null
    requestCategories: string[]
    cacheStatus: "hit" | "miss" | "mixed" | "none"
    lastError: string | null
    recommendations: number
    liveRequests: number
    cachedRequests: number
  }
}

export async function culturalIntelligence(
  world: Snapshot,
  clientFactory: () => QlooClient = () => new QlooClient()
): Promise<CulturalIntelligenceResult> {
  const emptyDiagnostics = {
    configured: Boolean(process.env.QLOO_API_KEY),
    baseUrl: QLOO_HACKATHON_ORIGIN,
    lastSuccessfulCall,
    requestCategories: [] as string[],
    cacheStatus: "none" as const,
    lastError: null as string | null,
    recommendations: 0,
    liveRequests: 0,
    cachedRequests: 0,
  }
  let client: QlooClient
  try {
    client = clientFactory()
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Qloo is unavailable"
    return {
      signals: [],
      tasteProfiles: world.tasteProfiles,
      reason,
      diagnostics: { ...emptyDiagnostics, lastError: reason },
    }
  }
  const profiles = structuredClone(world.tasteProfiles)
  const signals: CulturalSignal[] = []
  let lastError: string | null = null
  for (const resident of residents) {
    const profile = profiles.find((item) => item.residentId === resident.id)!
    for (const configured of profile.configuredInterests) {
      if (
        profile.verifiedInterests.some(
          (interest) =>
            interest.name === configured.name &&
            interest.type === configured.type
        )
      )
        continue
      try {
        const result = await client.search(configured.name, configured.type)
        const match = chooseSearchResult(
          result.data,
          configured.name,
          configured.type
        )
        if (!match)
          throw new QlooError(
            `Qloo could not verify ${configured.name} for ${resident.name}`,
            "response"
          )
        const verified: VerifiedInterest = {
          entityId: match.entityId,
          name: match.name,
          type: match.type,
          initial: true,
          weight: configured.weight,
          verifiedAt: new Date().toISOString(),
        }
        profile.verifiedInterests.push(verified)
        profile.lastUpdated = verified.verifiedAt
      } catch (error) {
        lastError =
          error instanceof Error ? error.message : "Qloo search failed"
      }
    }
    const eligibleLearned = world.discoveries
      .filter(
        (discovery) =>
          discovery.residentId === resident.id && discovery.status === "liked"
      )
      .map((discovery) => discovery.entityId)
    const entityIds = [
      ...profile.verifiedInterests.map((interest) => interest.entityId),
      ...eligibleLearned,
    ].slice(-8)
    if (!entityIds.length) continue
    const excluded = world.discoveries
      .filter((discovery) => discovery.residentId === resident.id)
      .map((discovery) => discovery.entityId)
      .slice(-20)
    try {
      const result = await client.insights({
        type: resident.discoveryType,
        entityIds,
        excludeEntityIds: excluded,
        explainability: true,
        take: 3,
      })
      const requestedAt = new Date().toISOString()
      for (const entity of result.data) {
        signals.push({
          residentId: resident.id,
          name: entity.name,
          category: entity.type.slice(
            "urn:entity:".length
          ) as CulturalSignal["category"],
          entityId: entity.entityId,
          affinity: entity.affinity,
          description: entity.description,
          properties: entity.properties,
          explainability: entity.explainability,
          source: result.delivery === "live" ? "LIVE Qloo" : "CACHED Qloo",
          provenance: {
            provider: "Qloo",
            endpoint: "/v2/insights",
            requestedAt,
            requestCategory: resident.discoveryType,
            signalEntityIds: entityIds,
            excludedEntityIds: excluded,
            delivery: result.delivery,
          },
        })
      }
    } catch (error) {
      lastError =
        error instanceof Error ? error.message : "Qloo Insights failed"
    }
  }
  const cacheStatus =
    client.liveRequests && client.cachedRequests
      ? "mixed"
      : client.cachedRequests
        ? "hit"
        : client.liveRequests
          ? "miss"
          : "none"
  return {
    signals,
    tasteProfiles: profiles,
    reason: lastError ?? client.lastError,
    diagnostics: {
      configured: true,
      baseUrl: QLOO_HACKATHON_ORIGIN,
      lastSuccessfulCall,
      requestCategories: [...new Set(client.requestCategories)],
      cacheStatus,
      lastError: lastError ?? client.lastError,
      recommendations: signals.length,
      liveRequests: client.liveRequests,
      cachedRequests: client.cachedRequests,
    },
  }
}

export function resetQlooClientForTests() {
  responseCache.clear()
  pending.clear()
  nextRequestAt = 0
  lastSuccessfulCall = null
}
