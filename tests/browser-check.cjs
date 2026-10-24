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
    })
    const errors = []
    page.on("pageerror", (e) => errors.push(e.message))
    await page.addInitScript(() => {
      window.__audio = { contexts: 0, notes: [], contextsList: [] }
      const Original = window.AudioContext
      window.AudioContext = class extends Original {
        constructor(...args) {
          super(...args)
          window.__audio.contexts++
          window.__audio.contextsList.push(this)
        }
        createOscillator() {
          const osc = super.createOscillator()
          const original = osc.frequency.setValueAtTime.bind(osc.frequency)
          osc.frequency.setValueAtTime = (freq, time) => {
            window.__audio.notes.push(freq)
            return original(freq, time)
          }
          return osc
        }
      }
    })
    await page.goto(process.env.WORLDLINGS_URL || "http://localhost:3000")
    await page.waitForFunction(
      () =>
        document
          .querySelector(".town-canvas")
          ?.getContext("2d")
          .getImageData(100, 70, 1, 1).data[3] > 0
    )
    assert.equal(await page.evaluate(() => window.__audio.contexts), 0)
    await page.screenshot({ path: "/tmp/worldlings-idle.png", fullPage: true })
    await page.clock.install()
    await page.getByRole("button", { name: "Start Event", exact: true }).click()
    await page.waitForFunction(() =>
      document
        .querySelector(".live-badge")
        ?.textContent.includes("Gathering in the square")
    )
    await page.waitForTimeout(100)
    // The simulation clock uses 50ms ticks; runFor delivers each tick, unlike fastForward.
    await page.clock.runFor(11000)
    console.log(
      "After gathering:",
      await page.locator(".live-badge").textContent()
    )
    await page.screenshot({
      path: "/tmp/worldlings-after-eight.png",
      fullPage: true,
    })
    assert(await page.locator(".speech-bubble").count())
    assert.equal(await page.evaluate(() => window.__audio.contexts), 1)
    await page.screenshot({
      path: "/tmp/worldlings-speaking.png",
      fullPage: true,
    })
    await page
      .getByRole("button", { name: "Pause simulation", exact: true })
      .click()
    const speech = await page.locator(".speech-bubble p").textContent()
    await page.clock.runFor(15000)
    assert.equal(await page.locator(".speech-bubble p").textContent(), speech)
    await page
      .getByRole("button", { name: "Resume simulation", exact: true })
      .click()
    await page.clock.runFor(90000)
    assert.equal(
      await page
        .getByRole("button", { name: "Replay afternoon", exact: true })
        .count(),
      1
    )
    assert.match(
      await page.locator(".event-card h2").textContent(),
      /The Museum/
    )
    assert.equal(await page.locator(".speech-bubble").count(), 0)
    assert.match(
      await page.locator(".conversation-history summary").textContent(),
      /10 messages/
    )
    await page.screenshot({
      path: "/tmp/worldlings-finished.png",
      fullPage: true,
    })
    await page.locator("#situation").selectOption("rain")
    await page.waitForFunction(
      () =>
        document.querySelector("#situation").value === "rain" &&
        !document.querySelector("#situation").disabled
    )
    await page.clock.runFor(100000)
    assert.match(
      await page.locator(".event-card h2").textContent(),
      /The Daily Cup/
    )
    await page.locator("#situation").selectOption("performance")
    await page.waitForFunction(
      () =>
        document.querySelector("#situation").value === "performance" &&
        !document.querySelector("#situation").disabled
    )
    await page.clock.runFor(100000)
    assert.match(
      await page.locator(".event-card h2").textContent(),
      /The Green Room/
    )
    await page.getByRole("tab", { name: /Decision log/ }).click()
    assert.match(await page.locator(".decision-log").textContent(), /MOCK/)
    assert.match(
      await page.locator(".decision-log").textContent(),
      /Reevaluating/
    )
    await page.getByRole("button", { name: "Mute music", exact: true }).click()
    await page
      .getByRole("button", {
        name: "Mute character and environment sounds",
        exact: true,
      })
      .click()
    await page
      .getByRole("button", { name: "Replay afternoon", exact: true })
      .click()
    await page.clock.runFor(5000)
    assert.equal(await page.evaluate(() => window.__audio.contexts), 1)
    await page.getByRole("button", { name: "Reset demo", exact: true }).click()
    await page.clock.runFor(500)
    assert.equal(
      await page
        .getByRole("button", { name: "Start Event", exact: true })
        .count(),
      1
    )
    assert.equal(
      await page
        .getByRole("button", { name: "Enable music", exact: true })
        .count(),
      1
    )
    await page.setViewportSize({ width: 390, height: 844 })
    await page.clock.runFor(100)
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    )
    await page.screenshot({
      path: "/tmp/worldlings-mobile.png",
      fullPage: true,
    })
    assert.deepEqual(errors, [])
    console.log(
      "PASS browser: artwork, all phases, pause/resume, three computed outcomes, situation changes, log, replay/reset, one audio context, independent mute, mobile layout, no browser errors"
    )
    console.log(
      "Audio notes scheduled:",
      await page.evaluate(() => window.__audio.notes.length)
    )
  } finally {
    await browser.close()
  }
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
