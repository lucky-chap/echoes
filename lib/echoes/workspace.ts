import type { EchoesWorkspace, FeedbackRecord, ResidentInput, SessionRecord } from "./types"

const prefix = "echoes-workspace-v2:"

export function workspaceKey(secret: string) { return `${prefix}${secret}` }

export function createWorkspace(secret: string, residents: ResidentInput[]): EchoesWorkspace {
  return { version: 1, secret, mode: "team", residents, feedback: [], sessions: [], traces: [] }
}

export function appendSession(workspace: EchoesWorkspace, session: SessionRecord): EchoesWorkspace {
  return { ...workspace, sessions: [session, ...workspace.sessions].slice(0, 50), feedback: session.feedback, traces: [ ...session.kit.agentTrace, ...workspace.traces ].slice(0, 200) }
}

export function nextFeedback(records: FeedbackRecord[], update: FeedbackRecord) {
  return [...records.filter((record) => !(record.residentId === update.residentId && record.entityId === update.entityId)), update]
}

export function clearWorkspaceStorage(storage: Storage) {
  Object.keys(storage).filter((key) => key.startsWith(prefix)).forEach((key) => storage.removeItem(key))
}
