const { test, after } = require("node:test")
const assert = require("node:assert/strict")
const { mkdtempSync, rmSync } = require("node:fs")
const { tmpdir } = require("node:os")
const { join } = require("node:path")
const ts = require("typescript")

const output = mkdtempSync(join(tmpdir(), "echoes-tests-"))
const program = ts.createProgram(["lib/echoes/types.ts", "lib/echoes/era.ts", "lib/echoes/feedback.ts", "lib/echoes/verified.ts"], { outDir: output, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, skipLibCheck: true })
const diagnostics = ts.getPreEmitDiagnostics(program)
assert.equal(diagnostics.length, 0, diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, " ")).join("\n"))
program.emit()
after(() => rmSync(output, { recursive: true, force: true }))

const { eraWindow, selectForCoverage } = require(join(output, "era.js"))
const { mergeFeedback, exclusionsFor } = require(join(output, "feedback.js"))
const { dropUnresolvedItems } = require(join(output, "verified.js"))

test("reminiscence era is ages 13 through 25", () => assert.deepEqual(eraWindow(1942), { from: 1955, to: 1967 }))

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
