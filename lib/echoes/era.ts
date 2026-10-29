import type { KitItem, ResidentInput } from "./types"

export const REMINISCENCE_ERA_START_AGE = 10
export const REMINISCENCE_ERA_END_AGE = 25

export function eraWindow(birthYear: number) {
  return {
    from: birthYear + REMINISCENCE_ERA_START_AGE,
    to: birthYear + REMINISCENCE_ERA_END_AGE,
  }
}

export function sharedEraWindow(residents: ResidentInput[]) {
  const windows = residents.map((resident) => eraWindow(resident.birthYear))
  return {
    from: Math.min(...windows.map((window) => window.from)),
    to: Math.max(...windows.map((window) => window.to)),
  }
}

export function selectForCoverage<T extends Pick<KitItem, "matchedResidentIds" | "affinity">>(
  candidates: T[],
  residentIds: string[],
  limit = 6
) {
  const available = [...candidates]
  const selected: T[] = []
  const served = new Set<string>()
  while (available.length && selected.length < limit) {
    available.sort((a, b) => {
      const newCoverage = (item: T) =>
        item.matchedResidentIds.filter((id) => !served.has(id)).length
      return (
        newCoverage(b) - newCoverage(a) ||
        b.matchedResidentIds.length - a.matchedResidentIds.length ||
        (b.affinity ?? 0) - (a.affinity ?? 0)
      )
    })
    const next = available.shift()!
    selected.push(next)
    next.matchedResidentIds.forEach((id) => served.add(id))
  }
  const servedResidentIds = residentIds.filter((id) => served.has(id))
  return {
    items: selected,
    servedResidentIds,
    percent: residentIds.length
      ? Math.round((servedResidentIds.length / residentIds.length) * 100)
      : 0,
  }
}
