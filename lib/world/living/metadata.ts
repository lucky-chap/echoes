const IMPORTANT_METADATA =
  /^(address|city|country|geocode|latitude|location|longitude|name|region|state|venue)$/i

function serializedLength(value: unknown) {
  try {
    return JSON.stringify(value).length
  } catch {
    return Number.POSITIVE_INFINITY
  }
}

function boundedString(value: string, maxChars: number) {
  let candidate = value.slice(0, Math.min(240, value.length))
  while (candidate && serializedLength(candidate) > maxChars)
    candidate = candidate.slice(0, Math.max(0, candidate.length - 16))
  return candidate
}

function boundedValue(
  value: unknown,
  depth: number,
  maxChars: number,
  seen: WeakSet<object>
): unknown {
  if (value === null || typeof value === "boolean") return value
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value === "string") return boundedString(value, maxChars)
  if (depth <= 0 || typeof value !== "object") return undefined
  if (seen.has(value)) return undefined
  seen.add(value)
  if (Array.isArray(value)) {
    const output: unknown[] = []
    for (const item of value.slice(0, 8)) {
      const candidate = boundedValue(item, depth - 1, 400, seen)
      if (candidate === undefined) continue
      const next = [...output, candidate]
      if (serializedLength(next) > maxChars) break
      output.push(candidate)
    }
    return output
  }
  const output: Record<string, unknown> = {}
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(
      ([a], [b]) =>
        Number(IMPORTANT_METADATA.test(b)) - Number(IMPORTANT_METADATA.test(a))
    )
    .slice(0, 18)
  for (const [rawKey, item] of entries) {
    const key = rawKey.slice(0, 80)
    const candidate = boundedValue(item, depth - 1, 700, seen)
    if (!key || candidate === undefined) continue
    const next = { ...output, [key]: candidate }
    if (serializedLength(next) > maxChars) continue
    output[key] = candidate
  }
  return output
}

/** Keeps useful Qloo provenance while making persisted snapshots transport-safe. */
export function compactMetadata(
  value: Record<string, unknown>,
  maxChars = 1200
): Record<string, unknown> {
  const compacted = boundedValue(value, 4, maxChars, new WeakSet())
  return compacted && typeof compacted === "object" && !Array.isArray(compacted)
    ? (compacted as Record<string, unknown>)
    : {}
}
