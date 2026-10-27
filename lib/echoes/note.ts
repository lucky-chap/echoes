import type { FeedbackRecord, KitItem, ResidentInput } from "./types"

export function draftNoteFromFacts(input: { resident: Pick<ResidentInput, "nickname">; items: Pick<KitItem, "entityId" | "name">[]; feedback: FeedbackRecord[]; engagement: 1 | 2 | 3 | null }) {
  const used = input.items.map((item) => item.name).join(", ") || "no verified items"
  const responses = input.feedback.map((item) => `${input.items.find((candidate) => candidate.entityId === item.entityId)?.name ?? "item"}: ${item.status}`).join("; ") || "No responses recorded."
  return `Draft for staff review. ${input.resident.nickname} took part in an activity-support session using ${used}. Observed responses: ${responses}. Engagement/pleasant moments: ${input.engagement ?? "not scored"}/3. Suggested next focus: begin with any item marked sparked response and avoid items marked not for us.`
}
