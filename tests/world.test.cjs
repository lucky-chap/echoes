const { test, after } = require("node:test")
const assert = require("node:assert/strict")
const { mkdtempSync, rmSync } = require("node:fs")
const { tmpdir } = require("node:os")
const { join } = require("node:path")
const ts = require("typescript")
const output = mkdtempSync(join(tmpdir(), "worldlings-tests-"))
const program = ts.createProgram(
  [
    "lib/world/simulation.ts",
    "lib/world/taste-provider.ts",
    "lib/world/audio/engine.ts",
    "lib/world/art.ts",
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
  ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (f) => f,
    getCurrentDirectory: () => process.cwd(),
    getNewLine: () => "\n",
  })
)
program.emit()
after(() => rmSync(output, { recursive: true, force: true }))
const { residents, destinations } = require(join(output, "profiles.js"))
const { mockTasteProvider } = require(join(output, "taste-provider.js"))
const { negotiate } = require(join(output, "decision.js"))
const { idleSimulation, beginSimulation, advanceSimulation, phases } = require(
  join(output, "simulation.js")
)
const { routeToDestination } = require(join(output, "movement.js"))
const recommendations = (situation) =>
  mockTasteProvider.recommend({ profiles: residents, destinations, situation })

test("all residents influence the result; each situation uses distinct complete MOCK scores", async () => {
  const winners = []
  for (const situation of ["sunny", "rain", "performance"]) {
    const rec = await recommendations(situation)
    assert.equal(rec.length, 9)
    assert(rec.every((r) => r.source === "MOCK"))
    const decision = negotiate(rec)
    winners.push(decision.winner.id)
    assert.equal(Object.keys(decision.proposals).length, 3)
    const w = decision.winner
    assert.equal(
      w.collective,
      Math.round((w.mean * 0.65 + w.minimum * 0.35) * 10) / 10
    )
  }
  assert.deepEqual(winners, ["museum", "cafe", "music"])
  const rec = await recommendations("sunny")
  for (const id of ["mia", "kai", "luna"]) {
    const changed = rec.map((r) => ({
      ...r,
      score:
        r.residentId === id ? (r.destinationId === "cafe" ? 100 : 0) : r.score,
    }))
    assert.notEqual(
      negotiate(changed).winner.collective,
      negotiate(rec).winner.collective
    )
  }
})
test("winners are computed from supplied scores, ties are stable, malformed results fail", async () => {
  const rec = await recommendations("sunny")
  for (const d of destinations)
    assert.equal(
      negotiate(
        rec.map((r) => ({ ...r, score: r.destinationId === d.id ? 90 : 10 }))
      ).winner.id,
      d.id
    )
  const tied = rec.map((r) => ({ ...r, score: 50 }))
  assert.equal(
    negotiate(tied).winner.id,
    negotiate([...tied].reverse()).winner.id
  )
  assert.throws(() => negotiate(rec.slice(1)))
  assert.throws(() =>
    negotiate(rec.map((r, i) => (i ? r : { ...r, score: NaN })))
  )
})
test("every phase completes, everyone speaks, and residents arrive at the actual destination", async () => {
  for (const situation of ["sunny", "rain", "performance"]) {
    let state = beginSimulation(
      idleSimulation(),
      situation,
      await recommendations(situation)
    )
    const visited = new Set(["idle"])
    for (let i = 0; i < 4000 && state.phase !== "finished"; i++) {
      visited.add(state.phase)
      state = advanceSimulation(state, 0.05)
    }
    visited.add(state.phase)
    assert.equal(state.phase, "finished")
    assert.deepEqual([...visited], phases)
    assert.equal(state.history.length, 10)
    assert.equal(new Set(state.history.map((s) => s.id)).size, 10)
    for (const id of ["mia", "kai", "luna"])
      assert(state.history.filter((s) => s.speaker === id).length >= 3)
    state.positions.forEach((p, i) =>
      assert.deepEqual(
        p,
        routeToDestination(residents[i].end, state.decision.winner.id, i).at(-1)
      )
    )
    assert.equal(state.speech, null)
    assert(state.logs.at(-1).text.startsWith("Completed:"))
  }
})
test("large and small ticks produce equivalent deterministic results without skipped conversations", async () => {
  const initial = beginSimulation(
    idleSimulation(),
    "sunny",
    await recommendations("sunny")
  )
  const big = advanceSimulation(initial, 1000)
  let small = initial
  for (let i = 0; i < 4000 && small.phase !== "finished"; i++)
    small = advanceSimulation(small, 0.05)
  assert.deepEqual(big.positions, small.positions)
  assert.deepEqual(
    big.history.map((s) => s.id),
    small.history.map((s) => s.id)
  )
  assert.equal(initial.phase, "gathering")
  assert.equal(initial.history.length, 0)
})
test("changing context during each phase preserves positions and history, then completes a fresh decision", async () => {
  const rec = await recommendations("sunny"),
    rain = await recommendations("rain")
  let state = beginSimulation(idleSimulation(), "sunny", rec)
  const seen = new Set()
  for (let i = 0; i < 4000; i++) {
    if (!seen.has(state.phase)) {
      seen.add(state.phase)
      const before = JSON.stringify(state)
      const changed = beginSimulation(state, "rain", rain)
      assert.equal(JSON.stringify(state), before)
      assert.deepEqual(changed.positions, state.positions)
      assert.equal(changed.round, 2)
      assert.equal(changed.decision.winner.id, "cafe")
      assert(changed.logs.some((l) => l.text.includes("Reevaluating")))
      assert.equal(advanceSimulation(changed, 1000).phase, "finished")
    }
    if (state.phase === "finished") break
    state = advanceSimulation(state, 0.1)
  }
  assert.equal(seen.size, 7)
})
test("same context re-evaluation does not force a winner change; replay clears history", async () => {
  const rec = await recommendations("sunny")
  const old = advanceSimulation(
    beginSimulation(idleSimulation(), "sunny", rec),
    1000
  )
  const next = beginSimulation(old, "sunny", rec)
  assert.equal(next.decision.winner.id, old.decision.winner.id)
  assert(next.logs.some((l) => l.text.includes("remains the same")))
  const replay = beginSimulation(idleSimulation(), "sunny", rec)
  assert.equal(replay.history.length, 0)
  assert.equal(replay.round, 1)
  assert.equal(replay.total, 0)
})
test("contextual dialogue changes with scores and includes each agent’s actual proposal", async () => {
  const dry = advanceSimulation(
    beginSimulation(idleSimulation(), "sunny", await recommendations("sunny")),
    1000
  )
  const wet = advanceSimulation(
    beginSimulation(idleSimulation(), "rain", await recommendations("rain")),
    1000
  )
  assert.notDeepEqual(
    dry.history.map((s) => s.text),
    wet.history.map((s) => s.text)
  )
  assert(wet.history.some((s) => s.text.includes("Rain begins")))
  for (const r of residents)
    assert(
      dry.history
        .find((s) => s.speaker === r.id)
        .text.includes(
          destinations.find((d) => d.id === dry.decision.proposals[r.id]).name
        )
    )
})
test("Canvas renderer accepts every phase and uses finite integer drawing coordinates", async () => {
  const { drawTown } = require(join(output, "art.js"))
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
  let state = beginSimulation(
    idleSimulation(),
    "performance",
    await recommendations("performance")
  )
  for (let i = 0; i < 15; i++) {
    state = advanceSimulation(state, 8)
    drawTown(
      ctx,
      state.total,
      0,
      true,
      state.positions,
      state.phase === "traveling",
      0
    )
  }
  assert(draws > 10000)
})
test("audio has distinct voices, one soundtrack scheduler, independent mute, hidden suspension, and disposal", async () => {
  const { WorldAudio, defaultAudioSettings } = require(
    join(output, "audio/engine.js")
  )
  const { voices } = require(join(output, "audio/voices.js"))
  assert.equal(new Set(Object.values(voices).map((v) => v.base)).size, 3)
  assert.equal(new Set(Object.values(voices).map((v) => v.cadence)).size, 3)
  const originalContext = global.AudioContext,
    originalSet = global.setInterval,
    originalClear = global.clearInterval
  let contexts = 0,
    started = 0
  const intervals = new Map()
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
        start() {
          started++
        },
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
  global.setInterval = (fn) => {
    intervals.set(++next, fn)
    return next
  }
  global.clearInterval = (id) => intervals.delete(id)
  try {
    const audio = new WorldAudio()
    assert.equal(contexts, 0)
    await Promise.all([audio.unlock(), audio.unlock(), audio.unlock()])
    assert.equal(contexts, 1)
    assert.equal(intervals.size, 1)
    ;[...intervals.values()][0]()
    assert(started > 0)
    audio.speak("mia", "A little lovely afternoon", 2)
    assert.equal(intervals.size, 2)
    audio.speak("kai", "Hello there", 2)
    assert.equal(intervals.size, 2)
    audio.setSettings({ ...defaultAudioSettings, effectsEnabled: false })
    assert.equal(intervals.size, 1)
    const before = started
    audio.speak("luna", "Muted", 2)
    assert.equal(started, before)
    await audio.setHidden(true)
    assert.equal(audio.ready, false)
    await audio.setHidden(false)
    assert.equal(audio.ready, true)
    assert.equal(intervals.size, 1)
    audio.dispose()
    assert.equal(intervals.size, 0)
    assert.equal(audio.ready, false)
  } finally {
    global.AudioContext = originalContext
    global.setInterval = originalSet
    global.clearInterval = originalClear
  }
})
