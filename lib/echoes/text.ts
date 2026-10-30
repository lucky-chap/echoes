import type { KitItem } from "./types"

export function itemDateLabel(
  item: KitItem,
  era: { from: number; to: number }
) {
  const evidence = item.yearEvidence
  if (evidence.artistLevel) return `in your window: ${era.from}–${era.to}`
  if (evidence.firstAirYear && evidence.lastAirYear)
    return `${evidence.firstAirYear}–${evidence.ongoing ? "present" : evidence.lastAirYear}`
  return String(evidence.year)
}

export function logisticsSentence(value: string) {
  return sentences([value]).replace(
    /(^|\.\s+)([a-z])/g,
    (_, prefix, letter) => prefix + letter.toUpperCase()
  )
}

export function cleanText(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/\.(?:\s*\.)+/g, ".")
    .replace(/this television\b/gi, "this TV show")
    .trim()
}
export function sentences(parts: (string | undefined | null | false)[]) {
  return (
    parts
      .filter(
        (part): part is string =>
          typeof part === "string" && Boolean(part.trim())
      )
      .map((part) => cleanText(part).replace(/[.!?。\s]+$/g, ""))
      .filter(Boolean)
      .join(". ") + (parts.some(Boolean) ? "." : "")
  )
}
