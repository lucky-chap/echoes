require("./echoes-runtime.cjs")
const { generateSessionKit } = require("../lib/echoes/pipeline.ts")
const fs = require("node:fs")
const resident = {
  id: "diagnosis-efua",
  nickname: "Efua",
  birthYear: 1949,
  hometown: "Accra",
  country: "Ghana",
  language: "English",
  lovedThings: ["Osibisa", "ET Mensah", "Jim Reeves"],
  sensitivities: ["funeral", "hospital", "war"],
}
generateSessionKit({ residents: [resident], feedback: [] })
  .then((kit) => {
    fs.writeFileSync(
      "/tmp/echoes-diagnosis-plan.json",
      JSON.stringify(kit, null, 2)
    )
    console.log(
      JSON.stringify(
        {
          diagnosis: true,
          items: kit.items.map((item) => item.name),
          diagnostics: kit.diagnostics,
          notes: kit.notes,
          dates: kit.agentTrace.filter(
            (t) => t.tool === "era_verify" || t.tool === "qloo_search"
          ),
        },
        null,
        2
      )
    )
  })
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
