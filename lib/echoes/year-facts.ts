import { avoidMatch } from "./suitability"
import { eraWindow } from "./era"
import { sameName, normalizeName } from "./names"
import { musicBrainz, searchArtists } from "./musicbrainz"
import {
  readProviderCache,
  writeProviderCache,
  demoMode,
} from "./provider-cache"
import type { EchoesEntity, EchoesEntityType, ResidentInput } from "./types"
export interface YearEvidence {
  year: number
  source: "MusicBrainz" | "TMDB" | "Qloo"
  residentIds: string[]
  title?: string
  url?: string
  cached?: boolean
  fetchedAt?: string
  workType?: "track" | "album" | "series"
  firstAirYear?: number
  lastAirYear?: number
  releaseCount?: number
}
export interface YearResult {
  status:
    "verified" | "outside_window" | "missing" | "unavailable" | "ambiguous"
  evidence: YearEvidence | null
  outsideEvidence?: YearEvidence
  originalDateUnknown?: boolean
  reason: string
  context?: string
  cached?: boolean
}
type Fact = {
  year: number
  source: "MusicBrainz" | "TMDB"
  title: string
  url: string
  compilation?: boolean
  primaryType?: string
  lastAirYear?: number
  releaseCount?: number
}
type Facts = {
  works: Fact[]
  artistId?: string
  context?: string
  partial?: boolean
  fetchedAt: string
}
const yearOf = (value: unknown) =>
  typeof value === "string" && /^\d{4}/.test(value)
    ? Number(value.slice(0, 4))
    : null
export function musicBrainzId(entity?: EchoesEntity) {
  const external = entity?.properties.external as
    Record<string, { id?: string } | { id?: string }[]> | undefined
  const mb = Array.isArray(external?.musicbrainz)
    ? external.musicbrainz[0]
    : external?.musicbrainz
  return mb?.id && /^[0-9a-f-]{36}$/i.test(mb.id) ? mb.id : undefined
}
export function yearEvidenceFor(
  year: number,
  source: YearEvidence["source"],
  residents: ResidentInput[]
): YearEvidence | null {
  const residentIds = residents
    .filter((r) => {
      const era = eraWindow(r.birthYear)
      return year >= era.from && year <= era.to
    })
    .map((r) => r.id)
  return residentIds.length ? { year, source, residentIds } : null
}
export async function lookupYearFact(
  name: string,
  type: EchoesEntityType,
  residents: ResidentInput[],
  signal?: AbortSignal,
  entity?: EchoesEntity
): Promise<YearResult> {
  const linkedId = musicBrainzId(entity)
  const key = `years:v5:${type}:${normalizeName(name)}:${linkedId ?? "unlinked"}`
  const prior = readProviderCache<Facts>(key)
  let facts = prior?.value,
    cached = Boolean(prior)
  try {
    if (!facts && type === "urn:entity:artist") {
      let id = linkedId,
        context =
          "MusicBrainz supplied release history; personal familiarity is unconfirmed."
      {
        // External provider IDs are hints, not verified artist identities.
        const artists = await searchArtists(name, signal)
        const namedMatches = artists.filter((a) =>
          [
            a.name,
            a["sort-name"],
            ...(a.aliases ?? []).flatMap((alias) => [
              alias.name,
              alias["sort-name"],
            ]),
          ].some((alias) => alias && sameName(alias, name))
        )
        // A linked homonym must not override a uniquely dominant exact search result.
        const ranked = [...namedMatches].sort(
          (a, b) => (b.score ?? 0) - (a.score ?? 0)
        )
        const matches =
          ranked[0]?.score === 100 && (ranked[1]?.score ?? 0) <= 80
            ? [ranked[0]]
            : namedMatches
        if (matches.length !== 1)
          return {
            status: matches.length ? "ambiguous" : "missing",
            evidence: null,
            reason: matches.length
              ? "More than one MusicBrainz artist matches; choose the intended artist."
              : "No matching MusicBrainz artist or alias was found.",
          }
        id = matches[0].id
        if (matches[0].area?.name)
          context = `MusicBrainz lists ${name}’s area as ${matches[0].area.name}. This does not establish personal familiarity.`
      }
      const works: Fact[] = []
      let partial = false,
        allCached = true,
        fetchedAt = new Date().toISOString()
      for (let offset = 0; offset < 100; offset += 100) {
        const result = await musicBrainz<{
          "release-groups": {
            id: string
            title: string
            "first-release-date"?: string
            "secondary-types"?: string[]
            "primary-type"?: string
          }[]
          "release-group-count"?: number
        }>(
          "/ws/2/release-group/",
          { artist: id, limit: "100", offset: String(offset) },
          signal
        )
        allCached &&= result.cached
        fetchedAt = result.fetchedAt
        for (const r of result.data["release-groups"]) {
          const year = yearOf(r["first-release-date"])
          if (year)
            works.push({
              year,
              source: "MusicBrainz",
              title: r.title,
              url: `https://musicbrainz.org/release-group/${r.id}`,
              primaryType: r["primary-type"],
              compilation:
                r["secondary-types"]?.some((t) =>
                  ["Compilation", "Live", "Remix"].includes(t)
                ) ?? false,
            })
        }
        partial = (result.data["release-group-count"] ?? 0) > offset + 100
        if (!partial) break
      }
      cached = allCached
      facts = { works, artistId: id, partial, context, fetchedAt }
    } else if (
      !facts &&
      (type === "urn:entity:movie" || type === "urn:entity:tv_show")
    ) {
      const domain = type === "urn:entity:movie" ? "movie" : "tv"
      const searchKey = `tmdb:search:v1:${domain}:${normalizeName(name)}`
      type TmdbSearch = {
        results: {
          id: number
          title?: string
          name?: string
          release_date?: string
          first_air_date?: string
        }[]
      }
      const priorSearch = readProviderCache<TmdbSearch>(searchKey)
      let data = priorSearch?.value
      if (!data) {
        if (process.env.ECHOES_OFFLINE === "true")
          return {
            status: "unavailable",
            evidence: null,
            reason: "No cached film/TV date is available while offline.",
          }
        if (!process.env.TMDB_API_KEY)
          return {
            status: "unavailable",
            evidence: null,
            reason:
              "TMDB_API_KEY is not configured; film/TV dates cannot be checked.",
          }
        const url = new URL(`https://api.themoviedb.org/3/search/${domain}`)
        url.search = new URLSearchParams({
          api_key: process.env.TMDB_API_KEY,
          query: name,
          include_adult: "false",
        }).toString()
        const timeout = AbortSignal.timeout(demoMode() ? 2000 : 7000)
        const response = await fetch(url, {
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
          headers: { Accept: "application/json" },
          cache: "no-store",
        })
        if (!response.ok)
          throw Error(`Date provider returned HTTP ${response.status}`)
        const body = await response.json()
        if (
          !Array.isArray(body.results) ||
          !body.results.every(
            (row: TmdbSearch["results"][number]) =>
              row &&
              typeof row.id === "number" &&
              typeof (row.title ?? row.name) === "string"
          )
        )
          throw Error("Date provider returned invalid JSON structure")
        data = { results: body.results }
        // A successful ambiguous/empty response is replayable evidence; a failed request is never cached.
        writeProviderCache(searchKey, data, "TMDB")
      }
      cached = Boolean(priorSearch)
      const external = entity?.properties.external as
        Record<string, { id?: string }[] | { id?: string }> | undefined
      const tmdb = external?.tmdb
      const linked = (Array.isArray(tmdb) ? tmdb[0] : tmdb)?.id
      const matches = data.results
        .filter((r: { title?: string; name?: string }) =>
          sameName(r.title ?? r.name ?? "", name)
        )
        .filter((r) => !linked || String(r.id) === String(linked))
      if (matches.length !== 1)
        return {
          status: matches.length ? "ambiguous" : "missing",
          evidence: null,
          cached,
          reason: "No unique title in TMDB; ambiguous remakes are not guessed.",
        }
      const result = matches[0],
        year = yearOf(result.release_date ?? result.first_air_date)
      let lastAirYear: number | undefined
      if (domain === "tv") {
        const detailKey = `tmdb:tv-span:v1:${result.id}`
        let detail = readProviderCache<{
          first_air_date?: string
          last_air_date?: string
        }>(detailKey)?.value
        if (
          !detail &&
          process.env.ECHOES_OFFLINE !== "true" &&
          process.env.TMDB_API_KEY
        ) {
          const url = new URL(`https://api.themoviedb.org/3/tv/${result.id}`)
          url.searchParams.set("api_key", process.env.TMDB_API_KEY)
          const response = await fetch(url, {
            signal: signal
              ? AbortSignal.any([signal, AbortSignal.timeout(7000)])
              : AbortSignal.timeout(7000),
          })
          if (!response.ok) throw Error("TV air-date check unavailable")
          detail = await response.json()
          writeProviderCache(detailKey, detail, "TMDB")
        }
        lastAirYear = yearOf(detail?.last_air_date) ?? undefined
      }
      facts = {
        works: year
          ? [
              {
                year,
                source: "TMDB",
                lastAirYear,
                title: name,
                url: `https://www.themoviedb.org/${domain}/${result.id}`,
              },
            ]
          : [],
        fetchedAt: priorSearch?.fetchedAt ?? new Date().toISOString(),
      }
    }
    if (!facts)
      return {
        status: "missing",
        evidence: null,
        reason: "This media type has no independent date tool.",
      }
    // Large artist catalogues may fill the album pages before singles are reached.
    const artistId = facts.artistId ?? linkedId
    if (type === "urn:entity:artist" && artistId && facts.partial) {
      const singles = await musicBrainz<{
        "release-groups": {
          id: string
          title: string
          "first-release-date"?: string
          "secondary-types"?: string[]
        }[]
      }>(
        "/ws/2/release-group/",
        { artist: artistId, type: "single", limit: "100", offset: "0" },
        signal
      )
      for (const row of singles.data["release-groups"]) {
        const year = yearOf(row["first-release-date"])
        if (year)
          facts.works.push({
            year,
            title: row.title,
            source: "MusicBrainz",
            primaryType: "Single",
            compilation: row["secondary-types"]?.some((t) =>
              ["Compilation", "Live", "Remix"].includes(t)
            ),
            url: `https://musicbrainz.org/release-group/${row.id}`,
          })
      }
      writeProviderCache(key, facts, "MusicBrainz")
    }
    if (!prior)
      writeProviderCache(
        key,
        facts,
        type === "urn:entity:artist" ? "MusicBrainz" : "TMDB"
      )
    const originals = facts.works
      .filter(
        (f) =>
          !f.compilation &&
          (type !== "urn:entity:artist" || !sameName(f.title, name))
      )
      .filter(
        (f) => !residents.some((r) => avoidMatch(f.title, r.sensitivities))
      )
    const notable = Array.isArray(entity?.properties.notable_songs)
      ? (entity.properties.notable_songs as string[])
      : []
    const isNotable = (f: Fact) =>
      f.title
        .split(/\s*[/／]\s*/)
        .some((t) => notable.some((n) => sameName(t, n)))
    const inWindow = (f: Fact) =>
      residents.some((r) => {
        const era = eraWindow(r.birthYear)
        return f.year <= era.to && (f.lastAirYear ?? f.year) >= era.from
      })
    const widelyReleased = new Set<string>()
    if (
      type === "urn:entity:artist" &&
      artistId &&
      originals.filter((f) => inWindow(f) && f.primaryType === "Single")
        .length > 8
    ) {
      try {
        const result = await musicBrainz<{
          "release-groups": { id: string }[]
        }>(
          "/ws/2/release-group/",
          {
            query: `arid:${artistId} AND primarytype:single AND releases:[5 TO *]`,
            limit: "100",
          },
          signal
            ? AbortSignal.any([signal, AbortSignal.timeout(6000)])
            : AbortSignal.timeout(6000)
        )
        result.data["release-groups"].forEach((r) => widelyReleased.add(r.id))
      } catch {
        /* An unavailable popularity index must not invalidate a verified date. */
      }
    }
    // Reuse every already-known count, not only the current lookup shortlist.
    for (const fact of originals) {
      const url = new URL("/ws/2/release/", "https://musicbrainz.org")
      url.search = new URLSearchParams({
        "release-group": fact.url.split("/").at(-1)!,
        limit: "1",
        status: "official",
        fmt: "json",
      }).toString()
      fact.releaseCount =
        readProviderCache<{ "release-count"?: number }>(`MusicBrainz:${url}`)
          ?.value["release-count"] ?? fact.releaseCount
    }
    const widelyKnown = (f: Fact) =>
      widelyReleased.has(f.url.split("/").at(-1)!)
    // Popularity is a selection signal, never a date source. Count editions of original single release groups.
    const shortlist = originals
      .filter(inWindow)
      .sort(
        (a, b) =>
          Number(b.primaryType === "Single") -
            Number(a.primaryType === "Single") ||
          Number(widelyKnown(b)) - Number(widelyKnown(a)) ||
          (b.releaseCount ?? 0) - (a.releaseCount ?? 0) ||
          Number(isNotable(b)) - Number(isNotable(a)) ||
          a.title.localeCompare(b.title)
      )
      .slice(0, 8)
    if (type === "urn:entity:artist") {
      const popularitySignal = signal
        ? AbortSignal.any([signal, AbortSignal.timeout(6000)])
        : AbortSignal.timeout(6000)
      for (const fact of shortlist.filter((f) => f.primaryType === "Single")) {
        if (popularitySignal.aborted) break
        try {
          const id = fact.url.split("/").at(-1)!
          const result = await musicBrainz<{ "release-count"?: number }>(
            "/ws/2/release/",
            { "release-group": id, limit: "1", status: "official" },
            popularitySignal
          )
          fact.releaseCount = result.data["release-count"] ?? 0
        } catch {
          /* Keep independently dated evidence when popularity is unavailable. */
        }
      }
    }
    originals.sort(
      (a, b) =>
        Number(inWindow(b)) - Number(inWindow(a)) ||
        Number(b.primaryType === "Single") -
          Number(a.primaryType === "Single") ||
        Number(widelyKnown(b)) - Number(widelyKnown(a)) ||
        (b.releaseCount ?? 0) - (a.releaseCount ?? 0) ||
        Number(isNotable(b)) - Number(isNotable(a)) ||
        a.year - b.year
    )
    for (const fact of originals) {
      const overlapYear =
        type === "urn:entity:tv_show" && fact.lastAirYear
          ? Math.max(
              fact.year,
              Math.min(...residents.map((r) => eraWindow(r.birthYear).from))
            )
          : fact.year
      const evidence =
        !fact.lastAirYear || overlapYear <= fact.lastAirYear
          ? yearEvidenceFor(overlapYear, fact.source, residents)
          : null
      const title =
        fact.primaryType === "Single"
          ? (fact.title
              .split(/\s+[/／]\s+/)
              .find((t) => notable.some((n) => sameName(t, n))) ??
            fact.title.split(/\s+[/／]\s+/)[0])
          : fact.title
      if (evidence)
        return {
          status: "verified",
          evidence: {
            ...evidence,
            title,
            workType:
              type === "urn:entity:tv_show"
                ? "series"
                : fact.primaryType === "Single"
                  ? "track"
                  : fact.primaryType === "Album"
                    ? "album"
                    : undefined,
            firstAirYear: type === "urn:entity:tv_show" ? fact.year : undefined,
            lastAirYear: fact.lastAirYear,
            releaseCount: fact.releaseCount,
            url: fact.url,
            cached,
            fetchedAt: facts.fetchedAt,
          },
          cached,
          reason: fact.lastAirYear
            ? `${fact.title} aired ${fact.year}–${fact.lastAirYear}, overlapping the requested era.`
            : `${title} (${fact.year}) falls in the requested era${fact.releaseCount !== undefined ? `; selected using ${fact.releaseCount} official MusicBrainz releases` : ""}.`,
          context: facts.context,
        }
    }
    return {
      status:
        facts.works.length && !facts.partial ? "outside_window" : "missing",
      evidence: null,
      outsideEvidence: originals[0]
        ? {
            ...originals[0],
            residentIds: residents.map((r) => r.id),
            cached,
            fetchedAt: facts.fetchedAt,
          }
        : undefined,
      originalDateUnknown: facts.works.length > 0 && !originals.length,
      cached,
      reason:
        facts.works.length && !originals.length
          ? "Only compilations are dated; original date unknown."
          : facts.partial
            ? "Catalogue is incomplete; no in-window work was found in the checked releases."
            : facts.works.length
              ? "Independent dates were found, but none falls in the requested era."
              : "No independently dated work was found.",
      context: facts.context,
    }
  } catch (error) {
    return {
      status: "unavailable",
      evidence: null,
      reason: error instanceof Error ? error.message : "Date check unavailable",
    }
  }
}
export async function verifyYearFact(
  name: string,
  type: EchoesEntityType,
  residents: ResidentInput[]
) {
  return (await lookupYearFact(name, type, residents)).evidence
}
export function retainEraVerifiedItems<
  T extends { entityId: string; name: string; type: EchoesEntityType },
>(items: T[], evidence: Map<string, YearEvidence | null>) {
  return items.flatMap((item) => {
    const fact = evidence.get(item.entityId)
    return fact ? [{ ...item, yearEvidence: fact }] : []
  })
}
