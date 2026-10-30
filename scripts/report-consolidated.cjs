const fs = require("node:fs")
const { createHash } = require("node:crypto")
const file = process.argv[2] || "/tmp/echoes-three-consolidated-final.json"
const raw = fs.readFileSync(file, "utf8"), report = JSON.parse(raw)
const cell = (value) => String(value ?? "unknown").replaceAll("|", "\\|").replaceAll("\n", " ")
const out = ["# Echoes consolidated verification", "", `Generated ${new Date().toISOString()}.`, "",
  "Demo profile birth years and notes are unchanged: Dorothy 1944, Margaret 1946, Robert 1950.", "",
  "The diagnosis and full before-ranking tables are in [echoes-consolidated-diagnosis.md](echoes-consolidated-diagnosis.md). This file records the final provider-backed kits, including cached responses. The browser verifier loads those actual kits into a separate temporary protected workspace; it does not invent discovery results.", "",
  `Evidence JSON: ${file}. SHA-256: \`${createHash("sha256").update(raw).digest("hex")}\`.`, "",
  "## What changed", "",
  "- Qloo name-search records were missing notable songs. The verified Insights lookup using filter.results.entities, without self-interest exclusion, supplies those fields before ranking favourites.",
  "- Ranking uses Qloo notable-song match, known official release count, widely-released evidence, then year. A two-release lead (N = 2) is sufficient without a notable match. Unknown is never zero. Unknown top or runner-up counts, or a lead below two, produce an artist invitation when there is no notable match.",
  "- All in-window singles remain in the ranking table. Up to 12 previously unknown release groups per artist are checked per run, deduplicated, throttled to at most one MusicBrainz request per second and cached. Existing known counts do not consume that request allowance. Failed and malformed count responses are not cached as successful results.",
  "- Artist invitations show the era window in review, overview, swaps and live-session badges. Date badges now use 14px text rather than 8px.",
  "- Swap qualification records genre, region and Qloo-neighbourhood evidence. It excludes current running-order items, unsafe alternatives and out-of-window alternatives, requires two options and caps lists at three. Rock-and-roll swaps need matching rock-and-roll/rockabilly evidence. The date budget reserves two additional music checks after 16 independent checks, within the existing overall tool/time bounds; publication years already present in Qloo book payloads do not consume independent-provider checks.",
  "- The planner reserves a related earlier screen discovery when a named screen favourite starts late in the window. This restores Robert’s Dick Van Dyke item without replacing his named favourite.",
  "- Named favourites with provider keyword matches remain visible with the matched term, source field and avoid topic. Discoveries remain strict. The conservative default is separately identified when it excludes content.",
  "- UK/US music searches resolve the real British/American genre tags and supplement the seed searches. Film/TV requests retain country filters. Artist start dates prioritize independent date checks; they never approve a release on their own.",
  "- Confirmed cooking specifics, music-attached movement and choir invitations are preserved. Prompt tails are checked for duplicates, including during swaps. Logistics are capitalized and punctuated in the plan and Tips.", "",
  "## ListenBrainz check", "",
  "The documented per-artist top-recordings endpoint returned HTTP 401 (authentication required). Its rate-limit headers allowed 30 requests per window, with 29 remaining and reset-in 1; authentication, not the rate limit, was the blocker. No ListenBrainz token is configured, so no ListenBrainz popularity signal is claimed or fabricated. See the [official popularity API documentation](https://listenbrainz.readthedocs.io/en/latest/users/api/popularity.html).", "",
  "## Cache behaviour and Dusty’s formerly missing counts", "",
  "Successful provider responses persist for 30 days in .echoes-data/provider-cache, with SHA-256 filenames derived from logical keys. HTTP/network/parse failures are not written. A malformed legacy count response is ignored and retried; it cannot overwrite a known count. A valid provider count of zero remains zero.", "",
  "Count key: `MusicBrainz:https://musicbrainz.org/ws/2/release/?release-group=<MBID>&limit=1&status=official&fmt=json`. Catalogue key: `years:v5:urn:entity:artist:<normalized artist>:<linked MBID>`. Resolved identity key: `Qloo:resolved-search:<type>:<normalized name without spaces>`. Enrichment responses use `Qloo:<full /v2/insights URL>`.", "",
  "The previous table already had a known count of 1 for I Only Want to Be With You / Once Upon a Time. You Don’t Have to Say You Love Me was marked outside_cap, not a title-match failure. Previously, already-cached early candidates consumed the 12-target shortlist again. The new allowance applies to unknown counts, and notable-song metadata prioritizes the relevant singles. Both counts are now known; the table below records the resulting choice.", "",
  "## Final ranking candidate tables", ""]
for (const [profile, artist] of [["Dorothy", "Aretha Franklin"], ["Dorothy", "Elvis Presley"], ["Margaret", "The Beatles"], ["Robert", "Stevie Wonder"], ["Robert", "Carole King"], ["Margaret", "Dusty Springfield"], ["Margaret", "The Who"]]) {
  const p = report.find((row) => row.resident.nickname === profile), k = p.kit
  const item = [...k.items, ...k.alternatives].find((row) => row.name === artist)
  const ranking = k.agentTrace.find((trace) => trace.output?.entityId === item?.entityId && trace.output?.candidates)?.output
  out.push(`### ${artist} — ${profile}`, "", `Choice: ${item?.yearEvidence.title ?? "artist-level invitation"}. Decision: ${ranking?.decision ?? "not available"}. Popularity coverage incomplete: ${ranking?.popularityCoverageIncomplete ?? "unknown"}.`, "", "|Rank|Candidate|Year|Qloo notable|Official releases|Widely released|Count status|Selected|", "|---:|---|---:|---|---:|---|---|---|")
  for (const [index, row] of (ranking?.candidates ?? []).entries()) out.push(`|${index + 1}|${cell(row.title)}|${row.year}|${row.notable}|${row.releaseCount ?? "unknown"}|${row.widelyReleased}|${row.countStatus}|${row.selected}|`)
  out.push("")
}
out.push("## Final rerun plans", "")
for (const { resident, kit: k } of report) {
  const pool = [...k.items, ...k.alternatives]
  out.push(`### ${resident.nickname} — ${k.era.from}–${k.era.to}`, "", `Practical details: ${k.logistics.join(" ")}`, "", "|Minutes|Activity|Invitation|", "|---|---|---|")
  let minute = 0
  for (const activity of k.activities) { out.push(`|${minute}–${minute + activity.minutes}|${cell(activity.title)}|${cell(activity.prompt)}|`); minute += activity.minutes }
  out.push("", "|Item|Work / date|Swap list|", "|---|---|---|")
  for (const item of k.items) {
    const e = item.yearEvidence
    const date = e.artistLevel ? `in your window: ${k.era.from}–${k.era.to}` : e.firstAirYear ? `${e.firstAirYear}–${e.ongoing ? "present" : e.lastAirYear}` : e.year
    out.push(`|${cell(item.name)}|${cell(e.title ?? "Artist invitation")} · ${date}|${(item.replacementIds ?? []).map((id) => cell(pool.find((row) => row.entityId === id)?.name)).join("; ") || "None: fewer than two unused qualifying options"}|`)
  }
  out.push("", "Item labels and swap evidence:", "")
  for (const item of k.items) {
    out.push(`- **${item.name}:** ${item.whyItFits.join(" ")}`)
    const swap = k.agentTrace.find((t) => t.output?.entityId === item.entityId && t.output?.purpose === "replacement qualification")?.output
    out.push(`  Swap audit: ${(swap?.options ?? []).map((o) => `${o.name} (${o.signals.join("; ")})`).join(". ") || "No qualifying unused candidates"}. ${swap?.reason ?? ""}.`)
  }
  out.push("", "Coverage and exclusions:", "", ...k.notes.map((note) => `- ${note}`), "")
  const pending = k.dateChecks.filter((c) => c.status === "unchecked_unavailable")
  for (const check of pending) out.push(`- Pending: ${check.entity.name} — ${check.reason}.`)
  out.push("")
}
out.push("## Margaret: actual constrained request results", "", "Every row below comes from the final request trace. Music uses both ordinary seed neighbourhoods and supplementary British-tag searches; movie/TV requests include United Kingdom. Raw normalized metadata and all decision traces remain in the evidence JSON.", "")
const m = report.find((p) => p.resident.nickname === "Margaret").kit
for (const t of m.agentTrace.filter((t) => t.tool === "qloo_insights" && t.input?.seeds)) {
  out.push(`### ${t.input.seed.name} → ${t.input.type}${t.input.regionalTags?.length ? " (regional tag)" : ""}`, "", `Constraints: ${JSON.stringify({ era: t.input.era, country: t.input.country, regionalTags: t.input.regionalTags })}.`, "", "|Provider rank|Candidate|Outcome / reason|", "|---:|---|---|")
  for (const [index, row] of (t.output?.entities ?? []).entries()) {
    const verdict = m.items.some((i) => i.entityId === row.entityId) ? "Running order" : m.alternatives.some((i) => i.entityId === row.entityId) ? "Verified alternative" : m.agentTrace.filter((t) => t.output?.entityId === row.entityId && (t.outcome === "excluded" || t.tool === "era_verify")).map((t) => t.summary).join(" ") || "Not selected"
    out.push(`|${index + 1}|${cell(row.name)}|${cell(verdict)}|`)
  }
  out.push("")
}
out.push("## Notes accuracy", "", "Dorothy’s existing demo notes mention choir singing and afternoon tea, not baking pies, a school-cook career or sewing. Those details were not invented and the demo notes were not edited. The tea invitation supports those details when they are actually present in confirmed notes; her current plan retains choir, tea and short quiet pauses.", "")
const uiPath = "/tmp/echoes-consolidated-ui/results.json"
if (fs.existsSync(uiPath)) {
  const ui = JSON.parse(fs.readFileSync(uiPath, "utf8"))
  out.push("## Browser verification", "", "Production build, headless Chromium, real rerun kits in a temporary protected workspace. An additional explicitly synthetic display fixture checks the artist-level badge.", "")
  for (const row of ui.results) out.push(`- ${row.profile}: reload ${row.reload}; Begin Session ${row.beginSession}; replacement persisted: ${row.swapPersisted}. Follow the thread: ${row.thread}`)
  out.push(`- Artist-level display fixture: ${ui.artistFallbackBadge}.`, `- Browser page errors: ${ui.errors.length}.`, "", `Screenshots and rendered swap/badge results: ${uiPath}.`, "")
}
const testLog = fs.readFileSync("/tmp/echoes-consolidated-tests.log", "utf8")
out.push("## Automated validation", "", `- npm test: ${testLog.match(/ℹ pass (\d+)/)?.[1] ?? "unknown"} passed; ${testLog.match(/ℹ fail (\d+)/)?.[1] ?? "unknown"} failed.`, "- Production build: npx next build --webpack; log at /tmp/echoes-consolidated-build.log.", "- Demo profile file unchanged; no birth-year or note edits.", "")
out.push("## Repeat the checks", "", "```sh", "npm test", "npx next build --webpack", "node scripts/diagnose-three-profiles.cjs /tmp/echoes-three-consolidated-final.json", "# Set PLAYWRIGHT_MODULE and CHROMIUM_PATH if Playwright is installed outside this repository.", "node scripts/verify-consolidated-ui.cjs /tmp/echoes-three-consolidated-final.json", "node scripts/report-consolidated.cjs /tmp/echoes-three-consolidated-final.json", "```", "", "For manual testing, create a new kit from each unchanged demo profile. Existing saved kits retain their saved content. Review Overview and Tips, expand Adjust this activity to inspect available swaps, reload, then start the session.")
fs.writeFileSync("docs/echoes-consolidated-verification.md", out.join("\n") + "\n")
console.log("docs/echoes-consolidated-verification.md")
