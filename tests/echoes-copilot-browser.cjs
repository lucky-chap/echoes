// Full local protected-workspace check. Qloo discovery is explicitly intercepted;
// live-provider evidence lives separately in docs/qloo-feasibility.json.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright")
const assert = require("node:assert/strict")
const { spawn } = require("node:child_process")
const { mkdtempSync, rmSync } = require("node:fs")
const { tmpdir } = require("node:os")
const { join } = require("node:path")
const { randomBytes } = require("node:crypto")
const directory = mkdtempSync(join(tmpdir(), "echoes-browser-"))
const port = process.env.ECHOES_TEST_PORT || "3123"
const base = `http://127.0.0.1:${port}`
const passphrase = "fictional-test-only-caregiver-passphrase"
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    port,
  ],
  {
    env: {
      ...process.env,
      ECHOES_STORAGE_KEY: randomBytes(32).toString("hex"),
      ECHOES_CAREGIVER_CODE: passphrase,
      ECHOES_ORIGIN: base,
      ECHOES_DATA_DIR: directory,
    },
    stdio: ["ignore", "pipe", "pipe"],
  }
)
let logs = ""
server.stdout.on("data", (chunk) => {
  logs += chunk
})
server.stderr.on("data", (chunk) => {
  logs += chunk
})
let browser
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
;(async () => {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(base + "/api/echoes/access")).ok) break
    } catch {}
    if (server.exitCode !== null) throw Error(logs)
    await delay(250)
  }
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {}),
    args: ["--no-sandbox"],
  })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  })
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(e.message))
  assert.equal(
    (await context.request.get(base + "/api/echoes/workspace")).status(),
    401
  )
  assert.equal(
    (await context.request.get(base + "/api/echoes/family")).status(),
    401
  )
  assert.equal(
    (
      await context.request.post(base + "/api/echoes/access", {
        headers: { Origin: "https://untrusted.example" },
        data: { code: passphrase },
      })
    ).status(),
    403
  )
  await page.goto(base)
  await page.getByRole("button", { name: "Plan a meaningful session" }).click()
  await page.getByLabel("Caregiver passphrase").fill(passphrase)
  await page.getByRole("button", { name: "Unlock workspace" }).click()
  await page.getByRole("link", { name: "Create a new kit" }).click()
  await page.getByLabel("First name or nickname").fill("Fictional Pat")
  await page.getByLabel("Birth year", { exact: true }).fill("1945")
  await page.getByLabel("Where they grew up").fill("Liverpool")
  await page.getByLabel("Country", { exact: true }).fill("United Kingdom")
  const favorites = page.getByRole("textbox", {
    name: /A few things they love/,
  })
  await favorites.fill("")
  await favorites.pressSequentially("Test Artist, Test Film")
  assert.equal(await favorites.inputValue(), "Test Artist, Test Film")
  await page
    .getByRole("checkbox", { name: /I have appropriate consent/ })
    .check()
  const notesText = "Loved dancing at weddings. Prefers short items with pauses. Sit on her right."
  await page.getByLabel("Anything else we should know?").fill(notesText)
  await page.getByText("We understood — review and edit", { exact: true }).click()
  await page.getByLabel("Enjoys", { exact: true }).fill("Loved dancing at weddings")
  await page.getByLabel("Session pace", { exact: true }).fill("Short items, pauses")
  await page.getByLabel("Practical details", { exact: true }).fill("Sit on her right")
  await page.getByLabel("I reviewed and confirm these preferences").check()
  await page.getByText("Past responses (0)", { exact: true }).click()
  await page.getByLabel("Past item", { exact: true }).fill("Test Artist")
  await page.getByLabel("Traits observed", { exact: true }).fill("dance, upbeat")
  await page.getByRole("button", { name: "Save past response", exact: true }).click()
  const saved = async () => {
    await page
      .locator(".workspace-protection [role=status]")
      .filter({ hasText: "Saved to protected workspace" })
      .waitFor()
    await delay(750)
  }
  await saved()
  assert.equal(
    await page.evaluate(
      () =>
        Object.keys(localStorage).filter((k) =>
          k.startsWith("echoes-workspace")
        ).length
    ),
    0
  )
  let requestBody
  await page.route("**/api/echoes/kit", async (route) => {
    requestBody = route.request().postDataJSON()
    assert.equal(requestBody.residents.length, 1)
    const resident = requestBody.residents[0]
    assert.equal(resident.notes, notesText)
    assert.equal(resident.preferences.confirmed, true)
    assert(resident.responseHistory.some(h => h.item === "Test Artist" && h.response === "sparked"))
    const items = [
      "Test Artist",
      "Test Film",
      "Alternate Artist",
      "Second Alternate Artist",
    ].map(
      (name, i) => ({
        entityId: `fixture-${i}`,
        name,
        kind: i === 1 ? "film" : "music",
        type: i === 1 ? "urn:entity:movie" : "urn:entity:artist",
        whyItFits: ["Explicit browser fixture — not a live Qloo result"],
        matchedResidentIds: [resident.id],
        affinity: 0.5,
        yearEvidence: {
          year: 1964,
          source: i === 1 ? "TMDB" : "MusicBrainz",
          residentIds: [resident.id],
          title: name,
        },
      })
    )
    items[0].replacementIds = [items[2].entityId, items[3].entityId]
    const activities = [
      {
        id: "welcome",
        kind: "welcome",
        title: "Settle in",
        minutes: 3,
        prompt: "Would you like music or quiet company?",
        rationale: "Fictional fixture",
        approved: false,
      },
      ...items.slice(0, 2).map((i) => ({
        id: `media:${i.entityId}`,
        kind: "media",
        title: i.name,
        itemId: i.entityId,
        minutes: 8,
        prompt: "What catches your attention?",
        rationale: "Fixture only",
        approved: false,
      })),
      {
        id: "conversation",
        kind: "conversation",
        title: "An invitation to share",
        minutes: 8,
        prompt: "What would you like to talk about?",
        rationale: "No correct answers expected",
        approved: false,
      },
      {
        id: "closing",
        kind: "closing",
        title: "Close gently",
        minutes: 3,
        prompt: "Thank you for this time together.",
        rationale: "Fixture only",
        approved: false,
      },
    ]
    const kit = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      residents: [resident],
      era: { from: 1958, to: 1970 },
      items: items.slice(0, 2),
      alternatives: items.slice(2),
      activities,
      prompts: ["Would you like to listen or talk?"],
      aboutMe: {
        title: "About Fictional Pat",
        opening: "Caregiver-confirmed fictional profile",
        details: ["Liverpool, United Kingdom", "Preferred language: English"],
      },
      coverage: {
        percent: 100,
        servedResidentIds: [resident.id],
        underservedNames: [],
      },
      logistics: ["Sit on her right"],
      notes: ["Browser fixture; not live provider evidence."],
      agentTrace: [
        {
          id: "fixture-trace",
          createdAt: new Date().toISOString(),
          tool: "qloo_search",
          role: "Qloo Taste Explorer",
          outcome: "ok",
          summary: "Explicit browser fixture",
          input: { query: "Test Artist" },
          output: {
            entities: items.map((i) => ({ id: i.entityId, name: i.name })),
          },
        },
      ],
    }
    await route.fulfill({ json: { kit } })
  })
  await page
    .getByRole("button", { name: "Create a session kit", exact: true })
    .click()
  await page.getByRole("heading", { name: "Your running order" }).waitFor()
  assert.equal(
    await page
      .getByRole("button", { name: "Start your 30-minute session" })
      .isEnabled(),
    true
  )
  await page.getByRole("tab", { name: "Tips" }).click()
  await page.getByRole("heading", { name: "A gentle way in." }).waitFor()
  await page.getByRole("tab", { name: "Overview" }).click()
  assert(await page.getByText("Sit on her right", { exact: true }).isVisible())
  await page.locator(".activity-controls summary").first().click()
  const replacementOptions = await page.getByRole("combobox", { name: "Replace with" }).first().locator("option").allTextContents()
  assert(replacementOptions.some(text => text.includes("Alternate Artist")))
  assert(!replacementOptions.some(text => text.includes("Test Film")))
  await page
    .getByRole("combobox", { name: "Replace with" })
    .first()
    .selectOption("fixture-2")
  await page
    .getByRole("button", { name: "Move Alternate Artist down", exact: true })
    .click()
  await page.screenshot({
    path: "/tmp/echoes-copilot-plan.png",
    fullPage: true,
  })
  await page
    .getByRole("button", { name: "Start your 30-minute session" })
    .click()
  await page.getByRole("button", { name: "Next activity", exact: true }).click()
  await page.getByRole("button", { name: "Pause timer", exact: true }).click()
  await page
    .getByRole("button", { name: "Resume timer", exact: true })
    .waitFor()
  await page
    .getByRole("button", { name: "Finish early & wrap up", exact: true })
    .click()
  await page.getByRole("heading", { name: "What did you notice?" }).waitFor()
  await page
    .getByRole("group", { name: "Test Film", exact: true })
    .getByRole("button", { name: "Distress", exact: true })
    .click()
  await page
    .getByRole("group", { name: "An invitation to share", exact: true })
    .getByRole("button", { name: "Shared a story", exact: true })
    .click()
  await page
    .getByLabel("Optional words or context, as observed")
    .fill("Talked about a garden. Fictional browser observation.")
  await page
    .getByRole("button", { name: "Generate note from observations" })
    .click()
  assert.match(
    await page.getByLabel("Editable session note").inputValue(),
    /distress observed/
  )
  await page
    .getByLabel("Editable session note")
    .fill(
      "Caregiver-edited fictional note. Distress observed during Test Film; no intervention documented."
    )
  await page.getByRole("button", { name: "Save review & memory" }).click()
  await saved()
  await page.getByRole("button", { name: "Stay on review" }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  )
  await page.screenshot({
    path: "/tmp/echoes-copilot-review-mobile.png",
    fullPage: true,
  })
  await page.getByRole("link", { name: "Back to your dashboard" }).click()
  await page.getByRole("link", { name: "Create a new kit" }).click()
  await page
    .getByRole("button", { name: "Create a session kit", exact: true })
    .click()
  await page.getByRole("heading", { name: "Your running order" }).waitFor()
  assert(
    requestBody.feedback.some(
      (f) => f.entityId === "fixture-1" && f.status === "distressed"
    )
  )
  assert(requestBody.memories.some((m) => m.response === "distress"))
  assert(
    requestBody.memories.some(
      (m) => m.response === "shared_story" && m.status === "reported"
    )
  )
  await page.getByRole("link", { name: "Back to your dashboard" }).click()
  await page.getByRole("link", { name: "Create a new kit" }).click()
  await saved()
  await page.setViewportSize({ width: 1280, height: 900 })
  await page
    .getByRole("checkbox", { name: /I have authority to invite/ })
    .check()
  await page.getByRole("button", { name: "Create family intake link" }).click()
  const link = await page.getByLabel(/Share privately/).inputValue()
  assert(link.includes("/family#"))
  const familyContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  })
  const family = await familyContext.newPage()
  family.on("pageerror", (e) => errors.push(e.message))
  await family.goto(link)
  await family
    .getByLabel("Your relationship (no name needed)")
    .fill("Fictional daughter")
  await family.getByLabel("Birth year", { exact: true }).fill("1945")
  await family.getByLabel("Preferred language", { exact: true }).fill("English")
  await family.getByLabel("Hometown or region").fill("Manchester")
  await family.getByLabel("Country", { exact: true }).fill("United Kingdom")
  await family.getByLabel("Favourite musician or band").fill("The Beatles")
  await family.getByRole("checkbox").check()
  assert(
    await family.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  )
  await family.screenshot({
    path: "/tmp/echoes-family-mobile.png",
    fullPage: true,
  })
  await family.getByRole("button", { name: "Send to their caregiver" }).click()
  await family.getByText(/Thank you. The caregiver will review/).waitFor()
  assert.equal(
    (await familyContext.request.get(base + "/api/echoes/workspace")).status(),
    401
  )
  const replay = await familyContext.request.post(base + "/api/echoes/family", {
    headers: { Origin: base },
    data: {
      action: "submit",
      token: link.split("#")[1],
      authority: true,
      relationship: "Fictional daughter",
      profile: {
        birthYear: 1945,
        hometown: "Other",
        country: "United Kingdom",
        language: "English",
        lovedThings: ["The Beatles"],
        sensitivities: [],
      },
    },
  })
  assert.equal(replay.status(), 400)
  await page.getByRole("button", { name: "Check for family responses" }).click()
  await page
    .getByRole("heading", { name: "Review family information" })
    .waitFor()
  assert.equal(
    await page.getByLabel("Where they grew up").inputValue(),
    "Liverpool"
  )
  await page.getByRole("button", { name: "Reviewed — accept profile" }).click()
  await page.waitForFunction(
    () =>
      document.querySelector(
        ".resident-form input[placeholder='City or region']"
      )?.value === "Manchester"
  )
  await saved()
  const snapshot = await (
    await context.request.get(base + "/api/echoes/workspace")
  ).json()
  const stale = await context.request.put(base + "/api/echoes/workspace", {
    headers: { Origin: base },
    data: { workspace: snapshot.workspace, revision: snapshot.revision - 1 },
  })
  assert.equal(stale.status(), 409)
  await page.getByRole("button", { name: "Lock this tablet" }).click()
  await page.getByRole("heading", { name: "Caregiver workspace" }).waitFor()
  assert.equal(
    (await context.request.get(base + "/api/echoes/workspace")).status(),
    401
  )
  await page.getByLabel("Caregiver passphrase").fill(passphrase)
  await page.getByRole("button", { name: "Unlock workspace" }).click()
  assert.equal(
    await page.getByLabel("Where they grew up").inputValue(),
    "Manchester"
  )
  const loaded = await (
    await context.request.get(base + "/api/echoes/workspace")
  ).json()
  assert(
    loaded.workspace.sessions.some((s) =>
      s.noteDraft?.includes("Caregiver-edited fictional note")
    )
  )
  assert(
    loaded.workspace.memories.some(
      (m) => m.source === "family" && m.status === "confirmed"
    )
  )
  assert.equal(
    await page.evaluate(
      () =>
        Object.keys(localStorage).filter((k) =>
          k.startsWith("echoes-workspace")
        ).length
    ),
    0
  )
  assert.deepEqual(errors, [])
  console.log(
    "PASS: protected unlock/lock, no browser-stored care data, profile spacing, single-resident planning, running-order adjustment, optional live feedback, wrap-up/note persistence, next-session memory payload, family submit/review/replay rejection, cross-origin rejection, stale-save conflict, desktop/mobile overflow. Discovery was an explicit UI fixture; no live Qloo claims."
  )
})()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await browser?.close()
    server.kill("SIGTERM")
    await new Promise((resolve) =>
      server.exitCode !== null ? resolve() : server.once("exit", resolve)
    )
    rmSync(directory, { recursive: true, force: true })
  })
