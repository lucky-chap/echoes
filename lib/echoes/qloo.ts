import { z } from "zod"
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
const tagRowSchema = z.object({ tag_id: z.string().min(1), name: z.string().min(1) }).passthrough()

type CacheRow = { value: EchoesEntity[]; expires: number }
const cache = new Map<string, CacheRow>()
const pending = new Map<string, Promise<EchoesEntity[]>>()

export class EchoesQlooError extends Error {
  constructor(
    message: string,
    readonly kind: "configuration" | "authentication" | "rate_limit" | "timeout" | "network" | "response",
    readonly status?: number
  ) {
    super(message)
  }
}

function normalize(payload: unknown, fallbackType: EchoesEntityType) {
  const result = payloadSchema.parse(payload).results
  const rows = Array.isArray(result)
    ? result
    : z.object({ entities: z.array(z.unknown()) }).passthrough().parse(result).entities
  return z.array(rowSchema).parse(rows).flatMap((row): EchoesEntity[] => {
    const type = [row.type, ...(row.types ?? [])].find((value) => validTypes.has(value as EchoesEntityType))
    const entityType = type && validTypes.has(type as EchoesEntityType) ? (type as EchoesEntityType) : fallbackType
    return [{
      entityId: row.entity_id,
      name: row.name,
      type: entityType,
      description: row.description ?? null,
      affinity: row.query?.affinity ?? null,
      properties: row.properties ?? {},
    }]
  })
}

export class EchoesQlooClient {
  private readonly key: string
  constructor(key = process.env.QLOO_API_KEY ?? "") {
    if (!key) throw new EchoesQlooError("Qloo is not configured for this deployment.", "configuration")
    this.key = key
  }

  private async get(path: "/search" | "/v2/insights", params: URLSearchParams, type: EchoesEntityType, ttl = 60 * 60 * 1000) {
    const url = new URL(path, QLOO_ORIGIN)
    url.search = params.toString()
    const cacheKey = url.toString()
    const current = cache.get(cacheKey)
    if (current && current.expires > Date.now()) return current.value
    const shared = pending.get(cacheKey)
    if (shared) return shared
    const request = (async () => {
      let lastError: unknown
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetch(url, {
            headers: { Accept: "application/json", "X-Api-Key": this.key },
            cache: "no-store",
            signal: AbortSignal.timeout(8000),
          })
          if (!response.ok) {
            const kind = response.status === 401 || response.status === 403 ? "authentication" : response.status === 429 ? "rate_limit" : "response"
            throw new EchoesQlooError(`Qloo request failed (HTTP ${response.status}).`, kind, response.status)
          }
          const entities = normalize(await response.json(), type)
          cache.set(cacheKey, { value: entities, expires: Date.now() + ttl })
          return entities
        } catch (error) {
          lastError = error
          if (error instanceof EchoesQlooError && !["rate_limit", "response"].includes(error.kind)) throw error
          if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt))
        }
      }
      if (lastError instanceof EchoesQlooError) throw lastError
      const timeout = lastError instanceof DOMException && lastError.name === "TimeoutError"
      throw new EchoesQlooError(timeout ? "Qloo request timed out." : "Qloo network request failed.", timeout ? "timeout" : "network")
    })()
    pending.set(cacheKey, request)
    try { return await request } finally { pending.delete(cacheKey) }
  }

  search(query: string, type: EchoesEntityType) {
    return this.get("/search", new URLSearchParams({ query, types: type, take: "5" }), type, 24 * 60 * 60 * 1000)
  }

  async tags(query: string) {
    const url = new URL("/v2/tags", QLOO_ORIGIN)
    url.search = new URLSearchParams({ "filter.query": query, take: "5" }).toString()
    const response = await fetch(url, { headers: { Accept: "application/json", "X-Api-Key": this.key }, cache: "no-store", signal: AbortSignal.timeout(8000) })
    if (!response.ok) return []
    try {
      const payload = z.object({ results: z.unknown() }).passthrough().parse(await response.json()).results
      const rows = Array.isArray(payload) ? payload : z.object({ tags: z.array(z.unknown()) }).passthrough().parse(payload).tags
      return z.array(tagRowSchema).parse(rows).filter((tag) => tag.name.localeCompare(query, undefined, { sensitivity: "accent" }) === 0).map((tag) => tag.tag_id)
    } catch { return [] }
  }

  insights(input: {
    type: EchoesEntityType
    entityIds: string[]
    era: { from: number; to: number }
    hometown?: string
    country?: string
    excludedEntityIds?: string[]
    excludedTags?: string[]
    candidateIds?: string[]
  }) {
    const params = new URLSearchParams({
      "filter.type": input.type,
      "signal.interests.entities": input.entityIds.join(","),
      "signal.demographics.age": "55_and_older",
      "bias.trends": "off",
      "filter.popularity.min": "0.35",
      take: "8",
    })
    if (input.type === "urn:entity:book") {
      params.set("filter.publication_year.min", String(input.era.from))
      params.set("filter.publication_year.max", String(input.era.to))
    } else if (input.type === "urn:entity:movie" || input.type === "urn:entity:tv_show") {
      params.set("filter.release_year.min", String(input.era.from))
      params.set("filter.release_year.max", String(input.era.to))
      if (input.country) params.set("filter.release_country", input.country)
    }
    if (input.hometown) params.set("filter.location.query", input.hometown)
    if (input.excludedEntityIds?.length) params.set("filter.exclude.entities", input.excludedEntityIds.join(","))
    if (input.excludedTags?.length) params.set("filter.exclude.tags", input.excludedTags.join(","))
    if (input.candidateIds?.length) params.set("filter.results.entities", input.candidateIds.join(","))
    return this.get("/v2/insights", params, input.type)
  }
}

export async function resolveLovedThings(client: EchoesQlooClient, resident: ResidentInput) {
  const types: EchoesEntityType[] = ["urn:entity:artist", "urn:entity:movie", "urn:entity:tv_show", "urn:entity:book", "urn:entity:place"]
  const attempts = resident.lovedThings.flatMap((name) => types.map(async (type) => {
    try {
      const matches = await client.search(name, type)
      return matches.find((match) => match.name.localeCompare(name, undefined, { sensitivity: "accent" }) === 0) ?? matches[0] ?? null
    } catch { return null }
  }))
  return (await Promise.all(attempts)).filter((item): item is EchoesEntity => item !== null)
}
