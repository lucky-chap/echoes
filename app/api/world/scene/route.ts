import { sameOrigin } from "@/lib/world/server/origin"
import { NextRequest, NextResponse } from "next/server"
import { validateSnapshot, validateScene } from "@/lib/world/living/validation"
import { planScene, newWorld } from "@/lib/world/living/planner"
import { MockLLMProvider } from "@/lib/world/living/mock"
import {
  GroqProvider,
  providerError,
  sceneTokenReservation,
} from "@/lib/world/server/groq"
import { culturalSignals } from "@/lib/world/server/taste"
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
export const runtime = "nodejs"
export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Same-origin request required" },
      { status: 403 }
    )
  let world
  try {
    const reader = request.body?.getReader()
    if (!reader) throw Error()
    let bytes = 0
    const chunks: Uint8Array[] = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.length
      if (bytes > 24000) {
        await reader.cancel()
        throw Error()
      }
      chunks.push(value)
    }
    world = validateSnapshot(JSON.parse(Buffer.concat(chunks).toString()))
  } catch {
    return NextResponse.json(
      { error: "Invalid or oversized world state" },
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
  const { signals, reason: tasteReason } = await culturalSignals(),
    plan = planScene(world, signals),
    context = { world, plan, signals }
  let scene = validateScene(
      await new MockLLMProvider().generateScene(context),
      plan
    ),
    live = false,
    inputTokens = 0,
    outputTokens = 0
  if (!reason && validSession) {
    const provider = new GroqProvider()
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        // UTF-8 byte count is a conservative upper bound on input tokens, plus prompt/profile overhead.
        calls = reserve(id, sceneTokenReservation(context))
        scene = await provider.generateScene(context)
        ;({ inputTokens, outputTokens } = provider.usage)
        recordUsage(id, inputTokens, outputTokens)
        if (provider.rateHeaders) recordRateHeaders(provider.rateHeaders)
        live = true
        break
      } catch (e) {
        ;({ inputTokens, outputTokens } = provider.usage)
        recordUsage(id, inputTokens, outputTokens)
        if (provider.rateHeaders) recordRateHeaders(provider.rateHeaders)
        reason =
          e instanceof Groq.APIError
            ? providerError(e)
            : e instanceof Error
              ? e.message
              : "Live request failed"
        if (
          e instanceof Groq.APIError &&
          e.status &&
          e.status >= 500 &&
          attempt === 0
        ) {
          await new Promise((r) => setTimeout(r, 1600))
          continue
        }
        if (e instanceof Groq.APIError) {
          if (e.status === 429)
            pauseLive(Number(e.headers?.get("retry-after")) || 60)
          if (e.headers) recordRateHeaders(e.headers)
          recordUsage(id, 0, 0, true)
        }
        break
      }
    }
  }
  return NextResponse.json(
    {
      scene,
      plan,
      diagnostics: {
        llm: live ? "Groq Live" : "Groq Mock",
        model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
        taste: signals.every((s) => s.source === "LIVE Qloo")
          ? "Qloo Live"
          : "Qloo Mock",
        reason: live ? null : reason,
        tasteReason,
        calls,
        limit: sessionLimit(),
        signals,
        inputTokens,
        outputTokens,
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
