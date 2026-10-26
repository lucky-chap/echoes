const { chromium } = require(
  process.env.WORLDLINGS_PLAYWRIGHT_PATH || "playwright"
)
const assert = require("node:assert/strict")
const { sceneFixture } = require("./scene-fixture.cjs")
;(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.WORLDLINGS_BROWSER_PATH,
    headless: true,
    args: ["--no-sandbox"],
  })
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    })
    const errors = []
    page.on("pageerror", (e) => errors.push(e.message))
    await page.goto(process.env.WORLDLINGS_URL || "http://127.0.0.1:3001")
    // Synthetic provider output tests playback only; this does not assert live Groq access.
    await page.route("**/api/world/scene", async (route) => {
      if (route.request().method() !== "POST") return route.continue()
      const response = await route.fetch()
      const body = await response.json()
      if (!body.plan) return route.fulfill({ response })
      body.scene = sceneFixture({
        world: route.request().postDataJSON(),
        plan: body.plan,
      })
      body.diagnostics = {
        ...body.diagnostics,
        llm: "Groq Live",
        model: "TEST FIXTURE — not live Groq",
        requestStatus: "success",
        repetition: "fixture playback only",
      }
      await route.fulfill({ response, json: body })
    })
    await page.clock.install()
    await page
      .getByRole("combobox", { name: "Simulation speed" })
      .selectOption("4")
    await page.locator(".provider-details summary").click()
    let previousMessages = 0
    for (const [mode, names] of [
      ["pair", ["Mia", "Kai"]],
      ["trio", ["Mia", "Kai", "Luna"]],
      ["join", ["Mia", "Kai", "Luna"]],
      ["solo", ["Luna"]],
    ]) {
      await page
        .getByRole("combobox", { name: "Gathering scenario" })
        .selectOption(mode)
      await Promise.all([
        page.waitForResponse(
          (r) =>
            r.url().endsWith("/api/world/scene") &&
            r.request().method() === "POST"
        ),
        page.getByRole("button", { name: "Next Event", exact: true }).click(),
      ])
      let sawJoin = false,
        sawThree = false
      const bubbles = new Set()
      for (let i = 0; i < 120; i++) {
        await page.clock.runFor(500)
        const state = await page.evaluate(() => ({
          phase: document.querySelector(".live-badge").textContent,
          occupancy: document.querySelector('[data-testid="square-occupants"]')
            .textContent,
          speaker: document.querySelector(".speech-bubble strong")?.textContent,
        }))
        if (state.phase.includes("joining")) {
          sawJoin = true
          assert(!state.speaker)
          assert(!state.occupancy.includes("Conversation: mia, kai, luna"))
        }
        if (state.speaker) bubbles.add(state.speaker.trim().split(" ")[0])
        if (state.occupancy.includes("Conversation: mia, kai, luna"))
          sawThree = true
        if (
          await page
            .getByRole("combobox", { name: "Gathering scenario" })
            .isEnabled()
        )
          break
      }
      assert(
        await page
          .getByRole("combobox", { name: "Gathering scenario" })
          .isEnabled(),
        "scene must finish"
      )
      const speakers = await page
        .locator(".conversation-history li strong")
        .allTextContents()
      assert.deepEqual(
        [...new Set(speakers.slice(previousMessages))].sort(),
        names.slice().sort()
      )
      previousMessages = speakers.length
      assert.deepEqual([...bubbles].sort(), names.slice().sort())
      if (mode === "join") assert(sawJoin && sawThree)
      if (mode === "trio") assert(sawThree)
    }
    // A failed endpoint must continue activities without adding or replaying speech.
    await page.route("**/api/world/scene", (route) => route.abort("failed"))
    await page
      .getByRole("combobox", { name: "Gathering scenario" })
      .selectOption("trio")
    await page.getByRole("button", { name: "Next Event", exact: true }).click()
    await page.waitForTimeout(200)
    for (let i = 0; i < 120; i++) {
      await page.clock.runFor(500)
      if (
        await page
          .getByRole("combobox", { name: "Gathering scenario" })
          .isEnabled()
      )
        break
    }
    const newLines = (
      await page.locator(".conversation-history li").allTextContents()
    ).slice(previousMessages)
    assert.equal(newLines.length, 0)
    assert.equal(await page.locator(".speech-bubble").count(), 0)
    assert.match(await page.locator(".mock-pill").textContent(), /Fallback/)
    assert(
      await page
        .getByRole("combobox", { name: "Gathering scenario" })
        .isEnabled()
    )
    assert.deepEqual(errors, [])
    await page.screenshot({
      path: "/tmp/worldlings-gatherings.png",
      fullPage: true,
    })
    console.log(
      "PASS (synthetic provider fixtures): pair, trio, solo, physical late arrival, all speakers/bubbles/history, repeated cycles, API failure fallback without duplicated dialogue"
    )
  } finally {
    await browser.close()
  }
})().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
