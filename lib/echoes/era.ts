import type { KitItem, ResidentInput } from "./types"

export function eraWindow(birthYear: number) {
  return { from: birthYear + 13, to: birthYear + 25 }
}

export function sharedEraWindow(residents: ResidentInput[]) {
  const windows = residents.map((resident) => eraWindow(resident.birthYear))
  return {
    from: Math.min(...windows.map((window) => window.from)),
    to: Math.max(...windows.map((window) => window.to)),
  }
}

export function selectForCoverage(
  candidates: KitItem[],
  residentIds: string[],
  limit = 6
) {
  const available = [...candidates]
  const selected: KitItem[] = []
  const served = new Set<string>()
  while (available.length && selected.length < limit) {
    available.sort((a, b) => {
      const newCoverage = (item: KitItem) =>
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
