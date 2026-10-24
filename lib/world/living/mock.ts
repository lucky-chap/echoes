import { destination, residents } from "../profiles"
import type { Scene, Snapshot, Plan, CulturalSignal, Beat } from "./types"
export interface SceneContext {
  world: Snapshot
  plan: Plan
  signals: CulturalSignal[]
}
export interface LLMProvider {
  generateScene(context: SceneContext): Promise<Scene>
}
/** Offline dialogue is explicitly templated; live scenes use the same state contract. */
export class MockLLMProvider implements LLMProvider {
  async generateScene({ world, plan }: SceneContext): Promise<Scene> {
    const [a, b] = plan.participants
    const agent = world.agents.find((x) => x.id === a)!
    const memory =
      agent.important.find((m) => m.kind === "promise") ??
      agent.memories.filter((m) => m.kind === "conversation").at(-1)
    const n = world.completed % 3
    const openings = {
      mia: [
        "I was going to be sensible today. Then I smelled cinnamon.",
        "Come with me? You can talk me out of buying everything.",
        "I have a plan. It may involve a snack.",
      ],
      kai: [
        "Wait. Do you hear that?",
        "I took a shortcut. It was definitely longer.",
        "I think I could learn that rhythm. Probably.",
      ],
      luna: [
        "Someone has given that pigeon a very important job.",
        "Hold still. Your shadow is doing something interesting.",
        "I found a corner I haven’t drawn yet.",
      ],
    }
    const replies = {
      mia: [
        "You say that like I’m the responsible one.",
        "Fine, but I’m choosing the snacks.",
        "I’m listening. Suspiciously, but listening.",
      ],
      kai: [
        "That sounds dangerously like a plan.",
        "Wait, let me do my dramatic face.",
        "I was absolutely paying attention. To something else.",
      ],
      luna: [
        "I’ll put that in the drawing. Very small.",
        "That explains more than you think.",
        "I’m going to pretend that was intentional.",
      ],
    }
    const beats: Beat[] = [
      {
        speaker: a,
        dialogue: memory
          ? `I keep thinking about this: “${memory.text.slice(0, 135)}”`
          : world.situation === "rain"
            ? "Oh. That cloud was not bluffing."
            : openings[a][n],
        emotion: "curious",
        action: "talk",
        targetLocation: null,
      },
      {
        speaker: b,
        dialogue: replies[b][n],
        emotion: "amused",
        action: "laugh",
        targetLocation: null,
      },
      {
        speaker: a,
        dialogue:
          plan.incident?.actor === a &&
          plan.incident.id === "unexpected-portrait"
            ? "There. Your heroic pose is now permanent."
            : `I’m heading to ${destination(plan.destinations[a]).name}. ${agent.energy < 40 ? "Somewhere to sit, at last." : agent.recentVisits.includes(plan.destinations[a]) ? "There’s something I want to try again." : "I could use a change of scene."}`,
        emotion: "thoughtful",
        action:
          plan.incident?.id === "unexpected-portrait" && a === "luna"
            ? "sketch"
            : "point",
        targetLocation:
          plan.incident?.id === "unexpected-portrait" && a === "luna"
            ? null
            : plan.destinations[a],
      },
      {
        speaker: b,
        dialogue:
          plan.destinations[a] === plan.destinations[b]
            ? "All right, I’m coming. No heroic speeches on the way."
            : `I’ll catch you later. ${destination(plan.destinations[b]).name} is calling me.`,
        emotion: "content",
        action: "wave",
        targetLocation: null,
      },
    ]
    return {
      sceneId: `scene-${plan.number}`,
      participants: plan.participants,
      sceneType: plan.incident ? "change_of_plans" : "social_encounter",
      summary: plan.summary.slice(0, 180),
      beats,
      suggestedMemoryUpdates: [
        { residentId: a, beatIndex: 2, kind: "conversation" },
      ],
      suggestedRelationshipChanges: [
        { from: b, to: a, beatIndex: 1, delta: 1 },
      ],
    }
  }
}
export const mockSignals: CulturalSignal[] = residents.flatMap((r) =>
  r.culture.slice(0, 2).map((name) => ({
    residentId: r.id,
    name,
    category: /art/i.test(name)
      ? ("art" as const)
      : /cinema/i.test(name)
        ? ("movie" as const)
        : ("artist" as const),
    entityId: null,
    affinity: null,
    source: "MOCK" as const,
  }))
)
