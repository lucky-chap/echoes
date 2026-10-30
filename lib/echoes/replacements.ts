import type { EchoesEntity, KitItem, ResidentInput } from "./types"
import { entityGenres, relevanceFor } from "./suitability"

export function replacementSignals(
  item: KitItem,
  candidate: KitItem,
  entities: Map<string, EchoesEntity>,
  resident: ResidentInput
) {
  if (
    item.kind !== candidate.kind ||
    item.entityId === candidate.entityId ||
    candidate.cautions?.length
  )
    return []
  const source = entities.get(item.entityId)
  const alternative = entities.get(candidate.entityId)
  if (!source || !alternative) return []
  const a = entityGenres(source),
    b = entityGenres(alternative)
  // Broad labels such as pop/oldies or a shared country cannot turn soul into rock and roll.
  const rock = (genres: Set<string>) =>
    [...genres].some((g) => /rock and roll|rock n roll|rockabilly/.test(g))
  if (item.kind === "music" && rock(a) && !rock(b)) return []
  const signals: string[] = []
  const primary = (entity: EchoesEntity) => entityGenres({ ...entity, properties: { primary_genres: entity.properties.primary_genres } })
  const sharedPrimary = [...primary(source)].filter((genre) => primary(alternative).has(genre))
  if (sharedPrimary.length) signals.push(`shared primary genre: ${sharedPrimary.join(", ")}`)
  const shared = [...a].filter(
    (g) => b.has(g) && !/^(music|oldies|popular music)$/.test(g)
  )
  if (shared.length) signals.push(`shared genre: ${shared.join(", ")}`)
  if (
    candidate.seed?.entityId === item.entityId ||
    item.seed?.entityId === candidate.entityId ||
    Boolean(
      item.seed?.entityId && item.seed.entityId === candidate.seed?.entityId
    )
  )
    signals.push("same Qloo seed neighbourhood")
  if (relevanceFor(alternative, source, resident).regional)
    signals.push(`matching region: ${resident.country}`)
  return signals
}

export function assignReplacements(
  pool: KitItem[],
  plannedIds: Set<string>,
  entities: Map<string, EchoesEntity>,
  resident: ResidentInput
) {
  return pool.map((item) => {
    const options = pool
      .filter(
        (candidate) =>
          !plannedIds.has(candidate.entityId) &&
          candidate.yearEvidence.year >= resident.birthYear + 10 &&
          candidate.yearEvidence.year <= resident.birthYear + 25
      )
      .map((candidate) => ({
        candidate,
        signals: replacementSignals(item, candidate, entities, resident),
      }))
      .filter((row) => row.signals.length)
      .sort(
        (a, b) =>
          b.signals.length - a.signals.length ||
          (b.candidate.score ?? 0) - (a.candidate.score ?? 0)
      )
    const chosen = options.length >= 2 ? options.slice(0, 3) : []
    item.replacementIds = chosen.map((row) => row.candidate.entityId)
    return {
      entityId: item.entityId,
      options: options.map(({ candidate, signals }) => ({
        entityId: candidate.entityId,
        name: candidate.name,
        signals,
      })),
      selectedIds: item.replacementIds,
      reason: chosen.length
        ? "At least two unused, related, era-fit, avoid-clear alternatives"
        : "Fewer than two unused qualifying alternatives",
    }
  })
}
