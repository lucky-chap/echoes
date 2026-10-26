import type { CulturalSignal, Plan, Scene, Snapshot } from "./types"

export interface SceneContext {
  world: Snapshot
  plan: Plan
  signals: CulturalSignal[]
  retryAngle?: string
}

export interface LLMProvider {
  generateScene(context: SceneContext): Promise<Scene>
}
