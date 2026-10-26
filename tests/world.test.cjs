const { test, after } = require("node:test")
const assert = require("node:assert/strict")
const { mkdtempSync, rmSync } = require("node:fs")
const { tmpdir } = require("node:os")
const { join } = require("node:path")
const ts = require("typescript")

const output = mkdtempSync(join(tmpdir(), "worldlings-render-tests-"))
const program = ts.createProgram(
  [
    "lib/world/art.ts",
    "lib/world/movement.ts",
    "lib/world/audio/engine.ts",
    "lib/world/living/base.ts",
  ],
  {
    outDir: output,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2023,
    skipLibCheck: true,
  }
)
const diagnostics = ts.getPreEmitDiagnostics(program)
assert.equal(
  diagnostics.length,
  0,
  diagnostics
    .map((d) => ts.flattenDiagnosticMessageText(d.messageText, " "))
    .join("\n")
)
program.emit()
after(() => rmSync(output, { recursive: true, force: true }))

test("pixel renderer preserves finite integer drawing coordinates for all residents", () => {
  const { drawTown } = require(join(output, "art.js"))
  const { residents } = require(join(output, "profiles.js"))
  let draws = 0
  const ctx = new Proxy(
    {},
    {
      get: (_, key) =>
        key === "fillRect"
          ? (...args) => {
              assert(args.every(Number.isInteger))
              draws++
            }
          : () => {},
      set: () => true,
    }
  )
  drawTown(
    ctx,
    12,
    1,
    true,
    residents.map((resident) => resident.start),
    [true, false, true],
    1,
    { mia: "cafe", kai: "music", luna: "museum" }
  )
  assert(draws > 3000)
})

test("movement routes end at real map destinations and the square", () => {
  const { residents, destinations } = require(join(output, "profiles.js"))
  const { routeToDestination, routeToSquare } = require(
    join(output, "movement.js")
  )
  for (const [index, resident] of residents.entries()) {
    assert(routeToSquare(resident.start, index).length > 1)
    for (const destination of destinations) {
      const end = routeToDestination(resident.start, destination.id, index).at(
        -1
      )
      assert(
        Math.hypot(
          end[0] - destination.arrival[0],
          end[1] - destination.arrival[1]
        ) <= 16
      )
    }
  }
})

test("audio remains lazy, independently mutable, and disposable", async () => {
  const { WorldAudio, defaultAudioSettings } = require(
    join(output, "audio/engine.js")
  )
  const originalContext = global.AudioContext
  const originalSet = global.setInterval
  const originalClear = global.clearInterval
  let contexts = 0
  const intervals = new Set()
  let next = 0
  const param = () => ({
    value: 0,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
    setTargetAtTime() {},
    cancelScheduledValues() {},
  })
  class FakeContext {
    constructor() {
      contexts++
      this.currentTime = 0
      this.state = "suspended"
      this.destination = {}
    }
    createGain() {
      return { gain: param(), connect() {}, disconnect() {} }
    }
    createDynamicsCompressor() {
      return {
        threshold: param(),
        ratio: param(),
        connect() {},
        disconnect() {},
      }
    }
    createOscillator() {
      return {
        frequency: param(),
        connect() {},
        disconnect() {},
        start() {},
        stop() {},
        onended: null,
      }
    }
    async resume() {
      this.state = "running"
    }
    async suspend() {
      this.state = "suspended"
    }
    async close() {
      this.state = "closed"
    }
  }
  global.AudioContext = FakeContext
  global.setInterval = () => {
    intervals.add(++next)
    return next
  }
  global.clearInterval = (id) => intervals.delete(id)
  try {
    const audio = new WorldAudio()
    assert.equal(contexts, 0)
    assert.equal(await audio.unlock(), true)
    assert.equal(contexts, 1)
    audio.setSettings({ ...defaultAudioSettings, effectsEnabled: false })
    await audio.setHidden(true)
    assert.equal(audio.ready, false)
    audio.dispose()
    assert.equal(intervals.size, 0)
  } finally {
    global.AudioContext = originalContext
    global.setInterval = originalSet
    global.clearInterval = originalClear
  }
})
