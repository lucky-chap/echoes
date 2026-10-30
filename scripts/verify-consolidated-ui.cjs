// Render the actual provider rerun kits in a temporary protected workspace.
// No Qloo results are fabricated and the user's workspace is not touched.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright")
const { spawn } = require("node:child_process")
const { readFileSync, writeFileSync, mkdtempSync, mkdirSync } = require("node:fs")
const { randomBytes } = require("node:crypto")
const assert = require("node:assert/strict")
const report = JSON.parse(readFileSync(process.argv[2] || "/tmp/echoes-three-consolidated-final.json", "utf8"))
const directory = mkdtempSync("/tmp/echoes-consolidated-workspace-")
const output = "/tmp/echoes-consolidated-ui"
mkdirSync(output, { recursive: true })
const base = "http://127.0.0.1:3128", passphrase = "fictional-consolidated-verification-only"
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3128"], {
  env: { ...process.env, ECHOES_STORAGE_KEY: randomBytes(32).toString("hex"), ECHOES_CAREGIVER_CODE: passphrase, ECHOES_ORIGIN: base, ECHOES_DATA_DIR: directory },
  stdio: ["ignore", "pipe", "pipe"],
})
let logs = "", browser
server.stdout.on("data", (chunk) => { logs += chunk })
server.stderr.on("data", (chunk) => { logs += chunk })
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
;(async () => {
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(base + "/api/echoes/access")).ok) break } catch {}
    if (server.exitCode !== null) throw Error(logs)
    await sleep(250)
  }
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ["--no-sandbox"] })
  const context = await browser.newContext({ viewport: { width: 1365, height: 950 } })
  const auth = await context.request.post(base + "/api/echoes/access", { headers: { Origin: base }, data: { code: passphrase } })
  assert.equal(auth.status(), 200)
  const state = await (await context.request.get(base + "/api/echoes/workspace")).json()
  const workspace = {
    version: 1, secret: "protected-site", mode: "team", residents: report.map((p) => p.resident), feedback: [], traces: [],
    sessions: report.map(({ kit }) => ({ id: kit.id, createdAt: kit.createdAt, kit, feedback: [], engagement: null, noteDraft: null, progress: { activityId: kit.activities[0].id, updatedAt: kit.createdAt } })),
  }
  const saved = await context.request.put(base + "/api/echoes/workspace", { headers: { Origin: base }, data: { revision: state.revision, workspace } })
  assert.equal(saved.status(), 200, await saved.text())
  const page = await context.newPage(), errors = [], results = []
  page.on("pageerror", (error) => errors.push(error.message))
  for (const { resident, kit } of report) {
    await page.goto(`${base}/kit/${kit.id}`)
    await page.getByRole("heading", { name: "Your running order" }).waitFor()
    const rows = []
    for (const item of kit.items) {
      const card = page.locator(".activity-card").filter({ has: page.getByRole("heading", { name: item.name, exact: true }) })
      assert.equal(await card.count(), 1)
      const text = await card.innerText()
      assert.equal((text.match(/A caregiver-supplied favourite, resolved by Qloo/g) || []).length, item.namedFavorite ? 1 : 0)
      assert(!text.includes(".."))
      const badge = await card.locator(".year-evidence").innerText()
      assert(await card.locator(".year-evidence").evaluate((element) => parseFloat(getComputedStyle(element).fontSize) >= 14))
      if (item.yearEvidence.artistLevel) assert(badge.includes(`in your window: ${kit.era.from}–${kit.era.to}`))
      if (item.name === "Coronation Street") assert(badge.includes("1960–present"))
      if (item.name === "The Dick Van Dyke Show" && resident.nickname === "Robert") assert(text.includes("Because you chose The Mary Tyler Moore Show"))
      if (!await card.locator(".activity-controls").evaluate((element) => element.open))
        await card.locator(".activity-controls > summary").click()
      const select = card.getByRole("combobox", { name: "Replace with" })
      const swaps = await select.count() ? (await select.locator("option").allTextContents()).slice(1) : []
      assert.equal(swaps.length, (item.replacementIds ?? []).length, item.name)
      assert(swaps.length === 0 || (swaps.length >= 2 && swaps.length <= 3))
      rows.push({ name: item.name, badge, swaps, prompt: await card.locator(".activity-prompt").innerText() })
    }
    const thread = await page.locator(".activity-card").filter({ has: page.getByRole("heading", { name: "Follow the thread", exact: true }) }).locator(".activity-prompt").innerText()
    const prompts = await page.locator(".activity-prompt").allTextContents()
    assert.equal(new Set(prompts).size, prompts.length, `${resident.nickname}: duplicate prompts`)
    const tails = prompts.filter((s) => s.includes(", or ")).map((s) => s.split(", or ").at(-1))
    assert.equal(new Set(tails).size, tails.length, `${resident.nickname}: duplicate opt-out tails`)
    await page.screenshot({ path: `${output}/${resident.nickname.toLowerCase()}-plan.png`, fullPage: true })
    await page.getByRole("tab", { name: "Tips" }).click()
    await page.getByRole("heading", { name: "A gentle way in." }).waitFor()
    await page.screenshot({ path: `${output}/${resident.nickname.toLowerCase()}-tips.png`, fullPage: true })
    await page.getByRole("tab", { name: "Overview" }).click()
    const swappable = kit.items.find((item) => item.replacementIds?.length >= 2)
    let changedTo
    if (swappable) {
      const card = page.locator(".activity-card").filter({ has: page.getByRole("heading", { name: swappable.name, exact: true }) })
      if (!await card.locator(".activity-controls").evaluate((element) => element.open))
        await card.locator(".activity-controls > summary").click()
      const replacementId = swappable.replacementIds[0]
      changedTo = kit.alternatives.find((item) => item.entityId === replacementId).name
      await card.getByRole("combobox", { name: "Replace with" }).selectOption(replacementId)
      await page.getByRole("heading", { name: changedTo, exact: true }).waitFor()
      await page.locator(".workspace-protection [role=status]").filter({ hasText: "Saved to protected workspace" }).waitFor()
      await sleep(800)
    }
    await page.reload()
    await page.getByRole("heading", { name: "Your running order" }).waitFor()
    assert.equal(await page.locator(".activity-list > .activity-card").count(), kit.activities.length)
    if (changedTo) await page.getByRole("heading", { name: changedTo, exact: true }).waitFor()
    await page.getByRole("button", { name: "Start your 30-minute session", exact: true }).click()
    await page.waitForURL(/\/live\//)
    await page.getByRole("heading", { name: "Settle in and offer a choice", exact: true }).waitFor()
    results.push({ profile: resident.nickname, rows, thread, reload: "passed", swapPersisted: changedTo ?? "no two qualifying alternatives", beginSession: "passed" })
  }
  assert.deepEqual(errors, [])
  // Also exercise an artist-level badge, even when all three live kits have track evidence.
  const fallback = structuredClone(workspace.sessions[0])
  fallback.id = fallback.kit.id = "browser-artist-fallback-check"
  const item = fallback.kit.items.find((i) => i.kind === "music")
  item.yearEvidence.artistLevel = true
  delete item.yearEvidence.title
  const current = await (await context.request.get(base + "/api/echoes/workspace")).json()
  current.workspace.sessions.push(fallback)
  const saveFallback = await context.request.put(base + "/api/echoes/workspace", { headers: { Origin: base }, data: { revision: current.revision, workspace: current.workspace } })
  assert.equal(saveFallback.status(), 200, await saveFallback.text())
  await page.goto(`${base}/kit/${fallback.id}`)
  const fallbackCard = page.locator(".activity-card").filter({ has: page.getByRole("heading", { name: item.name, exact: true }) })
  await fallbackCard.waitFor()
  assert((await fallbackCard.locator(".year-evidence").innerText()).includes(`in your window: ${fallback.kit.era.from}–${fallback.kit.era.to}`))
  writeFileSync(`${output}/results.json`, JSON.stringify({ results, artistFallbackBadge: "passed (explicit synthetic display fixture)", errors }, null, 2))
  console.log(JSON.stringify({ results, output }, null, 2))
})().catch((error) => { console.error(error); console.error(logs.slice(-2500)); process.exitCode = 1 }).finally(async () => {
  if (browser) await browser.close()
  server.kill("SIGTERM")
})
