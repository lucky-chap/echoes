// Node-only persistence core. Routes import this via access.ts, never from client code.
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto"
import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { isAbsolute, join } from "node:path"
import type { EchoesWorkspace, ResidentInput } from "./types"
import { createWorkspace } from "./workspace"

export interface FamilySubmission {
  id: string
  residentId: string
  profile: Omit<ResidentInput, "id" | "nickname">
  relationship: string
  receivedAt: string
  authority: true
}
export interface StoreData {
  version: 1
  revision: number
  workspace: EchoesWorkspace
  sessions: { hash: string; expires: number }[]
  invites: {
    id: string
    hash: string
    residentId: string
    expires: number
    used: boolean
  }[]
  submissions: FamilySubmission[]
}
export class StoreError extends Error {
  constructor(
    message: string,
    public status = 503
  ) {
    super(message)
  }
}
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex")
export function storageConfigured() {
  let safeOrigin = false
  try {
    const origin = new URL(process.env.ECHOES_ORIGIN ?? "")
    safeOrigin =
      origin.protocol === "https:" ||
      (origin.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname))
  } catch {
    /* fail closed */
  }
  return (
    /^[a-f\d]{64}$/i.test(process.env.ECHOES_STORAGE_KEY ?? "") &&
    (process.env.ECHOES_CAREGIVER_CODE?.length ?? 0) >= 12 &&
    safeOrigin &&
    Boolean(
      process.env.ECHOES_DATA_DIR && isAbsolute(process.env.ECHOES_DATA_DIR)
    )
  )
}
function settings() {
  if (!storageConfigured())
    throw new StoreError(
      "Protected storage is not configured. Use fictional demo data only."
    )
  return {
    directory: process.env.ECHOES_DATA_DIR!,
    key: Buffer.from(process.env.ECHOES_STORAGE_KEY!, "hex"),
  }
}
export function encryptStore(data: StoreData, key: Buffer) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(data), "utf8"),
    cipher.final(),
  ])
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext])
}
export function decryptStore(bytes: Buffer, key: Buffer): StoreData {
  const decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, 12))
  decipher.setAuthTag(bytes.subarray(12, 28))
  const result = JSON.parse(
    Buffer.concat([
      decipher.update(bytes.subarray(28)),
      decipher.final(),
    ]).toString("utf8")
  ) as StoreData
  if (
    result.version !== 1 ||
    !Array.isArray(result.sessions) ||
    !result.workspace
  )
    throw new StoreError(
      "Stored data is invalid. Restore a verified backup; data has not been overwritten."
    )
  return result
}
/** Single-site durable-volume pilot. Atomic cross-process lock and replace; a stale crash
 * lock fails closed and needs operator recovery. Not a serverless/distributed database. */
export function transaction<T>(fn: (data: StoreData) => T): T {
  const { directory, key } = settings()
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  const lock = join(directory, "write.lock")
  try {
    mkdirSync(lock, { mode: 0o700 })
  } catch {
    throw new StoreError(
      "Workspace is busy. Retry after a moment; a persistent lock needs administrator review.",
      409
    )
  }
  const file = join(directory, "workspace.enc")
  const temp = join(
    directory,
    `workspace-${randomBytes(8).toString("hex")}.tmp`
  )
  try {
    let data: StoreData
    try {
      data = decryptStore(readFileSync(file), key)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT")
        throw new StoreError(
          "Stored data could not be opened. Nothing was overwritten."
        )
      data = {
        version: 1,
        revision: 0,
        workspace: createWorkspace("protected-site", []),
        sessions: [],
        invites: [],
        submissions: [],
      }
    }
    data.sessions = data.sessions.filter((s) => s.expires > Date.now())
    data.invites = data.invites.filter((i) => i.expires > Date.now())
    const result = fn(data)
    writeFileSync(temp, encryptStore(data, key), { mode: 0o600, flag: "wx" })
    renameSync(temp, file)
    return result
  } finally {
    rmSync(temp, { force: true })
    rmSync(lock, { recursive: true })
  }
}
export function validSession(data: StoreData, token: string) {
  return (
    /^[a-f\d]{64}$/.test(token) &&
    data.sessions.some(
      (s) => s.hash === hashToken(token) && s.expires > Date.now()
    )
  )
}
export function issueInvite(data: StoreData, residentId: string) {
  if (!data.workspace.residents.some((r) => r.id === residentId))
    throw new StoreError("Save this resident before creating a link.", 400)
  const token = randomBytes(32).toString("hex")
  const invite = {
    id: randomBytes(16).toString("hex"),
    hash: hashToken(token),
    residentId,
    expires: Date.now() + 7 * 86400000,
    used: false,
  }
  // Issuing a new invitation revokes the previous unused link for this resident.
  data.invites = data.invites.filter((i) => i.residentId !== residentId)
  data.invites.push(invite)
  return { token, id: invite.id, expires: invite.expires }
}
export function acceptFamilySubmission(
  data: StoreData,
  token: string,
  submission: Omit<FamilySubmission, "id" | "residentId" | "receivedAt">
) {
  const invite = data.invites.find(
    (i) => i.hash === hashToken(token) && !i.used && i.expires > Date.now()
  )
  if (
    !invite ||
    !data.workspace.residents.some((r) => r.id === invite.residentId)
  )
    throw new StoreError(
      "This link is unavailable, expired, revoked, or already used. Ask the caregiver for a new link.",
      400
    )
  if (!submission.authority)
    throw new StoreError("Appropriate consent or authority is required.", 400)
  invite.used = true
  const entry = {
    ...submission,
    id: randomBytes(16).toString("hex"),
    residentId: invite.residentId,
    receivedAt: new Date().toISOString(),
  }
  data.submissions.push(entry)
  return entry.id
}
