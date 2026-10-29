// Live, fictional-profile feasibility audit. No generated recommendations or keys in output.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
require("./echoes-runtime.cjs")
const { musicBrainz } = require("../lib/echoes/musicbrainz.ts")
function compactEntity(entity) {
  const properties = entity.properties ?? {}
  const external = entity.external ?? properties.external ?? {}
  return {
    entity_id: entity.entity_id,
    name: entity.name,
    types: entity.types,
    properties: Object.fromEntries(
      [
        "release_year",
        "release_date",
        "start_year",
        "end_year",
        "place_of_birth",
        "release_country",
        "filming_location",
        "primary_genres",
        "genres",
      ]
        .filter((k) => properties[k] !== undefined)
        .map((k) => [k, properties[k]])
    ),
    external: Object.fromEntries(
      ["musicbrainz", "spotify", "youtube"]
        .filter((k) => external[k])
        .map((k) => [k, external[k]])
    ),
  }
}
if (process.argv.includes("--compact-existing")) {
  const report = JSON.parse(readFileSync("docs/qloo-feasibility.json", "utf8"))
  for (const profile of report.profiles)
    for (const result of [...profile.resolution, ...profile.domains])
      result.results = result.results.map(compactEntity)
  writeFileSync(
    "docs/qloo-feasibility.json",
    JSON.stringify(report, null, 2) + "\n"
  )
  console.log(
    "Compacted the existing live artifact without new network calls; names, IDs, dates, geography and provider identifiers retained."
  )
  process.exit(0)
}
if (existsSync(".env.local")) process.loadEnvFile(".env.local")
if (!process.env.QLOO_API_KEY)
  throw Error("QLOO_API_KEY is required for a live audit")
const profiles = [
  {
    label: "Ghanaian highlife",
    birthYear: 1970,
    hometown: "Accra",
    country: "Ghana",
    favorites: ["Daddy Lumba", "Osibisa"],
  },
  {
    label: "British rock",
    birthYear: 1945,
    hometown: "Liverpool",
    country: "United Kingdom",
    favorites: ["The Beatles", "The Rolling Stones"],
  },
  {
    label: "American soul",
    birthYear: 1944,
    hometown: "Detroit",
    country: "United States",
    favorites: ["Aretha Franklin", "Otis Redding"],
  },
]
let calls = 0
async function request(url, headers = {}) {
  if (++calls > 32) throw Error("Audit request budget exhausted")
  try {
    if (url.hostname === "musicbrainz.org") {
      const result = await musicBrainz(
        url.pathname,
        Object.fromEntries(url.searchParams)
      )
      return { status: 200, body: result.data, cached: result.cached }
    }
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(12000),
    })
    const body = await response.json()
    return { status: response.status, body }
  } catch (error) {
    return {
      status: error.status ?? null,
      error:
        error.kind ??
        (error.name === "TimeoutError" ? "timeout" : "network or invalid JSON"),
    }
  }
}
async function qloo(path, params) {
  const url = new URL(path, "https://hackathon.api.qloo.com")
  url.search = new URLSearchParams(params)
  const response = await request(url, {
    Accept: "application/json",
    "X-Api-Key": process.env.QLOO_API_KEY,
  })
  const rows = Array.isArray(response.body?.results)
    ? response.body.results
    : (response.body?.results?.entities ?? [])
  return {
    status: response.status,
    error: response.error ?? response.body?.error ?? response.body?.message,
    results: rows.map(compactEntity),
  }
}
async function yearFact(name, type, window) {
  if (type !== "artist") {
    if (!process.env.TMDB_API_KEY)
      return { source: "TMDB", status: "not configured" }
    const url = new URL(`https://api.themoviedb.org/3/search/${type}`)
    url.search = new URLSearchParams({
      api_key: process.env.TMDB_API_KEY,
      query: name,
    })
    const response = await request(url)
    const exact = response.body?.results?.find(
      (r) => (r.title ?? r.name)?.toLowerCase() === name.toLowerCase()
    )
    const date = exact?.release_date ?? exact?.first_air_date
    const year = date ? Number(date.slice(0, 4)) : null
    return {
      source: "TMDB",
      status: response.status,
      error: response.error,
      exactMatch: Boolean(exact),
      date,
      inWindow: year ? year >= window.from && year <= window.to : null,
    }
  }
  const headers = {
    Accept: "application/json",
  }
  const url = new URL("https://musicbrainz.org/ws/2/artist/")
  url.search = new URLSearchParams({
    query: `artist:"${name}"`,
    fmt: "json",
    limit: "5",
  })
  const response = await request(url, headers)
  const artist = response.body?.artists?.find(
    (a) => a.name.toLowerCase() === name.toLowerCase()
  )
  if (!artist)
    return {
      source: "MusicBrainz",
      status: response.status,
      error: response.error,
      exactMatch: false,
    }
  const releases = new URL("https://musicbrainz.org/ws/2/release-group/")
  releases.search = new URLSearchParams({
    artist: artist.id,
    fmt: "json",
    limit: "100",
  })
  const result = await request(releases, headers)
  const works = (result.body?.["release-groups"] ?? [])
    .map((r) => ({ title: r.title, date: r["first-release-date"] }))
    .filter((r) => r.date)
  return {
    source: "MusicBrainz",
    status: result.status,
    error: result.error,
    artistId: artist.id,
    works,
    inWindow: works.some(
      (r) =>
        Number(r.date.slice(0, 4)) >= window.from &&
        Number(r.date.slice(0, 4)) <= window.to
    ),
    truncated: result.body?.["release-group-count"] > 100,
  }
}
const report = {
  live: true,
  startedAt: new Date().toISOString(),
  origin: "https://hackathon.api.qloo.com",
  profiles: [],
  limitations: [
    "Fictional profiles only. Taste affinity is not proof of personal preference or geographical relevance.",
    "Geography is recorded only from returned metadata; missing evidence is unknown, not culturally relevant by assumption.",
    "Baseline discovery is deliberately not year-filtered, to distinguish catalogue coverage from the independent era gate.",
    "Independent providers can fail; an unavailable date is not an out-of-window date.",
    "No playback URL is verified by this audit. Raw provider URLs, if present, are not endorsements.",
  ],
}
for (const profile of profiles) {
  const window = { from: profile.birthYear + 13, to: profile.birthYear + 25 }
  const resolution = []
  for (const name of profile.favorites)
    resolution.push({
      query: name,
      ...(await qloo("/search", {
        query: name,
        types: "urn:entity:artist",
        take: "5",
      })),
    })
  const seeds = resolution
    .flatMap((r) =>
      r.results.filter((e) => e.name.toLowerCase() === r.query.toLowerCase())
    )
    .map((e) => e.entity_id)
  const domains = []
  if (seeds.length)
    for (const [type, dateType] of [
      ["artist", "artist"],
      ["movie", "movie"],
      ["tv_show", "tv"],
    ]) {
      const response = await qloo("/v2/insights", {
        "filter.type": `urn:entity:${type}`,
        "signal.interests.entities": seeds.join(","),
        "bias.trends": "off",
        take: "5",
      })
      const first = response.results[0]
      domains.push({
        type,
        ...response,
        firstResultYearCheck: first
          ? await yearFact(first.name, dateType, window)
          : null,
      })
    }
  report.profiles.push({
    ...profile,
    window,
    resolution,
    resolvedFavorites: seeds.length,
    domains,
  })
  console.log(
    `${profile.label}: ${seeds.length}/${profile.favorites.length} exact favorites; ${domains.map((d) => `${d.type}=${d.results.length} (HTTP ${d.status})`).join(", ")}`
  )
}
report.finishedAt = new Date().toISOString()
report.requests = calls
mkdirSync("docs", { recursive: true })
writeFileSync(
  "docs/qloo-feasibility.json",
  JSON.stringify(report, null, 2) + "\n"
)
console.log("Live evidence written to docs/qloo-feasibility.json")
