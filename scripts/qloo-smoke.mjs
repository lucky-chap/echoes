import { existsSync } from "node:fs"

if (existsSync(".env.local")) process.loadEnvFile(".env.local")
const origin = "https://hackathon.api.qloo.com"
const key = process.env.QLOO_API_KEY
if (!key) {
  console.error("Qloo smoke test skipped: QLOO_API_KEY is not configured.")
  process.exitCode = 2
} else {
  const call = async (path, params = {}) => {
    const url = new URL(path, origin)
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
    const response = await fetch(url, { headers: { Accept: "application/json", "X-Api-Key": key }, signal: AbortSignal.timeout(9000) })
    const text = await response.text()
    let payload
    try { payload = JSON.parse(text) } catch { payload = null }
    return { status: response.status, validJson: Boolean(payload), resultCount: Array.isArray(payload?.results) ? payload.results.length : payload?.results?.entities?.length ?? payload?.results?.tags?.length ?? null }
  }
  const results = { origin, probes: {} }
  try {
    results.probes.search = await call("/search", { query: "The Beatles", types: "urn:entity:artist", take: "1" })
    const seedUrl = new URL("/search", origin); seedUrl.searchParams.set("query", "The Beatles"); seedUrl.searchParams.set("types", "urn:entity:artist"); seedUrl.searchParams.set("take", "1")
    const seedResponse = await fetch(seedUrl, { headers: { Accept: "application/json", "X-Api-Key": key }, signal: AbortSignal.timeout(9000) })
    const seedPayload = await seedResponse.json()
    const entityId = (Array.isArray(seedPayload.results) ? seedPayload.results : seedPayload.results?.entities)?.[0]?.entity_id
    if (!entityId) throw Error("Search did not return a seed entity ID")
    const base = { "filter.type": "urn:entity:movie", "signal.interests.entities": entityId, take: "1" }
    results.probes.insights = await call("/v2/insights", base)
    for (const [name, value] of Object.entries({
      "signal.demographics.age": "55_and_older", "filter.release_year.min": "1960", "filter.release_year.max": "1967", "filter.release_country": "US", "filter.location.query": "Accra", "bias.trends": "off", "filter.popularity.min": "0.35", "filter.exclude.tags": "war", "filter.exclude.entities": entityId, "filter.content_rating": "PG", "filter.results.entities": entityId,
    })) results.probes[name] = await call("/v2/insights", { ...base, [name]: value })
    results.probes.bookYears = await call("/v2/insights", { ...base, "filter.type": "urn:entity:book", "filter.publication_year.min": "1960", "filter.publication_year.max": "1967" })
    results.probes.tags = await call("/v2/tags", { "filter.query": "war", take: "1" })
    console.log(JSON.stringify(results, null, 2))
  } catch (error) {
    console.error(`Qloo smoke test failed: ${error instanceof Error ? error.message : "unknown error"}`)
    process.exitCode = 1
  }
}
