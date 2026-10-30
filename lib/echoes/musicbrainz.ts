import {
  readProviderCache,
  writeProviderCache,
  demoMode,
} from "./provider-cache"
export interface MusicBrainzArtist {
  id: string
  score?: number
  name: string
  "sort-name"?: string
  aliases?: { name: string; "sort-name"?: string }[]
  country?: string
  area?: { name: string }
  disambiguation?: string
  "life-span"?: { begin?: string; end?: string }
}
export interface MusicBrainzLog {
  provider: "MusicBrainz"
  startedAt: string
  latencyMs: number
  url: string
  status: number | null
  outcome: string
  attempt: number
  userAgent: string
}
export class MusicBrainzError extends Error {
  constructor(
    message: string,
    public kind: string,
    public status?: number
  ) {
    super(message)
  }
}
type Queue = { tail: Promise<void>; nextStart: number }
const shared = globalThis as typeof globalThis & {
  echoesMusicBrainzQueue?: Queue
}
const globalQueue = (shared.echoesMusicBrainzQueue ??= {
  tail: Promise.resolve(),
  nextStart: 0,
})
const pause = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason)
    const finish = () => {
      signal?.removeEventListener("abort", abort)
      resolve()
    }
    const timer = setTimeout(finish, ms)
    const abort = () => {
      clearTimeout(timer)
      signal?.removeEventListener("abort", abort)
      reject(signal?.reason)
    }
    signal?.addEventListener("abort", abort, { once: true })
  })
export function createMusicBrainzClient(
  deps: {
    fetch?: typeof fetch
    now?: () => number
    sleep?: typeof pause
    random?: () => number
    log?: (entry: MusicBrainzLog) => void
    email?: string
    queue?: Queue
    cache?: boolean
  } = {}
) {
  const now = deps.now ?? Date.now,
    sleep = deps.sleep ?? pause,
    queue = deps.queue ?? globalQueue
  return async function request<T>(
    path: string,
    params: Record<string, string>,
    signal?: AbortSignal
  ): Promise<{ data: T; cached: boolean; fetchedAt: string }> {
    const url = new URL(path, "https://musicbrainz.org")
    url.search = new URLSearchParams({ ...params, fmt: "json" }).toString()
    const key = `MusicBrainz:${url}`
    const validCountResponse = (value: unknown) => {
      if (path !== "/ws/2/release/" || !params["release-group"]) return true
      const count = (value as Record<string, unknown> | null)?.["release-count"]
      return typeof count === "number" && Number.isInteger(count) && count >= 0
    }
    const cached = deps.cache === false ? undefined : readProviderCache<T>(key)
    if (cached && validCountResponse(cached.value))
      return { data: cached.value, cached: true, fetchedAt: cached.fetchedAt }
    if (process.env.ECHOES_OFFLINE === "true")
      throw new MusicBrainzError(
        "MusicBrainz cache miss while offline",
        "unavailable"
      )
    const email = (
      deps.email ??
      process.env.MUSICBRAINZ_CONTACT_EMAIL ??
      ""
    ).trim()
    if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email))
      throw new MusicBrainzError(
        "Set MUSICBRAINZ_CONTACT_EMAIL before live date checks.",
        "configuration"
      )
    const userAgent = `Echoes/0.1 (contact: ${email})`
    let nextAttempt = 0
    for (let attempt = 0; attempt <= 3; attempt++) {
      let release!: () => void
      const previous = queue.tail
      queue.tail = new Promise<void>((resolve) => {
        release = resolve
      })
      await previous
      let status: number | null = null,
        outcome = "ok",
        started = 0,
        retryAfter = 0
      try {
        await sleep(
          Math.max(0, queue.nextStart - now(), nextAttempt - now()),
          signal
        )
        signal?.throwIfAborted()
        // Cache may have been filled by the request ahead of us in the queue.
        const filled =
          deps.cache === false ? undefined : readProviderCache<T>(key)
        if (filled && validCountResponse(filled.value))
          return {
            data: filled.value,
            cached: true,
            fetchedAt: filled.fetchedAt,
          }
        started = now()
        queue.nextStart = started + 1000
        const timeout = AbortSignal.timeout(demoMode() ? 2000 : 7000)
        const response = await (deps.fetch ?? fetch)(url, {
          headers: { Accept: "application/json", "User-Agent": userAgent },
          cache: "no-store",
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        })
        status = response.status
        const header = response.headers.get("retry-after")
        if (header)
          retryAfter = /^\d+(\.\d+)?$/.test(header)
            ? Number(header) * 1000
            : Math.max(0, Date.parse(header) - now())
        if (!response.ok)
          throw new MusicBrainzError(
            `MusicBrainz returned HTTP ${status}`,
            `http_${status}`,
            status
          )
        const data = (await response.json()) as T
        if (!data || typeof data !== "object" || Array.isArray(data))
          throw new SyntaxError("Invalid MusicBrainz response")
        const body = data as Record<string, unknown>
        if (!validCountResponse(data))
          throw new SyntaxError("Missing or invalid official release count")
        if (
          (params.query &&
            path.includes("/artist/") &&
            !Array.isArray(body.artists)) ||
          (path.includes("release-group") &&
            !Array.isArray(body["release-groups"]))
        )
          throw new SyntaxError("Invalid MusicBrainz response structure")
        const list = body.artists ?? body["release-groups"]
        if (Array.isArray(list) && list.length === 0) outcome = "no_results"
        const fetchedAt = new Date(now()).toISOString()
        if (deps.cache !== false) writeProviderCache(key, data, "MusicBrainz")
        return { data, cached: false, fetchedAt }
      } catch (error) {
        outcome =
          error instanceof MusicBrainzError
            ? error.kind
            : error instanceof SyntaxError
              ? "parse_error"
              : error instanceof Error &&
                  ["TimeoutError", "AbortError"].includes(error.name)
                ? "timeout"
                : "network_error"
        const retryable =
          status === 429 ||
          status === 503 ||
          outcome === "timeout" ||
          outcome === "network_error"
        if (signal?.aborted || !retryable || attempt === 3)
          throw new MusicBrainzError(
            `MusicBrainz date check unavailable (${outcome})`,
            outcome,
            status ?? undefined
          )
        nextAttempt =
          now() +
          Math.max(
            retryAfter,
            1000 * 2 ** attempt +
              Math.floor((deps.random ?? Math.random)() * 250)
          )
      } finally {
        if (started)
          (deps.log ?? ((entry) => console.info(JSON.stringify(entry))))({
            provider: "MusicBrainz",
            startedAt: new Date(started).toISOString(),
            latencyMs: now() - started,
            url: url.toString(),
            status,
            outcome,
            attempt,
            userAgent,
          })
        release()
      }
    }
    throw new MusicBrainzError(
      "MusicBrainz date check unavailable",
      "unavailable"
    )
  }
}
export const musicBrainz = createMusicBrainzClient()
export async function searchArtists(query: string, signal?: AbortSignal) {
  const response = await musicBrainz<{ artists: MusicBrainzArtist[] }>(
    "/ws/2/artist/",
    { query: `artist:"${query.replaceAll('"', "")}"`, limit: "5" },
    signal
  )
  if (!Array.isArray(response.data.artists))
    throw new MusicBrainzError(
      "MusicBrainz artist response could not be parsed",
      "parse_error"
    )
  return response.data.artists
}
