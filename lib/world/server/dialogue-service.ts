import Groq from "groq-sdk"
import {
  GroqProvider,
  providerModel,
  sceneTokenReservation,
  type DialogueProvider,
} from "./groq"
import {
  liveUnavailable,
  pauseLive,
  QuotaWait,
  recordRateHeaders,
  recordUsage,
  reserve,
} from "./quota"
import { sceneRateBudget } from "./rate-budget"
import { DialogueQualityError, validateDialogue } from "../living/dialogue"
import { validateScene } from "../living/validation"
import type { SceneContext } from "../living/context"
import type { Scene } from "../living/types"

export interface TrackedProvider {
  generateScene(context: SceneContext): Promise<Scene>
  usage: { inputTokens: number; outputTokens: number }
  rateHeaders: Headers | null
}

export function retryAfterSeconds(value: string | null, now = Date.now()) {
  if (!value) return 60
  const seconds = Number(value)
  const result = Number.isFinite(seconds)
    ? seconds
    : (Date.parse(value) - now) / 1000
  return Number.isFinite(result)
    ? Math.min(86400, Math.max(1, Math.ceil(result)))
    : 60
}

/** A complete scene, at most two attempts across both providers, reserved before I/O. */
export async function generateBudgetedConversation(
  id: string,
  context: SceneContext,
  options: {
    makeProvider?: (provider: DialogueProvider) => TrackedProvider
    budget?: Pick<typeof sceneRateBudget, "charge">
    wait?: () => Promise<void>
  } = {}
) {
  const primaryReason = liveUnavailable()
  const backupReason = liveUnavailable("cerebras")
  const candidates: DialogueProvider[] = primaryReason
    ? backupReason
      ? []
      : ["cerebras"]
    : backupReason
      ? ["groq", "groq"]
      : ["groq", "cerebras"]
  let attempts = 0,
    inputTokens = 0,
    outputTokens = 0
  let retryAt: number | null = null
  let repetition = "not checked — no dialogue"
  let reason = primaryReason ?? "No valid dialogue available."
  const failures: string[] = primaryReason ? [primaryReason] : []
  for (const [index, kind] of candidates.entries()) {
    const next = {
      ...context,
      plan: structuredClone(context.plan),
      ...(index
        ? {
            retryAngle:
              "Use a different opening and present detail; no invented callbacks or repeated lines.",
          }
        : {}),
    }
    const reservation = sceneTokenReservation(next, kind)
    let reserved = false
    const provider =
      options.makeProvider?.(kind) ?? new GroqProvider(undefined, kind)
    let block = false
    try {
      const lead = (options.budget ?? sceneRateBudget).charge(
        next.plan.initialParticipants
      )
      if (!lead)
        throw new QuotaWait(
          "Town dialogue budget is resting.",
          Date.now() + 60000
        )
      reserve(id, reservation, kind)
      reserved = true
      attempts++
      const scene = await provider.generateScene(next)
      validateScene(scene, next.plan)
      repetition = validateDialogue(scene, next)
      return {
        scene,
        plan: next.plan,
        provider: kind,
        model: providerModel(kind),
        attempts,
        inputTokens: inputTokens + provider.usage.inputTokens,
        outputTokens: outputTokens + provider.usage.outputTokens,
        repetition,
        reason: null,
        failoverReason: failures.join(" ") || null,
        retryAt: null,
      }
    } catch (error) {
      if (error instanceof Groq.APIError && error.status === 429) {
        const until = pauseLive(
          retryAfterSeconds(error.headers?.get("retry-after") ?? null),
          kind
        )
        retryAt = retryAt === null ? until : Math.min(retryAt, until)
      } else if (error instanceof QuotaWait) {
        retryAt =
          retryAt === null ? error.retryAt : Math.min(retryAt, error.retryAt)
      }
      block =
        error instanceof Groq.APIError &&
        (error.status === 401 || error.status === 403)
      reason =
        error instanceof DialogueQualityError
          ? `${kind} scene rejected: ${error.message.slice(0, 240)}`
          : error instanceof Groq.APIError
            ? `${kind} unavailable (HTTP ${error.status ?? "network"}).`
            : error instanceof QuotaWait || !reserved
              ? error instanceof Error
                ? error.message
                : "Quota unavailable."
              : `${kind} timed out or returned invalid output.`
      failures.push(reason)
      if (error instanceof DialogueQualityError)
        repetition = `rejected: ${error.message.slice(0, 240)}`
      const nextKind = candidates[index + 1]
      if (nextKind === kind) {
        const retryable =
          error instanceof DialogueQualityError ||
          (error instanceof Groq.APIError &&
            !!error.status &&
            error.status >= 500)
        if (!retryable) break
        await (options.wait?.() ??
          new Promise((resolve) => setTimeout(resolve, 1600)))
      }
    } finally {
      inputTokens += provider.usage.inputTokens
      outputTokens += provider.usage.outputTokens
      if (reserved) {
        // Unknown transport usage keeps the worst-case token reservation spent.
        recordUsage(
          id,
          provider.rateHeaders ? provider.usage.inputTokens : reservation,
          provider.rateHeaders ? provider.usage.outputTokens : 0,
          block,
          kind
        )
        if (provider.rateHeaders) recordRateHeaders(provider.rateHeaders, kind)
      }
    }
  }
  return {
    scene: null,
    plan: context.plan,
    provider: null,
    model: providerModel("groq"),
    attempts,
    inputTokens,
    outputTokens,
    repetition,
    reason: failures.join(" ") || reason,
    failoverReason: null,
    retryAt,
  }
}
