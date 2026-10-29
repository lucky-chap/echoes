import type { EchoesWorkspace } from "./types"
import { clearWorkspaceStorage, workspaceKey } from "./workspace"

const activeKey = "echoes-active-workspace"
const database = "echoes-demo-workspaces"
type Snapshot = { savedAt: number; workspace: EchoesWorkspace }
export interface WorkspaceStorage {
  read(secret?: string): Promise<Snapshot | null>
  write(snapshot: Snapshot): Promise<void>
  clear(): Promise<void>
}
function snapshot(value: unknown): Snapshot | null {
  if (!value || typeof value !== "object") return null
  const record = value as Partial<Snapshot> & Partial<EchoesWorkspace>
  const workspace = record.workspace ?? (record as EchoesWorkspace)
  if (workspace.version !== 1 || !Array.isArray(workspace.residents))
    return null
  return { savedAt: record.savedAt ?? 0, workspace }
}
const local: WorkspaceStorage = {
  async read(secret) {
    const id = secret ?? localStorage.getItem(activeKey)
    return id
      ? snapshot(JSON.parse(localStorage.getItem(workspaceKey(id)) ?? "null"))
      : null
  },
  async write(value) {
    localStorage.setItem(
      workspaceKey(value.workspace.secret),
      JSON.stringify(value)
    )
    localStorage.setItem(activeKey, value.workspace.secret)
  },
  async clear() {
    clearWorkspaceStorage(localStorage)
    localStorage.removeItem(activeKey)
    localStorage.removeItem("echoes-feedback-v1")
  },
}
function transaction<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore, done: (value: T) => void) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(database, 1)
    request.onupgradeneeded = () =>
      request.result.createObjectStore("workspaces")
    request.onerror = () => reject(request.error)
    request.onblocked = () =>
      reject(
        Error("Browser database is busy. Close other Echoes tabs and retry.")
      )
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction("workspaces", mode)
      let value: T
      tx.oncomplete = () => {
        db.close()
        resolve(value)
      }
      tx.onabort = () => {
        db.close()
        reject(tx.error ?? Error("Browser save failed"))
      }
      tx.onerror = () => {
        /* Abort reports failure; never report a request alone as saved. */
      }
      try {
        action(tx.objectStore("workspaces"), (result) => {
          value = result
        })
      } catch (error) {
        tx.abort()
        reject(error)
      }
    }
  })
}
const indexed: WorkspaceStorage = {
  read(secret) {
    return transaction("readonly", (store, done) => {
      const read = (id?: string) => {
        if (!id) return done(null)
        const request = store.get(workspaceKey(id))
        request.onsuccess = () => done(snapshot(request.result))
      }
      if (secret) read(secret)
      else {
        const request = store.get(activeKey)
        request.onsuccess = () => read(request.result)
      }
    })
  },
  write(value) {
    return transaction("readwrite", (store, done) => {
      store.put(value, workspaceKey(value.workspace.secret))
      store.put(value.workspace.secret, activeKey)
      done(undefined)
    })
  },
  clear() {
    return transaction("readwrite", (store, done) => {
      store.clear()
      done(undefined)
    })
  },
}
// Serialized writes prevent an older edit from replacing a newer snapshot.
export function createBrowserWorkspaceStorage(
  primary: WorkspaceStorage,
  fallback: WorkspaceStorage
) {
  let queue: Promise<unknown> = Promise.resolve()
  let lastSavedAt = 0
  return {
    async read(secret?: string) {
      const results = await Promise.allSettled([
        primary.read(secret),
        fallback.read(secret),
      ])
      if (results.every((result) => result.status === "rejected"))
        throw Error(
          "Browser storage could not be read. Allow site storage and reload; existing data has not been replaced."
        )
      const snapshots = results.flatMap((result) =>
        result.status === "fulfilled" && result.value ? [result.value] : []
      )
      const newest = snapshots.sort((a, b) => b.savedAt - a.savedAt)[0]
      lastSavedAt = newest?.savedAt ?? 0
      return newest?.workspace ?? null
    },
    write(workspace: EchoesWorkspace) {
      const value = {
        workspace,
        savedAt: Math.max(Date.now(), lastSavedAt + 1),
      }
      lastSavedAt = value.savedAt
      const result = queue
        .catch(() => {})
        .then(async () => {
          try {
            await primary.write(value)
          } catch {
            await fallback.write(value)
          }
        })
      queue = result
      return result
    },
    clear() {
      const result = queue
        .catch(() => {})
        .then(async () => {
          // Attempt both stores even if one is blocked; never claim deletion succeeded on failure.
          const results = await Promise.allSettled([
            primary.clear(),
            fallback.clear(),
          ])
          if (results.some((result) => result.status === "rejected"))
            throw Error(
              "Some browser data could not be cleared. Allow site storage and retry."
            )
        })
      queue = result
      return result
    },
  }
}
export const browserWorkspaceStorage = createBrowserWorkspaceStorage(
  indexed,
  local
)
