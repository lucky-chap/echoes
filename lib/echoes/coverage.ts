import type { SessionKit } from "./types"
export function coverageSummary(kit: SessionKit) {
  const checks = kit.dateChecks ?? []
  const pending = checks.filter(
    (check) => check.status === "unchecked_unavailable"
  )
  const completed = checks.filter(
    (check) => check.status !== "unchecked_unavailable"
  ).length
  const inWindow = checks.filter(
    (check) => check.status === "verified_in_window"
  ).length
  const domains = new Set(kit.items.map((item) => item.kind)).size
  const level: "strong" | "partial" | "thin" =
    inWindow >= 5 && domains >= 2
      ? "strong"
      : inWindow >= 2
        ? "partial"
        : "thin"
  return {
    pending,
    completed,
    inWindow,
    level,
    showFew:
      checks.some(
        (check) =>
          check.status === "verified_in_window" ||
          check.status === "verified_out_of_window"
      ) &&
      inWindow < 2 &&
      pending.length === 0,
  }
}
