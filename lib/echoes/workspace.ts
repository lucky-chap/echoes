import type {
  EchoesWorkspace,
  FeedbackRecord,
  ResidentInput,
  SessionRecord,
} from "./types"

const prefix = "echoes-workspace-v2:"

export function workspaceKey(secret: string) {
  return `${prefix}${secret}`
}

export function createWorkspace(
  secret: string,
  residents: ResidentInput[]
): EchoesWorkspace {
  return {
    version: 1,
    secret,
    mode: "team",
    residents,
    feedback: [],
    sessions: [],
    traces: [],
  }
}

export function appendSession(
  workspace: EchoesWorkspace,
  session: SessionRecord
): EchoesWorkspace {
  return {
    ...workspace,
    sessions: [session, ...workspace.sessions].slice(0, 50),
    feedback: session.feedback,
    traces: [...session.kit.agentTrace, ...workspace.traces].slice(0, 200),
  }
}

export function nextFeedback(
  records: FeedbackRecord[],
  update: FeedbackRecord
) {
  return [
    ...records.filter(
      (record) =>
        !(
          record.residentId === update.residentId &&
          record.entityId === update.entityId
        )
    ),
    update,
  ]
}

export function clearWorkspaceStorage(storage: Storage) {
  Object.keys(storage)
    .filter((key) => key.startsWith(prefix))
    .forEach((key) => storage.removeItem(key))
}

export function removeResidentData(
  workspace: EchoesWorkspace,
  residentId: string
): EchoesWorkspace {
  const removedSessions = workspace.sessions.filter((s) =>
    s.kit.residents.some((r) => r.id === residentId)
  )
  const traceIds = new Set(
    removedSessions.flatMap((s) => s.kit.agentTrace.map((t) => t.id))
  )
  return {
    ...workspace,
    residents: workspace.residents.filter((r) => r.id !== residentId),
    sessions: workspace.sessions.filter((s) => !removedSessions.includes(s)),
    feedback: workspace.feedback.filter((f) => f.residentId !== residentId),
    memories: (workspace.memories ?? []).filter(
      (m) => m.residentId !== residentId
    ),
    traces: workspace.traces.filter((t) => !traceIds.has(t.id)),
  }
}
