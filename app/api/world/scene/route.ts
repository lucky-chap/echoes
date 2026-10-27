import { sameOrigin } from "@/lib/world/server/origin"
import { NextRequest, NextResponse } from "next/server"
import { validateSnapshot } from "@/lib/world/living/validation"
import { planScene, newWorld } from "@/lib/world/living/planner"
import { quietScene } from "@/lib/world/living/fallback"
import { createHash } from "node:crypto"
import { generateBudgetedConversation } from "@/lib/world/server/dialogue-service"
import { culturalIntelligence } from "@/lib/world/server/qloo"
import {
  liveUnavailable,
  sessionStatus,
  sessionLimit,
} from "@/lib/world/server/quota"
import { managedGroqRequest } from "@/lib/world/server/request-manager"
export const runtime = "nodejs"
const MAX_WORLD_BYTES = 256 * 1024
export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Same-origin request required" },
      { status: 403 }
    )
  let world
  let oversized = false
  try {
    const reader = request.body?.getReader()
    if (!reader) throw Error()
    let bytes = 0
    const chunks: Uint8Array[] = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.length
      if (bytes > MAX_WORLD_BYTES) {
        oversized = true
        await reader.cancel()
        throw Error()
      }
      chunks.push(value)
    }
    world = validateSnapshot(JSON.parse(Buffer.concat(chunks).toString()))
  } catch (error) {
    const detail =
      error instanceof Error && error.message
        ? error.message.slice(0, 160)
        : "unknown validation error"
    return NextResponse.json(
      {
        error: oversized
          ? "World state exceeds the 256 KB transport limit"
          : error instanceof SyntaxError
            ? "World state is not valid JSON"
            : `World state validation failed: ${detail}`,
      },
      { status: 400 }
    )
  }
  const id = request.cookies.get("world-session")?.value ?? ""
  let calls = 0,
    reason = liveUnavailable()
  let validSession = false
  try {
    calls = sessionStatus(id).calls
    validSession = true
  } catch (e) {
    reason = e instanceof Error ? e.message : "Session unavailable"
  }
  const cultural = await culturalIntelligence(world),
    { signals, reason: tasteReason } = cultural,
    plan = planScene(world, signals),
    context = { world, plan, signals }
  let scene = quietScene(plan),
    live: "Groq Live" | "Cerebras Live" | null = null,
    waiting = false,
    retryAt: number | null = null,
    inputTokens = 0,
    outputTokens = 0,
    attempts = 0,
    repetition = "not checked — no dialogue",
    model = process.env.GROQ_MODEL || "openai/gpt-oss-20b",
    failoverReason: string | null = null
  let resolvedPlan = plan
  if (validSession) {
    const key = `${id}:${createHash("sha256").update(JSON.stringify(context)).digest("hex")}`
    const result = await managedGroqRequest(key, () =>
      generateBudgetedConversation(id, context)
    )
    attempts = result.attempts
    inputTokens = result.inputTokens
    outputTokens = result.outputTokens
    repetition = result.repetition
    model = result.model
    reason = result.reason
    failoverReason = result.failoverReason
    retryAt = result.retryAt
    waiting = !result.scene && retryAt !== null
    if (result.scene) {
      scene = result.scene
      resolvedPlan = result.plan
      live = result.provider === "cerebras" ? "Cerebras Live" : "Groq Live"
    }
    calls = sessionStatus(id).calls
  }
  return NextResponse.json(
    {
      scene,
      plan: resolvedPlan,
      tasteProfiles: cultural.tasteProfiles,
      diagnostics: {
        llm: live ?? (waiting ? "Waiting" : "Fallback"),
        requestStatus: live
          ? "success"
          : waiting
            ? "waiting"
            : attempts
              ? "failed"
              : "skipped",
        attempts,
        repetition,
        model,
        failoverReason,
        taste: signals.some((s) => s.source === "LIVE Qloo")
          ? "Qloo Live"
          : signals.some((s) => s.source === "CACHED Qloo")
            ? "Qloo Cache"
            : cultural.diagnostics.configured
              ? "Qloo Error"
              : "Qloo Unavailable",
        reason: live ? null : reason,
        tasteReason,
        calls,
        limit: sessionLimit(),
        signals,
        qloo: cultural.diagnostics,
        inputTokens,
        outputTokens,
        retryAt,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}

export async function GET() {
  return NextResponse.json(
    { world: newWorld(), reason: liveUnavailable() },
    { headers: { "Cache-Control": "no-store" } }
  )
}
