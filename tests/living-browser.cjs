const { chromium } = require(
  process.env.WORLDLINGS_PLAYWRIGHT_PATH || "playwright"
)
const assert = require("node:assert/strict")
;(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.WORLDLINGS_BROWSER_PATH,
    headless: true,
    args: ["--no-sandbox"],
  })
  try {
    const page = await browser.newPage({
        viewport: { width: 1440, height: 1100 },
      }),
      errors = [],
      scenes = []
    page.on("pageerror", (e) => errors.push(e.message))
    page.on("response", async (r) => {
      if (
        r.status() === 200 &&
        r.url().endsWith("/api/world/scene") &&
        r.request().method() === "POST"
      )
        scenes.push(await r.json())
    })
    await page.addInitScript(() => {
      window.__audio = { contexts: 0, notes: 0 }
      const Original = window.AudioContext
      window.AudioContext = class extends Original {
        constructor(...args) {
          super(...args)
          window.__audio.contexts++
        }
        createOscillator() {
          window.__audio.notes++
          return super.createOscillator()
        }
      }
    })
    const base = process.env.WORLDLINGS_URL || "http://127.0.0.1:3001"
    await page.goto(base)
    await page.waitForFunction(
      () =>
        document
          .querySelector(".town-canvas")
          ?.getContext("2d")
          .getImageData(100, 70, 1, 1).data[3] > 0
    )
    assert.equal(await page.evaluate(() => window.__audio.contexts), 0)
    await page.clock.install()
    await page
      .getByRole("combobox", { name: "Simulation speed" })
      .selectOption("4")
    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().endsWith("/api/world/scene") &&
          r.request().method() === "POST"
      ),
      page.getByRole("button", { name: "Start Event", exact: true }).click(),
    ])
    await page.waitForTimeout(200)
    assert.equal(scenes[0].diagnostics.llm, "Groq Mock")
    assert(scenes[0].diagnostics.reason)
    await page.clock.runFor(5000)
    assert(await page.locator(".speech-bubble").count())
    const line = await page.locator(".speech-bubble p").textContent()
    assert(!/\d|score|Qloo/.test(line))
    await page
      .getByRole("button", { name: "Pause simulation", exact: true })
      .click()
    const speech = await page.locator(".speech-bubble p").textContent()
    await page.clock.runFor(12000)
    assert.equal(await page.locator(".speech-bubble p").textContent(), speech)
    await page
      .getByRole("button", { name: "Resume simulation", exact: true })
      .click()
    // Drive each scene and allow real HTTP responses between virtual time advances.
    for (let i = 0; i < 12; i++) {
      await page.clock.runFor(10000)
      await page.waitForTimeout(100)
    }
    await page.waitForFunction(() =>
      document
        .querySelector(".event-footnote")
        ?.textContent.includes("checkpoint")
    )
    assert.equal(scenes.length, 3)
    assert.match(await page.locator(".day-card").textContent(), /Day 02/)
    await page.clock.runFor(60000)
    assert.equal(scenes.length, 3)
    await page.locator(".memory-panel summary").click()
    assert(await page.locator(".memory-panel li").count())
    assert((await page.evaluate(() => window.__audio.notes)) > 0)
    assert.equal(await page.evaluate(() => window.__audio.contexts), 1)
    await page.getByRole("button", { name: "Mute music", exact: true }).click()
    await page
      .getByRole("button", { name: "Mute character and environment sounds" })
      .click()
    await page.getByRole("button", { name: "Next Event", exact: true }).click()
    await page.waitForTimeout(100)
    await page.clock.runFor(30000)
    await page.waitForTimeout(100)
    assert.equal(scenes.length, 4)
    await page.screenshot({
      path: "/tmp/worldlings-living-desktop.png",
      fullPage: true,
    })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({
      path: "/tmp/worldlings-living-mobile.png",
      fullPage: true,
    })
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    )
    await page.getByRole("button", { name: "Reset World" }).click()
    assert.equal(await page.locator(".memory-panel li").count(), 0)
    assert.match(await page.locator(".day-card").textContent(), /Day 01/)
    const invalid = await page.evaluate(async () => {
      const r = await fetch("/api/world/scene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
      return r.status
    })
    assert.equal(invalid, 400)
    assert.deepEqual(errors, [])
    console.log(
      "PASS: scenes, checkpoints, day rollover, memory, pause/speed, audio controls, mobile layout, reset and invalid requests"
    )
  } finally {
    await browser.close()
  }
})().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
