require("./echoes-runtime.cjs")
const fs = require("node:fs")
const { generateSessionKit } = require("../lib/echoes/pipeline.ts")
const { EchoesQlooClient } = require("../lib/echoes/qloo.ts")
const { reliabilityDemoProfiles: profiles } = require("../lib/echoes/demo-profiles.ts")
module.exports = { profiles }
if (require.main === module)
  (async () => {
    process.env.ECHOES_WARM_DEMO = "true"
    process.env.DEMO_MODE = "false"
    if (process.argv.includes("--offline")) process.env.ECHOES_OFFLINE = "true"
    const report = []
    const baseFetch = global.fetch
    let raw = []
    global.fetch = async (...args) => {
      const response = await baseFetch(...args)
      if (String(args[0]).includes("qloo.com")) {
        const url = new URL(String(args[0]))
        raw.push({
          path: url.pathname,
          params: Object.fromEntries(url.searchParams),
          status: response.status,
          payload: await response.clone().json(),
        })
      }
      return response
    }
    const client = new EchoesQlooClient()
    for (const resident of profiles) {
      raw = []
      const kit = await generateSessionKit({
        residents: [resident],
        feedback: [],
      })
      // Audit all four domains for every resolved seed, even when production budgets or era policy skip a seed.
      const seeds = kit.agentTrace
        .filter((t) => t.tool === "qloo_search")
        .flatMap((t) => t.output?.entities ?? [])
        .filter((r) =>
          resident.lovedThings.some(
            (n) => n.toLowerCase() === r.name.toLowerCase()
          )
        )
      const queries = []
      for (const seed of [
        ...new Map(seeds.map((s) => [s.entityId ?? s.id, s])).values(),
      ])
        for (const type of [
          "urn:entity:artist",
          "urn:entity:movie",
          "urn:entity:tv_show",
          "urn:entity:book",
        ]) {
          try {
            const results = await client.insights({
              type,
              entityIds: [seed.entityId ?? seed.id],
              era: kit.era,
            })
            queries.push({ seed: seed.name, type, results })
          } catch (e) {
            queries.push({ seed: seed.name, type, error: e.message })
          }
        }
      const decisions = queries.map((q) => ({
        ...q,
        results: (q.results ?? []).map((r, index) => ({
          rank: index + 1,
          rawNormalizedResult: r,
          outcome: kit.items.some((i) => i.entityId === r.entityId)
            ? "running order"
            : kit.alternatives?.some((i) => i.entityId === r.entityId)
              ? "verified alternative"
              : "held back",
          producingSeed: kit.items
            .concat(kit.alternatives ?? [])
            .find((i) => i.entityId === r.entityId)?.seed,
          decisions: kit.agentTrace
            .filter((t) => t.output?.entityId === r.entityId)
            .map((t) => ({
              tool: t.tool,
              outcome: t.outcome,
              reason: t.summary,
              details: t.output,
            })),
        })),
      }))
      report.push({
        resident,
        queries,
        decisions,
        rawNetworkResponses: raw,
        cacheNote:
          "Queries include unchanged normalized cached provider results; rawNetworkResponses contains HTTP bodies only for cache misses. No new network response is invented for a cache hit.",
        kit,
      })
      fs.writeFileSync(
        process.argv[2] ?? "/tmp/echoes-three-baseline.json",
        JSON.stringify(report, null, 2)
      )
      console.log(
        JSON.stringify({
          profile: resident.nickname,
          items: kit.items.map((i) => ({
            name: i.name,
            title: i.yearEvidence.title,
            seed: i.seed?.name,
          })),
          regional: queries.flatMap((q) =>
            (q.results ?? [])
              .filter((r) => /Bembeya|Sonora Matancera/i.test(r.name))
              .map((r) => ({
                name: r.name,
                seed: q.seed,
                rank: q.results.indexOf(r) + 1,
              }))
          ),
          output: process.argv[2] ?? "/tmp/echoes-three-baseline.json",
        })
      )
    }
  })().catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
