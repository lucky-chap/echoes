/** Comparison only: preserve the provider's original display name. */
export function normalizeName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
}
export function sameName(a: string, b: string) {
  return (
    normalizeName(a).replace(/\s/g, "") === normalizeName(b).replace(/\s/g, "")
  )
}
export function nameVariants(value: string, aliases: string[] = []) {
  const normalized = normalizeName(value)
  const parts = normalized.split(" ")
  // A leading group of initials, not an artist-specific spelling table.
  let initials = parts[0]
  const rest = parts.slice(1)
  while (initials.length < 4 && rest[0]?.length === 1) initials += rest.shift()
  const dotted =
    initials.length >= 2 && initials.length <= 3 && rest.length
      ? [
          initials.toUpperCase().split("").join(".") + ". " + rest.join(" "),
          initials.toUpperCase().split("").join(". ") + ". " + rest.join(" "),
        ]
      : []
  return [
    ...new Set(
      [value.trim(), normalized, ...dotted, ...aliases].filter(Boolean)
    ),
  ]
}
export function aliasNames(properties: Record<string, unknown>): string[] {
  const aliases = properties.aliases
  return [
    properties.sort_name,
    properties["sort-name"],
    ...(Array.isArray(aliases)
      ? aliases.flatMap((a) =>
          typeof a === "string"
            ? [a]
            : a && typeof a === "object"
              ? [(a as { name?: string }).name]
              : []
        )
      : []),
  ].filter((name): name is string => typeof name === "string")
}
