import type {
  EchoesWorkspace,
  MemoryRecord,
  ResidentInput,
  SessionKit,
  WrapUp,
} from "./types"
import { migrateResidentNotes, mergeResponseHistory } from "./preferences"
import { mergeFeedback } from "./feedback"

export function relevantMemories(memories: MemoryRecord[], residentId: string) {
  const own = memories.filter(
    (m) => m.residentId === residentId && m.source !== "Qloo"
  )
  // Exclusions are never aged out by the retrieval window.
  const distress = own.filter((m) => m.response === "distress")
  const recent = own
    .filter((m) => m.response !== "distress" && m.kind !== "discovery")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 20)
  return [...distress, ...recent]
}

export function confirmProfile(
  resident: ResidentInput,
  previous: MemoryRecord[]
) {
  resident = migrateResidentNotes(resident)
  const text = `Born ${resident.birthYear}; grew up in ${resident.hometown}, ${resident.country}; language: ${resident.language}. Favourites: ${resident.lovedThings.join(", ")}. Avoid: ${resident.sensitivities.join(", ") || "none specified"}.${resident.notes ? ` Caregiver-confirmed context: ${resident.notes}` : ""}`
  if (
    previous.some(
      (m) =>
        m.residentId === resident.id &&
        m.kind === "biography" &&
        m.text === text
    )
  )
    return previous
  return [
    ...previous,
    {
      id: crypto.randomUUID(),
      residentId: resident.id,
      kind: "biography",
      status: "confirmed",
      text,
      source: "caregiver",
      createdAt: new Date().toISOString(),
    } satisfies MemoryRecord,
  ]
}

export function saveWrapUp(
  workspace: EchoesWorkspace,
  kit: SessionKit,
  wrapUp: WrapUp,
  noteDraft: string
): EchoesWorkspace {
  const residentId = kit.residents[0].id
  const activities = kit.activities ?? []
  const allowed = new Map(activities.map((a) => [a.id, a]))
  const observations = wrapUp.observations.filter((o) =>
    allowed.has(o.activityId)
  )
  const reviewedIds = new Set(
    observations.map((o) => `${kit.id}:${o.activityId}`)
  )
  const reviewedEntities = new Set(
    observations.map((o) => allowed.get(o.activityId)?.itemId).filter(Boolean)
  )
  let feedback = workspace.feedback.filter(
    (f) => !(f.sessionId === kit.id && reviewedEntities.has(f.entityId))
  )
  const memories: MemoryRecord[] = observations
    .filter((o) => o.status !== "not_used")
    .map((observation) => {
      const activity = allowed.get(observation.activityId)!
      const entityId = activity.itemId
      if (entityId)
        feedback = mergeFeedback(feedback, {
          residentId,
          entityId,
          sessionId: kit.id,
          recordedAt: wrapUp.recordedAt,
          status:
            observation.status === "distress"
              ? "distressed"
              : observation.status === "not_for_us"
                ? "not_for_us"
                : observation.status === "no_response"
                  ? "neutral"
                  : "sparked",
        })
      return {
        id: `${kit.id}:${activity.id}`,
        residentId,
        sessionId: kit.id,
        kind: "observation",
        status: "reported",
        source: "caregiver",
        createdAt: wrapUp.recordedAt,
        entityId,
        response: observation.status,
        text: `${activity.title}: ${observation.status.replaceAll("_", " ")}${observation.story ? `. Caregiver-recorded story (not a confirmed biographical fact): ${observation.story}` : ""}`,
      }
    })
  return {
    ...workspace,
    feedback,
    residents: workspace.residents.map((r) =>
      r.id !== residentId
        ? r
        : {
            ...r,
            responseHistory: mergeResponseHistory(
              (r.responseHistory ?? []).filter(
                (h) =>
                  !(
                    h.session === kit.id &&
                    kit.items.some(
                      (i) =>
                        reviewedEntities.has(i.entityId) && i.name === h.item
                    )
                  )
              ),
              observations.flatMap((o) => {
                const item = kit.items.find(
                  (i) => i.entityId === allowed.get(o.activityId)?.itemId
                )
                return item &&
                  ["engaged", "shared_story", "not_for_us"].includes(o.status)
                  ? [
                      {
                        item: item.name,
                        domain: item.kind,
                        traits: item.traits ?? [],
                        response:
                          o.status === "not_for_us"
                            ? ("not_for_us" as const)
                            : ("sparked" as const),
                        note: o.story ?? "",
                        session: kit.id,
                        entityId: item.entityId,
                      },
                    ]
                  : []
              })
            ),
          }
    ),
    memories: [
      ...(workspace.memories ?? []).filter((m) => !reviewedIds.has(m.id)),
      ...memories,
    ],
    sessions: workspace.sessions.map((session) =>
      session.id === kit.id
        ? {
            ...session,
            kit,
            wrapUp: { ...wrapUp, observations },
            noteDraft,
            engagement: wrapUp.engagement,
            feedback: feedback.filter((f) => f.sessionId === kit.id),
          }
        : session
    ),
  }
}
