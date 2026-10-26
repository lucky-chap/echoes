import type { Plan, Scene } from "./types"

/** Outages never manufacture dialogue, cultural evidence, or social outcomes. */
export function quietScene(plan: Plan): Scene {
  return {
    sceneId: `scene-${plan.number}`,
    participants: plan.participants,
    sceneType: plan.sceneType,
    summary:
      "Dialogue unavailable. Residents continue their independent activities.",
    ending: "transition",
    beats: [],
    suggestedMemoryUpdates: [],
    suggestedRelationshipChanges: [],
  }
}
