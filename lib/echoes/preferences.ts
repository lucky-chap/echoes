import { z } from "zod"
import type {
  EchoesEntity,
  ResidentInput,
  ResponseHistory,
  PersonPreferences,
} from "./types"
import { normalizeName } from "./names"

const phrases = z.array(z.string().trim().min(1).max(160)).max(20)
export const preferenceFieldsSchema = z
  .object({
    liked_traits: phrases,
    disliked_traits: phrases,
    format_prefs: phrases,
    logistics: phrases,
    people: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(40)
          .transform((name) => name.split(/\s+/)[0])
      )
      .max(20),
    places: phrases,
  })
  .strict()
export const preferencesSchema = preferenceFieldsSchema.extend({
  confirmed: z.boolean(),
  sourceNotes: z.string().max(6000),
})
export const historySchema = z.object({
  item: z.string().trim().min(1).max(250),
  domain: z.enum(["music", "film", "television", "book", "place"]),
  traits: phrases,
  response: z.enum(["sparked", "not_for_us"]),
  note: z.string().max(600).default(""),
  session: z.string().trim().min(1).max(160),
  entityId: z.string().max(160).optional(),
})
export const historyImportSchema = z.array(historySchema).max(500)
export const emptyPreferences = (): PersonPreferences => ({
  liked_traits: [],
  disliked_traits: [],
  format_prefs: [],
  logistics: [],
  people: [],
  places: [],
  confirmed: false,
  sourceNotes: "",
})

/** Legacy text is copied verbatim once; editing the merged field must not resurrect it. */
export function migrateResidentNotes<T extends ResidentInput>(resident: T): T {
  const old = resident as T & {
    intake?: string
    intakeNote?: string
    memories?: string
  }
  const notes = [
    ...new Set(
      [
        old.notes,
        old.intake,
        old.intakeNote,
        old.importantMemories,
        old.memories,
      ].filter((s): s is string => typeof s === "string" && Boolean(s.trim()))
    ),
  ].join("\n\n")
  const rest = { ...old }
  delete rest.intake
  delete rest.intakeNote
  delete rest.memories
  delete rest.importantMemories
  return { ...rest, notes } as T
}
export function confirmedPreferences(
  resident: ResidentInput
): PersonPreferences {
  const preferences = resident.preferences
  return preferences?.confirmed &&
    preferences.sourceNotes === migrateResidentNotes(resident).notes
    ? preferences
    : emptyPreferences()
}
export function mergeResponseHistory(
  previous: ResponseHistory[],
  entries: ResponseHistory[]
) {
  const key = (r: ResponseHistory) =>
    `${r.session}:${r.domain}:${normalizeName(r.item)}`
  return [
    ...new Map([...previous, ...entries].map((r) => [key(r), r])).values(),
  ].slice(-500)
}

// Match only explicit provider metadata; these equivalences describe traits, never artists.
const traitPatterns: [string, RegExp][] = [
  ["dance", /\bdanc(?:e|ing|eable)\b/i],
  ["call-and-response", /call[ -]and[ -]response/i],
  ["upbeat", /\b(upbeat|uptempo|up-tempo|energetic)\b/i],
  ["slow ballad", /\b(ballads?|slow|downtempo)\b/i],
  ["highlife", /\bhighlife\b/i],
  ["afro-rock", /\bafro[ -]?rock\b/i],
  ["weddings", /\bweddings?\b/i],
]
export function canonicalTraits(values: string[]) {
  return [
    ...new Set(
      values.flatMap((value) => {
        const matched = traitPatterns
          .filter(([, pattern]) => pattern.test(value))
          .map(([trait]) => trait)
        return matched.length ? matched : [normalizeName(value)]
      })
    ),
  ]
}
export function entityTraits(entity: EchoesEntity) {
  const properties = entity.properties
  const values = [
    entity.description ?? "",
    JSON.stringify(properties.tags ?? []),
    JSON.stringify(properties.genres ?? []),
    String(properties.genre ?? ""),
    String(properties.tempo ?? ""),
    ...[
      "primary_genres",
      "secondary_genres",
      "description",
      "short_description",
      "vocals",
      "performance_style",
      "adjectives_for_music",
      "characteristics",
    ].map((key) => JSON.stringify(properties[key] ?? "")),
  ]
  return traitPatterns
    .filter(([, pattern]) => pattern.test(values.join(" ")))
    .map(([trait]) => trait)
}
export function traitEvidence(resident: ResidentInput, entity: EchoesEntity) {
  const preferences = confirmedPreferences(resident)
  const history = resident.responseHistory ?? []
  const traits = entityTraits(entity)
  const liked = canonicalTraits([
    ...preferences.liked_traits,
    ...history.filter((r) => r.response === "sparked").flatMap((r) => r.traits),
  ])
  const disliked = canonicalTraits([
    ...preferences.disliked_traits,
    ...history
      .filter((r) => r.response === "not_for_us")
      .flatMap((r) => r.traits),
  ])
  return {
    traits,
    matches: traits.filter((t) => liked.includes(t)),
    conflicts: traits.filter((t) => disliked.includes(t)),
  }
}
