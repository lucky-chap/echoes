import type { EchoesEntity, KitItem } from "./types"
import { normalizeName } from "./names"
import { cleanText } from "./text"

export function mediaSearch(
  name: string,
  work?: string
): NonNullable<KitItem["media"]> {
  const artist = normalizeName(name)
  const title = normalizeName(work ?? "")
  const query = cleanText(
    !title || title === artist
      ? name
      : ` ${title} `.includes(` ${artist} `)
        ? work!
        : `${name} ${work}`
  )
  return [
    {
      label: "Find this",
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
      status: "search",
      instructions: `Find “${query}”, then preview the version and volume before sharing it.`,
    },
  ]
}
export function playableDestination(value: string) {
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" || url.username || url.password) return false
    return (
      (url.hostname === "open.spotify.com" &&
        /^\/(track|album)\/[A-Za-z0-9]{22}$/.test(url.pathname)) ||
      (url.hostname === "www.youtube.com" &&
        url.pathname === "/watch" &&
        /^[\w-]{11}$/.test(url.searchParams.get("v") ?? ""))
    )
  } catch {
    return false
  }
}
export function primaryMedia(item: KitItem) {
  if (item.kind === "book") return null
  return (
    item.media?.find(
      (link) =>
        link.status === "provider-checked" && playableDestination(link.url)
    ) ?? mediaSearch(item.name, item.yearEvidence.title)[0]
  )
}
export async function lookupMedia(
  entity: EchoesEntity,
  work?: string,
  signal?: AbortSignal
): Promise<NonNullable<KitItem["media"]>> {
  if (entity.type === "urn:entity:book") return []
  const fallback = mediaSearch(entity.name, work)
  if (process.env.ECHOES_OFFLINE === "true") return fallback
  const external = entity.properties.external as
    | Record<
        string,
        | { id?: string; url?: string; type?: string }
        | { id?: string; url?: string; type?: string }[]
      >
    | undefined
  const candidates: string[] = []
  for (const provider of ["spotify", "youtube"]) {
    const value = external?.[provider]
    for (const row of value ? (Array.isArray(value) ? value : [value]) : []) {
      if (row.url && playableDestination(row.url)) candidates.push(row.url)
      else if (
        provider === "spotify" &&
        /^(track|album)$/.test(row.type ?? "") &&
        /^[A-Za-z0-9]{22}$/.test(row.id ?? "")
      )
        candidates.push(`https://open.spotify.com/${row.type}/${row.id}`)
      else if (
        provider === "youtube" &&
        row.type === "video" &&
        /^[\w-]{11}$/.test(row.id ?? "")
      )
        candidates.push(`https://www.youtube.com/watch?v=${row.id}`)
    }
  }
  for (const url of candidates.slice(0, 2)) {
    const spotify = new URL(url).hostname === "open.spotify.com"
    const endpoint = spotify
      ? "https://open.spotify.com/oembed"
      : "https://www.youtube.com/oembed"
    try {
      const timeout = AbortSignal.timeout(
        process.env.DEMO_MODE === "true" ? 1000 : 3000
      )
      const response = await fetch(
        `${endpoint}?url=${encodeURIComponent(url)}&format=json`,
        {
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
          redirect: "error",
        }
      )
      const body = response.ok ? await response.json() : null
      const title = normalizeName(body?.title ?? "")
      const credit = normalizeName(
        `${body?.title ?? ""} ${body?.author_name ?? ""}`
      )
      if (
        body?.provider_name === (spotify ? "Spotify" : "YouTube") &&
        title.includes(normalizeName(work ?? entity.name)) &&
        (spotify || credit.includes(normalizeName(entity.name)))
      ) {
        return [
          {
            label: spotify ? "Open recording" : "Open video",
            url,
            status: "provider-checked",
            checkedAt: new Date().toISOString(),
            instructions:
              "Recording destination and title checked through provider metadata; preview suitability and volume. Playback availability may vary by account and region.",
          },
        ]
      }
    } catch {
      /* A failed check remains a single explicit search action. */
    }
  }
  return fallback
}
