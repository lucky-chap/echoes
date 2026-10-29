import { aliasNames, nameVariants, normalizeName, sameName } from "./names"
import { searchArtists, type MusicBrainzArtist } from "./musicbrainz"
import { musicBrainzId } from "./year-facts"
import type { EchoesEntity, EchoesEntityType, ResidentInput } from "./types"
const domains: EchoesEntityType[] = [
  "urn:entity:artist",
  "urn:entity:tv_show",
  "urn:entity:movie",
  "urn:entity:book",
]
export function candidateDetail(entity: EchoesEntity) {
  const p = entity.properties
  return [
    entity.type.replace("urn:entity:", "").replace("_", " "),
    p.country ?? p.place_of_birth,
    p.start_year ? `active from ${p.start_year}` : null,
    entity.description,
  ]
    .filter((v) => typeof v === "string" || typeof v === "number")
    .join(" · ")
    .slice(0, 240)
}
export async function resolveFavorite(
  query: string,
  search: (query: string, type: EchoesEntityType) => Promise<EchoesEntity[]>,
  selected?: NonNullable<ResidentInput["resolvedFavorites"]>[number],
  aliases:
    ((query: string) => Promise<MusicBrainzArtist[]>) | false = searchArtists
) {
  const pool = new Map<string, EchoesEntity>()
  const variants = nameVariants(query)
  const names = (e: EchoesEntity) => [e.name, ...aliasNames(e.properties)]
  const matches = () =>
    [...pool.values()].filter((e) => names(e).some((n) => sameName(n, query)))
  const select = () => {
    if (selected)
      return [...pool.values()].find(
        (e) => e.entityId === selected.entityId && e.type === selected.type
      )
    const strong = matches()
    return strong.length === 1 ? strong[0] : undefined
  }
  for (const type of domains) {
    for (const variant of variants.slice(0, 4)) {
      for (const row of await search(variant, type)) pool.set(row.entityId, row)
      const found = select()
      if (found) return { entity: found, candidates: [] }
      if (matches().length > 1) break
    }
    if (matches().length > 1) break
  }
  if (aliases) {
    try {
      const artists = await aliases(query)
      for (const artist of artists) {
        const known = [
          artist.name,
          artist["sort-name"],
          ...(artist.aliases ?? []).flatMap((a) => [a.name, a["sort-name"]]),
        ].filter((n): n is string => Boolean(n))
        if (!known.some((n) => sameName(n, query))) continue
        // Expand only aliases actually returned by the provider.
        for (const variant of [...new Set([artist.name, ...known])].slice(
          0,
          3
        )) {
          for (const e of await search(variant, "urn:entity:artist")) {
            if (
              musicBrainzId(e) === artist.id ||
              sameName(e.name, artist.name)
            ) {
              pool.set(e.entityId, {
                ...e,
                properties: {
                  ...e.properties,
                  aliases: [...aliasNames(e.properties), ...known],
                  country: artist.country ?? artist.area?.name,
                  start_year: artist["life-span"]?.begin,
                  disambiguation: artist.disambiguation,
                },
                description: e.description ?? artist.disambiguation ?? null,
              })
            }
          }
        }
      }
    } catch {
      /* Retain Qloo candidates when alias lookup is unavailable. */
    }
  }
  const found = select()
  if (found) return { entity: found, candidates: [] }
  const strong = matches()
  const tokens = normalizeName(query).split(" ")
  const plausible = strong.length
    ? strong
    : [...pool.values()].filter((e) =>
        names(e).some((n) => {
          const value = normalizeName(n)
          return tokens.every((token) => value.includes(token))
        })
      )
  return { entity: undefined, candidates: plausible.slice(0, 5) }
}
