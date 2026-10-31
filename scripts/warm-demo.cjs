require("./echoes-runtime.cjs")
const { generateSessionKit } = require("../lib/echoes/pipeline.ts")
const { reliabilityDemoProfiles } = require("../lib/echoes/demo-profiles.ts")
const {
  writeProviderCache,
  beginCacheAudit,
  observedCacheKeys,
} = require("../lib/echoes/provider-cache.ts")
const { coverageSummary } = require("../lib/echoes/coverage.ts")
const fs = require("node:fs")
const offline = process.argv.includes("--offline")
const coldA = process.argv.includes("--cold-a")
if (coldA)
  process.env.ECHOES_CACHE_DIR = require("node:fs").mkdtempSync(
    require("node:path").join(require("node:os").tmpdir(), "echoes-cold-a-")
  )
let networkCalls = 0
process.env.DEMO_MODE = offline ? "true" : "false"
process.env.ECHOES_WARM_DEMO = "true"
process.env.ECHOES_TOOL_BUDGET = process.env.ECHOES_TOOL_BUDGET || "240"
if (offline) {
  process.env.ECHOES_OFFLINE = "true"
  global.fetch = async () => {
    networkCalls++
    throw Error("NETWORK_DISABLED: unexpected live call")
  }
}
;(async () => {
  const results = []
  for (const resident of coldA
    ? reliabilityDemoProfiles.slice(0, 1)
    : reliabilityDemoProfiles) {
    beginCacheAudit()
    const feedback = []
    const kit = await generateSessionKit({ residents: [resident], feedback })
    const coverage = coverageSummary(kit)
    const summary = {
      profileId: resident.id,
      profile: resident.nickname,
      resolved: kit.diagnostics.resolved,
      dated: coverage.inWindow,
      failed: coverage.pending.length,
      level: coverage.level,
      resolutionPending: kit.resolutionChoices?.length ?? 0,
      items: kit.items.map((i) => ({
        name: i.name,
        year: i.yearEvidence.year,
        source: i.yearEvidence.source,
        cached: Boolean(i.yearEvidence.cached),
      })),
      completePlan:
        kit.activities.reduce((sum, a) => sum + a.minutes, 0) === 30,
      checked: coverage.completed,
      networkCalls: offline ? networkCalls : undefined,
      pending: coverage.pending.map((check) => ({
        name: check.entity.name,
        reason: check.reason,
      })),
      cacheKeys: observedCacheKeys(),
    }
    results.push(summary)
    if (!offline)
      writeProviderCache(
        `demo:${resident.id}`,
        summary,
        "Echoes warm-demo audit of real provider responses"
      )
    console.log(
      JSON.stringify({ ...summary, cacheKeys: summary.cacheKeys.length })
    )
    if (
      (coverage.level === "thin" && coverage.pending.length) ||
      summary.resolutionPending ||
      summary.resolved < resident.lovedThings.length
    )
      process.exitCode = 1
    if (offline && networkCalls) process.exitCode = 1
    if (
      offline &&
      (coverage.pending.length || kit.items.some((i) => !i.yearEvidence.cached))
    )
      process.exitCode = 1
    if (!offline) await new Promise((resolve) => setTimeout(resolve, 1100))
  }
  fs.writeFileSync(
    offline ? "/tmp/echoes-demo-offline.json" : "/tmp/echoes-demo-warm.json",
    JSON.stringify(results, null, 2)
  )
})().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
