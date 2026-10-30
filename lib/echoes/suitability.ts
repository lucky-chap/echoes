import type { EchoesEntity, ResidentInput } from "./types"
import { normalizeName } from "./names"

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
export interface AvoidMatch {
  topic: string
  source: "caregiver" | "conservative_default"
  sourceField?: string
  matchedTerm?: string
}

/** Content checks never copy biographies into resident-facing prose. */
export function matchedAvoidTopic(
  text: string,
  sensitivities: string[],
  conservativeDefault = false
): AvoidMatch | null {
  // Preserve word boundaries in structured provider fields before name normalisation.
  const value = normalizeName(text.replace(/[{}\[\]":,]/g, " "))
  for (const sensitivity of sensitivities) {
    const term = normalizeName(sensitivity)
    const groups: [RegExp, RegExp][] = [
      [
        /funeral|bereav|mourning/,
        /funeral|burial|mourning|requiem|never grow old|amazing grace|abide with me|precious lord|take my hand|old rugged cross|nearer my god|going home|go rest high/,
      ],
      [/hospital|medical/, /\b(hospital|medical|surgery|ward|clinic)\b/],
      [
        /politic/,
        /politic\w*|revolution\w*|communis\w*|propaganda|election\w*|dictator\w*/,
      ],
      [
        /leaving cuba|exile|migration/,
        /leaving cuba|exile|emigrat|refugee|fled cuba|escape from cuba/,
      ],
    ]
    for (const [trigger, pattern] of groups) {
      const match = trigger.test(term) ? value.match(pattern) : null
      if (match)
        return {
          topic: sensitivity,
          source: "caregiver",
          matchedTerm: match[0],
        }
    }
    for (const part of term.split(/\s+(?:and|or)\s+|[,/]/)) {
      const needle = part
        .replace(/\s+(songs?|themes?|content|stories|scenes|hymns)$/, "")
        .trim()
      if (needle && new RegExp(`\\b${escape(needle)}\\b`, "i").test(value))
        return { topic: sensitivity, source: "caregiver", matchedTerm: needle }
    }
  }
  if (
    conservativeDefault &&
    /\b(death|dead|dying|funeral|burial|mourning|requiem|hospital|infirmary|surgery|hospice|losing you|goodbye)\b/.test(
      value
    )
  )
    return {
      topic: "death, funeral or hospital themes",
      source: "conservative_default",
      matchedTerm: value.match(
        /\b(death|dead|dying|funeral|burial|mourning|requiem|hospital|infirmary|surgery|hospice|losing you|goodbye)\b/
      )?.[0],
    }
  return null
}
export function cautionText(caution: {
  topic: string
  sourceField: string
  matchedTerm?: string
  source?: string
}) {
  const source =
    caution.source === "conservative_default"
      ? `the conservative default flags ${caution.topic}`
      : `your avoid list includes ${caution.topic}`
  const field =
    caution.sourceField === "selected work title"
      ? "the selected work’s title mentions"
      : `Qloo’s ${caution.sourceField} ${/themes|tags|keywords/.test(caution.sourceField) ? "mention" : "mentions"}`
  return `Check before playing: ${field} “${caution.matchedTerm ?? caution.topic}”, and ${source}.`
}
export function avoidMatch(text: string, sensitivities: string[]) {
  return Boolean(matchedAvoidTopic(text, sensitivities))
}
export function unsuitableReason(
  entity: EchoesEntity,
  sensitivities: string[]
): AvoidMatch | null {
  const p = entity.properties
  const contentTags =
    Array.isArray(p.tags) && entity.type === "urn:entity:artist"
      ? p.tags.filter(
          (tag) =>
            !/influenced_by|influence:/.test(String(tag?.type ?? tag?.id ?? ""))
        )
      : p.tags
  // Artist biographies and influences are not the themes of the selected work.
  const fields: [string, string][] = [
    ["title", entity.name],
    [
      "description",
      `${entity.description ?? ""} ${String(p.description ?? "")} ${String(p.short_description ?? "")}`,
    ],
    [
      "lyrical themes",
      `${JSON.stringify(p.lyrical_themes ?? [])} ${String(p.lyrical_themes_description ?? "")}`,
    ],
    [
      "keywords and tags",
      `${JSON.stringify(p.keywords ?? [])} ${JSON.stringify(contentTags ?? [])} ${JSON.stringify(p.plot_themes ?? [])}`,
    ],
  ]
  for (const [sourceField, text] of fields) {
    if (entity.type === "urn:entity:artist" && sourceField === "description")
      continue
    const match = matchedAvoidTopic(
      text,
      sensitivities,
      entity.type === "urn:entity:book"
    )
    if (match) return { ...match, sourceField }
  }
  return null
}
export function unsuitable(entity: EchoesEntity, sensitivities: string[]) {
  return Boolean(unsuitableReason(entity, sensitivities))
}
const regions: [string, string, RegExp][] = [
  ["Ghana", "West Africa", /\b(ghana|ghanaian|gh|kumasi|accra)\b/i],
  ["Guinea", "West Africa", /\b(guinea|guinean|gn|conakry)\b/i],
  ["Nigeria", "West Africa", /\b(nigeria|nigerian|ng)\b/i],
  ["Mali", "West Africa", /\b(mali|malian|ml)\b/i],
  ["Senegal", "West Africa", /\b(senegal|senegalese|sn)\b/i],
  ["Cuba", "Caribbean", /\b(cuba|cuban|cu|havana|habana|matanzas)\b/i],
  ["Puerto Rico", "Caribbean", /\b(puerto rico|puerto rican|pr)\b/i],
  ["Dominican Republic", "Caribbean", /\b(dominican|do)\b/i],
  ["United States", "North America", /\b(united states|american|usa|us)\b/i],
  [
    "United Kingdom",
    "British Isles",
    /\b(united kingdom|british|england|english|uk|gb)\b/i,
  ],
]
function origin(entity: EchoesEntity) {
  const p = entity.properties
  // Only origin fields and the opening description; translated descriptions are not language evidence.
  return [
    p.country,
    p.countries,
    p.release_country,
    p.country_of_origin,
    p.origin_country,
    p.origin,
    p.region,
    p.nationality,
    p.place_of_birth,
    (
      entity.description ?? String(p.description ?? p.short_description ?? "")
    ).split(/[.!]/)[0],
  ]
    .map((v) => (typeof v === "string" ? v : JSON.stringify(v ?? "")))
    .join(" ")
}
export function entityGenres(entity: EchoesEntity) {
  const p = entity.properties
  const tags = Array.isArray(p.tags)
    ? (p.tags as { name?: string; type?: string; id?: string }[])
    : []
  return new Set(
    [
      p.genre,
      p.genres,
      p.primary_genres,
      p.secondary_genres,
      tags.filter((t) => /genre/.test(t.type ?? t.id ?? "")).map((t) => t.name),
    ]
      .flat(2)
      .filter((v): v is string => typeof v === "string")
      .map(normalizeName)
      .filter((v) => v && !/^\d+s$/.test(v))
  )
}
export function relevanceFor(
  candidate: EchoesEntity,
  seed: EchoesEntity | undefined,
  resident: ResidentInput
) {
  const content = `${candidate.description ?? ""} ${JSON.stringify(candidate.properties.genres ?? [])} ${JSON.stringify(candidate.properties.tags ?? [])}`
  if (/\b(cartoon|animation|animated|anime)\b/i.test(content))
    return { relevant: false, regional: false, signals: [] as string[] }
  const candidateOrigin = origin(candidate)
  const local = regions.filter(([, , pattern]) =>
    pattern.test(`${resident.country} ${resident.hometown}`)
  )
  const origins = regions.filter(([, , pattern]) =>
    pattern.test(candidateOrigin)
  )
  const regional = origins.some(([country, region]) =>
    local.some(([c, r]) => country === c || region === r)
  )
  const signals: string[] = []
  if (regional) signals.push("matching country or region")
  if (
    seed &&
    origins.some(([country]) =>
      regions.some(([c, , p]) => c === country && p.test(origin(seed)))
    )
  )
    signals.push("origin shared with producing seed")
  const candidateGenres = entityGenres(candidate)
  if (
    seed?.type === candidate.type &&
    [...entityGenres(seed)].some((g) => candidateGenres.has(g))
  )
    signals.push("genre shared with producing seed")
  const language = JSON.stringify([
    candidate.properties.original_language,
    candidate.properties.language,
    candidate.properties.languages,
  ]).toLowerCase()
  const preferred = /spanish|español/i.test(resident.language)
    ? /\b(es|spa|spanish|español)\b/
    : /twi|akan/i.test(resident.language)
      ? /\b(tw|twi|aka|akan)\b/
      : /english/i.test(resident.language)
        ? /\b(en|eng|english)\b/
        : null
  if (preferred?.test(language)) signals.push("preferred language")
  const available = JSON.stringify(
    candidate.properties.available_countries ??
      candidate.properties.availability ??
      []
  ).toLowerCase()
  if (local.some(([, , pattern]) => pattern.test(available)))
    signals.push("available in country")
  return { relevant: signals.length > 0, regional, signals }
}
