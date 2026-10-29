// Public provider responses only. No resident profiles or personal observations.
import { createHash, randomUUID } from "node:crypto"
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { join } from "node:path"
let observed = new Set<string>()
export function beginCacheAudit() {
  observed = new Set()
}
export function observedCacheKeys() {
  return [...observed]
}
export const CACHE_TTL = 30 * 24 * 60 * 60 * 1000
export interface CacheEntry<T> {
  version: 1
  source: string
  fetchedAt: string
  expiresAt: string
  value: T
}
export const cacheDirectory = () =>
  process.env.ECHOES_CACHE_DIR ||
  join(process.cwd(), ".echoes-data", "provider-cache")
function pathFor(key: string) {
  return join(
    cacheDirectory(),
    createHash("sha256").update(key).digest("hex") + ".json"
  )
}
export function readProviderCache<T>(key: string): CacheEntry<T> | undefined {
  try {
    const row = JSON.parse(readFileSync(pathFor(key), "utf8")) as CacheEntry<T>
    if (row.version === 1 && Date.parse(row.expiresAt) > Date.now()) {
      observed.add(key)
      return row
    }
  } catch {
    /* A missing or corrupt entry is a cache miss. */
  }
}
export function writeProviderCache<T>(
  key: string,
  value: T,
  source: string,
  ttl = CACHE_TTL
) {
  const entry: CacheEntry<T> = {
    version: 1,
    source,
    fetchedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + ttl).toISOString(),
    value,
  }
  try {
    mkdirSync(cacheDirectory(), { recursive: true, mode: 0o700 })
    const destination = pathFor(key)
    const temporary = `${destination}.${randomUUID()}.tmp`
    writeFileSync(temporary, JSON.stringify(entry), { mode: 0o600 })
    renameSync(temporary, destination)
    observed.add(key)
  } catch (error) {
    console.warn(
      "Echoes provider cache write failed:",
      error instanceof Error ? error.message : "unknown error"
    )
  }
  return entry
}
export const demoMode = () =>
  process.env.DEMO_MODE === "true" || process.env.DEMO_MODE === "1"
