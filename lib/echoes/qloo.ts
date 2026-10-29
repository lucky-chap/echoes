import { z } from "zod"
import {
  readProviderCache,
  writeProviderCache,
  demoMode,
} from "./provider-cache"
import { sameName, normalizeName, aliasNames } from "./names"
import type { EchoesEntity, EchoesEntityType, ResidentInput } from "./types"

export const QLOO_ORIGIN = "https://hackathon.api.qloo.com" as const
const validTypes = new Set<EchoesEntityType>([
  "urn:entity:artist",
  "urn:entity:movie",
  "urn:entity:tv_show",
  "urn:entity:book",
  "urn:entity:place",
])
const payloadSchema = z.object({ results: z.unknown() }).passthrough()
const rowSchema = z
  .object({
    entity_id: z.string().min(1),
    name: z.string().min(1),
    type: z.string().optional(),
    types: z.array(z.string()).optional(),
    description: z.string().nullable().optional(),
    properties: z.record(z.string(), z.unknown()).optional(),
    query: z
      .object({ affinity: z.number().nullable().optional() })
      .passthrough()
      .optional(),
  })
  .passthrough()
const tagRowSchema = z
  .object({
    tag_id: z.string().min(1).optional(),
    id: z.string().min(1).optional(),
    name: z.string().min(1),
    type: z.string().optional(),
  })
  .passthrough()

type CacheRow = { value: EchoesEntity[]; expires: number }
const cache = new Map<string, CacheRow>()
const pending = new Map<string, Promise<EchoesEntity[]>>()

function safeImageUrl(value: unknown) {
  if (value && typeof value === "object" && "url" in value) value = value.url
  if (typeof value !== "string") return undefined
  try {
    const url = new URL(value)
    return url.protocol === "https:" && !url.username && !url.password
      ? url.toString()
      : undefined
  } catch {
    return undefined
  }
}

function imageFromRow(row: Record<string, unknown>) {
  const properties =
    row.properties && typeof row.properties === "object"
      ? (row.properties as Record<string, unknown>)
      : {}
  const candidates = [
    row.image_url,
    row.imageUrl,
    row.image,
    row.thumbnail,
    row.poster,
    properties.image_url,
    properties.imageUrl,
    properties.image,
    properties.thumbnail,
    properties.poster,
    ...(Array.isArray(row.images) ? row.images : []),
    ...(Array.isArray(properties.images) ? properties.images : []),
  ]
  return candidates.map(safeImageUrl).find(Boolean)
}

export class EchoesQlooError extends Error {
  constructor(
    message: string,
    readonly kind:
      | "configuration"
      | "authentication"
      | "rate_limit"
      | "timeout"
      | "network"
      | "response",
    readonly status?: number
  ) {
    super(message)
  }
}

function normalize(payload: unknown, fallbackType: EchoesEntityType) {
  const result = payloadSchema.parse(payload).results
  const rows = Array.isArray(result)
    ? result
    : z
        .object({ entities: z.array(z.unknown()) })
        .passthrough()
        .parse(result).entities
  return z
    .array(rowSchema)
    .parse(rows)
    .flatMap((row): EchoesEntity[] => {
      const type = [row.type, ...(row.types ?? [])].find((value) =>
        validTypes.has(value as EchoesEntityType)
      )
      const entityType =
        type && validTypes.has(type as EchoesEntityType)
          ? (type as EchoesEntityType)
          : fallbackType
      return [
        {
          entityId: row.entity_id,
          name: row.name,
          type: entityType,
          description: row.description ?? null,
          affinity: row.query?.affinity ?? null,
          properties: {
            ...row.properties,
            ...(row.tags ? { tags: row.tags } : {}),
            ...(row.aliases ? { aliases: row.aliases } : {}),
            ...(row.external ? { external: row.external } : {}),
          },
          imageUrl: imageFromRow(row),
        },
      ]
    })
}

export class EchoesQlooClient {
  private readonly key: string
  constructor(
    key = process.env.QLOO_API_KEY ?? "",
    private readonly signal?: AbortSignal
  ) {
    if (!key)
      throw new EchoesQlooError(
        "Qloo is not configured for this deployment.",
        "configuration"
      )
    this.key = key
  }

  private async get(
    path: "/search" | "/v2/insights",
    params: URLSearchParams,
    type: EchoesEntityType,
    ttl = 60 * 60 * 1000
  ) {
    const url = new URL(path, QLOO_ORIGIN)
    url.search = params.toString()
    const cacheKey = url.toString()
    const persisted = readProviderCache<EchoesEntity[]>(`Qloo:${cacheKey}`)
    if (persisted) return persisted.value
    if (process.env.ECHOES_OFFLINE === "true")
      throw new EchoesQlooError("Qloo cache miss while offline", "network")
    const current = cache.get(cacheKey)
    if (current && current.expires > Date.now()) return current.value
    const shared = pending.get(cacheKey)
    if (shared) return shared
    const request = (async () => {
      let lastError: unknown
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await fetch(url, {
            headers: { Accept: "application/json", "X-Api-Key": this.key },
            cache: "no-store",
            signal: this.signal
              ? AbortSignal.any([
                  this.signal,
                  AbortSignal.timeout(demoMode() ? 1500 : 6000),
                ])
              : AbortSignal.timeout(demoMode() ? 1500 : 6000),
          })
          if (!response.ok) {
            const kind =
              response.status === 401 || response.status === 403
                ? "authentication"
                : response.status === 429
                  ? "rate_limit"
                  : "response"
            throw new EchoesQlooError(
              `Qloo request failed (HTTP ${response.status}).`,
              kind,
              response.status
            )
          }
          const entities = normalize(await response.json(), type)
          cache.set(cacheKey, { value: entities, expires: Date.now() + ttl })
          writeProviderCache(`Qloo:${cacheKey}`, entities, "Qloo")
          return entities
        } catch (error) {
          lastError = error
          if (
            error instanceof EchoesQlooError &&
            !["rate_limit", "response"].includes(error.kind)
          )
            throw error
          if (this.signal?.aborted)
            throw new EchoesQlooError(
              "Discovery time budget reached.",
              "timeout"
            )
          if (attempt < 1)
            await new Promise((resolve) => setTimeout(resolve, 250))
        }
      }
      if (lastError instanceof EchoesQlooError) throw lastError
      const timeout =
        lastError instanceof DOMException && lastError.name === "TimeoutError"
      throw new EchoesQlooError(
        timeout ? "Qloo request timed out." : "Qloo network request failed.",
        timeout ? "timeout" : "network"
      )
    })()
    pending.set(cacheKey, request)
    try {
      return await request
    } finally {
      pending.delete(cacheKey)
    }
  }

  async search(query: string, type: EchoesEntityType) {
    const key = `Qloo:resolved-search:${type}:${normalizeName(query).replace(/\s/g, "")}`
    const cached = readProviderCache<EchoesEntity[]>(key)
    if (cached) return cached.value
    const rows = await this.get(
      "/search",
      new URLSearchParams({ query, types: type, take: "5" }),
      type,
      24 * 60 * 60 * 1000
    )
    // Cache interchangeable spellings only after a provider result supports them.
    if (
      rows.some((row) =>
        [row.name, ...aliasNames(row.properties)].some((name) =>
          sameName(name, query)
        )
      )
    )
      writeProviderCache(key, rows, "Qloo")
    return rows
  }

  async tags(query: string, type?: string) {
    const cacheKey = `Qloo:exact-tags:v2:${type ?? "all"}:${normalizeName(query)}`
    const cached = readProviderCache<string[]>(cacheKey)
    if (cached) return cached.value
    if (process.env.ECHOES_OFFLINE === "true") return []
    const url = new URL("/v2/tags", QLOO_ORIGIN)
    url.search = new URLSearchParams({
      "filter.query": query,
      take: "10",
    }).toString()
    const response = await fetch(url, {
      headers: { Accept: "application/json", "X-Api-Key": this.key },
      cache: "no-store",
      signal: this.signal
        ? AbortSignal.any([this.signal, AbortSignal.timeout(8000)])
        : AbortSignal.timeout(8000),
    })
    if (!response.ok) return []
    try {
      const payload = z
        .object({ results: z.unknown() })
        .passthrough()
        .parse(await response.json()).results
      const rows = Array.isArray(payload)
        ? payload
        : z
            .object({ tags: z.array(z.unknown()) })
            .passthrough()
            .parse(payload).tags
      const ids = z
        .array(tagRowSchema)
        .parse(rows)
        .filter(
          (tag) =>
            (!type || tag.type === type) &&
            tag.name.localeCompare(query, undefined, {
              sensitivity: "accent",
            }) === 0
        )
        .flatMap((tag) =>
          (tag.tag_id ?? tag.id) ? [tag.tag_id ?? tag.id!] : []
        )
      writeProviderCache(cacheKey, ids, "Qloo")
      return ids
    } catch {
      return []
    }
  }

  insights(input: {
    type: EchoesEntityType
    entityIds: string[]
    era: { from: number; to: number }
    hometown?: string
    country?: string
    excludedEntityIds?: string[]
    excludedTags?: string[]
    regionalTags?: string[]
    candidateIds?: string[]
    broaden?: boolean
  }) {
    const params = new URLSearchParams({
      "filter.type": input.type,
      "signal.interests.entities": input.entityIds.join(","),
      "bias.trends": "off",
      take: "5",
    })
    if (!input.broaden) params.set("filter.popularity.min", "0.35")
    if (input.type === "urn:entity:book") {
      params.set("filter.publication_year.min", String(input.era.from))
      params.set("filter.publication_year.max", String(input.era.to))
    } else if (input.type === "urn:entity:movie") {
      params.set("filter.release_year.min", String(input.era.from))
      params.set("filter.release_year.max", String(input.era.to))
    }
    // Series can begin before the window and still overlap it; verify the full run locally.
    if (input.type === "urn:entity:tv_show")
      params.set("filter.release_year.max", String(input.era.to))
    if (
      input.country &&
      (input.type === "urn:entity:movie" || input.type === "urn:entity:tv_show")
    )
      params.set("filter.release_country", input.country.trim())
    if (input.type === "urn:entity:artist" && input.regionalTags?.length) {
      params.set("filter.tags", input.regionalTags.join(","))
      params.set("operator.filter.tags", "union")
    }
    // Place radius/location is not a media origin constraint.
    if (input.type === "urn:entity:place" && input.hometown)
      params.set("filter.location.query", input.hometown)
    if (input.excludedEntityIds?.length)
      params.set("filter.exclude.entities", input.excludedEntityIds.join(","))
    if (input.excludedTags?.length)
      params.set("filter.exclude.tags", input.excludedTags.join(","))
    if (input.candidateIds?.length)
      params.set("filter.results.entities", input.candidateIds.join(","))
    return this.get("/v2/insights", params, input.type)
  }
}

export async function resolveLovedThings(
  client: EchoesQlooClient,
  resident: ResidentInput
) {
  const types: EchoesEntityType[] = [
    "urn:entity:artist",
    "urn:entity:movie",
    "urn:entity:tv_show",
    "urn:entity:book",
    "urn:entity:place",
  ]
  const attempts = resident.lovedThings.flatMap((name) =>
    types.map(async (type) => {
      try {
        const matches = await client.search(name, type)
        return matches.find((match) => sameName(match.name, name)) ?? null
      } catch {
        return null
      }
    })
  )
  return (await Promise.all(attempts)).filter(
    (item): item is EchoesEntity => item !== null
  )
}
