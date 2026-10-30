const { test, after } = require("node:test")
const assert = require("node:assert/strict")
const { mkdtempSync, rmSync, symlinkSync, readFileSync } = require("node:fs")
const { tmpdir } = require("node:os")
const { join, resolve } = require("node:path")
const { randomBytes } = require("node:crypto")
const ts = require("typescript")
const output = mkdtempSync(join(tmpdir(), "echoes-copilot-tests-"))
const originalCacheDir = process.env.ECHOES_CACHE_DIR
process.env.ECHOES_CACHE_DIR = join(output, "test-cache")
process.env.MUSICBRAINZ_CONTACT_EMAIL ||= "tests@example.invalid"
after(() => {
  if (originalCacheDir) process.env.ECHOES_CACHE_DIR = originalCacheDir
  else delete process.env.ECHOES_CACHE_DIR
})
const program = ts.createProgram(
  [
    "lib/echoes/pipeline.ts",
    "lib/echoes/memory.ts",
    "lib/echoes/planner.ts",
    "lib/echoes/note.ts",
    "lib/echoes/secure-store.ts",
    "lib/echoes/storage-validation.ts",
    "lib/echoes/recheck.ts",
    "lib/echoes/demo-preflight.ts",
  ],
  {
    outDir: output,
    rootDir: "lib/echoes",
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2023,
    esModuleInterop: true,
    skipLibCheck: true,
    strict: true,
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
symlinkSync(resolve("node_modules"), join(output, "node_modules"), "dir")
after(() => rmSync(output, { recursive: true, force: true }))
const { generateSessionKit } = require(join(output, "pipeline.js"))
const { relevantMemories, saveWrapUp } = require(join(output, "memory.js"))
const { planSession, rebalancePlan } = require(join(output, "planner.js"))
const { createWorkspace, removeResidentData } = require(
  join(output, "workspace.js")
)
const { draftWrapUpNote } = require(join(output, "note.js"))
const { lookupYearFact } = require(join(output, "year-facts.js"))
const { mediaSearch, lookupMedia } = require(join(output, "media.js"))
const { workspaceSchema } = require(join(output, "storage-validation.js"))
const { memorySchema, kitRequestSchema } = require(
  join(output, "validation.js")
)
const store = require(join(output, "secure-store.js"))
const person = {
  id: "fictional-person",
  nickname: "Fictional",
  birthYear: 1945,
  hometown: "Liverpool",
  country: "United Kingdom",
  language: "English",
  lovedThings: ["Test Artist"],
  sensitivities: [],
  consent: { authority: "caregiver", recordedAt: "2026-10-27T00:00:00.000Z" },
}
const entity = (id, name = id, type = "urn:entity:artist") => ({
  entityId: id,
  name,
  type,
  description: null,
  affinity: 0.5,
  properties: { country: "United Kingdom" },
})
function fixtureTools(options = {}) {
  const calls = []
  return {
    calls,
    client: {
      search: async (query, type) => {
        calls.push({ tool: "search", query, type })
        return type === "urn:entity:artist" ? [entity("anchor", query)] : []
      },
      insights: async (input) => {
        calls.push({ tool: "insights", ...input })
        if (options.fail) throw Error("Fixture provider outage")
        return [
          entity(`related:${input.type}`, "Related " + input.type, input.type),
        ]
      },
    },
    year: async (name, type, residents) =>
      options.noDates
        ? {
            status: "unavailable",
            evidence: null,
            reason: "Fixture date provider unavailable",
          }
        : {
            status: "verified",
            evidence: {
              year: options.year ?? 1964,
              source: type === "urn:entity:artist" ? "MusicBrainz" : "TMDB",
              residentIds: residents.map((r) => r.id),
              title: name,
              url: "https://musicbrainz.org/release-group/test-fixture",
            },
            reason: "Explicit test fixture, not a live result",
          },
    media: async (e) => mediaSearch(e.name),
  }
}
test("copilot uses structured tools, includes a dated favourite, and plans exactly 30 minutes", async () => {
  const tools = fixtureTools()
  const kit = await generateSessionKit(
    { residents: [person], feedback: [] },
    tools
  )
  assert(kit.items.some((i) => i.entityId === "anchor"))
  assert(kit.items.every((i) => i.yearEvidence.year === 1964))
  assert.equal(
    kit.activities.reduce((n, a) => n + a.minutes, 0),
    30
  )
  assert(kit.activities.every((a) => !a.approved))
  assert(
    kit.agentTrace.some(
      (t) => t.tool === "qloo_search" && t.output.entities.length
    )
  )
  assert(
    kit.agentTrace.some(
      (t) => t.role === "Cultural Researcher" && t.tool === "era_verify"
    )
  )
  assert(kit.diagnostics.toolCalls <= 30)
  assert(kit.items.every((i) => i.media.every((m) => m.status === "search")))
})
test("outside-window discoveries stay excluded while named favourites carry explicit exceptions", async () => {
  const kit = await generateSessionKit(
    { residents: [person], feedback: [] },
    fixtureTools({ year: 2020 })
  )
  assert.equal(kit.items.length, 1)
  assert(kit.items[0].namedFavorite)
  assert.match(
    kit.items[0].eraLabel,
    /Later than.*included because you named it/
  )
  assert(!kit.items.some((i) => i.entityId.startsWith("related:")))
  assert.equal(
    kit.activities.reduce((n, a) => n + a.minutes, 0),
    30
  )
})
test("unavailable dates trigger at most one broader discovery pass and an explicit failure trace", async () => {
  const tools = fixtureTools({ noDates: true })
  const kit = await generateSessionKit(
    { residents: [person], feedback: [] },
    tools
  )
  assert.equal(
    tools.calls.filter((c) => c.tool === "insights" && c.broaden).length,
    4
  )
  assert(kit.notes.some((n) => n.includes("unavailable")))
  assert(
    kit.agentTrace.some(
      (t) => t.tool === "era_verify" && t.outcome === "unavailable"
    )
  )
  assert.equal(kit.items.length, 0)
})
test("Osibisa-era planning rejects Jambo and reports cross-domain coverage honestly", async () => {
  const osibisa = { ...person, birthYear: 1950, lovedThings: ["Osibisa"] }
  const related = (type, name, year) => ({
    ...entity(`${type}:${name}`, name, type),
    properties:
      type === "urn:entity:book"
        ? { country: "United Kingdom", publication_year: String(year) }
        : { country: "United Kingdom" },
  })
  const tools = {
    client: {
      search: async (query, type) =>
        type === "urn:entity:artist" ? [entity("osibisa", query, type)] : [],
      insights: async ({ type }) => {
        if (type === "urn:entity:artist") return [related(type, "Jambo", 1989)]
        if (type === "urn:entity:movie")
          return [related(type, "Era Film", 1972)]
        if (type === "urn:entity:tv_show")
          return [related(type, "Era Television", 1973)]
        return [related(type, "Era Book", 1971)]
      },
    },
    year: async (name, type, residents) => {
      const year =
        name === "Jambo"
          ? 1989
          : name === "Osibisa"
            ? 1971
            : type === "urn:entity:movie"
              ? 1972
              : 1973
      return {
        status: year >= 1960 && year <= 1975 ? "verified" : "outside_window",
        evidence:
          year >= 1960 && year <= 1975
            ? {
                year,
                source: type === "urn:entity:artist" ? "MusicBrainz" : "TMDB",
                residentIds: residents.map((resident) => resident.id),
                title: name,
              }
            : null,
        reason: "Fixture year evidence",
      }
    },
    media: async (candidate) => mediaSearch(candidate.name),
  }
  const kit = await generateSessionKit(
    { residents: [osibisa], feedback: [] },
    tools
  )
  assert(
    kit.items.every(
      (item) => item.yearEvidence.year >= 1960 && item.yearEvidence.year <= 1975
    )
  )
  assert(!kit.items.some((item) => item.name === "Jambo"))
  assert(new Set(kit.items.map((item) => item.kind)).size >= 2)
  assert(
    kit.items
      .filter((item) => item.entityId !== "osibisa")
      .every((item) => item.whyItFits[0].includes("Because you chose Osibisa"))
  )
  assert(["strong", "partial", "thin"].includes(kit.coverage.level))
})
test("saved review changes the next session, keeps distress excluded, and never confirms a shared story", async () => {
  const kit = await generateSessionKit(
    { residents: [person], feedback: [] },
    fixtureTools()
  )
  let workspace = createWorkspace("fixture", [person])
  workspace.sessions = [
    {
      id: kit.id,
      createdAt: kit.createdAt,
      kit,
      feedback: [],
      engagement: null,
      noteDraft: null,
    },
  ]
  const activity = kit.activities.find((a) => a.itemId === "anchor")
  const wrapUp = {
    recordedAt: new Date().toISOString(),
    observations: [
      { activityId: activity.id, status: "distress" },
      {
        activityId: "conversation",
        status: "shared_story",
        story: "Talked about a garden.",
      },
    ],
    engagement: 2,
    caregiverNote: "",
  }
  workspace = saveWrapUp(workspace, kit, wrapUp, draftWrapUpNote(kit, wrapUp))
  assert.equal(
    workspace.memories.find((m) => m.response === "shared_story").status,
    "reported"
  )
  assert.equal(workspace.sessions[0].wrapUp.engagement, 2)
  const next = await generateSessionKit(
    {
      residents: [person],
      feedback: workspace.feedback,
      memories: workspace.memories,
    },
    fixtureTools()
  )
  assert(!next.items.some((i) => i.entityId === "anchor"))
  assert(
    next.agentTrace
      .find((t) => t.tool === "memory_read")
      .output.excludedIds.includes("anchor")
  )
  const again = saveWrapUp(workspace, kit, wrapUp, "Edited note")
  assert.equal(again.memories.length, workspace.memories.length)
})
test("memory retrieval is resident-scoped, bounded, and excludes unconfirmed cultural discoveries", () => {
  const records = Array.from({ length: 50 }, (_, i) => ({
    id: String(i),
    residentId: person.id,
    kind: "discovery",
    status: "suggested",
    source: "Qloo",
    text: "Suggestion",
    createdAt: new Date().toISOString(),
  }))
  records.push({
    id: "distress",
    residentId: person.id,
    kind: "observation",
    response: "distress",
    createdAt: "2020-01-01T00:00:00Z",
  })
  records.push({
    id: "other",
    residentId: "other",
    kind: "biography",
    status: "confirmed",
    createdAt: new Date().toISOString(),
  })
  assert.deepEqual(
    relevantMemories(records, person.id).map((m) => m.id),
    ["distress"]
  )
  assert.equal(
    memorySchema.safeParse({
      ...records[0],
      kind: "biography",
      status: "confirmed",
    }).success,
    false
  )
})
test("editing a plan retains 30 minutes; notes never infer participation or use historical feedback", () => {
  const activities = rebalancePlan(
    planSession(person, [], []).filter((a) => a.kind !== "conversation")
  )
  assert.equal(
    activities.reduce((n, a) => n + a.minutes, 0),
    30
  )
  const note = draftWrapUpNote(
    { residents: [person], activities },
    {
      recordedAt: "2026-10-27T00:00:00Z",
      observations: [{ activityId: "invented", status: "engaged" }],
      engagement: null,
      caregiverNote: "",
    }
  )
  assert.match(note, /No activity responses recorded/)
  assert.doesNotMatch(
    note,
    /took part|engagement observed|treatment|Do you remember/
  )
})
test("single-resident MVP rejects group generation", () => {
  assert.equal(
    kitRequestSchema.safeParse({
      residents: [person, { ...person, id: "two" }],
      feedback: [],
    }).success,
    false
  )
})

test("positive observed memory becomes a discovery seed, never a Qloo-suggested personal fact", async () => {
  const tools = fixtureTools()
  const memories = [
    {
      id: "positive",
      residentId: person.id,
      kind: "observation",
      status: "reported",
      source: "caregiver",
      entityId: "previously-engaging",
      response: "engaged",
      text: "Engagement observed",
      createdAt: new Date().toISOString(),
    },
  ]
  await generateSessionKit(
    { residents: [person], feedback: [], memories },
    tools
  )
  assert(
    tools.calls.some(
      (c) =>
        c.tool === "insights" && c.entityIds.includes("previously-engaging")
    )
  )
})

test("correcting a session activity to not used removes that session’s response memory", async () => {
  const kit = await generateSessionKit(
    { residents: [person], feedback: [] },
    fixtureTools()
  )
  let workspace = createWorkspace("fixture", [person])
  workspace.sessions = [
    {
      id: kit.id,
      createdAt: kit.createdAt,
      kit,
      feedback: [],
      engagement: null,
      noteDraft: null,
    },
  ]
  const activity = kit.activities.find((a) => a.itemId === "anchor")
  const review = {
    recordedAt: new Date().toISOString(),
    observations: [{ activityId: activity.id, status: "distress" }],
    engagement: null,
    caregiverNote: "",
  }
  workspace = saveWrapUp(workspace, kit, review, "First draft")
  workspace = saveWrapUp(
    workspace,
    kit,
    {
      ...review,
      observations: [{ activityId: activity.id, status: "not_used" }],
    },
    "Corrected draft"
  )
  assert.equal(workspace.memories.length, 0)
  assert.equal(workspace.feedback.length, 0)
})

test("resident removal clears only their records, leaving another resident intact", () => {
  const workspace = createWorkspace("fixture", [
    person,
    { ...person, id: "other", nickname: "Other fictional" },
  ])
  workspace.memories = [
    { id: "one", residentId: person.id },
    { id: "two", residentId: "other" },
  ]
  workspace.feedback = [
    { residentId: person.id, entityId: "one", status: "sparked" },
    { residentId: "other", entityId: "two", status: "sparked" },
  ]
  const result = removeResidentData(workspace, person.id)
  assert.deepEqual(
    result.residents.map((r) => r.id),
    ["other"]
  )
  assert.deepEqual(
    result.memories.map((m) => m.id),
    ["two"]
  )
  assert.deepEqual(
    result.feedback.map((f) => f.residentId),
    ["other"]
  )
})

test("caregiver sessions reject unknown, expired, and revoked tokens", () => {
  const token = randomBytes(32).toString("hex")
  const data = {
    sessions: [{ hash: store.hashToken(token), expires: Date.now() + 10000 }],
  }
  assert(store.validSession(data, token))
  assert(!store.validSession(data, randomBytes(32).toString("hex")))
  data.sessions[0].expires = Date.now() - 1
  assert(!store.validSession(data, token))
  data.sessions = []
  assert(!store.validSession(data, token))
})
test("year facts do not cache outages and never reuse another resident’s evidence IDs", async () => {
  const original = global.fetch
  let outage = true
  global.fetch = async (url) => {
    if (outage) return new Response("{}", { status: 503 })
    if (String(url).includes("/artist/"))
      return Response.json({
        artists: [{ id: "fixture-artist", name: "Cache Fixture Artist" }],
      })
    return Response.json({
      "release-groups": [
        {
          id: "fixture-release",
          title: "Fixture work",
          "first-release-date": "1964",
        },
      ],
    })
  }
  try {
    assert.equal(
      (
        await lookupYearFact("Cache Fixture Artist", "urn:entity:artist", [
          person,
        ])
      ).status,
      "unavailable"
    )
    outage = false
    assert.deepEqual(
      (
        await lookupYearFact("Cache Fixture Artist", "urn:entity:artist", [
          person,
        ])
      ).evidence.residentIds,
      [person.id]
    )
    assert.deepEqual(
      (
        await lookupYearFact("Cache Fixture Artist", "urn:entity:artist", [
          { ...person, id: "second-person" },
        ])
      ).evidence.residentIds,
      ["second-person"]
    )
  } finally {
    global.fetch = original
  }
})
test("a provider URL is checked, while a failed media check is only a search instruction", async () => {
  const original = global.fetch
  const candidate = {
    ...entity("media", "Media Fixture"),
    properties: {
      external: { spotify: { id: "1234567890123456789012", type: "album" } },
    },
  }
  try {
    global.fetch = async () =>
      Response.json({ provider_name: "Spotify", title: "Media Fixture" })
    assert.equal((await lookupMedia(candidate))[0].status, "provider-checked")
    global.fetch = async () => new Response("{}", { status: 503 })
    assert(
      (await lookupMedia(candidate)).every((link) => link.status === "search")
    )
    assert.equal(mediaSearch("Anything").length, 1)
  } finally {
    global.fetch = original
  }
})
test("protected storage encrypts data, survives reload, and fails closed on tampering", () => {
  const directory = mkdtempSync(join(tmpdir(), "echoes-protected-"))
  const env = { ...process.env }
  try {
    process.env.ECHOES_STORAGE_KEY = randomBytes(32).toString("hex")
    process.env.ECHOES_CAREGIVER_CODE = "fictional-test-passphrase"
    process.env.ECHOES_ORIGIN = "http://localhost:3112"
    process.env.ECHOES_DATA_DIR = directory
    store.transaction((data) => {
      data.workspace.residents = [person]
    })
    assert.equal(
      store.transaction((data) => data.workspace.residents[0].nickname),
      person.nickname
    )
    const encrypted = readFileSync(join(directory, "workspace.enc"))
    assert(!encrypted.toString().includes(person.nickname))
    encrypted[30] ^= 1
    assert.throws(() =>
      store.decryptStore(
        encrypted,
        Buffer.from(process.env.ECHOES_STORAGE_KEY, "hex")
      )
    )
  } finally {
    for (const key of [
      "ECHOES_STORAGE_KEY",
      "ECHOES_CAREGIVER_CODE",
      "ECHOES_ORIGIN",
      "ECHOES_DATA_DIR",
    ]) {
      if (env[key] === undefined) delete process.env[key]
      else process.env[key] = env[key]
    }
    rmSync(directory, { recursive: true, force: true })
  }
})
test("family links are scoped, one-use, revocable, expire, and do not overwrite a profile before review", () => {
  const data = {
    version: 1,
    revision: 0,
    workspace: createWorkspace("fixture", [person]),
    sessions: [],
    invites: [],
    submissions: [],
  }
  const invitation = store.issueInvite(data, person.id)
  assert.notEqual(data.invites[0].hash, invitation.token)
  const submission = {
    authority: true,
    relationship: "family test",
    profile: { ...person, hometown: "Changed by family" },
  }
  store.acceptFamilySubmission(data, invitation.token, submission)
  assert.equal(data.workspace.residents[0].hometown, person.hometown)
  assert.equal(data.submissions[0].residentId, person.id)
  assert.throws(() =>
    store.acceptFamilySubmission(data, invitation.token, submission)
  )
  const revoked = store.issueInvite(data, person.id)
  const current = store.issueInvite(data, person.id)
  assert.throws(() =>
    store.acceptFamilySubmission(data, revoked.token, submission)
  )
  data.invites[0].expires = Date.now() - 1
  assert.throws(() =>
    store.acceptFamilySubmission(data, current.token, submission)
  )
})
test("protected workspace validation rejects executable media URLs", async () => {
  const kit = await generateSessionKit(
    { residents: [person], feedback: [] },
    fixtureTools()
  )
  const workspace = createWorkspace("fixture", [person])
  workspace.sessions = [
    {
      id: kit.id,
      createdAt: kit.createdAt,
      kit,
      feedback: [],
      engagement: null,
      noteDraft: null,
    },
  ]
  assert(workspaceSchema.safeParse(workspace).success)
  kit.items[0].media[0].url = "javascript:alert(1)"
  assert.equal(workspaceSchema.safeParse(workspace).success, false)
})

test("Qloo artwork accepts nested image URLs and skips unsafe or missing candidates", async () => {
  const { EchoesQlooClient } = require(join(output, "qloo.js"))
  const original = global.fetch
  global.fetch = async () =>
    Response.json({
      results: [
        {
          entity_id: "nested",
          name: "Nested artwork",
          properties: { image: { url: "https://images.example/artist.jpg" } },
        },
        {
          entity_id: "fallback",
          name: "Fallback artwork",
          properties: {
            image: { url: "javascript:alert(1)" },
            images: [{}, { url: "https://images.example/cover.jpg" }],
          },
        },
        {
          entity_id: "none",
          name: "No artwork",
          properties: {
            image: { url: "https://user:password@images.example/private.jpg" },
          },
        },
      ],
    })
  try {
    const items = await new EchoesQlooClient("test-key").search(
      "artwork-regression",
      "urn:entity:artist"
    )
    assert.deepEqual(
      items.map((item) => item.imageUrl),
      [
        "https://images.example/artist.jpg",
        "https://images.example/cover.jpg",
        undefined,
      ]
    )
  } finally {
    global.fetch = original
  }
})

test("chosen favourites are checked before related discovery and lead the plan", async () => {
  const tools = fixtureTools()
  const events = []
  const year = tools.year
  const insights = tools.client.insights
  tools.year = async (...args) => {
    events.push(`date:${args[0]}`)
    return year(...args)
  }
  tools.client.insights = async (...args) => {
    events.push("discover")
    return insights(...args)
  }
  const kit = await generateSessionKit(
    { residents: [person], feedback: [] },
    tools
  )
  assert(events.indexOf("date:Test Artist") < events.indexOf("discover"))
  assert.equal(
    kit.activities.find((a) => a.kind === "media").title,
    "Test Artist"
  )
})

test("a failed favourite date check is explained by name, never presented as no match", async () => {
  const tools = fixtureTools({ noDates: true })
  const kit = await generateSessionKit(
    { residents: [{ ...person, lovedThings: ["Daddy Lumba"] }], feedback: [] },
    tools
  )
  assert(
    kit.notes.some(
      (note) =>
        note.includes("Daddy Lumba was matched by Qloo") &&
        note.includes("release-date check was unavailable")
    )
  )
  assert.equal(kit.items.length, 0)
})

test("a favourite search outage and an empty result have different explanations", async () => {
  for (const unavailable of [true, false]) {
    const tools = fixtureTools()
    tools.client.search = async () => {
      if (unavailable) throw Error("Fixture outage")
      return []
    }
    const kit = await generateSessionKit(
      { residents: [person], feedback: [] },
      tools
    )
    assert(
      kit.notes.some(
        (note) =>
          note.includes("Test Artist") &&
          note.includes(
            unavailable ? "lookup was unavailable" : "plausible match"
          )
      )
    )
  }
})

test("all ET Mensah punctuation variants resolve to the same Qloo artist", async () => {
  for (const name of [
    "ET Mensah",
    "E.T. Mensah",
    "E. T. Mensah",
    "et mensah",
  ]) {
    const tools = fixtureTools()
    tools.client.search = async () => [entity("mensah", "E.T. Mensah")]
    const kit = await generateSessionKit(
      { residents: [{ ...person, lovedThings: [name] }], feedback: [] },
      tools
    )
    assert.equal(kit.items[0].entityId, "mensah")
    assert.equal(kit.diagnostics.resolved, 1)
  }
})

test("MusicBrainz serializes requests, honors Retry-After, and caps 429 retries", async () => {
  const { createMusicBrainzClient } = require(join(output, "musicbrainz.js"))
  let time = 100000
  const starts = [],
    logs = []
  const client = createMusicBrainzClient({
    now: () => time,
    sleep: async (ms) => {
      time += ms
    },
    random: () => 0,
    email: "test@example.invalid",
    cache: false,
    queue: { tail: Promise.resolve(), nextStart: 0 },
    log: (entry) => logs.push(entry),
    fetch: async (url, init) => {
      starts.push(time)
      assert.equal(
        init.headers["User-Agent"],
        "Echoes/0.1 (contact: test@example.invalid)"
      )
      return new Response("{}", {
        status: 429,
        headers: { "Retry-After": "2" },
      })
    },
  })
  await assert.rejects(
    client("/ws/2/artist/", { query: "test" }),
    (error) => error.status === 429
  )
  assert.equal(starts.length, 4)
  assert.deepEqual(
    starts.map((t, i) => (i ? t - starts[i - 1] : 0)),
    [0, 2000, 2000, 4000]
  )
  assert(logs.every((log) => log.status === 429 && log.outcome === "http_429"))
})

test("MusicBrainz concurrent callers cannot burst; timeouts retry; parse errors remain unavailable", async () => {
  const { createMusicBrainzClient } = require(join(output, "musicbrainz.js"))
  let time = 100000
  const starts = []
  const base = {
    now: () => time,
    sleep: async (ms) => {
      time += ms
    },
    random: () => 0,
    email: "test@example.invalid",
    cache: false,
    queue: { tail: Promise.resolve(), nextStart: 0 },
    log: () => {},
  }
  const client = createMusicBrainzClient({
    ...base,
    fetch: async () => {
      starts.push(time)
      return Response.json({ artists: [] })
    },
  })
  await Promise.all([
    client("/ws/2/artist/", { query: "a" }),
    client("/ws/2/artist/", { query: "b" }),
    client("/ws/2/artist/", { query: "c" }),
  ])
  assert.deepEqual(starts, [100000, 101000, 102000])
  let attempts = 0
  const timeout = createMusicBrainzClient({
    ...base,
    fetch: async () => {
      if (++attempts < 3)
        throw new DOMException("Fixture timeout", "TimeoutError")
      return Response.json({ artists: [] })
    },
  })
  await timeout("/ws/2/artist/", { query: "d" })
  assert.equal(attempts, 3)
  const malformed = createMusicBrainzClient({
    ...base,
    fetch: async () => new Response("not json"),
  })
  await assert.rejects(
    malformed("/ws/2/artist/", { query: "e" }),
    (error) => error.kind === "parse_error"
  )
})

test("unavailable checks do not imply thin evidence; retry updates only failed items in place", async () => {
  const { coverageSummary } = require(join(output, "coverage.js"))
  const { retryDateChecks } = require(join(output, "recheck.js"))
  const kit = await generateSessionKit(
    { residents: [person], feedback: [] },
    fixtureTools({ noDates: true })
  )
  const summary = coverageSummary(kit)
  assert(summary.pending.length > 0)
  assert.equal(summary.showFew, false)
  assert(kit.notes.some((note) => note.startsWith("Less personalised")))
  const checked = kit.dateChecks.find(
    (check) => check.status !== "unchecked_unavailable"
  )
  if (checked) checked.entity.name = "MUST NOT RETRY"
  const names = []
  const next = await retryDateChecks(kit, person, [], {
    year: async (name, type, residents) => {
      names.push(name)
      return {
        status: "verified",
        evidence: {
          year: 1964,
          source: "MusicBrainz",
          residentIds: residents.map((r) => r.id),
        },
        reason: "fixture",
      }
    },
    media: async () => [],
  })
  assert.equal(names.length, summary.pending.length)
  assert(!names.includes("MUST NOT RETRY"))
  assert.equal(next.id, kit.id)
  assert(next.activities.some((a) => a.kind === "media"))
  assert.equal(
    next.activities.reduce((sum, a) => sum + a.minutes, 0),
    30
  )
  assert.equal(coverageSummary(next).pending.length, 0)
})

test("ambiguous candidates produce a pick list and a remembered choice resolves it", async () => {
  const { resolveFavorite } = require(join(output, "resolution.js"))
  const rows = [entity("first", "Test Artist"), entity("second", "Test Artist")]
  const choice = await resolveFavorite(
    "Test Artist",
    async () => rows,
    undefined,
    false
  )
  assert.equal(choice.entity, undefined)
  assert.equal(choice.candidates.length, 2)
  const remembered = await resolveFavorite(
    "test artist",
    async () => rows,
    {
      query: "Test Artist",
      entityId: "second",
      type: "urn:entity:artist",
      name: "Test Artist",
    },
    false
  )
  assert.equal(remembered.entity.entityId, "second")
})

test("MusicBrainz aliases expand Qloo resolution without a hardcoded artist mapping", async () => {
  const { resolveFavorite } = require(join(output, "resolution.js"))
  const result = await resolveFavorite(
    "Stage Name",
    async (query) =>
      query === "Full Name" ? [entity("alias", "Full Name")] : [],
    undefined,
    async () => [
      {
        id: "mb-alias",
        name: "Full Name",
        aliases: [{ name: "Stage Name" }],
        country: "GH",
      },
    ]
  )
  assert.equal(result.entity.entityId, "alias")
})

test("Profile C keeps later Daddy Lumba dates out and shows completed thin coverage", async () => {
  const { coverageSummary } = require(join(output, "coverage.js"))
  const tools = fixtureTools()
  tools.client.insights = async () => []
  tools.year = async () => ({
    status: "outside_window",
    evidence: null,
    reason: "Fixture release in 1989, outside 1960–1975",
  })
  const kit = await generateSessionKit(
    {
      residents: [{ ...person, birthYear: 1950, lovedThings: ["Daddy Lumba"] }],
      feedback: [],
    },
    tools
  )
  assert.equal(kit.items.length, 0)
  assert.equal(kit.dateChecks[0].status, "verified_out_of_window")
  assert(coverageSummary(kit).showFew)
})

test("persistent date facts replay offline with current resident evidence and cached labels", async () => {
  const original = global.fetch
  let calls = 0
  global.fetch = async (url) => {
    calls++
    return String(url).includes("/artist/")
      ? Response.json({
          artists: [{ id: "offline-artist", name: "Offline Fixture" }],
        })
      : Response.json({
          "release-groups": [
            {
              id: "offline-work",
              title: "Fixture album",
              "first-release-date": "1963",
            },
          ],
        })
  }
  try {
    const first = await lookupYearFact("Offline Fixture", "urn:entity:artist", [
      person,
    ])
    assert.equal(first.status, "verified")
    assert.equal(first.evidence.cached, false)
    global.fetch = async () => {
      throw Error("Network disabled")
    }
    process.env.ECHOES_OFFLINE = "true"
    const replay = await lookupYearFact(
      "Offline Fixture",
      "urn:entity:artist",
      [{ ...person, id: "offline-person" }]
    )
    assert.equal(replay.evidence.cached, true)
    assert.deepEqual(replay.evidence.residentIds, ["offline-person"])
    const outside = await lookupYearFact(
      "Offline Fixture",
      "urn:entity:artist",
      [{ ...person, birthYear: 1900 }]
    )
    assert.equal(outside.status, "outside_window")
    assert.equal(outside.cached, true)
    assert.equal(calls, 2)
  } finally {
    global.fetch = original
    delete process.env.ECHOES_OFFLINE
  }
})

test("name comparison handles spacing, punctuation, ampersands and diacritics", () => {
  const { sameName } = require(join(output, "names.js"))
  assert(sameName("  Earth, Wind & Fire ", "earth wind and fire"))
  assert(sameName("Beyoncé", "Beyonce"))
  assert(!sameName("Daddy Lumba", "Daddy Yankee"))
})

test("final 429 failures become unchecked_unavailable in the plan", async () => {
  const { createMusicBrainzClient } = require(join(output, "musicbrainz.js"))
  let time = 1000
  const client = createMusicBrainzClient({
    now: () => time,
    sleep: async (ms) => {
      time += ms
    },
    random: () => 0,
    email: "tests@example.invalid",
    cache: false,
    queue: { tail: Promise.resolve(), nextStart: 0 },
    log: () => {},
    fetch: async () => new Response("{}", { status: 429 }),
  })
  const tools = fixtureTools()
  tools.client.insights = async () => []
  tools.year = async () => {
    try {
      await client("/ws/2/artist/", { query: "fixture" })
    } catch (error) {
      return { status: "unavailable", evidence: null, reason: error.message }
    }
  }
  const kit = await generateSessionKit(
    { residents: [person], feedback: [] },
    tools
  )
  assert.equal(kit.dateChecks[0].status, "unchecked_unavailable")
  assert.equal(kit.items.length, 0)
})

test("demo startup warns about missing warm cache without fetching", () => {
  const { demoPreflight } = require(join(output, "demo-preflight.js"))
  const original = console.warn
  const warnings = []
  process.env.DEMO_MODE = "true"
  console.warn = (message) => warnings.push(message)
  try {
    assert.equal(demoPreflight().length, 3)
    assert(warnings[0].includes("warm-demo"))
  } finally {
    console.warn = original
    delete process.env.DEMO_MODE
  }
})

test("a real-shaped Qloo result is shared across normalized spellings offline", async () => {
  const { EchoesQlooClient } = require(join(output, "qloo.js"))
  const original = global.fetch
  global.fetch = async () =>
    Response.json({
      results: [
        { entity_id: "mensah-cache", name: "E.T. Mensah", properties: {} },
      ],
    })
  try {
    const client = new EchoesQlooClient("fixture-key")
    assert.equal(
      (await client.search("E.T. Mensah", "urn:entity:artist"))[0].entityId,
      "mensah-cache"
    )
    process.env.ECHOES_OFFLINE = "true"
    global.fetch = async () => {
      throw Error("Network disabled")
    }
    for (const name of ["ET Mensah", "E. T. Mensah", "et mensah"])
      assert.equal(
        (await client.search(name, "urn:entity:artist"))[0].entityId,
        "mensah-cache"
      )
  } finally {
    global.fetch = original
    delete process.env.ECHOES_OFFLINE
  }
})

test("merged legacy notes survive request parsing and reach the planner trace and About Me", async () => {
  const { migrateResidentNotes } = require(join(output, "preferences.js"))
  const resident = migrateResidentNotes({
    ...person,
    intake: "Loved dancing at weddings.",
    importantMemories: "Sit on her right.",
  })
  assert.equal(
    resident.notes,
    "Loved dancing at weddings.\n\nSit on her right."
  )
  assert.deepEqual(migrateResidentNotes(resident), resident)
  const request = kitRequestSchema.parse({
    residents: [resident],
    feedback: [],
  })
  assert.equal(request.residents[0].notes, resident.notes)
  const kit = await generateSessionKit(request, fixtureTools())
  assert(
    kit.agentTrace.some((t) => t.summary === "Notes preferences confirmed: no")
  )
  assert(kit.aboutMe.details.some((d) => d.includes("Sit on her right.")))
  const workspace = createWorkspace("notes-test", [resident])
  assert.equal(
    workspaceSchema.parse(workspace).residents[0].notes,
    resident.notes
  )
})
test("preferences need confirmation for the current notes and response imports are bounded and merged", () => {
  const {
    emptyPreferences,
    confirmedPreferences,
    historyImportSchema,
    mergeResponseHistory,
  } = require(join(output, "preferences.js"))
  const resident = {
    ...person,
    notes: "Likes dancing",
    preferences: {
      ...emptyPreferences(),
      liked_traits: ["dance"],
      sourceNotes: "Likes dancing",
      confirmed: false,
    },
  }
  assert.deepEqual(confirmedPreferences(resident).liked_traits, [])
  resident.preferences.confirmed = true
  assert.deepEqual(confirmedPreferences(resident).liked_traits, ["dance"])
  assert.deepEqual(
    confirmedPreferences({ ...resident, notes: "Likes quiet" }).liked_traits,
    []
  )
  const rows = historyImportSchema.parse([
    {
      item: "Test song",
      domain: "music",
      traits: ["slow ballad"],
      response: "not_for_us",
      session: "past",
    },
  ])
  assert.equal(mergeResponseHistory(rows, rows).length, 1)
  assert.equal(
    historyImportSchema.safeParse([{ ...rows[0], response: "unknown" }])
      .success,
    false
  )
})

test("per-seed ranking traces history, penalizes slow ballads, and reserves screen media", async () => {
  const { emptyPreferences } = require(join(output, "preferences.js"))
  const notes =
    "Loved dancing at weddings. Call-and-response. Short items with pauses. Sit on her right."
  const resident = {
    ...person,
    nickname: "Baaba",
    birthYear: 1949,
    lovedThings: ["First favourite", "Second favourite"],
    notes,
    preferences: {
      ...emptyPreferences(),
      liked_traits: ["Loved dancing at weddings", "Call-and-response"],
      format_prefs: ["Short items with pauses"],
      logistics: ["Sit on her right"],
      confirmed: true,
      sourceNotes: notes,
    },
    responseHistory: [
      {
        item: "Second favourite",
        domain: "music",
        traits: ["dance"],
        response: "sparked",
        note: "",
        session: "last-time",
      },
      {
        item: "An unspecified ballad",
        domain: "music",
        traits: ["slow ballad"],
        response: "not_for_us",
        note: "",
        session: "last-time",
      },
    ],
  }
  const tools = fixtureTools()
  tools.client.search = async (name, type) =>
    type === "urn:entity:artist" ? [entity(name, name)] : []
  const requests = []
  tools.client.insights = async (input) => {
    requests.push(input)
    if (input.type === "urn:entity:artist")
      return [
        {
          ...entity("dance-discovery", "Dance discovery"),
          properties: {
            country: "United Kingdom",
            performance_style: "Upbeat dance and call-and-response",
            primary_genres: ["Highlife"],
          },
        },
        {
          ...entity("slow-discovery", "Slow discovery"),
          affinity: 0.99,
          properties: { performance_style: "Slow ballads" },
        },
      ]
    if (input.type === "urn:entity:movie")
      return [entity("film", "Film discovery", input.type)]
    return []
  }
  const kit = await generateSessionKit(
    { residents: [resident], feedback: [] },
    tools
  )
  assert(requests.every((r) => r.entityIds.length === 1))
  assert.equal(requests[0].entityIds[0], "Second favourite")
  assert(kit.items.some((i) => i.entityId === "dance-discovery"))
  assert(!kit.items.some((i) => i.entityId === "slow-discovery"))
  assert(
    kit.items
      .find((i) => i.entityId === "dance-discovery")
      .whyItFits.some((reason) =>
        reason.includes("Because Baaba responded to Second favourite last time")
      )
  )
  assert(kit.activities.some((a) => a.itemId === "film"))
  assert(kit.logistics.includes("Sit on her right."))
  assert(kit.aboutMe.details.some((d) => d.includes("Sit on her right")))
  for (const item of kit.items.filter((i) => !i.namedFavorite)) {
    assert(item.seed)
    assert(
      kit.agentTrace.some(
        (t) =>
          t.tool === "qloo_insights" &&
          t.input.seeds[0] === item.seed.entityId &&
          t.output.entities.some((e) => e.entityId === item.entityId)
      )
    )
  }
  assert(kit.agentTrace.some((t) => t.output?.reason === "dedupe"))
  assert(kit.agentTrace.some((t) => t.output?.reason === "preference ranking"))
  let consecutive = 0
  for (const activity of kit.activities) {
    consecutive = activity.kind === "media" ? consecutive + activity.minutes : 0
    assert(consecutive <= 8)
  }
  assert(
    kit.activities.some((a) => a.id.startsWith("pause:") && a.minutes === 1)
  )
  assert.equal(
    kit.activities.reduce((n, a) => n + a.minutes, 0),
    30
  )
  assert(
    kit.activities
      .filter((a) => a.kind === "media")
      .every((a) => a.minutes <= 4)
  )
  assert(
    kit.activities
      .find((a) => a.id === "conversation")
      .prompt.includes("music, more conversation, or quiet company")
  )
  assert.equal(
    workspaceSchema.safeParse({
      ...createWorkspace("personal", [resident]),
      sessions: [
        {
          id: kit.id,
          createdAt: kit.createdAt,
          kit,
          feedback: [],
          engagement: null,
          noteDraft: null,
        },
      ],
    }).success,
    true
  )
})
test("named favourite childhood/outside dates survive with labels; discoveries remain strict", async () => {
  const tools = fixtureTools()
  tools.year = async (name, type, residents) => ({
    status: "outside_window",
    evidence: null,
    outsideEvidence: {
      year: 1952,
      source: "MusicBrainz",
      residentIds: residents.map((r) => r.id),
      title: name,
    },
    reason: "An original release outside the discovery era",
  })
  const kit = await generateSessionKit(
    { residents: [person], feedback: [] },
    tools
  )
  assert.equal(kit.items.length, 1)
  assert.match(kit.items[0].eraLabel, /Earlier than.*childhood/)
  assert(kit.items[0].namedFavorite)
  assert(
    kit.notes.some((n) => n.startsWith("No film or TV match passed checks"))
  )
})
test("searches deduplicate eponymous works and primary actions reject legacy artist pages", () => {
  const { primaryMedia } = require(join(output, "media.js"))
  assert.equal(
    new URL(mediaSearch("Osibisa", "Osibisa")[0].url).searchParams.get(
      "search_query"
    ),
    "Osibisa"
  )
  assert.equal(
    new URL(mediaSearch("Artist", "Artist Album")[0].url).searchParams.get(
      "search_query"
    ),
    "Artist Album"
  )
  const item = {
    name: "Artist",
    yearEvidence: { title: "Work" },
    media: [
      {
        url: "https://open.spotify.com/artist/1234567890123456789012",
        status: "provider-checked",
      },
    ],
  }
  assert.equal(primaryMedia(item).status, "search")
})
test("prompt validation rejects template repetition, quizzes and unsupported wedding context", () => {
  const { validPrompts } = require(join(output, "prompts.js"))
  const items = ["One", "Two"].map((name) => ({
    ...entity(name, name),
    kind: "music",
    yearEvidence: { year: 1964, title: name },
    whyItFits: [],
  }))
  const payload = (prompts) => ({
    prompts: prompts.map((prompt, i) => ({
      entityId: items[i].entityId,
      prompt,
    })),
  })
  assert.equal(
    validPrompts(
      payload([
        "How does One feel, or shall we stop?",
        "How does Two feel, or shall we stop?",
      ]),
      items,
      person
    ),
    null
  )
  assert.equal(
    validPrompts(
      payload([
        "Do you remember One, or shall we skip it?",
        "Which part of Two is interesting, or would you prefer quiet?",
      ]),
      items,
      person
    ),
    null
  )
  assert.equal(
    validPrompts(
      payload([
        "How does One feel, or shall we stop?",
        "What about dancing at weddings to Two, or shall we skip it?",
      ]),
      items,
      person
    ),
    null
  )
  assert(
    validPrompts(
      payload([
        "How does One feel, or shall we stop?",
        "Which part of Two catches your ear, or would you prefer quiet?",
      ]),
      items,
      person
    )
  )
})
test("rendered plan reasons have no repeated punctuation or spaces, with distinct item prompts", async () => {
  const { sentences } = require(join(output, "text.js"))
  const { promptTemplate } = require(join(output, "prompts.js"))
  assert.equal(
    sentences(["Unconfirmed.", " Dated  by provider.. "]),
    "Unconfirmed. Dated by provider."
  )
  const kit = await generateSessionKit(
    { residents: [person], feedback: [] },
    fixtureTools()
  )
  const rendered = [
    ...kit.items.flatMap((i) => i.whyItFits),
    ...kit.activities.flatMap((a) => [a.rationale, a.prompt]),
  ]
  assert(rendered.every((s) => !s.includes("..") && !s.includes("  ")))
  const media = kit.activities.filter((a) => a.kind === "media")
  assert.equal(
    new Set(media.map((a) => promptTemplate(a.prompt, kit.items))).size,
    media.length
  )
})

test("not-for-us review writes trait history without excluding the whole artist", async () => {
  const kit = await generateSessionKit(
    { residents: [person], feedback: [] },
    fixtureTools()
  )
  kit.items[0].traits = ["slow ballad"]
  const activity = kit.activities.find(
    (a) => a.itemId === kit.items[0].entityId
  )
  const workspace = {
    ...createWorkspace("response-test", [person]),
    sessions: [
      {
        id: kit.id,
        createdAt: kit.createdAt,
        kit,
        feedback: [],
        engagement: null,
        noteDraft: null,
      },
    ],
  }
  const next = saveWrapUp(
    workspace,
    kit,
    {
      recordedAt: new Date().toISOString(),
      observations: [{ activityId: activity.id, status: "not_for_us" }],
      engagement: null,
      caregiverNote: "",
    },
    ""
  )
  assert.equal(next.feedback[0].status, "not_for_us")
  assert.equal(next.residents[0].responseHistory[0].response, "not_for_us")
  assert.deepEqual(next.residents[0].responseHistory[0].traits, ["slow ballad"])
  const { exclusionsFor } = require(join(output, "feedback.js"))
  assert.deepEqual(exclusionsFor(next.feedback, person.id), [])
})
test("MusicBrainz prefers original release groups and identifies compilation-only dates", async () => {
  const original = global.fetch
  try {
    const candidate = entity("original-test", "Original test")
    candidate.properties.external = {
      musicbrainz: { id: "20000000-0000-4000-8000-000000000001" },
    }
    global.fetch = async (url) =>
      String(url).includes("/artist/")
        ? Response.json({
            artists: [
              {
                id: candidate.properties.external.musicbrainz.id,
                name: candidate.name,
              },
            ],
          })
        : Response.json({
            "release-groups": [
              {
                id: "compilation",
                title: "Collection",
                "first-release-date": "1960",
                "secondary-types": ["Compilation"],
              },
              {
                id: "later-original",
                title: "Later original",
                "first-release-date": "1966",
                "secondary-types": [],
              },
              {
                id: "first-original",
                title: "First original",
                "first-release-date": "1959",
                "secondary-types": [],
              },
            ],
            "release-group-count": 3,
          })
    const result = await lookupYearFact(
      candidate.name,
      candidate.type,
      [person],
      undefined,
      candidate
    )
    assert.equal(result.evidence.title, "First original")
    const compilation = entity("compilation-test", "Compilation test")
    compilation.properties.external = {
      musicbrainz: { id: "20000000-0000-4000-8000-000000000002" },
    }
    global.fetch = async (url) =>
      String(url).includes("/artist/")
        ? Response.json({
            artists: [
              {
                id: compilation.properties.external.musicbrainz.id,
                name: compilation.name,
              },
            ],
          })
        : Response.json({
            "release-groups": [
              {
                id: "compilation-only",
                title: "Collection",
                "first-release-date": "2000",
                "secondary-types": ["Compilation"],
              },
            ],
            "release-group-count": 1,
          })
    const unknown = await lookupYearFact(
      compilation.name,
      compilation.type,
      [person],
      undefined,
      compilation
    )
    assert.equal(unknown.originalDateUnknown, true)
    assert.equal(unknown.evidence, null)
    assert.equal(unknown.outsideEvidence, undefined)
  } finally {
    global.fetch = original
  }
})
test("successful ambiguous TMDB responses replay offline without becoming outages", async () => {
  const originalFetch = global.fetch,
    key = process.env.TMDB_API_KEY,
    offline = process.env.ECHOES_OFFLINE
  process.env.TMDB_API_KEY = "fixture-key"
  try {
    global.fetch = async () =>
      Response.json({
        results: [
          { id: 1, title: "Ambiguous fixture", release_date: "1960-01-01" },
          { id: 2, title: "Ambiguous fixture", release_date: "2000-01-01" },
        ],
      })
    const first = await lookupYearFact(
      "Ambiguous fixture",
      "urn:entity:movie",
      [person]
    )
    assert.equal(first.status, "ambiguous")
    process.env.ECHOES_OFFLINE = "true"
    global.fetch = async () => {
      throw Error("Offline must not fetch")
    }
    const second = await lookupYearFact(
      "Ambiguous fixture",
      "urn:entity:movie",
      [person]
    )
    assert.equal(second.status, "ambiguous")
    assert.equal(second.cached, true)
  } finally {
    global.fetch = originalFetch
    if (key) process.env.TMDB_API_KEY = key
    else delete process.env.TMDB_API_KEY
    if (offline) process.env.ECHOES_OFFLINE = offline
    else delete process.env.ECHOES_OFFLINE
  }
})

test("discoveries require actual origin, language, availability or producing-seed genre evidence", () => {
  const { relevanceFor } = require(join(output, "suitability.js"))
  const resident = {
    ...person,
    country: "Cuba",
    hometown: "Havana",
    language: "Spanish",
  }
  const seed = { ...entity("celia"), properties: { primary_genres: ["Salsa"] } }
  const cop = {
    ...entity("cop", "American cop show", "urn:entity:tv_show"),
    properties: {
      country: "United States",
      original_language: "en",
      short_descriptions: [{ languages: ["es"], value: "Translated metadata" }],
    },
  }
  assert.equal(relevanceFor(cop, seed, resident).relevant, false)
  const regional = {
    ...entity("sonora"),
    properties: { description: "A Cuban band.", primary_genres: ["Salsa"] },
  }
  assert.equal(relevanceFor(regional, seed, resident).regional, true)
  assert.equal(
    relevanceFor({ ...regional, properties: {} }, seed, resident).relevant,
    false
  )
  assert.equal(
    relevanceFor(
      { ...cop, properties: { original_language: "es" } },
      seed,
      resident
    ).relevant,
    true
  )
  assert.equal(
    relevanceFor(
      { ...cop, properties: { country: "Cuba", genres: ["Animation"] } },
      seed,
      resident
    ).relevant,
    false
  )
  const westAfrica = {
    ...entity("bembeya"),
    properties: { description: "A Guinean band." },
  }
  assert.equal(
    relevanceFor(westAfrica, undefined, {
      ...resident,
      country: "Ghana",
      hometown: "Kumasi",
      language: "Twi",
    }).regional,
    true
  )
})

test("title and theme avoid rules catch funeral hymns without treating awards as hospital wards", () => {
  const { avoidMatch, matchedAvoidTopic, unsuitable } = require(join(output, "suitability.js"))
  assert(avoidMatch("Never Grow Old / You Grow Closer", ["funeral hymns"]))
  assert(avoidMatch("Amazing Grace", ["funeral hymns"]))
  assert(avoidMatch("A hospital scene", ["hospital scenes"]))
  assert(avoidMatch("Political revolution", ["politics"]))
  assert(avoidMatch("Exile from Cuba", ["leaving Cuba"]))
  assert.deepEqual(matchedAvoidTopic("Amazing Grace", ["funeral hymns"]), {
    topic: "funeral hymns",
    source: "caregiver",
    matchedTerm: "amazing grace",
  })
  assert.deepEqual(matchedAvoidTopic("A hospital ward", [], true), {
    topic: "death, funeral or hospital themes",
    source: "conservative_default",
    matchedTerm: "hospital",
  })
  assert(!avoidMatch("Many awards", ["hospital scenes"]))
  assert(
    !unsuitable(
      {
        ...entity("singer"),
        properties: {
          biography: "An exile involved in politics",
          lyrical_themes: ["Love"],
        },
      },
      ["politics", "leaving Cuba"]
    )
  )
})

test("a provider keyword cautions a named favourite while the same match excludes a discovery", async () => {
  const named = {
    ...entity("named-keyword", "Named Keyword Artist"),
    properties: {
      country: "United Kingdom",
      tags: [{ name: "Election", type: "urn:tag:keyword:media" }],
    },
  }
  const discovery = {
    ...entity("discovery-keyword", "Discovery Keyword Artist"),
    properties: {
      country: "United Kingdom",
      tags: [{ name: "Election", type: "urn:tag:keyword:media" }],
    },
  }
  const resident = {
    ...person,
    lovedThings: [named.name],
    sensitivities: ["politics"],
  }
  const tools = fixtureTools()
  tools.client.search = async () => [named]
  tools.client.insights = async ({ type }) =>
    type === "urn:entity:artist" ? [discovery] : []
  const kit = await generateSessionKit({ residents: [resident], feedback: [] }, tools)
  const favourite = [...kit.items, ...(kit.alternatives ?? [])].find(
    (item) => item.entityId === named.entityId
  )
  assert(favourite)
  assert.deepEqual(favourite.cautions, [
    { topic: "politics", sourceField: "keywords and tags", source: "caregiver", matchedTerm: "election" },
  ])
  assert(
    favourite.whyItFits.some((reason) =>
      /Check before playing: Qloo’s keywords and tags mention “election”, and your avoid list includes politics\./.test(reason)
    )
  )
  assert(
    ![...kit.items, ...(kit.alternatives ?? [])].some(
      (item) => item.entityId === discovery.entityId
    )
  )
})

test("regional discoveries reach the running order, Spanish notes become content, and unrelated TV stays out", async () => {
  const { emptyPreferences } = require(join(output, "preferences.js"))
  const notes = "Enjoys dancing. Enjoys cooking."
  const resident = {
    ...person,
    nickname: "Carmen",
    birthYear: 1948,
    country: "Cuba",
    hometown: "Havana",
    language: "Spanish",
    lovedThings: ["Celia Cruz", "Beny Moré", "Gloria Estefan"],
    sensitivities: ["politics", "leaving Cuba"],
    notes,
    preferences: {
      ...emptyPreferences(),
      confirmed: true,
      sourceNotes: notes,
      liked_traits: ["dancing", "cooking"],
    },
  }
  const tools = fixtureTools()
  tools.client.search = async (name, type) =>
    type === "urn:entity:artist"
      ? [
          {
            ...entity(name, name),
            properties: { country: "Cuba", primary_genres: ["Salsa"] },
          },
        ]
      : []
  tools.client.insights = async ({ type }) =>
    type === "urn:entity:artist"
      ? [
          {
            ...entity("sonora", "La Sonora Matancera"),
            affinity: 0.01,
            properties: { country: "Cuba", primary_genres: ["Salsa"] },
          },
        ]
      : type === "urn:entity:tv_show"
        ? [
            {
              ...entity("cop", "American cop show", type),
              affinity: 0.99,
              properties: { country: "United States", original_language: "en" },
            },
          ]
        : []
  const kit = await generateSessionKit(
    { residents: [resident], feedback: [] },
    tools
  )
  assert(kit.activities.some((a) => a.itemId === "sonora"))
  assert(![...kit.items, ...kit.alternatives].some((i) => i.entityId === "cop"))
  assert(kit.notes.some((n) => n.startsWith("Less personalised:")))
  assert(kit.activities.some((a) => /baile/.test(a.prompt)))
  assert(kit.activities.some((a) => /cocinar/.test(a.prompt)))
  assert.equal(
    kit.activities.filter((a) =>
      /Chosen because confirmed notes mention/.test(a.rationale)
    ).length,
    2
  )
  assert.equal(
    kit.activities.reduce((n, a) => n + a.minutes, 0),
    30
  )
  const { promptTemplate } = require(join(output, "planner.js"))
  assert.equal(
    new Set(kit.activities.map((a) => promptTemplate(a.prompt, kit.items)))
      .size,
    kit.activities.length
  )
  assert(
    kit.activities.every(
      (a) =>
        a.prompt.endsWith(".") && !/politic|exile|leaving Cuba/.test(a.prompt)
    )
  )
})

test("Twi invitations show an English line and confirmed logistics remain on review data", () => {
  const { emptyPreferences } = require(join(output, "preferences.js"))
  const notes = "Enjoys proverbs. Enjoys radio dramas. Sit on his left."
  const resident = {
    ...person,
    language: "Twi (understands English)",
    notes,
    preferences: {
      ...emptyPreferences(),
      confirmed: true,
      sourceNotes: notes,
      liked_traits: ["proverbs", "radio dramas"],
      logistics: ["Sit on his left"],
    },
  }
  const plan = planSession(resident, [], [])
  assert(plan.every((a) => a.prompt.includes("\n")))
  assert(plan.some((a) => a.prompt.includes("ɛbɛ")))
  assert(plan[0].rationale.includes("Sit on his left"))
  assert(!JSON.stringify(plan).includes("Use Twi (understands English)"))
  assert.equal(
    planSession({ ...resident, notes: "Changed notes" }, [], []).filter((a) =>
      a.id.startsWith("notes:")
    ).length,
    0
  )
})

test("books are conversation activities without playback links and templates do not repeat", async () => {
  const { primaryMedia } = require(join(output, "media.js"))
  const books = ["One", "Two"].map((name, index) => ({
    ...entity(name, name, "urn:entity:book"),
    kind: "book",
    yearEvidence: {
      year: 1964,
      source: "Qloo",
      residentIds: [person.id],
      title: name,
    },
    whyItFits: ["Verified topic."],
    matchedResidentIds: [person.id],
  }))
  assert.deepEqual(await lookupMedia(books[0]), [])
  assert.equal(primaryMedia(books[0]), null)
  const plan = planSession(person, books, [])
  assert(plan.filter((a) => a.itemId).every((a) => a.kind === "conversation"))
  assert.notEqual(
    plan.find((a) => a.itemId === "One").prompt,
    plan.find((a) => a.itemId === "Two").prompt
  )
})

test("track choice prefers popular original singles over earliest, self-titled, compilation and unsafe works", async () => {
  const original = global.fetch
  const candidate = {
    ...entity("track-choice", "Track choice"),
    properties: {
      external: { musicbrainz: { id: "30000000-0000-4000-8000-000000000001" } },
      notable_songs: ["Amazing Grace", "Early obscure single"],
    },
  }
  global.fetch = async (url) =>
    String(url).includes("/artist/")
      ? Response.json({
          artists: [
            {
              id: candidate.properties.external.musicbrainz.id,
              name: candidate.name,
            },
          ],
        })
      : String(url).includes("/release/?")
        ? Response.json({
            "release-count": String(url).includes("popular") ? 90 : 2,
          })
        : Response.json({
            "release-group-count": 5,
            "release-groups": [
              {
                id: "self",
                title: "Track choice",
                "first-release-date": "1956",
                "primary-type": "Single",
              },
              {
                id: "early",
                title: "Early obscure single",
                "first-release-date": "1957",
                "primary-type": "Single",
              },
              {
                id: "popular",
                title: "Popular song / B-side",
                "first-release-date": "1965",
                "primary-type": "Single",
              },
              {
                id: "hymn",
                title: "Amazing Grace",
                "first-release-date": "1960",
                "primary-type": "Single",
              },
              {
                id: "compilation",
                title: "Hits",
                "first-release-date": "1955",
                "primary-type": "Album",
                "secondary-types": ["Compilation"],
              },
            ],
          })
  try {
    const result = await lookupYearFact(
      candidate.name,
      candidate.type,
      [{ ...person, sensitivities: ["funeral hymns"] }],
      undefined,
      candidate
    )
    assert.equal(result.evidence.title, "Early obscure single")
    assert.equal(result.evidence.workType, "track")
    assert.equal(result.evidence.releaseCount, 2)
    assert.equal(result.ranking.popularityCoverageIncomplete, false)
    assert.equal(
      result.ranking.candidates.find((row) => row.title === "Early obscure single")
        .notable,
      true
    )
  } finally {
    global.fetch = original
  }
})

test("missing official counts remain unknown and force an artist-level choice without Qloo notable coverage", async () => {
  const original = global.fetch
  const candidate = {
    ...entity("unknown-counts", "Unknown Counts Artist"),
    properties: {
      external: { musicbrainz: { id: "40000000-0000-4000-8000-000000000001" } },
    },
  }
  global.fetch = async (url) =>
    String(url).includes("/artist/")
      ? Response.json({ artists: [{ id: candidate.properties.external.musicbrainz.id, name: candidate.name }] })
      : String(url).includes("/release/?")
        ? Response.json({ releases: [] })
        : Response.json({
            "release-group-count": 2,
            "release-groups": [
              { id: "unknown-a", title: "First Song", "first-release-date": "1963", "primary-type": "Single" },
              { id: "unknown-b", title: "Second Song", "first-release-date": "1966", "primary-type": "Single" },
            ],
          })
  try {
    const result = await lookupYearFact(
      candidate.name,
      candidate.type,
      [person],
      undefined,
      candidate
    )
    assert.equal(result.evidence.artistLevel, true)
    assert.equal(result.evidence.title, undefined)
    assert.equal(result.evidence.releaseCount, undefined)
    assert.equal(result.ranking.popularityCoverageIncomplete, true)
    assert(
      result.ranking.candidates.every(
        (row) => row.releaseCount === undefined && row.countStatus === "unknown"
      )
    )
  } finally {
    global.fetch = original
  }
})

test("single confidence uses notable evidence or a two-release lead, never unknown as zero", () => {
  const { trackConfidence } = require(join(output, "year-facts.js"))
  assert.equal(trackConfidence({ notable: false, releaseCount: 33 }, { releaseCount: 27 }).artistLevel, false)
  assert.equal(trackConfidence({ notable: false, releaseCount: 21 }, { releaseCount: 19 }).artistLevel, false)
  assert.equal(trackConfidence({ notable: false, releaseCount: 2 }, { releaseCount: 2 }).artistLevel, true)
  assert.equal(trackConfidence({ notable: false, releaseCount: 2 }, {}).artistLevel, true)
  assert.equal(trackConfidence({ notable: false }, { releaseCount: 0 }).artistLevel, true)
  assert.equal(trackConfidence({ notable: true }, {}).artistLevel, false)
})

test("malformed official counts are retried, known counts survive, and real zero remains known", async () => {
  const { createMusicBrainzClient } = require(join(output, "musicbrainz.js"))
  const { writeProviderCache, readProviderCache } = require(join(output, "provider-cache.js"))
  let calls = 0
  const params = { "release-group": "cache-recovery", limit: "1", status: "official" }
  const key = "MusicBrainz:https://musicbrainz.org/ws/2/release/?" + new URLSearchParams({ ...params, fmt: "json" })
  writeProviderCache(key, { releases: [] }, "MusicBrainz")
  const client = createMusicBrainzClient({ email: "test@example.invalid", queue: { tail: Promise.resolve(), nextStart: 0 }, sleep: async () => {}, log: () => {}, fetch: async () => {
    calls++
    return Response.json(calls === 1 ? { releases: [] } : { "release-count": 27 })
  } })
  await assert.rejects(client("/ws/2/release/", params), /parse_error/)
  assert.equal(readProviderCache(key).value["release-count"], undefined)
  assert.equal((await client("/ws/2/release/", params)).data["release-count"], 27)
  assert.equal((await client("/ws/2/release/", params)).data["release-count"], 27)
  assert.equal(calls, 2)
  const zero = createMusicBrainzClient({ email: "test@example.invalid", queue: { tail: Promise.resolve(), nextStart: 0 }, sleep: async () => {}, log: () => {}, fetch: async () => Response.json({ "release-count": 0 }) })
  assert.equal((await zero("/ws/2/release/", { ...params, "release-group": "real-zero" })).data["release-count"], 0)
})

test("artist-level badges show an era window and ongoing shows say present", () => {
  const { itemDateLabel, logisticsSentence } = require(join(output, "text.js"))
  const era = { from: 1956, to: 1971 }
  assert.equal(itemDateLabel({ yearEvidence: { artistLevel: true, year: 1963 } }, era), "in your window: 1956–1971")
  assert.equal(itemDateLabel({ yearEvidence: { firstAirYear: 1960, lastAirYear: 2026, ongoing: true } }, era), "1960–present")
  assert.equal(logisticsSentence("sit on her right.. keep the volume low. ."), "Sit on her right. Keep the volume low.")
})

test("swaps qualify per item, require two unused options and keep soul out of rock and roll", () => {
  const { assignReplacements, replacementSignals } = require(join(output, "replacements.js"))
  const make = (id, kind, genre, seed) => ({ ...entity(id, id, kind === "music" ? "urn:entity:artist" : "urn:entity:tv_show"), properties: { country: person.country, genres: [genre] }, kind, seed, yearEvidence: { year: 1964 }, whyItFits: [] })
  const lucy = make("Lucy", "television", "Sitcom"), dick = make("Dick", "television", "Sitcom", { entityId: "Lucy" }), honey = make("Honeymooners", "television", "Sitcom", { entityId: "Lucy" })
  const jerry = make("Jerry", "music", "Rock And Roll"), chuck = make("Chuck", "music", "Rock And Roll"), elvis = make("Elvis", "music", "Rockabilly"), stevie = make("Stevie", "music", "Soul")
  const pool = [lucy, dick, honey, jerry, chuck, elvis, stevie], entities = new Map(pool.map((e) => [e.entityId, e]))
  const trace = assignReplacements(pool, new Set(["Lucy", "Jerry"]), entities, person)
  assert.deepEqual(lucy.replacementIds, ["Dick", "Honeymooners"])
  assert.deepEqual(jerry.replacementIds, ["Chuck", "Elvis"])
  assert.deepEqual(replacementSignals(jerry, stevie, entities, person), [])
  assert(trace.find((r) => r.entityId === "Lucy").options.every((o) => o.signals.length))
  assignReplacements(pool, new Set(["Lucy", "Jerry", "Dick"]), entities, person)
  assert.deepEqual(lucy.replacementIds, [])
})

test("a named screen favourite leaves room for a related screen discovery and preserves its seed label", async () => {
  const names = ["Stevie", "Carole", "The Mary Tyler Moore Show"]
  const tools = fixtureTools()
  tools.client.search = async (name, type) => names.includes(name) && type === (name === names[2] ? "urn:entity:tv_show" : "urn:entity:artist") ? [entity(name, name, type)] : []
  tools.client.insights = async ({ type, entityIds }) => type === "urn:entity:tv_show" && entityIds[0] === names[2] ? [entity("dick", "The Dick Van Dyke Show", type)] : type === "urn:entity:artist" ? [entity("music-discovery", "New music")] : []
  const kit = await generateSessionKit({ residents: [{ ...person, lovedThings: names }], feedback: [] }, tools)
  assert(kit.activities.some((a) => a.itemId === "dick"))
  assert.match(kit.items.find((i) => i.entityId === "dick").whyItFits.join(" "), /Because you chose The Mary Tyler Moore Show/)
  assert.equal(kit.activities.reduce((sum, a) => sum + a.minutes, 0), 30)
})

test("confirmed cooking specifics produce distinct invitations; unconfirmed notes supply no detail", () => {
  const { emptyPreferences } = require(join(output, "preferences.js"))
  const profile = (notes, trait) => ({ ...person, notes, preferences: { ...emptyPreferences(), confirmed: true, sourceNotes: notes, liked_traits: [trait] } })
  const robert = profile("Enjoys cooking breakfast, especially pancakes.", "cooking breakfast")
  const margaret = profile("Enjoys cooking Sunday lunch.", "cooking Sunday lunch")
  const a = planSession(robert, [], []).find((a) => a.id === "notes:0").prompt
  const b = planSession(margaret, [], []).find((a) => a.id === "notes:0").prompt
  assert.match(a, /pancakes/); assert.match(b, /Sunday lunch/)
  assert.notEqual(a.split(", or ")[1], b.split(", or ")[1])
  assert(!JSON.stringify(planSession({ ...robert, notes: "Changed" }, [], [])).includes("pancakes"))
  const notes = "Enjoys listening to radio dramas and cooking breakfast, especially pancakes."
  const both = { ...robert, notes, preferences: { ...robert.preferences, sourceNotes: notes, liked_traits: ["radio dramas", "cooking breakfast"] } }
  const prompts = planSession(both, [], []).filter((a) => a.id.startsWith("notes:")).map((a) => a.prompt)
  assert.equal(new Set(prompts).size, 2)
  assert(prompts.some((p) => /radio/.test(p)))
  assert(prompts.some((p) => /pancakes/.test(p)))
})

test("era hints prioritize independent checks without approving provider-only dates", async () => {
  const tools = fixtureTools(), checked = []
  tools.client.insights = async ({ type }) => type === "urn:entity:artist" ? [
    ...Array.from({ length: 20 }, (_, i) => ({ ...entity(`modern-${i}`), affinity: 1, properties: { country: person.country, start_year: 2000 } })),
    { ...entity("era-fit"), affinity: 0.1, properties: { country: person.country, start_year: 1960 } },
  ] : []
  const year = tools.year
  tools.year = async (...args) => { checked.push(args[0]); return year(...args) }
  const kit = await generateSessionKit({ residents: [person], feedback: [] }, tools)
  assert.equal(checked[1], "era-fit")
  const checkedItem = [...kit.items, ...kit.alternatives].find((item) => item.entityId === "era-fit")
  assert(checkedItem)
  assert.equal(checkedItem.yearEvidence.source, "MusicBrainz")
})

test("storage retains bounded date checks beyond twenty so expanded kits survive reload", async () => {
  const kit = await generateSessionKit({ residents: [person], feedback: [] }, fixtureTools())
  kit.dateChecks = Array.from({ length: 32 }, (_, i) => ({ ...kit.dateChecks[0], entity: entity(`checked-${i}`) }))
  const workspace = { ...createWorkspace("personal", [person]), sessions: [{ id: kit.id, createdAt: kit.createdAt, kit, feedback: [], engagement: null, noteDraft: null }] }
  assert.equal(workspaceSchema.safeParse(workspace).success, true)
  kit.dateChecks = Array.from({ length: 41 }, () => kit.dateChecks[0])
  assert.equal(workspaceSchema.safeParse(workspace).success, false)
})

test("TV series use first and last air overlap and retain the original start year", async () => {
  const original = global.fetch,
    key = process.env.TMDB_API_KEY
  process.env.TMDB_API_KEY = "fixture-key"
  global.fetch = async (url) =>
    String(url).includes("/search/")
      ? Response.json({
          results: [
            { id: 123456, name: "Span fixture", first_air_date: "1951-01-01" },
          ],
        })
      : Response.json({
          first_air_date: "1951-01-01",
          last_air_date: "1957-01-01",
        })
  try {
    const result = await lookupYearFact("Span fixture", "urn:entity:tv_show", [
      person,
    ])
    assert.equal(result.status, "verified")
    assert.equal(result.evidence.firstAirYear, 1951)
    assert.equal(result.evidence.lastAirYear, 1957)
    assert.equal(result.evidence.year, 1955)
    assert.match(result.reason, /overlapping/)
  } finally {
    global.fetch = original
    if (key) process.env.TMDB_API_KEY = key
    else delete process.env.TMDB_API_KEY
  }
})

test("Qloo requests carry supported era and region constraints without applying place filters to media", async () => {
  const { EchoesQlooClient } = require(join(output, "qloo.js"))
  const original = global.fetch,
    requests = []
  global.fetch = async (url) => {
    requests.push(new URL(url))
    return Response.json({ results: { entities: [] } })
  }
  try {
    const client = new EchoesQlooClient("fixture-key")
    const base = {
      entityIds: ["constraint-seed"],
      era: { from: 1958, to: 1973 },
      country: "Cuba",
      hometown: "Havana",
    }
    for (const type of ["movie", "tv_show", "book", "artist"])
      for (const broaden of [false, true])
        await client.insights({
          ...base,
          type: "urn:entity:" + type,
          regionalTags: ["urn:tag:genre:music:cuba"],
          broaden,
        })
    for (const url of requests) {
      const p = url.searchParams,
        type = p.get("filter.type")
      assert.equal(p.has("filter.location.query"), false)
      if (["urn:entity:movie", "urn:entity:tv_show"].includes(type))
        assert.equal(p.get("filter.release_country"), "Cuba")
      else assert.equal(p.has("filter.release_country"), false)
      if (type === "urn:entity:movie") {
        assert.equal(p.get("filter.release_year.min"), "1958")
        assert.equal(p.get("filter.release_year.max"), "1973")
      }
      if (type === "urn:entity:tv_show") {
        assert.equal(p.has("filter.release_year.min"), false)
        assert.equal(p.get("filter.release_year.max"), "1973")
      }
      if (type === "urn:entity:book") {
        assert.equal(p.get("filter.publication_year.min"), "1958")
        assert.equal(p.get("filter.publication_year.max"), "1973")
      }
      if (type === "urn:entity:artist") {
        assert.equal(p.get("filter.tags"), "urn:tag:genre:music:cuba")
        assert.equal(p.get("operator.filter.tags"), "union")
        assert.equal(p.has("filter.start_year.max"), false)
        assert.equal(p.has("filter.release_year.max"), false)
      }
    }
    assert.equal(requests.length, 8)
  } finally {
    global.fetch = original
  }
})

test("Qloo exact regional tag resolution accepts provider id and legacy tag_id and rejects other domains", async () => {
  const { EchoesQlooClient } = require(join(output, "qloo.js"))
  const original = global.fetch
  global.fetch = async () =>
    Response.json({
      results: {
        tags: [
          {
            id: "urn:tag:genre:music:fixture_region",
            name: "Fixture Region",
            type: "urn:tag:genre:music",
          },
          {
            tag_id: "urn:tag:genre:music:fixture_legacy",
            name: "Fixture Region",
            type: "urn:tag:genre:music",
          },
          {
            id: "urn:tag:genre:place:fixture_region",
            name: "Fixture Region",
            type: "urn:tag:genre:place",
          },
          {
            id: "urn:tag:genre:music:unrelated",
            name: "Unrelated",
            type: "urn:tag:genre:music",
          },
        ],
      },
    })
  try {
    const client = new EchoesQlooClient("fixture-key")
    assert.deepEqual(
      await client.tags("Fixture Region", "urn:tag:genre:music"),
      [
        "urn:tag:genre:music:fixture_region",
        "urn:tag:genre:music:fixture_legacy",
      ]
    )
  } finally {
    global.fetch = original
  }
})

test("planner supplies country and provider-resolved music tags to discovery requests", async () => {
  const tools = fixtureTools(),
    seen = []
  tools.client.tags = async (query, type) => {
    assert.equal(query, "British")
    assert.equal(type, "urn:tag:genre:music")
    return ["urn:tag:genre:music:fixture_region"]
  }
  tools.client.insights = async (input) => {
    seen.push(input)
    return []
  }
  await generateSessionKit({ residents: [person], feedback: [] }, tools)
  assert(seen.length >= 4)
  assert(seen.every((r) => r.country === person.country))
  assert(
    seen
      .filter((r) => r.type === "urn:entity:artist")
      .some((r) =>
        r.regionalTags.includes("urn:tag:genre:music:fixture_region")
      )
  )
  assert(
    seen
      .filter((r) => r.type !== "urn:entity:artist")
      .every((r) => r.regionalTags.length === 0)
  )
})

test("a wrong external artist link cannot supply another artist's catalogue", async () => {
  const original = global.fetch
  const requests = []
  const candidate = entity("wrong-linked-artist", "Identity fixture")
  candidate.properties.external = {
    musicbrainz: { id: "40000000-0000-4000-8000-000000000001" },
  }
  global.fetch = async (input) => {
    const url = new URL(String(input))
    requests.push(url)
    if (url.pathname.includes("/artist/"))
      return Response.json({
        artists: [
          { id: "correct-identity", name: candidate.name, score: 100 },
          {
            id: candidate.properties.external.musicbrainz.id,
            name: candidate.name,
            score: 56,
          },
        ],
      })
    return Response.json({
      "release-group-count": 1,
      "release-groups": [
        {
          id: "identity-work",
          title: "Correct catalogue work",
          "first-release-date": "1965",
          "primary-type": "Album",
        },
      ],
    })
  }
  try {
    const result = await lookupYearFact(
      candidate.name,
      candidate.type,
      [person],
      undefined,
      candidate
    )
    assert.equal(result.evidence.title, "Correct catalogue work")
    assert(
      requests.some(
        (url) => url.searchParams.get("artist") === "correct-identity"
      )
    )
    assert(
      !requests.some(
        (url) =>
          url.searchParams.get("artist") ===
          candidate.properties.external.musicbrainz.id
      )
    )
  } finally {
    global.fetch = original
  }
})

test("confirmed no-singing preferences apply to initial and replacement invitations", () => {
  const { itemPrompt, replacementPrompt } = require(join(output, "planner.js"))
  const { emptyPreferences } = require(join(output, "preferences.js"))
  const resident = {
    ...person,
    notes: "Does not want to sing.",
    preferences: {
      ...emptyPreferences(),
      confirmed: true,
      sourceNotes: "Does not want to sing.",
      disliked_traits: ["singing"],
    },
  }
  const item = {
    entityId: "song",
    name: "Song",
    kind: "music",
    yearEvidence: { title: "Song", year: 1965 },
    prompt: "Try humming a little of Song, or rest your voice.",
  }
  assert(!/hum|sing/i.test(itemPrompt(item, 1, resident)))
  assert(!/hum|sing/i.test(replacementPrompt(item, [], [item], resident)))
  assert(
    !/colou?r/i.test(
      itemPrompt(
        { ...item, prompt: undefined, kind: "television" },
        1,
        resident
      )
    )
  )
})

test("four verified music items do not produce a few-dated-items warning", () => {
  const { coverageSummary } = require(join(output, "coverage.js"))
  const kit = {
    items: Array.from({ length: 4 }, () => ({ kind: "music" })),
    dateChecks: Array.from({ length: 4 }, () => ({
      status: "verified_in_window",
    })),
  }
  assert.equal(coverageSummary(kit).showFew, false)
})

test("Dorothy, Margaret and Robert retain two confirmed note activities and practical instructions", async () => {
  const { emptyPreferences } = require(join(output, "preferences.js"))
  for (const [nickname, liked_traits, disliked_traits, logistics] of [
    [
      "Dorothy",
      ["choir singing", "afternoon tea"],
      ["funeral hymns"],
      ["Sit on her right", "Keep the volume low"],
    ],
    ["Margaret", ["dancing", "cooking Sunday lunch"], [], ["Sit facing her"]],
    [
      "Robert",
      ["radio dramas", "cooking pancakes"],
      ["singing"],
      ["Sit on his left"],
    ],
  ]) {
    const notes = [...liked_traits, ...disliked_traits, ...logistics].join(". ")
    const resident = {
      ...person,
      nickname,
      notes,
      preferences: {
        ...emptyPreferences(),
        confirmed: true,
        sourceNotes: notes,
        liked_traits,
        disliked_traits,
        logistics,
      },
    }
    const kit = await generateSessionKit(
      { residents: [resident], feedback: [] },
      fixtureTools()
    )
    assert.equal(
      kit.activities.filter((a) =>
        /Chosen because confirmed notes mention/.test(a.rationale)
      ).length,
      2,
      nickname
    )
    assert.deepEqual(kit.logistics, logistics.map((detail) => detail + "."))
    assert.equal(
      kit.activities.reduce((n, a) => n + a.minutes, 0),
      30
    )
    if (nickname === "Margaret")
      assert(
        kit.activities.some((a) =>
          /Sunday lunch/i.test(a.title + " " + a.prompt)
        )
      )
    if (nickname === "Robert")
      assert(
        kit.activities.every(
          (a) => !/\b(hum|humming|sing|singing)\b/i.test(a.prompt)
        )
      )
    if (nickname === "Robert")
      assert(
        kit.activities.some((a) => /pancakes/i.test(a.title + " " + a.prompt))
      )
  }
})

test("intake keeps supporting details out of form fields and presents them under Tips", () => {
  const editor = readFileSync(
    "components/echoes/preferences-editor.tsx",
    "utf8"
  )
  const app = readFileSync("components/echoes/echoes-app.tsx", "utf8")
  const plan = readFileSync("components/echoes/session-plan.tsx", "utf8")
  const styles = readFileSync("app/globals.css", "utf8")
  const editableGroups = editor.slice(
    editor.indexOf("const groups"),
    editor.indexOf("} as const")
  )
  assert(!/format_prefs|logistics|people|places/.test(editableGroups))
  assert.match(app, /FROM THE CONFIRMED NOTES/)
  assert.match(app, /Session pace/)
  assert.match(app, /Practical details/)
  assert.match(app, /People mentioned/)
  assert.match(app, /Places/)
  assert(!/strong>Practical details/.test(plan))
  assert.match(
    styles,
    /\.confirmed-note-tips\s*{[^}]*grid-column:\s*1 \/ -1/s
  )
  assert.match(
    styles,
    /\.confirmed-note-grid\s*{[^}]*grid-template-columns:\s*repeat\(auto-fit/s
  )
  assert.match(
    styles,
    /\.echoes-shell :where\(p:not\(\.eyebrow\), li\)\s*{[^}]*font-size:\s*15px/s
  )
})

test("kit and live activity prompts do not add decorative quotation marks", () => {
  const plan = readFileSync("components/echoes/session-plan.tsx", "utf8")
  const live = readFileSync("components/echoes/live-session.tsx", "utf8")
  assert(!plan.includes("“{activity.prompt}”"))
  assert(!/live-invitation[\s\S]{0,100}[“”]/.test(live))
})
