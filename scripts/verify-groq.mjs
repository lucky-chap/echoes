import { existsSync } from "node:fs"
if (existsSync(".env.local")) process.loadEnvFile(".env.local")
if (!process.env.GROQ_API_KEY) {
  console.error(
    "Fallback: GROQ_API_KEY is not configured. No live request was made; Free Plan access is unverified."
  )
  process.exitCode = 1
} else {
  const base = process.env.WORLDLINGS_URL || "http://localhost:3000"
  try {
    const status = await (await fetch(`${base}/api/world/scene`)).json()
    if (status.reason) throw Error(status.reason)
    const session = await fetch(`${base}/api/world/session`, {
      method: "POST",
      headers: { Origin: base },
    })
    if (!session.ok) throw Error((await session.json()).error)
    const response = await fetch(`${base}/api/world/scene`, {
      method: "POST",
      headers: {
        Origin: base,
        "Content-Type": "application/json",
        Cookie: session.headers.get("set-cookie").split(";")[0],
      },
      body: JSON.stringify(status.world),
      signal: AbortSignal.timeout(45000),
    })
    const result = await response.json()
    if (!response.ok || result.diagnostics?.llm !== "Groq Live") {
      if (result.diagnostics)
        console.log(
          JSON.stringify(
            {
              source: result.diagnostics.llm,
              model: result.diagnostics.model,
              sceneId: result.scene?.sceneId,
              participants: result.plan?.participants,
              request: result.diagnostics.requestStatus,
              attempts: result.diagnostics.attempts,
              validation: result.diagnostics.repetition,
              dialogueLines: result.scene?.beats.length,
            },
            null,
            2
          )
        )
      throw Error(
        result.error || result.diagnostics?.reason || "Live scene failed"
      )
    }
    console.log(
      JSON.stringify(
        {
          status: "Groq Live",
          model: result.diagnostics.model,
          diagnostics: result.diagnostics,
          scene: result.scene,
          usage: {
            input: result.diagnostics.inputTokens,
            output: result.diagnostics.outputTokens,
          },
          note: "Generation succeeded. Account billing tier must be confirmed in the Groq console.",
        },
        null,
        2
      )
    )
  } catch (e) {
    console.error(e.message)
    process.exitCode = 1
  }
}
