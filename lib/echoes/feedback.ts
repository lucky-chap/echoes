import type { FeedbackRecord } from "./types"

export function mergeFeedback(records: FeedbackRecord[], next: FeedbackRecord) {
  return [
    ...records.filter((record) => !(record.residentId === next.residentId && record.entityId === next.entityId)),
    next,
  ]
}

export function exclusionsFor(records: FeedbackRecord[], residentId: string) {
  return records.filter((record) => record.residentId === residentId && record.status === "distressed").map((record) => record.entityId)
}
