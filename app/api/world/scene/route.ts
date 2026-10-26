import { sameOrigin } from "@/lib/world/server/origin"
import { NextRequest, NextResponse } from "next/server"
import { validateSnapshot } from "@/lib/world/living/validation"
import { planScene, newWorld } from "@/lib/world/living/planner"
import { quietScene } from "@/lib/world/living/fallback"
import {
  GroqProvider,
  providerError,
  sceneTokenReservation,
} from "@/lib/world/server/groq"
import { culturalIntelligence } from "@/lib/world/server/qloo"
import {
  liveUnavailable,
  reserve,
  sessionStatus,
  recordUsage,
  recordRateHeaders,
  pauseLive,
  sessionLimit,
} from "@/lib/world/server/quota"
import Groq from "groq-sdk"
import { generateConversation } from "@/lib/world/server/generation"
import { DialogueQualityError } from "@/lib/world/living/dialogue"
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
    live = false,
    waiting = false,
    retryAt: number | null = null,
    inputTokens = 0,
    outputTokens = 0,
    attempts = 0,
    repetition = "not checked — no dialogue"
  if (!reason && validSession) {
    const result = await managedGroqRequest(`${id}:${world.completed}`, () => generateConversation(
      context,
      async (next) => {
        // Reservations include retries and remain spent even for rejected output.
        calls = reserve(id, sceneTokenReservation(next))
        attempts++
        const provider = new GroqProvider()
        try {
          return await provider.generateScene(next)
        } catch (e) {
          if (e instanceof Groq.APIError) {
            if (e.status === 429)
              pauseLive(Number(e.headers?.get("retry-after")) || 60)
            if (e.headers) recordRateHeaders(e.headers)
            if (!e.status || e.status < 500) recordUsage(id, 0, 0, true)
          }
          throw e
        } finally {
          inputTokens += provider.usage.inputTokens
          outputTokens += provider.usage.outputTokens
          recordUsage(
            id,
            provider.usage.inputTokens,
            provider.usage.outputTokens
          )
          if (provider.rateHeaders) recordRateHeaders(provider.rateHeaders)
        }
      },
      {
        retryable: (e) =>
          e instanceof Groq.APIError && !!e.status && e.status >= 500,
        // A single bounded retry is enough for transient 5xx responses.  429
        // is governed by the provider's retry-after header and is not retried
        // here, so the client can preserve the gathering rather than burn it.
        wait: () => new Promise((resolve) => setTimeout(resolve, 1200)),
      }
    ))
    repetition = result.repetition
    if (result.scene) {
      scene = result.scene
      live = true
    } else {
      const failure = result.failure
      if (failure instanceof Groq.APIError && failure.status === 429) {
        waiting = true
        const seconds = Number(failure.headers?.get("retry-after")) || 60
        retryAt = Date.now() + Math.min(86400, Math.max(1, seconds)) * 1000
      }
      reason =
        failure instanceof DialogueQualityError
          ? `Groq scene rejected: ${failure.message}. Dialogue withheld.`
          : failure instanceof Groq.APIError
            ? providerError(failure)
            : failure instanceof Error
              ? `${failure.message}. Dialogue withheld.`
              : "Generation failed or retry budget unavailable. Dialogue withheld."
    }
  }
  return NextResponse.json(
    {
      scene,
      plan,
      tasteProfiles: cultural.tasteProfiles,
      diagnostics: {
        llm: live ? "Groq Live" : waiting ? "Waiting" : "Fallback",
        requestStatus: live ? "success" : waiting ? "waiting" : attempts ? "failed" : "skipped",
        attempts,
        repetition,
        model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
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
