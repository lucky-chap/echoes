import { advanceLiving, type LivingSimulation } from "./engine"
import { validateSnapshot } from "./validation"
import type { SceneBundle, Snapshot } from "./types"

export const snapshotKey = (world: Snapshot) =>
  JSON.stringify(validateSnapshot(world))

/** Project on the pure engine's clone: no future memories commit to playback. */
export function projectNextWorld(sim: LivingSimulation): Snapshot | null {
  if (
    !sim.bundle ||
    !["gathering", "proposing", "traveling", "completing"].includes(
      sim.phase
    ) ||
    !["Groq Live", "Cerebras Live"].includes(sim.bundle.diagnostics.llm)
  )
    return null
  const projected = advanceLiving(sim, 10000)
  return projected.phase === "finished"
    ? validateSnapshot(projected.world)
    : null
}

type FetchScene = (world: Snapshot, signal: AbortSignal) => Promise<SceneBundle>

/** One slot, including an in-flight request. Failed/discarded work never plays. */
export class ScenePrefetch {
  private slot: {
    key: string
    controller: AbortController
    result: Promise<SceneBundle | null>
  } | null = null

  prepare(world: Snapshot, fetchScene: FetchScene) {
    const key = snapshotKey(world)
    if (this.slot?.key === key) return
    this.clear()
    const controller = new AbortController()
    const result = Promise.resolve()
      .then(() => {
        controller.signal.throwIfAborted()
        return fetchScene(structuredClone(world), controller.signal)
      })
      .catch(() => null)
    this.slot = { key, controller, result }
  }

  async consume(world: Snapshot) {
    const slot = this.slot
    if (!slot) return null
    if (slot.key !== snapshotKey(world)) {
      this.clear()
      return null
    }
    const result = await slot.result
    if (this.slot !== slot || slot.controller.signal.aborted) return null
    this.slot = null
    return result
  }

  clear() {
    this.slot?.controller.abort()
    this.slot = null
  }
}
