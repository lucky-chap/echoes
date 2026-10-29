import type {
  FeedbackRecord,
  KitItem,
  ResidentInput,
  SessionKit,
  WrapUp,
} from "./types"

export function draftNoteFromFacts(input: {
  resident: Pick<ResidentInput, "nickname">
  items: Pick<KitItem, "entityId" | "name">[]
  feedback: FeedbackRecord[]
  engagement: 1 | 2 | 3 | null
}) {
  const used =
    input.items.map((item) => item.name).join(", ") || "no verified items"
  const responses =
    input.feedback
      .map(
        (item) =>
          `${input.items.find((candidate) => candidate.entityId === item.entityId)?.name ?? "item"}: ${item.status}`
      )
      .join("; ") || "No responses recorded."
  return `Draft for staff review. ${input.resident.nickname} took part in an activity-support session using ${used}. Observed responses: ${responses}. Engagement/pleasant moments: ${input.engagement ?? "not scored"}/3. Suggested next focus: begin with any item marked sparked response and avoid items marked not for us.`
}

export function draftWrapUpNote(kit: SessionKit, wrapUp: WrapUp) {
  const labels = {
    engaged: "engagement observed",
    no_response: "no response observed",
    distress: "distress observed",
    shared_story: "shared a story",
    not_used: "not used",
    not_for_us: "not for us",
  }
  const activities = new Map(kit.activities?.map((a) => [a.id, a]) ?? [])
  const observations = wrapUp.observations.filter((o) =>
    activities.has(o.activityId)
  )
  const details = observations
    .map(
      (o) =>
        `${activities.get(o.activityId)!.title}: ${labels[o.status]}${o.story ? `; caregiver-recorded words/context: ${o.story}` : ""}.`
    )
    .join(" ")
  return [
    `Draft for caregiver review — ${kit.residents[0]?.nickname ?? "Resident"}, ${wrapUp.recordedAt.slice(0, 10)}.`,
    details ||
      "No activity responses recorded. Completion or participation has not been inferred.",
    `Overall engagement: ${wrapUp.engagement === null ? "not recorded" : `${wrapUp.engagement}/3 (caregiver rating)`}.`,
    wrapUp.caregiverNote ? `Caregiver note: ${wrapUp.caregiverNote}` : "",
    observations.some((o) => o.status === "distress")
      ? "For future sessions: omit the stimulus marked distress. If distress occurs, stop the stimulus and follow the established comfort approach. No comfort intervention is recorded as performed unless entered by the caregiver."
      : "",
  ]
    .filter(Boolean)
    .join("\n\n")
}
