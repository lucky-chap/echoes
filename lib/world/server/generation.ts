import type { SceneContext } from "../living/context"
import type { Scene } from "../living/types"
import { DialogueQualityError, validateDialogue } from "../living/dialogue"
import { validateScene } from "../living/validation"

/** Two attempts total, including failures. Caller reserves quota before EACH request. */
export async function generateConversation(
  context: SceneContext,
  request: (context: SceneContext) => Promise<Scene>,
  options: {
    retryable?: (error: unknown) => boolean
    wait?: () => Promise<void>
  } = {}
) {
  let repetition = "not checked — no completed response"
  let failure: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    const next =
      attempt === 0
        ? context
        : {
            ...context,
            retryAngle:
              "Discard the rejected draft. Use a different present-tense detail of the selected situation, a different opening speaker if attendance allows, and a new conversational development. No callbacks to imagined past events or reuse of recent lines.",
          }
    try {
      const scene = await request(next)
      validateScene(scene, next.plan)
      repetition = validateDialogue(scene, next)
      return { scene, repetition, failure: null }
    } catch (error) {
      failure = error
      if (error instanceof DialogueQualityError)
        repetition = `rejected: ${error.message}`
      if (
        attempt === 1 ||
        !(error instanceof DialogueQualityError || options.retryable?.(error))
      )
        break
      await options.wait?.()
    }
  }
  return { scene: null, repetition, failure }
}
