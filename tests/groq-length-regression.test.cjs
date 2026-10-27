const { test } = require("node:test")
const assert = require("node:assert/strict")

// The main living suite compiles TypeScript into its temporary CommonJS tree.
// Keep this source-level regression explicit: provider prompt, JSON schema and
// semantic validation must agree on the same scene length.
test("Groq prompt and semantic scene limit both allow ten beats", () => {
  const source = require("node:fs").readFileSync(
    "lib/world/living/validation.ts",
    "utf8"
  )
  assert.match(source, /value\.beats\.length > 10/)
  assert.match(source, /\.max\(10\)/)
})
