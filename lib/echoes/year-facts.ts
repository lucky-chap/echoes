import { eraWindow } from "./era"
import type { EchoesEntityType, ResidentInput } from "./types"

export interface YearEvidence {
  year: number
  source: "MusicBrainz" | "TMDB"
  residentIds: string[]
}

type CachedEvidence = { evidence: YearEvidence | null; expiresAt: number }
const cache = new Map<string, CachedEvidence>()
let nextMusicBrainzRequestAt = 0
let musicBrainzQueue: Promise<void> = Promise.resolve()

async function musicBrainzFetch(url: URL) {
  const previous = musicBrainzQueue
  let releaseQueue!: () => void
  musicBrainzQueue = new Promise((resolve) => { releaseQueue = resolve })
  await previous
  const wait = Math.max(0, nextMusicBrainzRequestAt - Date.now())
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait))
  nextMusicBrainzRequestAt = Date.now() + 1_050
  try {
    return await fetch(url, { headers: { Accept: "application/json", "User-Agent": "EchoesReminiscenceKit/1.0 (contact: hello@echoes.local)" }, signal: AbortSignal.timeout(8000) })
  } finally {
    releaseQueue()
  }
}

function yearFromDate(value: unknown) {
  const match = typeof value === "string" ? /^(\d{4})/.exec(value) : null
  const year = match ? Number(match[1]) : NaN
  return Number.isInteger(year) ? year : null
}

export function yearEvidenceFor(year: number, source: YearEvidence["source"], residents: ResidentInput[]): YearEvidence | null {
  const residentIds = residents.filter((resident) => {
    const window = eraWindow(resident.birthYear)
    return year >= window.from && year <= window.to
  }).map((resident) => resident.id)
  return residentIds.length ? { year, source, residentIds } : null
}

function residentsForYear(year: number, residents: ResidentInput[]) {
  return yearEvidenceFor(year, "MusicBrainz", residents)?.residentIds ?? []
}

async function musicBrainzEvidence(name: string, residents: ResidentInput[]) {
  const searchUrl = new URL("https://musicbrainz.org/ws/2/artist/")
  searchUrl.search = new URLSearchParams({ query: `artist:${name}`, fmt: "json", limit: "1" }).toString()
  const search = await musicBrainzFetch(searchUrl)
  if (!search.ok) return null
  const artists = (await search.json() as { artists?: { id?: string; name?: string }[] }).artists ?? []
  const artist = artists.find((result) => result.name?.localeCompare(name, undefined, { sensitivity: "accent" }) === 0) ?? artists[0]
  if (!artist?.id) return null
  const releasesUrl = new URL("https://musicbrainz.org/ws/2/release-group/")
  releasesUrl.search = new URLSearchParams({ artist: artist.id, fmt: "json", limit: "100" }).toString()
  const releases = await musicBrainzFetch(releasesUrl)
  if (!releases.ok) return null
  const groups = (await releases.json() as { "release-groups"?: { "first-release-date"?: string }[] })["release-groups"] ?? []
  for (const group of groups) {
    const year = yearFromDate(group["first-release-date"])
    if (!year) continue
    const residentIds = residentsForYear(year, residents)
    if (residentIds.length) return { year, source: "MusicBrainz" as const, residentIds }
  }
  return null
}

async function tmdbEvidence(name: string, type: "movie" | "tv", residents: ResidentInput[]) {
  const key = process.env.TMDB_API_KEY
  if (!key) return null
  const endpoint = type === "movie" ? "movie" : "tv"
  const url = new URL(`https://api.themoviedb.org/3/search/${endpoint}`)
  url.search = new URLSearchParams({ api_key: key, query: name, include_adult: "false", language: "en-US", page: "1" }).toString()
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000), cache: "no-store" })
  if (!response.ok) return null
  const results = (await response.json() as { results?: { title?: string; name?: string; release_date?: string; first_air_date?: string }[] }).results ?? []
  const result = results.find((item) => (item.title ?? item.name)?.localeCompare(name, undefined, { sensitivity: "accent" }) === 0) ?? results[0]
  const year = yearFromDate(result?.release_date ?? result?.first_air_date)
  if (!year) return null
  const residentIds = residentsForYear(year, residents)
  return residentIds.length ? { year, source: "TMDB" as const, residentIds } : null
}

export async function verifyYearFact(name: string, type: EchoesEntityType, residents: ResidentInput[]): Promise<YearEvidence | null> {
  const key = `${type}:${name.toLocaleLowerCase()}:${residents.map((resident) => resident.birthYear).sort().join(",")}`
  const prior = cache.get(key)
  if (prior && prior.expiresAt > Date.now()) return prior.evidence
  let evidence: YearEvidence | null = null
  try {
    if (type === "urn:entity:artist") evidence = await musicBrainzEvidence(name, residents)
    if (type === "urn:entity:movie") evidence = await tmdbEvidence(name, "movie", residents)
    if (type === "urn:entity:tv_show") evidence = await tmdbEvidence(name, "tv", residents)
  } catch { evidence = null }
  cache.set(key, { evidence, expiresAt: Date.now() + 24 * 60 * 60 * 1000 })
  return evidence
}

export function retainEraVerifiedItems<T extends { entityId: string; name: string; type: EchoesEntityType }>(
  items: T[],
  evidence: Map<string, YearEvidence | null>
) {
  return items.flatMap((item) => {
    const fact = evidence.get(item.entityId ?? item.name)
    return fact ? [{ ...item, yearEvidence: fact }] : []
  })
}
