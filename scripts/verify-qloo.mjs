import { existsSync } from "node:fs"

if (existsSync(".env.local")) process.loadEnvFile(".env.local")

const origin = "https://hackathon.api.qloo.com"
const configuredOrigin = (process.env.QLOO_BASE_URL || origin).replace(
  /\/$/,
  ""
)
const key = process.env.QLOO_API_KEY
if (!key) {
  console.error(
    "Qloo live verification skipped: QLOO_API_KEY is not configured."
  )
  process.exitCode = 2
} else if (configuredOrigin !== origin) {
  console.error(
    `Qloo live verification refused: QLOO_BASE_URL must be ${origin}`
  )
  process.exitCode = 2
} else {
  const profiles = [
    {
      resident: "mia",
      query: "Before Sunrise",
      seedType: "urn:entity:movie",
      outputType: "urn:entity:movie",
    },
    {
      resident: "kai",
      query: "Kendrick Lamar",
      seedType: "urn:entity:artist",
      outputType: "urn:entity:artist",
    },
    {
      resident: "luna",
      query: "The Little Prince",
      seedType: "urn:entity:book",
      outputType: "urn:entity:book",
    },
  ]
  let searches = 0
  let insights = 0
  const evidence = []
  const request = async (url) => {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "X-Api-Key": key },
      signal: AbortSignal.timeout(Number(process.env.QLOO_TIMEOUT_MS || 7000)),
    })
    if (!response.ok)
      throw Error(`HTTP ${response.status} from ${url.pathname}`)
    return response.json()
  }
  try {
    for (const profile of profiles) {
      const searchUrl = new URL("/search", origin)
      searchUrl.searchParams.set("query", profile.query)
      searchUrl.searchParams.set("types", profile.seedType)
      searchUrl.searchParams.set("take", "5")
      const searchPayload = await request(searchUrl)
      searches++
      const searchRows = Array.isArray(searchPayload.results)
        ? searchPayload.results
        : searchPayload.results?.entities
      const seed = searchRows?.find(
        (row) =>
          typeof row?.entity_id === "string" && typeof row?.name === "string"
      )
      if (!seed) throw Error(`No valid search result for ${profile.resident}`)

      const insightUrl = new URL("/v2/insights", origin)
      insightUrl.searchParams.set("filter.type", profile.outputType)
      insightUrl.searchParams.set("signal.interests.entities", seed.entity_id)
      insightUrl.searchParams.set("feature.explainability", "true")
      insightUrl.searchParams.set("take", "3")
      const insightPayload = await request(insightUrl)
      insights++
      const rows = insightPayload.results?.entities
      if (!Array.isArray(rows) || !rows.length)
        throw Error(`No Insights recommendations for ${profile.resident}`)
      const recommendations = rows
        .filter(
          (row) =>
            typeof row?.entity_id === "string" && typeof row?.name === "string"
        )
        .map((row) => ({ entityId: row.entity_id, name: row.name }))
      if (!recommendations.length)
        throw Error(`Invalid Insights response for ${profile.resident}`)
      evidence.push({
        resident: profile.resident,
        seed: { entityId: seed.entity_id, name: seed.name },
        outputType: profile.outputType,
        recommendations,
      })
    }
    console.log(
      JSON.stringify(
        {
          authenticatedHost: origin,
          successfulRequests: searches + insights,
          searches,
          insights,
          independentlyPersonalized: evidence,
        },
        null,
        2
      )
    )
  } catch (error) {
    console.error(
      `Qloo live verification failed after ${searches + insights} successful requests: ${error instanceof Error ? error.message : "unknown error"}`
    )
    process.exitCode = 1
  }
}
