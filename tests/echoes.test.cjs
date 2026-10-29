const { test, after } = require("node:test")
const assert = require("node:assert/strict")
const { mkdtempSync, rmSync } = require("node:fs")
const { tmpdir } = require("node:os")
const { join } = require("node:path")
const ts = require("typescript")

const output = mkdtempSync(join(tmpdir(), "echoes-tests-"))
const program = ts.createProgram(["lib/echoes/types.ts", "lib/echoes/era.ts", "lib/echoes/feedback.ts", "lib/echoes/verified.ts", "lib/echoes/year-facts.ts", "lib/echoes/note.ts"], { outDir: output, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, skipLibCheck: true })
const diagnostics = ts.getPreEmitDiagnostics(program)
assert.equal(diagnostics.length, 0, diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, " ")).join("\n"))
program.emit()
after(() => rmSync(output, { recursive: true, force: true }))

const { eraWindow, selectForCoverage } = require(join(output, "era.js"))
const { mergeFeedback, exclusionsFor } = require(join(output, "feedback.js"))
const { dropUnresolvedItems } = require(join(output, "verified.js"))
const { retainEraVerifiedItems, yearEvidenceFor } = require(join(output, "year-facts.js"))
const { draftNoteFromFacts } = require(join(output, "note.js"))

test("reminiscence era is ages 10 through 25", () => assert.deepEqual(eraWindow(1942), { from: 1952, to: 1967 }))

test("coverage selection prioritizes items that serve every resident", () => {
  const picked = selectForCoverage([
    { entityId: "a", matchedResidentIds: ["one"], affinity: .9 },
    { entityId: "b", matchedResidentIds: ["two", "three"], affinity: .4 },
    { entityId: "c", matchedResidentIds: ["one", "two"], affinity: .8 },
  ], ["one", "two", "three"], 2)
  assert.equal(picked.percent, 100)
  assert.deepEqual(new Set(picked.items.map((item) => item.entityId)), new Set(["b", "c"]))
})

test("distressed feedback persists as a resident-specific exclusion", () => {
  const records = mergeFeedback([], { residentId: "marie", entityId: "qloo-1", status: "sparked" })
  const changed = mergeFeedback(records, { residentId: "marie", entityId: "qloo-1", status: "distressed" })
  assert.deepEqual(exclusionsFor(changed, "marie"), ["qloo-1"])
  assert.deepEqual(exclusionsFor(changed, "other"), [])
})

test("unresolved entities are dropped before a kit can render", () => {
  assert.deepEqual(dropUnresolvedItems([{ entityId: "verified" }, { entityId: "" }, {}, { entityId: null }]), [{ entityId: "verified" }])
})

test("an item outside every reminiscence window is dropped", () => {
  const residents = [{ id: "marie", birthYear: 1942 }]
  assert.equal(yearEvidenceFor(1974, "MusicBrainz", residents), null)
  const output = retainEraVerifiedItems([{ entityId: "one", name: "Example", type: "urn:entity:artist" }], new Map([["one", null]]))
  assert.deepEqual(output, [])
})

test("every retained item carries independent year evidence", () => {
  const residents = [{ id: "marie", birthYear: 1942 }]
  const evidence = yearEvidenceFor(1964, "MusicBrainz", residents)
  const output = retainEraVerifiedItems([{ entityId: "one", name: "Example", type: "urn:entity:artist" }], new Map([["one", evidence]]))
  assert.equal(output.length, 1)
  assert.deepEqual(output[0].yearEvidence, { year: 1964, source: "MusicBrainz", residentIds: ["marie"] })
})

test("session-note draft is grounded in recorded taps", () => {
  const note = draftNoteFromFacts({ resident: { nickname: "M" }, items: [{ entityId: "one", name: "A familiar song" }], feedback: [{ residentId: "M", entityId: "one", status: "sparked" }], engagement: 3 })
  assert.match(note, /A familiar song: sparked/)
  assert.match(note, /3\/3/)
  assert.doesNotMatch(note, /treatment|agitation|cognition/i)
})
