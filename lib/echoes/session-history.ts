import type { ResidentInput, SessionRecord } from "./types"

export interface NumberedSession {
  session: SessionRecord
  number: number
}

export interface ResidentSessionGroup {
  resident: ResidentInput
  sessions: NumberedSession[]
}

/** Oldest first. Equal timestamps fall back to array order (newest was prepended). */
const creationOrder = (
  a: { session: SessionRecord; index: number },
  b: { session: SessionRecord; index: number }
) =>
  a.session.createdAt.localeCompare(b.session.createdAt) || b.index - a.index

function ownSessions(sessions: SessionRecord[], residentId: string) {
  return sessions
    .map((session, index) => ({ session, index }))
    .filter(({ session }) =>
      session.kit.residents.some((resident) => resident.id === residentId)
    )
    .sort(creationOrder)
    .map(({ session }) => session)
}

/** Newest first, numbered from the resident's first session. */
export function residentSessions(
  sessions: SessionRecord[],
  residentId: string
): NumberedSession[] {
  return ownSessions(sessions, residentId)
    .map((session, index) => ({ session, number: index + 1 }))
    .reverse()
}

export function sessionNumber(
  sessions: SessionRecord[],
  sessionId: string
): number {
  const session = sessions.find((entry) => entry.id === sessionId)
  const residentId = session?.kit.residents[0]?.id
  if (!session || !residentId) return 0
  const index = ownSessions(sessions, residentId).findIndex(
    (entry) => entry.id === sessionId
  )
  return index >= 0 ? index + 1 : 0
}

export function latestSessionFor(
  sessions: SessionRecord[],
  residentId: string
) {
  return residentSessions(sessions, residentId)[0]?.session
}

/** A new kit is always prepended; earlier kits are never replaced. */
export function recordNewSession(
  sessions: SessionRecord[],
  session: SessionRecord
) {
  return [session, ...sessions].slice(0, 600)
}

export function residentSessionGroups(
  residents: ResidentInput[],
  sessions: SessionRecord[]
): ResidentSessionGroup[] {
  return residents.map((resident) => ({
    resident,
    sessions: residentSessions(sessions, resident.id),
  }))
}
