const { test, after } = require("node:test")
const assert = require("node:assert/strict")
const { mkdtempSync, rmSync } = require("node:fs")
const { tmpdir } = require("node:os")
const { join, resolve } = require("node:path")
const ts = require("typescript")
// Compile beside node_modules so the runtime validator resolves exactly as in the app.
const output = mkdtempSync(join(process.cwd(), ".living-test-"))
const program = ts.createProgram(
  [
    "lib/world/living/engine.ts",
    "lib/world/living/mock.ts",
    "lib/world/server/quota.ts",
    "lib/world/server/groq.ts",
    "lib/world/server/origin.ts",
  ],
  {
    outDir: output,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2023,
    skipLibCheck: true,
    esModuleInterop: true,
    moduleResolution: ts.ModuleResolutionKind.Node10,
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
require("node:fs").writeFileSync(
  join(output, "package.json"),
  '{"type":"commonjs"}'
)
after(() => rmSync(output, { recursive: true, force: true }))
const { newWorld, planScene, scoreDestinations } = require(
  join(output, "living/planner.js")
)
const { MockLLMProvider, mockSignals } = require(join(output, "living/mock.js"))
const { validateScene, validateSnapshot, sceneSchema } = require(
  join(output, "living/validation.js")
)
const { idleLiving, beginLiving, advanceLiving } = require(
  join(output, "living/engine.js")
)
const { routeToDestination } = require(join(output, "movement.js"))
const quota = require(join(output, "server/quota.js"))
async function bundle(world) {
  const plan = planScene(world, mockSignals)
  return {
    plan,
    scene: await new MockLLMProvider().generateScene({
      world,
      plan,
      signals: mockSignals,
    }),
    diagnostics: {
      llm: "Groq Mock",
      taste: "Qloo Mock",
      model: "openai/gpt-oss-120b",
      reason: null,
      tasteReason: null,
      calls: 0,
      limit: 10,
      signals: mockSignals,
    },
  }
}
test("connected scenes split residents, visit every destination, advance days, preserve bounded memories", async () => {
  let state = idleLiving()
  const visits = new Set()
  const pairs = new Set()
  let split = false
  for (let n = 0; n < 18; n++) {
    const b = await bundle(state.world)
    validateScene(b.scene, b.plan)
    validateSnapshot(state.world)
    assert.equal(b.plan.participants.length, 2)
    pairs.add(b.plan.participants.join(","))
    split ||= new Set(Object.values(b.plan.destinations)).size > 1
    const before = structuredClone(state)
    state = beginLiving(state, b)
    assert.deepEqual(before.world, validateSnapshot(before.world))
    state = advanceLiving(state, 1000)
    assert.equal(state.phase, "finished")
    assert.equal(state.world.completed, n + 1)
    state.world.agents.forEach((a, i) => {
      visits.add(a.location)
      assert(a.memories.length <= 8)
      assert(a.important.length <= 4)
      assert.equal(a.location, b.plan.destinations[a.id])
      assert.deepEqual(
        state.positions[i],
        routeToDestination([230, 210], a.location, i).at(-1)
      )
    })
    assert(
      state.history.every(
        (l) => !/[0-9]|\b(score|affinity|Qloo|API)\b/i.test(l.text)
      )
    )
  }
  assert(split)
  assert.equal(visits.size, 3)
  assert.equal(pairs.size, 3)
  assert.equal(state.world.day, 7)
  assert.equal(state.world.hour, 9)
})
test("memory and relationship suggestions commit only after their beats; large ticks equal small ticks", async () => {
  const initial = idleLiving(),
    b = await bundle(initial.world)
  let state = beginLiving(initial, b)
  assert(state.world.agents.every((a) => a.memories.length === 0))
  state = advanceLiving(state, state.duration)
  assert.equal(state.phase, "proposing")
  const relationship = state.world.agents.find(
    (a) => a.id === b.scene.beats[1].speaker
  ).relationships[b.scene.beats[0].speaker]
  state = advanceLiving(state, state.duration)
  assert(state.world.agents.every((a) => a.memories.length === 0))
  state = advanceLiving(state, state.duration)
  assert.equal(
    state.world.agents.find((a) => a.id === b.scene.beats[1].speaker)
      .relationships[b.scene.beats[0].speaker],
    relationship + 1
  )
  state = advanceLiving(state, state.duration)
  assert(
    state.world.agents.some((a) =>
      a.memories.some((m) => m.kind === "conversation")
    )
  )
  let tiny = beginLiving(initial, b)
  for (let n = 0; n < 2000; n++) tiny = advanceLiving(tiny, 0.1)
  const large = advanceLiving(beginLiving(initial, b), 200)
  assert.deepEqual(tiny.world, large.world)
  assert.deepEqual(tiny.positions, large.positions)
})
test("schema and semantic validation reject invented actions, places, scores and ungrounded state changes", async () => {
  const b = await bundle(newWorld())
  for (const mutate of [
    (s) => (s.beats[0].speaker = "outsider"),
    (s) => (s.beats[0].action = "teleport"),
    (s) => (s.beats[0].targetLocation = "castle"),
    (s) => (s.beats[0].dialogue = "That scores 95/100."),
    (s) => (s.extra = true),
    (s) => (s.beats[0].extra = true),
    (s) => (s.suggestedMemoryUpdates[0].beatIndex = 99),
    (s) => (s.suggestedMemoryUpdates[0].kind = "promise"),
    (s) => (s.beats[0].action = "walk_to"),
    (s) => (s.participants = ["mia"]),
    (s) => (s.sceneId = "wrong"),
  ]) {
    const scene = structuredClone(b.scene)
    mutate(scene)
    assert.throws(() => validateScene(scene, b.plan))
  }
  const strict = (s) => {
    if (s.type === "object") {
      assert.equal(s.additionalProperties, false)
      assert.deepEqual([...s.required].sort(), Object.keys(s.properties).sort())
      Object.values(s.properties).forEach(strict)
    }
    if (s.items) strict(s.items)
    if (s.anyOf) s.anyOf.forEach(strict)
  }
  strict(sceneSchema)
})
test("recent experiences, goals and actual cultural evidence affect local decisions", () => {
  const w = newWorld(),
    before = scoreDestinations(w, [], null)
  w.agents[0].recentVisits = ["cafe"]
  w.agents[1].goal = "Take a quiet break"
  const after = scoreDestinations(w, [], null)
  assert(
    after.find((s) => s.residentId === "mia" && s.destinationId === "cafe")
      .total <
      before.find((s) => s.residentId === "mia" && s.destinationId === "cafe")
        .total
  )
  assert(
    after.find((s) => s.residentId === "kai" && s.destinationId === "museum")
      .factors.goal >
      before.find((s) => s.residentId === "kai" && s.destinationId === "museum")
        .factors.goal
  )
  const evidence = [
    {
      residentId: "mia",
      name: "Real artist",
      category: "artist",
      entityId: "real-id",
      affinity: 0.9,
      source: "LIVE Qloo",
    },
  ]
  assert(
    scoreDestinations(w, evidence, null).find(
      (s) => s.residentId === "mia" && s.destinationId === "music"
    ).total >
      after.find((s) => s.residentId === "mia" && s.destinationId === "music")
        .total
  )
})
test("promise memory is available to later scenes, snapshot input is bounded", async () => {
  let s = idleLiving(),
    b = await bundle(s.world)
  b.scene.beats[2].dialogue = "I promise to meet you tomorrow."
  b.scene.suggestedMemoryUpdates[0].kind = "promise"
  s = advanceLiving(beginLiving(s, b), 500)
  assert(
    s.world.agents.some((a) => a.important.some((m) => m.kind === "promise"))
  )
  validateSnapshot(s.world)
  const bad = structuredClone(s.world)
  bad.agents[0].memories = Array(9).fill(bad.agents[0].memories[0])
  assert.throws(() => validateSnapshot(bad))
})
test("durable server quotas count reservations, survive reloads, reject new-session bypass and fail closed", () => {
  const root = mkdtempSync(join(tmpdir(), "world-quota-"))
  const prior = { ...process.env }
  const originalNow = Date.now
  let now = Date.now()
  Date.now = () => now
  try {
    process.env.WORLDLINGS_QUOTA_DIR = root
    process.env.MAX_LLM_CALLS_PER_SESSION = "2"
    process.env.GROQ_DAILY_REQUEST_LIMIT = "3"
    process.env.GROQ_REQUESTS_PER_MINUTE = "20"
    process.env.GROQ_TOKENS_PER_MINUTE = "10000"
    process.env.GROQ_DAILY_TOKEN_LIMIT = "10000"
    const a = quota.createSession()
    assert.equal(quota.reserve(a, 100), 1)
    assert.throws(() => quota.reserve(a, 100), /close/)
    now += 2000
    assert.equal(quota.reserve(a, 100), 2)
    now += 2000
    assert.throws(() => quota.reserve(a, 100), /Session call limit/)
    delete require.cache[resolve(output, "server/quota.js")]
    const reloaded = require(join(output, "server/quota.js"))
    assert.equal(reloaded.sessionStatus(a).calls, 2)
    const b = quota.createSession()
    quota.reserve(b, 100)
    now += 2000
    assert.throws(() => quota.reserve(b, 100), /Daily/)
    assert.throws(() => quota.reserve("made-up", 100), /expired/)
    process.env.NODE_ENV = "production"
    process.env.GROQ_API_KEY = "test"
    process.env.GROQ_FREE_PLAN_CONFIRMED = "true"
    process.env.LLM_PROVIDER = "groq"
    delete process.env.WORLDLINGS_SINGLE_INSTANCE
    assert.match(quota.liveUnavailable(), /single server/)
  } finally {
    Date.now = originalNow
    for (const k of Object.keys(process.env))
      if (!(k in prior)) delete process.env[k]
    Object.assign(process.env, prior)
    rmSync(root, { recursive: true, force: true })
  }
})

test("official Groq SDK sends strict scene requests and rejects invalid output without retries", async () => {
  const Groq = require("groq-sdk").default
  const { GroqProvider, providerError, sceneTokenReservation } = require(
    join(output, "server/groq.js")
  )
  const world = newWorld(),
    b = await bundle(world),
    scene = structuredClone(b.scene)
  scene.beats.forEach((beat) => {
    if (beat.action === "point") {
      beat.action = "talk"
      beat.targetLocation = null
    }
  })
  let calls = 0,
    sent
  const client = new Groq({
    apiKey: "test-only",
    maxRetries: 0,
    fetch: async (_url, init) => {
      calls++
      sent = JSON.parse(init.body)
      return new Response(
        JSON.stringify({
          id: "test",
          object: "chat.completion",
          choices: [
            {
              index: 0,
              finish_reason: "stop",
              message: { role: "assistant", content: JSON.stringify(scene) },
            },
          ],
          usage: {
            prompt_tokens: 700,
            completion_tokens: 200,
            total_tokens: 900,
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "x-ratelimit-remaining-tokens": "6000",
          },
        }
      )
    },
  })
  const provider = new GroqProvider(client),
    context = { world, plan: b.plan, signals: mockSignals }
  assert.deepEqual(await provider.generateScene(context), scene)
  assert.equal(calls, 1)
  assert.equal(sent.model, "openai/gpt-oss-120b")
  assert.equal(sent.response_format.json_schema.strict, true)
  assert.equal(sent.response_format.type, "json_schema")
  assert.equal(provider.usage.inputTokens, 700)
  assert(sceneTokenReservation(context) > 900)
  scene.beats[0].action = "teleport"
  await assert.rejects(() => provider.generateScene(context))
  const limited = new GroqProvider(
    new Groq({
      apiKey: "test-only",
      maxRetries: 0,
      fetch: async () =>
        new Response(
          JSON.stringify({ error: { message: "Rate limit reached" } }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": "60",
            },
          }
        ),
    })
  )
  await assert.rejects(
    () => limited.generateScene(context),
    (error) => {
      assert.match(providerError(error), /HTTP 429/)
      return true
    }
  )
})

test("origin checks handle Next's normalized URL and reject cross-origin/missing origins", () => {
  const { sameOrigin } = require(join(output, "server/origin.js"))
  assert(
    sameOrigin(
      new Request("http://localhost:3001/api/world/scene", {
        headers: { host: "127.0.0.1:3001", origin: "http://127.0.0.1:3001" },
      })
    )
  )
  assert(
    !sameOrigin(
      new Request("http://localhost:3001/api/world/scene", {
        headers: { host: "127.0.0.1:3001", origin: "https://outsider.example" },
      })
    )
  )
  assert(
    !sameOrigin(
      new Request("http://localhost:3001/api/world/scene", {
        headers: { host: "127.0.0.1:3001" },
      })
    )
  )
})
