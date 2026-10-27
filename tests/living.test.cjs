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
    "lib/world/living/fallback.ts",
    "lib/world/server/qloo.ts",
    "lib/world/server/quota.ts",
    "lib/world/server/groq.ts",
    "lib/world/server/origin.ts",
    "lib/world/server/generation.ts",
    "lib/world/server/rate-budget.ts",
    "lib/world/server/dialogue-service.ts",
    "lib/world/living/prefetch.ts",
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
const { quietScene } = require(join(output, "living/fallback.js"))
const { validateScene, validateSnapshot, sceneSchema } = require(
  join(output, "living/validation.js")
)
const { idleLiving, beginLiving, advanceLiving } = require(
  join(output, "living/engine.js")
)
const { routeToDestination } = require(join(output, "movement.js"))
const quota = require(join(output, "server/quota.js"))
const { SceneRateBudget } = require(join(output, "server/rate-budget.js"))
const { sceneFixture } = require("./scene-fixture.cjs")
const { ScenePrefetch, projectNextWorld, snapshotKey } = require(
  join(output, "living/prefetch.js")
)
const { generateBudgetedConversation, retryAfterSeconds } = require(
  join(output, "server/dialogue-service.js")
)
const mockSignals = [
  ["mia", "Test Film", "movie", "mia-film"],
  ["kai", "Test Artist", "artist", "kai-artist"],
  ["luna", "Test Book", "book", "luna-book"],
].map(([residentId, name, category, entityId]) => ({
  residentId,
  name,
  category,
  entityId,
  affinity: 0.7,
  description: null,
  properties: {},
  explainability: null,
  source: "CACHED Qloo",
  provenance: {
    provider: "Qloo",
    endpoint: "/v2/insights",
    requestedAt: "2026-10-25T00:00:00.000Z",
    requestCategory: `urn:entity:${category}`,
    signalEntityIds: [`${residentId}-seed`],
    excludedEntityIds: [],
    delivery: "cache",
  },
}))
async function bundle(world) {
  const plan = planScene(world, mockSignals)
  return {
    plan,
    scene: sceneFixture({
      world,
      plan,
      signals: mockSignals,
      qloo: {
        configured: true,
        baseUrl: "https://hackathon.api.qloo.com",
        lastSuccessfulCall: "2026-10-25T00:00:00.000Z",
        requestCategories: ["test"],
        cacheStatus: "hit",
        lastError: null,
        recommendations: mockSignals.length,
        liveRequests: 0,
        cachedRequests: 1,
      },
    }),
    diagnostics: {
      llm: "Groq Live",
      requestStatus: "success",
      attempts: 1,
      repetition: "test fixture",
      taste: "Qloo Cache",
      model: "openai/gpt-oss-20b",
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
    assert(b.plan.participants.length >= 1 && b.plan.participants.length <= 3)
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
  assert(pairs.size >= 3)
  assert(
    state.world.day >= 2,
    "venue conversations must not prevent the day advancing"
  )
  assert([9, 14, 19].includes(state.world.hour))
})
test("memory and relationship suggestions commit only after their beats; large ticks equal small ticks", async () => {
  const initial = idleLiving()
  initial.world.encounter = "pair"
  const b = await bundle(initial.world)
  let state = beginLiving(initial, b)
  assert(state.world.agents.every((a) => a.memories.length === 0))
  state = advanceLiving(state, state.duration)
  assert.equal(state.phase, "proposing")
  const relationship = state.world.agents.find(
    (a) => a.id === b.scene.beats[1].speaker
  ).relationships[b.scene.beats[0].speaker]
  state = advanceLiving(state, state.duration)
  assert(state.world.agents.some((a) => a.memories.length > 0))
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
      description: null,
      properties: {},
      explainability: null,
      provenance: {
        provider: "Qloo",
        endpoint: "/v2/insights",
        requestedAt: "2026-10-25T00:00:00.000Z",
        requestCategory: "urn:entity:artist",
        signalEntityIds: ["real-seed"],
        excludedEntityIds: [],
        delivery: "live",
      },
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
  let s = idleLiving()
  s.world.encounter = "pair"
  const b = await bundle(s.world)
  b.scene.beats[2].dialogue = "I promise to meet you tomorrow."
  b.scene.suggestedMemoryUpdates[0] = {
    residentId: b.scene.beats[2].speaker,
    beatIndex: 2,
    kind: "promise",
  }
  s = advanceLiving(beginLiving(s, b), 500)
  assert(
    s.world.agents.some((a) => a.important.some((m) => m.kind === "promise"))
  )
  validateSnapshot(s.world)
  const bad = structuredClone(s.world)
  bad.agents[0].memories = Array(9).fill(bad.agents[0].memories[0])
  assert.throws(() => validateSnapshot(bad))
})
test("snapshot validation migrates oversized legacy Qloo metadata", () => {
  const world = newWorld()
  world.discoveries.push({
    entityId: "legacy-qloo-entity",
    name: "Legacy recommendation",
    type: "urn:entity:artist",
    description: null,
    residentId: "mia",
    discoveredAt: "2026-10-25T00:00:00.000Z",
    day: 1,
    scene: 1,
    status: "discovered",
    affinity: 0.5,
    properties: {
      geocode: { city: "Accra", latitude: 5.6037, longitude: -0.187 },
      payload: "x".repeat(50000),
    },
    explainability: { payload: "y".repeat(50000) },
    provenance: {
      provider: "Qloo",
      endpoint: "/v2/insights",
      requestedAt: "2026-10-25T00:00:00.000Z",
      requestCategory: "urn:entity:artist",
      signalEntityIds: ["verified-seed"],
      excludedEntityIds: [],
      delivery: "live",
    },
    reaction: null,
  })
  const migrated = validateSnapshot(world)
  assert.equal(migrated.discoveries[0].properties.geocode.city, "Accra")
  assert(JSON.stringify(migrated.discoveries[0].properties).length <= 1200)
  assert(JSON.stringify(migrated.discoveries[0].explainability).length <= 1200)
  assert(Buffer.byteLength(JSON.stringify(migrated)) < 48000)
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
    quota.recordUsage(a, 20, 10)
    assert.equal(quota.sessionStatus(a).reserved, 0)
    assert.equal(quota.sessionStatus(a).input, 20)
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

test("prefetch projects exact completion without committing effects and reuses one in-flight request", async () => {
  let state = beginLiving(idleLiving(), await bundle(newWorld()))
  state = advanceLiving(state, state.duration)
  const unchanged = structuredClone(state)
  const projected = projectNextWorld(state)
  assert.deepEqual(state, unchanged)
  assert(projected)
  let actual = state
  for (let n = 0; n < 2000 && actual.phase !== "finished"; n++)
    actual = advanceLiving(actual, 0.1)
  assert.equal(snapshotKey(actual.world), snapshotKey(projected))
  let resolve,
    calls = 0
  const future = await bundle(projected)
  const cache = new ScenePrefetch()
  const fetcher = () => {
    calls++
    return new Promise((done) => {
      resolve = done
    })
  }
  cache.prepare(projected, fetcher)
  cache.prepare(projected, fetcher)
  await Promise.resolve()
  const result = cache.consume(actual.world)
  assert.equal(calls, 1)
  resolve(future)
  assert.equal(await result, future)
  assert.equal(await cache.consume(actual.world), null)
})

test("prefetch rejects changed state, reset, failed transport and non-live projections", async () => {
  const world = newWorld()
  const b = await bundle(world)
  const cache = new ScenePrefetch()
  let signal, resolve
  cache.prepare(world, (_w, requestSignal) => {
    signal = requestSignal
    return Promise.resolve(b)
  })
  await Promise.resolve()
  const changed = structuredClone(world)
  changed.agents[0].relationships.kai--
  assert.equal(
    await cache.consume(changed),
    null,
    "same scene counter is not enough"
  )
  assert(signal.aborted)
  cache.prepare(
    world,
    () =>
      new Promise((done) => {
        resolve = done
      })
  )
  await Promise.resolve()
  const pending = cache.consume(world)
  cache.clear()
  resolve(b)
  assert.equal(
    await pending,
    null,
    "reset invalidates even an ignored transport abort"
  )
  cache.prepare(world, async () => {
    throw Error("offline")
  })
  assert.equal(await cache.consume(world), null)
  b.scene = quietScene(b.plan)
  b.diagnostics.llm = "Waiting"
  assert.equal(projectNextWorld(beginLiving(idleLiving(), b)), null)
})

test("compact prompts bound context while validation still sees older repeated dialogue", async () => {
  const { sceneRequest } = require(join(output, "server/groq.js"))
  const world = newWorld()
  const b = await bundle(world)
  world.recentScenes = [0, 1, 2, 3].map((n) => ({
    sceneId: `old-${n}`,
    topic: `old topic ${n}`,
    lines: Array.from({ length: 10 }, (_, i) => ({
      speaker: "mia",
      text: `An established line about the town from moment ${n} and detail ${i}.`,
    })),
  }))
  const context = { world, plan: b.plan, signals: mockSignals }
  const outgoing = sceneRequest(context)
  const prompt = JSON.parse(outgoing.messages[1].content)
  assert.equal(prompt.world.avoidRepeating.length, 10)
  assert(!prompt.world.agents.some((a) => "memories" in a || "important" in a))
  assert(!("recentByResident" in prompt.world))
  assert.equal(outgoing.max_completion_tokens, 1600)
  assert(
    Buffer.byteLength(JSON.stringify(outgoing)) < 13000,
    "complete bounded request includes schema and context"
  )
  b.scene.beats[0].dialogue = world.recentScenes[0].lines[0].text
  assert.throws(
    () =>
      require(join(output, "living/dialogue.js")).validateDialogue(
        b.scene,
        context
      ),
    /repeated dialogue/
  )
})

test("primary success avoids backup; 429 uses validated Cerebras, respecting isolated cooldowns and shared session cap", async () => {
  const Groq = require("groq-sdk").default
  const { GroqProvider } = require(join(output, "server/groq.js"))
  const root = mkdtempSync(join(tmpdir(), "world-failover-"))
  const prior = { ...process.env }
  const nowFn = Date.now
  let now = Date.now()
  Date.now = () => now
  try {
    Object.assign(process.env, {
      WORLDLINGS_QUOTA_DIR: root,
      NODE_ENV: "test",
      LLM_PROVIDER: "groq",
      GROQ_API_KEY: "test-only",
      GROQ_FREE_PLAN_CONFIRMED: "true",
      GROQ_PLAN: "free",
      CEREBRAS_BACKUP_ENABLED: "true",
      CEREBRAS_API_KEY: "test-only",
      MAX_LLM_CALLS_PER_SESSION: "4",
      GROQ_DAILY_REQUEST_LIMIT: "100",
      CEREBRAS_DAILY_REQUEST_LIMIT: "100",
      GROQ_REQUESTS_PER_MINUTE: "25",
      CEREBRAS_REQUESTS_PER_MINUTE: "25",
      GROQ_TOKENS_PER_MINUTE: "100000",
      CEREBRAS_TOKENS_PER_MINUTE: "100000",
      GROQ_DAILY_TOKEN_LIMIT: "100000",
      CEREBRAS_DAILY_TOKEN_LIMIT: "100000",
    })
    const world = newWorld(),
      b = await bundle(world)
    const context = { world, plan: b.plan, signals: mockSignals }
    const id = quota.createSession()
    let primaryStatus = 200,
      invalidBackup = false
    const called = []
    const options = {
      budget: new SceneRateBudget({ now: () => now }),
      wait: async () => {
        now += 1600
      },
      makeProvider: (kind) =>
        new GroqProvider(
          new Groq({
            apiKey: "test-only",
            maxRetries: 0,
            fetch: async (_url, init) => {
              called.push(kind)
              const sent = JSON.parse(init.body)
              assert.equal(sent.response_format.json_schema.strict, true)
              if (kind === "groq" && primaryStatus !== 200)
                return new Response(
                  JSON.stringify({ error: { message: "limited" } }),
                  { status: primaryStatus, headers: { "retry-after": "90" } }
                )
              const scene = structuredClone(b.scene)
              if (invalidBackup)
                scene.beats[0].references = ["invented:evidence"]
              return Response.json({
                choices: [
                  {
                    finish_reason: "stop",
                    message: { content: JSON.stringify(scene) },
                  },
                ],
                usage: { prompt_tokens: 500, completion_tokens: 300 },
              })
            },
          }),
          kind
        ),
    }
    const first = await generateBudgetedConversation(id, context, options)
    assert.equal(first.provider, "groq")
    assert.deepEqual(called, ["groq"])
    now += 2000
    primaryStatus = 429
    const second = await generateBudgetedConversation(id, context, options)
    assert.equal(second.provider, "cerebras")
    assert.equal(second.attempts, 2)
    assert.equal(second.inputTokens, 500)
    assert.match(second.failoverReason, /429/)
    assert.deepEqual(called, ["groq", "groq", "cerebras"])
    assert.equal(quota.sessionStatus(id).calls, 3)
    const playback = advanceLiving(
      beginLiving(idleLiving(), {
        ...b,
        scene: second.scene,
        plan: second.plan,
        diagnostics: { ...b.diagnostics, llm: "Cerebras Live" },
      }),
      1000
    )
    assert(playback.history.length > 0)
    now += 2000
    const third = await generateBudgetedConversation(id, context, options)
    assert.equal(
      third.provider,
      "cerebras",
      "Groq cooldown does not block backup"
    )
    assert.equal(
      called.filter((kind) => kind === "groq").length,
      2,
      "no retry of rate-limited primary"
    )
    const capped = await generateBudgetedConversation(id, context, options)
    assert.equal(capped.scene, null)
    assert.match(capped.reason, /Session call limit/)
    const another = quota.createSession()
    invalidBackup = true
    const rejected = await generateBudgetedConversation(
      another,
      context,
      options
    )
    assert.equal(rejected.scene, null)
    assert.match(rejected.reason, /unknown evidence/)
    assert.equal(rejected.attempts, 1)
    assert.equal(retryAfterSeconds("90", now), 90)
    process.env.GROQ_PLAN = "developer"
    process.env.GROQ_PAID_USAGE_CONFIRMED = "false"
    assert.match(quota.liveUnavailable(), /Confirm paid/)
    process.env.GROQ_PAID_USAGE_CONFIRMED = "true"
    assert.equal(quota.liveUnavailable(), null)
    assert.equal(
      retryAfterSeconds(new Date(now + 60000).toUTCString(), now),
      60
    )
  } finally {
    Date.now = nowFn
    for (const key of Object.keys(process.env))
      if (!(key in prior)) delete process.env[key]
    Object.assign(process.env, prior)
    rmSync(root, { recursive: true, force: true })
  }
})

test("rolling scene budget cannot burst across a minute boundary", () => {
  let now = 59999
  const budget = new SceneRateBudget({ now: () => now })
  for (let i = 0; i < 25; i++) assert(budget.charge(["mia", "kai", "luna"]))
  now = 60001
  assert.equal(budget.charge(["mia", "kai", "luna"]), null)
  now = 120000
  assert.equal(budget.charge(["mia"]), "mia")
})

test("official Groq SDK sends strict scene requests and rejects invalid output without retries", async () => {
  const Groq = require("groq-sdk").default
  const {
    GroqProvider,
    normalizeGeneratedScene,
    providerError,
    sceneTokenReservation,
  } = require(join(output, "server/groq.js"))
  const arrivalDraft = {
    beats: [
      { speaker: "mia", replyTo: null, dialogue: "Look at the fountain." },
      { speaker: "kai", replyTo: 0, dialogue: "The water is leaning." },
      { speaker: "mia", replyTo: 1, dialogue: "It does that in the wind." },
      { speaker: "luna", replyTo: 1, dialogue: "I can see the tilt." },
    ],
  }
  const arrivalPlan = {
    arrival: { residentId: "luna", beforeBeat: 2 },
    initialParticipants: ["mia", "kai"],
  }
  normalizeGeneratedScene(arrivalDraft, arrivalPlan)
  assert.equal(arrivalDraft.beats[0].replyTo, null)
  assert.equal(arrivalDraft.beats[2].replyTo, 1)
  assert.equal(arrivalDraft.beats[3].replyTo, 2)
  assert.deepEqual(arrivalDraft.suggestedMemoryUpdates, [])
  assert.deepEqual(arrivalDraft.suggestedRelationshipChanges, [])
  assert.match(arrivalDraft.beats[2].dialogue, /Luna/)
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
  assert.deepEqual(await provider.generateScene(context), {
    ...scene,
    suggestedMemoryUpdates: [],
    suggestedRelationshipChanges: [],
  })
  assert.equal(calls, 1)
  assert.equal(sent.model, "openai/gpt-oss-20b")
  assert.equal(sent.response_format.json_schema.strict, true)
  assert.equal(sent.response_format.type, "json_schema")
  assert(
    !JSON.stringify(sent.response_format.json_schema.schema).includes(
      "maxLength"
    )
  )
  assert(
    !JSON.stringify(sent.response_format.json_schema.schema).includes(
      "maxItems"
    )
  )
  const prompt = JSON.parse(sent.messages[1].content)
  assert(
    prompt.culturalDiscoveries.every(
      (signal) => !("properties" in signal) && !("explainability" in signal)
    )
  )
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

test("pair, trio and solo gatherings use actual square occupancy and preserve independent activities", async () => {
  const { squareOccupants } = require(join(output, "living/presence.js"))
  for (const [mode, ids] of [
    ["pair", ["mia", "kai"]],
    ["trio", ["mia", "kai", "luna"]],
    ["solo", ["luna"]],
  ]) {
    const initial = idleLiving()
    // Encounter controls apply after the deterministic opening scene.
    initial.world.completed = 1
    initial.world.encounter = mode
    const b = await bundle(initial.world)
    assert.deepEqual(b.plan.participants, ids)
    let state = beginLiving(initial, b)
    assert.deepEqual(state.positions, initial.positions)
    assert.equal(state.history.length, 0)
    const firstStep = advanceLiving(state, 0.05)
    firstStep.positions.forEach((p, i) =>
      assert(
        Math.hypot(
          p[0] - state.positions[i][0],
          p[1] - state.positions[i][1]
        ) <= 3
      )
    )
    state = advanceLiving(state, state.duration)
    assert.deepEqual(
      [...squareOccupants(state.positions)].sort(),
      [...ids].sort()
    )
    assert.deepEqual([...state.present].sort(), [...ids].sort())
    state = advanceLiving(state, 1000)
    assert.deepEqual(
      [...new Set(state.history.map((l) => l.speaker))].sort(),
      [...ids].sort()
    )
    assert.equal(state.phase, "finished")
    assert(state.world.agents.every((a) => a.location !== "square"))
    const next = beginLiving(state, await bundle(state.world))
    assert.equal(next.phase, "gathering")
    assert.equal(next.round, state.world.completed + 1)
    assert.equal(next.history.length, state.history.length)
  }
})
test("Luna walks into an ongoing conversation, is acknowledged, and cannot speak or receive memories remotely", async () => {
  const initial = idleLiving()
  initial.world.completed = 1
  initial.world.encounter = "join"
  const b = await bundle(initial.world)
  const invalid = structuredClone(b.scene)
  invalid.beats[0].speaker = "luna"
  assert.throws(() => validateScene(invalid, b.plan), /Absent/)
  const remoteMemory = structuredClone(b.scene)
  remoteMemory.suggestedMemoryUpdates = [
    { residentId: "luna", beatIndex: 0, kind: "conversation" },
  ]
  assert.throws(() => validateScene(remoteMemory, b.plan), /Ungrounded/)
  let state = beginLiving(initial, b)
  state = advanceLiving(state, state.duration)
  assert.deepEqual(state.present, ["mia", "kai"])
  assert.deepEqual(state.positions[2], initial.positions[2])
  state = advanceLiving(state, state.duration)
  state = advanceLiving(state, state.duration)
  assert(state.joining)
  assert.equal(state.speech, null)
  assert.equal(state.history.length, 2)
  assert(!state.present.includes("luna"))
  const start = state.positions[2]
  state = advanceLiving(state, state.duration / 2)
  assert.notDeepEqual(state.positions[2], start)
  assert(!state.present.includes("luna"))
  assert.equal(state.history.length, 2)
  state = advanceLiving(state, state.duration - state.time)
  assert(state.present.includes("luna"))
  assert.match(state.speech.text, /Luna/)
  assert.notEqual(state.speech.speaker, "luna")
  state = advanceLiving(state, 1000)
  assert(state.history.some((l) => l.speaker === "luna"))
  assert.equal(
    new Set(state.history.map((l) => l.id)).size,
    state.history.length
  )
})
test("early departure moves a tired resident while the other continues; departed speakers are rejected", async () => {
  const initial = idleLiving()
  initial.world.encounter = "pair"
  initial.world.agents[0].energy = 20
  const b = await bundle(initial.world)
  const leaveIndex = b.scene.beats.findIndex((l) => l.action === "walk_to")
  assert(leaveIndex >= 0)
  let state = beginLiving(initial, b)
  state = advanceLiving(state, state.duration)
  for (let i = 0; i <= leaveIndex; i++)
    state = advanceLiving(state, state.duration)
  assert(!state.present.includes("mia"))
  assert(state.transits.mia)
  assert.equal(state.speech.speaker, "kai")
  const before = state.positions[0]
  state = advanceLiving(state, 0.5)
  assert.notDeepEqual(state.positions[0], before)
  const bad = structuredClone(b.scene)
  bad.beats[leaveIndex + 1].speaker = "mia"
  assert.throws(() => validateScene(bad, b.plan), /Absent/)
  state = advanceLiving(state, 1000)
  assert.equal(state.world.agents[0].location, b.plan.destinations.mia)
})
test("automatic schedules retain pairs and make shared-event trio opportunities without a fixed rotation", () => {
  const world = newWorld()
  world.completed = 1
  world.hour = 14
  world.situation = "performance"
  world.agents.forEach((a) => {
    a.social = 80
    a.energy = 80
  })
  const shared = planScene(world, mockSignals)
  assert.equal(shared.participants.length, 3)
  world.situation = "sunny"
  world.agents.forEach((a) => (a.social = 5))
  assert.equal(planScene(world, mockSignals).participants.length, 1)
})

test("square dispersal leads to an actual cafe pair conversation, with persisted causal action effects", async () => {
  let state = idleLiving()
  const opening = await bundle(state.world)
  opening.plan.destinations = { mia: "cafe", kai: "cafe", luna: "museum" }
  opening.plan.culturalDecision = null
  state = advanceLiving(beginLiving(state, opening), 1000)
  assert.equal(
    state.world.hour,
    9,
    "finish venue visits before advancing the day's clock"
  )
  assert.deepEqual(state.world.pendingVisits, [
    { location: "cafe", participants: ["mia", "kai"] },
    { location: "museum", participants: ["luna"] },
  ])
  state.world = validateSnapshot(JSON.parse(JSON.stringify(state.world)))
  const next = await bundle(state.world)
  assert.equal(next.plan.activityVisit, true)
  assert.equal(next.plan.gathering.location, "cafe")
  assert.deepEqual(next.plan.participants, ["mia", "kai"])
  next.scene.beats = [
    [
      "mia",
      "I want to sketch while we're here. Will you sit with me?",
      "sketch",
    ],
    ["kai", "All right. I'll sit here while you try it.", "sit"],
    ["mia", "Keep still for a moment; I'm starting with your outline.", "talk"],
    ["kai", "I'll give you a moment. This is quite restful.", "talk"],
  ].map(([speaker, dialogue, action], index) => ({
    speaker,
    dialogue,
    action,
    emotion: "content",
    targetLocation: null,
    replyTo: index ? index - 1 : null,
    references: [],
  }))
  next.scene.summary = "Mia sketches while Kai sits with her at The Daily Cup."
  next.scene.suggestedMemoryUpdates = []
  next.scene.suggestedRelationshipChanges = []
  validateScene(next.scene, next.plan)
  require(join(output, "living/dialogue.js")).validateDialogue(next.scene, {
    world: state.world,
    plan: next.plan,
    signals: [],
  })
  const before = structuredClone(state.world)
  let playing = beginLiving(state, next)
  assert(
    !playing.transits.mia && !playing.transits.kai,
    "residents already at the cafe stay there"
  )
  assert.deepEqual(playing.world.agents[0].learned, before.agents[0].learned)
  playing = advanceLiving(playing, playing.duration)
  assert.equal(playing.speech.speaker, "mia")
  assert.deepEqual(playing.present, ["mia", "kai"])
  const away = structuredClone(playing)
  away.positions[1] = [230, 210]
  assert.throws(() => advanceLiving(away, away.duration), /Absent resident/)
  playing = advanceLiving(playing, playing.duration)
  assert.equal(
    playing.world.agents[0].learned.art,
    (before.agents[0].learned.art ?? 0) + 0.02
  )
  assert(
    playing.world.agents[0].memories.some(
      (m) => m.location === "cafe" && m.text.startsWith("Sketched")
    )
  )
  const after = advanceLiving(playing, 1000)
  const museumCulture = (w) =>
    scoreDestinations(w, [], null).find(
      (s) => s.residentId === "mia" && s.destinationId === "museum"
    ).factors.culture
  assert(
    museumCulture(after.world) > museumCulture(before),
    "practising art affects a later destination score"
  )
  assert.equal(
    after.world.agents[0].relationships.kai,
    before.agents[0].relationships.kai + 1
  )
  assert.equal(
    after.world.agents[2].relationships.mia,
    before.agents[2].relationships.mia,
    "absent Luna receives no social credit"
  )
  assert.equal(after.world.socialMemories.at(-1).location, "cafe")
  assert.deepEqual(after.world.pendingVisits, [
    { location: "museum", participants: ["luna"] },
  ])
  const solo = await bundle(after.world)
  assert.deepEqual(solo.plan.participants, ["luna"])
  const finished = advanceLiving(beginLiving(after, solo), 1000)
  assert.equal(finished.world.hour, 14)
  assert.deepEqual(finished.world.pendingVisits, [])
  assert.equal(planScene(finished.world, []).gathering.scheduledHour, 14)
  validateSnapshot(finished.world)
})

test("unavailable venue speech stays silent and cannot fabricate action effects", async () => {
  const state = idleLiving()
  state.world.pendingVisits = [
    { location: "cafe", participants: ["mia", "kai"] },
  ]
  const b = await bundle(state.world)
  b.scene = quietScene(b.plan)
  b.diagnostics.llm = "Fallback"
  const result = advanceLiving(beginLiving(state, b), 1000)
  assert.equal(result.history.length, 0)
  assert.equal(result.world.socialMemories.length, 0)
  assert.deepEqual(
    result.world.agents.map((a) => a.learned),
    [{}, {}, {}]
  )
  assert.equal(result.world.pendingVisits.length, 0)
  assert.equal(result.world.hour, 14)
})

test("pending venue visits migrate and reject duplicate attendance and invented venues", () => {
  const old = newWorld()
  delete old.pendingVisits
  assert.deepEqual(validateSnapshot(old).pendingVisits, [])
  for (const visits of [
    [{ location: "castle", participants: ["mia"] }],
    [{ location: "cafe", participants: ["mia", "mia"] }],
    [
      { location: "cafe", participants: ["mia"] },
      { location: "museum", participants: ["mia"] },
    ],
  ])
    assert.throws(() => validateSnapshot({ ...old, pendingVisits: visits }))
})

test("a rate-limited venue visit reaches the cafe, preserves its roster, and can resume speech", async () => {
  const state = idleLiving()
  state.world.pendingVisits = [
    { location: "cafe", participants: ["mia", "kai"] },
  ]
  const b = await bundle(state.world)
  const waiting = structuredClone(b)
  waiting.scene = quietScene(waiting.plan)
  waiting.diagnostics.llm = "Waiting"
  waiting.diagnostics.retryAt = Date.now() + 60000
  let result = advanceLiving(beginLiving(state, waiting), 1000)
  assert.equal(result.phase, "waiting")
  assert.deepEqual(result.present, ["mia", "kai"])
  assert.equal(result.world.agents[0].location, "cafe")
  assert.notDeepEqual(result.positions[1], state.positions[1])
  assert.equal(result.history.length, 0)
  assert.deepEqual(result.world.pendingVisits, state.world.pendingVisits)
  assert.equal(advanceLiving(result, 60), result)
  result = advanceLiving(beginLiving(result, b), 1000)
  assert(result.history.length > 0)
  assert.equal(result.world.socialMemories.at(-1).location, "cafe")
  assert.equal(result.world.pendingVisits.length, 0)
})

test("a ten-beat venue scene survives save and restore for the next request", async () => {
  const state = idleLiving()
  state.world.pendingVisits = [
    { location: "cafe", participants: ["mia", "kai"] },
  ]
  const b = await bundle(state.world)
  const lines = [
    "Shall we sit for a moment?",
    "Yes, I could use a rest.",
    "I keep thinking about what to draw.",
    "Try something small to start.",
    "A little outline might be enough.",
    "You can always add to it.",
    "That makes it less daunting.",
    "Take your time with it.",
    "I'll stay here and give it a go.",
    "I'll sit with you while you start.",
  ]
  b.scene.beats = lines.map((dialogue, i) => ({
    speaker: i % 2 ? "kai" : "mia",
    dialogue,
    action: "talk",
    emotion: "content",
    targetLocation: null,
    replyTo: i ? i - 1 : null,
    references: [],
  }))
  b.scene.suggestedMemoryUpdates = []
  b.scene.suggestedRelationshipChanges = []
  validateScene(b.scene, b.plan)
  const result = advanceLiving(beginLiving(state, b), 1000)
  const restored = validateSnapshot(JSON.parse(JSON.stringify(result.world)))
  assert.equal(restored.recentScenes.at(-1).lines.length, 10)
  assert.doesNotThrow(() => planScene(restored, []))
})

test("per-resident scene budget stays below 6 each and 25 total per fake minute", () => {
  let now = 0
  const budget = new SceneRateBudget({ now: () => now })
  for (let i = 0; i < 40; i++) budget.charge(["mia", "kai", "luna"])
  const first = budget.snapshot()
  assert.equal(first.total, 25)
  assert(
    first.residents.mia <= 6 &&
      first.residents.kai <= 6 &&
      first.residents.luna <= 6
  )
  now = 60000
  assert.equal(budget.charge(["mia"]), "mia")
  assert.equal(budget.snapshot().residents.mia, 1)
})

test("a due venue plan is honored with venue occupancy and a late arrival", async () => {
  const world = newWorld()
  world.hour = 14
  world.gatherings.push({
    id: "tomorrow-museum",
    organizer: "mia",
    invited: ["mia", "kai", "luna"],
    responses: { mia: "accepted", kai: "accepted", luna: "late" },
    location: "museum",
    scheduledDay: world.day,
    scheduledHour: world.hour,
    reason: "A real follow-up plan.",
    entityId: null,
    status: "planned",
    timeoutHour: 12,
  })
  const b = await bundle(world)
  assert.equal(b.plan.gathering.location, "museum")
  assert.deepEqual(b.plan.initialParticipants, ["mia", "kai"])
  assert.equal(b.plan.arrival.residentId, "luna")
  let state = beginLiving(idleLiving(), b)
  state = advanceLiving(state, state.duration)
  assert.deepEqual([...state.present].sort(), ["kai", "mia"])
  assert.equal(
    state.world.agents.find((a) => a.id === "mia").location,
    "museum"
  )
  state = advanceLiving(state, 1000)
  assert.equal(state.world.gatherings.at(-1).status, "completed")
  assert.equal(state.world.socialMemories.at(-1).location, "museum")
})

test("the first two simulated days include a real three-resident planned gathering", async () => {
  const initial = idleLiving()
  initial.world.completed = 2
  initial.world.day = 1
  initial.world.hour = 19
  const b = await bundle(initial.world)
  assert.deepEqual(b.plan.participants, ["mia", "kai", "luna"])
  assert.equal(b.plan.sceneType, "group_hangout")
  assert.equal(b.plan.gathering.status, "planned")
  assert.deepEqual(b.plan.gathering.invited, ["mia", "kai", "luna"])
  let state = beginLiving(initial, b)
  assert.equal(state.world.gatherings.at(-1).status, "traveling")
  state = advanceLiving(state, state.duration)
  assert.deepEqual([...state.present].sort(), ["kai", "luna", "mia"])
  assert.equal(state.world.gatherings.at(-1).status, "active")
  state = advanceLiving(state, 1000)
  assert.equal(state.world.gatherings.at(-1).status, "completed")
  assert.deepEqual(
    [...new Set(state.history.map((line) => line.speaker))].sort(),
    ["kai", "luna", "mia"]
  )
  assert.equal(state.world.socialMemories.at(-1).participants.length, 3)
})

test("a verified Qloo discovery can produce an invitation, movement, experience, and taste update", async () => {
  const initial = idleLiving()
  const b = await bundle(initial.world)
  assert(b.plan.culturalDecision)
  assert.equal(b.plan.gathering.entityId, b.plan.culturalDecision.entityId)
  assert(b.plan.gathering.invited.includes(b.plan.culturalDecision.residentId))
  let state = beginLiving(initial, b)
  const stored = state.world.discoveries.find(
    (item) => item.entityId === b.plan.culturalDecision.entityId
  )
  assert(stored)
  assert.equal(stored.provenance.provider, "Qloo")
  assert(Object.keys(state.transits).length > 0)
  state = advanceLiving(state, 1000)
  assert.equal(state.phase, "finished")
  const experienced = state.world.discoveries.find(
    (item) => item.entityId === b.plan.culturalDecision.entityId
  )
  assert(["liked", "disliked", "considered"].includes(experienced.status))
  if (state.bundle.plan.culturalDecision.completed) {
    const profile = state.world.tasteProfiles.find(
      (item) => item.residentId === b.plan.culturalDecision.residentId
    )
    assert(
      profile.preferenceChanges.some(
        (change) => change.entityId === b.plan.culturalDecision.entityId
      )
    )
  }
})

const {
  normalizeDialogue,
  similarDialogue,
  validateDialogue,
  confirmedFacts,
  DialogueQualityError,
} = require(join(output, "living/dialogue.js"))
const { generateConversation } = require(join(output, "server/generation.js"))
test("normalized exact and near duplicates reject cross-speaker reuse and six-line sequences", async () => {
  assert.equal(normalizeDialogue("  I’m HERE!  "), "i m here")
  assert(
    similarDialogue(
      "The fountain looks like a crown from here.",
      "The fountain looks like a crown from here!"
    )
  )
  assert(
    similarDialogue(
      "The fountain looks like a crown from here.",
      "The fountain looks like a crown from there."
    )
  )
  assert(!similarDialogue("Yes.", "Yet."))
  const world = newWorld()
  world.encounter = "trio"
  const b = await bundle(world)
  assert.equal(b.scene.beats.length, 6)
  world.recentScenes = [
    {
      sceneId: "previous",
      topic: "different",
      lines: b.scene.beats.map((l) => ({
        speaker: l.speaker,
        text: l.dialogue,
      })),
    },
  ]
  const swapped = structuredClone(b.scene)
  swapped.beats.forEach(
    (l) => (l.speaker = { mia: "kai", kai: "luna", luna: "mia" }[l.speaker])
  )
  assert.throws(
    () => validateDialogue(swapped, { world, plan: b.plan, signals: [] }),
    /multi-line sequence/
  )
  world.recentScenes = []
  world.recentDialogue = [
    {
      speaker: "luna",
      text: b.scene.beats[0].dialogue.replace("crown", "little crown"),
    },
  ]
  assert.throws(
    () => validateDialogue(b.scene, { world, plan: b.plan, signals: [] }),
    /repeated dialogue/
  )
  world.recentDialogue = []
  const internal = structuredClone(b.scene)
  internal.beats[4].dialogue = internal.beats[0].dialogue
  assert.throws(
    () => validateDialogue(internal, { world, plan: b.plan, signals: [] }),
    /repeated dialogue/
  )
})
test("grounding rejects imaginary callbacks, quotations, unknown evidence, forward replies and unfinished closure", async () => {
  const world = newWorld()
  world.encounter = "trio"
  const b = await bundle(world),
    context = { world, plan: b.plan, signals: [] }
  validateDialogue(b.scene, context)
  for (const text of [
    "Remember when we sang yesterday?",
    "Actually, I take it back. I liked that bit.",
    "You said “the moon is made of jam.”",
  ]) {
    const scene = structuredClone(b.scene)
    scene.beats[0].dialogue = text
    assert.throws(() => validateDialogue(scene, context), /unestablished/)
  }
  const unknown = structuredClone(b.scene)
  unknown.beats[0].references = ["imaginary"]
  assert.throws(() => validateDialogue(unknown, context), /unknown evidence/)
  const forward = structuredClone(b.scene)
  forward.beats[1].replyTo = 5
  assert.throws(() => validateScene(forward, b.plan), /continuity/)
  const dangling = structuredClone(b.scene)
  dangling.beats.at(-1).dialogue = "What will you draw?"
  assert.throws(
    () => validateDialogue(dangling, context),
    /unanswered question/
  )
  world.recentDialogue = [
    { speaker: "kai", text: "I like the shape of the fountain." },
  ]
  const grounded = structuredClone(b.scene)
  grounded.beats[0].dialogue =
    "Kai, you told me “I like the shape of the fountain.” Which part?"
  grounded.beats[0].references = ["dialogue:0"]
  validateDialogue(grounded, context)
  assert(confirmedFacts(context).some((f) => f.text.startsWith("kai said:")))
})
test("engine preserves intended speakers and records only completed scenes, with bounded history and topic cooldown", async () => {
  let state = idleLiving()
  state.world.encounter = "trio"
  for (let n = 0; n < 6; n++) {
    const b = await bundle(state.world)
    assert(
      !(state.world.recentScenes ?? []).some((s) => s.topic === b.plan.topic)
    )
    const expected = b.scene.beats.map((l) => ({
      speaker: l.speaker,
      text: l.dialogue,
    }))
    const before = state.world.recentScenes.length
    state = beginLiving(state, b)
    state = advanceLiving(state, state.duration)
    assert.equal(state.world.recentScenes.length, before)
    state = advanceLiving(state, 1000)
    assert.deepEqual(
      state.history
        .slice(-expected.length)
        .map((l) => ({ speaker: l.speaker, text: l.text })),
      expected
    )
    assert.deepEqual(state.world.recentScenes.at(-1).lines, expected)
    assert(state.world.recentScenes.length <= 4)
    validateSnapshot(state.world)
  }
})
test("repetition gets one fresh-angle retry, all failures remain bounded, and quota failure stops requests", async () => {
  const world = newWorld(),
    b = await bundle(world),
    context = { world, plan: b.plan, signals: [] }
  let requests = 0
  const invalid = structuredClone(b.scene)
  invalid.beats[1].dialogue = invalid.beats[0].dialogue
  const result = await generateConversation(context, async (next) => {
    requests++
    if (requests === 1) {
      assert.equal(next.retryAngle, undefined)
      return invalid
    }
    assert.match(next.retryAngle, /different present-tense detail/)
    return b.scene
  })
  assert.equal(requests, 2)
  assert.deepEqual(result.scene, b.scene)
  assert.match(result.repetition, /passed/)
  requests = 0
  const repeated = await generateConversation(context, async () => {
    requests++
    return invalid
  })
  assert.equal(requests, 2)
  assert.equal(repeated.scene, null)
  assert.match(repeated.repetition, /rejected/)
  requests = 0
  const limited = await generateConversation(context, async () => {
    requests++
    throw Error("Daily free-use ceiling reached")
  })
  assert.equal(requests, 1)
  assert.equal(limited.scene, null)
  requests = 0
  const failed = await generateConversation(
    context,
    async () => {
      requests++
      throw Error("503")
    },
    { retryable: () => true }
  )
  assert.equal(requests, 2)
  assert.equal(failed.scene, null)
  assert(repeated.failure instanceof DialogueQualityError)
})
test("fallback advances independent activities without dialogue, invented social memories, or stale scene replay", async () => {
  let state = idleLiving()
  const live = await bundle(state.world)
  state = advanceLiving(beginLiving(state, live), 1000)
  const history = structuredClone(state.history),
    scenes = structuredClone(state.world.recentScenes)
  for (let n = 0; n < 4; n++) {
    const b = await bundle(state.world)
    b.scene = quietScene(b.plan)
    b.diagnostics = {
      ...b.diagnostics,
      llm: "Fallback",
      requestStatus: "failed",
      repetition: "not checked",
      reason: "Groq unavailable",
    }
    state = beginLiving(state, b)
    assert.equal(state.phase, "traveling")
    assert.equal(state.speech, null)
    state = advanceLiving(state, 1000)
    assert.equal(state.phase, "finished")
    assert.deepEqual(state.history, history)
    assert.deepEqual(state.world.recentScenes, scenes)
    assert(
      state.world.agents.every((a) => a.location === b.plan.destinations[a.id])
    )
  }
  const forged = await bundle(state.world)
  forged.diagnostics.llm = "Fallback"
  assert.throws(
    () => beginLiving(state, forged),
    /Fallback must not contain dialogue/
  )
})

test("three consecutive SDK fixture scenes keep a thread, distinct voices, endings and bounded recent context", async () => {
  // Authored responses from a fake SDK transport: this is NOT a live Groq quality claim.
  const Groq = require("groq-sdk").default
  const { GroqProvider, sceneTokenReservation } = require(
    join(output, "server/groq.js")
  )
  const exchanges = [
    [
      ["mia", "The fountain looks like a crown. Kai, would you wear it?"],
      [
        "kai",
        "Only if I could dodge the water. That crown seems determined to soak me.",
      ],
      [
        "luna",
        "A crown with its own rain. I'll draw the silhouette from here.",
      ],
      ["mia", "Draw Kai beside it, looking heroic and staying completely dry."],
      [
        "kai",
        "I can manage the dry part. The heroic part might take practice.",
      ],
      ["luna", "Stay there, then. I'll begin with the outline."],
    ],
    [
      [
        "luna",
        "I want to try drawing without lifting my pencil. What should I start with?",
      ],
      ["mia", "My sleeve. It has enough wrinkles to keep your pencil busy."],
      ["kai", "Or my shoe, if you want a dramatic subject."],
      [
        "luna",
        "The sleeve is still, which gives it an advantage over your shoe.",
      ],
      ["kai", "Fair. My foot keeps wandering. I'll watch instead."],
      ["mia", "Here, I'll hold my arm against the bench while you start."],
    ],
    [
      [
        "kai",
        "I'm in the mood to dance. Does either of you want to try a very small step?",
      ],
      ["mia", "Small enough to fit between these paving stones? I'm willing."],
      [
        "luna",
        "I'll watch the stones. Someone should make sure they aren't moving too.",
      ],
      ["kai", "Just a step sideways, then back. I'll go slowly."],
      ["mia", "Slowly sounds manageable. Give me a little room."],
      ["luna", "I'll move to the edge and leave the middle to you."],
    ],
  ]
  let state = idleLiving()
  state.world.encounter = "trio"
  let outgoing
  for (const exchange of exchanges) {
    // This test exercises authored trio SDK replies. Venue rosters have their
    // own attendance tests; do not feed trio prose to a solo/pair visit.
    state.world.pendingVisits = []
    const b = await bundle(state.world)
    b.scene.beats = exchange.map(([speaker, dialogue], index) => ({
      speaker,
      dialogue,
      emotion: "curious",
      action: "talk",
      targetLocation: null,
      replyTo: index ? index - 1 : null,
      references: [],
    }))
    b.scene.suggestedMemoryUpdates = []
    b.scene.suggestedRelationshipChanges = []
    const context = { world: state.world, plan: b.plan, signals: mockSignals }
    const provider = new GroqProvider(
      new Groq({
        apiKey: "test-only",
        maxRetries: 0,
        fetch: async (_url, init) => {
          outgoing = JSON.parse(init.body)
          return new Response(
            JSON.stringify({
              choices: [
                {
                  finish_reason: "stop",
                  message: { content: JSON.stringify(b.scene) },
                },
              ],
              usage: { prompt_tokens: 1000, completion_tokens: 300 },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        },
      })
    )
    const result = await generateConversation(context, (c) =>
      provider.generateScene(c)
    )
    assert(result.scene, result.failure?.message)
    const prompt = JSON.parse(outgoing.messages[1].content)
    assert.deepEqual(prompt.encounter.participants, ["mia", "kai", "luna"])
    assert(prompt.world.avoidRepeating.length <= 10)
    assert(
      prompt.world.avoidRepeating.every(
        (line) =>
          state.world.recentScenes.some((scene) =>
            scene.lines.some((past) => past.text === line.text)
          ) ||
          state.world.recentDialogue.some((past) => past.text === line.text)
      )
    )
    assert(
      sceneTokenReservation(context) < 20000,
      "one scene remains within configured minute token reservation ceiling"
    )
    state = advanceLiving(
      beginLiving(state, { ...b, scene: result.scene }),
      1000
    )
    assert.equal(state.phase, "finished")
  }
  assert.equal(state.world.recentScenes.length, 3)
  assert.equal(
    new Set(state.history.map((l) => normalizeDialogue(l.text))).size,
    18
  )
})

const {
  QlooClient,
  QlooError,
  culturalIntelligence,
  resetQlooClientForTests,
  QLOO_HACKATHON_ORIGIN,
} = require(join(output, "server/qloo.js"))

test("Qloo client pins the hackathon host, authenticates server-side, validates entities, and caches real responses", async () => {
  resetQlooClientForTests()
  const requests = []
  const transport = async (url, init) => {
    requests.push({ url: new URL(url), init })
    const target = new URL(url)
    if (target.pathname === "/search")
      return Response.json({
        results: [
          {
            entity_id: "verified-miles-davis",
            name: "Miles Davis",
            types: ["urn:entity:artist"],
          },
        ],
      })
    return Response.json({
      results: {
        entities: [
          {
            entity_id: "recommended-artist",
            name: "Real Recommendation",
            type: "urn:entity:artist",
            description: "Returned by the fixture transport.",
            properties: {
              geocode: { city: "Accra", latitude: 5.6037, longitude: -0.187 },
              biography: "x".repeat(9000),
            },
            query: {
              affinity: 0.73,
              explainability: {
                signals: Array.from({ length: 100 }, (_, i) =>
                  `explanation-${i}-`.repeat(30)
                ),
              },
            },
          },
        ],
      },
    })
  }
  const client = new QlooClient({
    apiKey: "test-secret-key",
    fetch: transport,
    sleep: async () => {},
  })
  const search = await client.search("Miles Davis", "urn:entity:artist")
  assert.equal(search.data[0].entityId, "verified-miles-davis")
  const recommendation = await client.insights({
    type: "urn:entity:artist",
    entityIds: [search.data[0].entityId],
  })
  assert.equal(recommendation.data[0].affinity, 0.73)
  assert.equal(recommendation.data[0].properties.geocode.city, "Accra")
  assert(JSON.stringify(recommendation.data[0].properties).length <= 1200)
  assert(JSON.stringify(recommendation.data[0].explainability).length <= 1200)
  await client.insights({
    type: "urn:entity:artist",
    entityIds: [search.data[0].entityId],
  })
  assert.equal(requests.length, 2)
  assert(
    requests.every((request) => request.url.origin === QLOO_HACKATHON_ORIGIN)
  )
  assert.equal(requests[0].url.searchParams.get("types"), "urn:entity:artist")
  assert.equal(
    requests[1].url.searchParams.get("signal.interests.entities"),
    "verified-miles-davis"
  )
  assert.equal(requests[0].init.headers["X-Api-Key"], "test-secret-key")
  assert(!JSON.stringify(recommendation).includes("test-secret-key"))
  assert.equal(client.cachedRequests, 1)
})

test("Qloo client reports configuration, authentication, rate-limit, and empty-result failures without mock data", async () => {
  resetQlooClientForTests()
  assert.throws(
    () => new QlooClient({ apiKey: "x", baseUrl: "https://api.qloo.com" }),
    /hackathon\.api\.qloo\.com/
  )
  const forbidden = new QlooClient({
    apiKey: "bad",
    fetch: async () => Response.json({}, { status: 403 }),
    sleep: async () => {},
  })
  await assert.rejects(
    () => forbidden.search("Miles Davis", "urn:entity:artist"),
    (error) => error instanceof QlooError && error.kind === "authentication"
  )
  let calls = 0
  const limited = new QlooClient({
    apiKey: "limited",
    fetch: async () => {
      calls++
      return Response.json({}, { status: 429, headers: { "Retry-After": "0" } })
    },
    sleep: async () => {},
  })
  await assert.rejects(
    () => limited.search("Miles Davis", "urn:entity:artist"),
    (error) => error instanceof QlooError && error.kind === "rate_limit"
  )
  assert.equal(calls, 2)
  resetQlooClientForTests()
  const empty = new QlooClient({
    apiKey: "valid",
    fetch: async () => Response.json({ results: [] }),
    sleep: async () => {},
  })
  await assert.rejects(
    () => empty.search("Nobody", "urn:entity:artist"),
    /returned no entities/
  )
})

test("each resident resolves independent Qloo seeds and later liked experiences become future signals", async () => {
  resetQlooClientForTests()
  const requests = []
  const transport = async (url) => {
    const target = new URL(url)
    requests.push(target)
    if (target.pathname === "/search") {
      const name = target.searchParams.get("query")
      const type = target.searchParams.get("types")
      return Response.json({
        results: [
          {
            entity_id: `verified-${name.toLowerCase().replace(/[^a-z]+/g, "-")}`,
            name,
            types: [type],
          },
        ],
      })
    }
    const type = target.searchParams.get("filter.type")
    return Response.json({
      results: {
        entities: [
          {
            entity_id: `recommendation-${type}`,
            name: `Recommendation for ${type}`,
            type,
            query: { affinity: 0.61 },
          },
        ],
      },
    })
  }
  const world = newWorld()
  world.discoveries.push({
    entityId: "liked-extra",
    name: "Experienced Favorite",
    type: "urn:entity:artist",
    description: null,
    residentId: "mia",
    discoveredAt: "2026-10-25T00:00:00.000Z",
    day: 1,
    scene: 0,
    status: "liked",
    affinity: null,
    properties: {},
    explainability: null,
    provenance: {
      provider: "Qloo",
      endpoint: "/v2/insights",
      requestedAt: "2026-10-25T00:00:00.000Z",
      requestCategory: "urn:entity:artist",
      signalEntityIds: ["original-seed"],
      excludedEntityIds: [],
      delivery: "live",
    },
    reaction: "Mia enjoyed it",
  })
  const result = await culturalIntelligence(
    world,
    () =>
      new QlooClient({
        apiKey: "server-only",
        fetch: transport,
        sleep: async () => {},
      })
  )
  assert.equal(result.signals.length, 3)
  assert.deepEqual(result.signals.map((signal) => signal.residentId).sort(), [
    "kai",
    "luna",
    "mia",
  ])
  assert.equal(new Set(result.signals.map((signal) => signal.category)).size, 3)
  assert(
    result.tasteProfiles.every(
      (profile) => profile.verifiedInterests.length === 2
    )
  )
  const insightRequests = requests.filter(
    (request) => request.pathname === "/v2/insights"
  )
  assert.equal(insightRequests.length, 3)
  assert(
    insightRequests.some((request) =>
      request.searchParams
        .get("signal.interests.entities")
        .includes("liked-extra")
    )
  )
  assert(
    result.signals.every(
      (signal) => signal.provenance.signalEntityIds.length >= 2
    )
  )
})
