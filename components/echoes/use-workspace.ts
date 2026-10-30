"use client"
import { browserWorkspaceStorage } from "@/lib/echoes/browser-storage"
import { blankResident } from "@/lib/echoes/intake"
import { migrateResidentNotes } from "@/lib/echoes/preferences"
import { useCallback, useEffect, useRef, useState } from "react"
import type { EchoesWorkspace } from "@/lib/echoes/types"
import { createWorkspace, removeResidentData } from "@/lib/echoes/workspace"

export { blankResident }
const empty = () => createWorkspace("loading", [blankResident("initial")])
async function readLocal() {
  const secret = window.location.hash.match(/^#workspace=([\w-]+)$/)?.[1]
  const saved = await browserWorkspaceStorage.read(secret)
  if (saved)
    return { ...saved, residents: saved.residents.map(migrateResidentNotes) }
  return createWorkspace(secret ?? crypto.randomUUID(), [blankResident()])
}
export function useWorkspace() {
  const [workspace, setWorkspace] = useState<EchoesWorkspace>(empty)
  const [mode, setMode] = useState<"checking" | "demo" | "protected">(
    "checking"
  )
  const [locked, setLocked] = useState(true)
  const [notice, setNotice] = useState("")
  const [saveState, setSaveState] = useState("Not loaded")
  const [savedWorkspace, setSavedWorkspace] = useState<EchoesWorkspace | null>(
    null
  )
  const revision = useRef(0)
  const persisted = useRef<EchoesWorkspace | null>(null)
  const saving = useRef(false)
  const blocked = useRef(false)
  const latest = useRef(workspace)
  const authorized = useRef(false)
  const [saveTick, setSaveTick] = useState(0)
  const reload = useCallback(async () => {
    const response = await fetch("/api/echoes/workspace", { cache: "no-store" })
    const body = await response.json()
    if (!response.ok) throw Error(body.error || "Workspace unavailable")
    const loaded: EchoesWorkspace = {
      ...body.workspace,
      residents: body.workspace.residents.map(migrateResidentNotes),
    }
    if (!loaded.residents.length) loaded.residents = [blankResident()]
    revision.current = body.revision
    persisted.current = loaded
    setSavedWorkspace(loaded)
    blocked.current = false
    authorized.current = true
    setWorkspace(loaded)
    setLocked(false)
    setNotice("")
    setSaveState("Saved to protected workspace")
    window.history.replaceState(null, "", window.location.pathname)
  }, [])
  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const response = await fetch("/api/echoes/access", {
          cache: "no-store",
        })
        const status = await response.json()
        if (!response.ok)
          throw Error(status.error || "Could not check workspace protection.")
        if (!active) return
        if (status.configured) {
          setMode("protected")
          if (status.unlocked) await reload()
        } else {
          const local = await readLocal()
          if (!active) return
          setWorkspace(local)
          persisted.current = local
          setMode("demo")
          setLocked(false)
          setSaveState("Saving changes…")
        }
      } catch (error) {
        if (active)
          setNotice(
            error instanceof Error
              ? error.message
              : "Workspace unavailable. Reload to retry."
          )
      }
    })()
    return () => {
      active = false
      authorized.current = false
    }
  }, [reload])
  const lock = useCallback(async () => {
    authorized.current = false
    setLocked(true)
    setWorkspace(empty())
    persisted.current = null
    setSavedWorkspace(null)
    try {
      await fetch("/api/echoes/access", { method: "DELETE" })
    } catch {
      /* Client is already cleared; server cookie expires independently. */
    }
  }, [])
  const unlock = async (code: string) => {
    const response = await fetch("/api/echoes/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    })
    const body = await response.json()
    if (!response.ok) throw Error(body.error || "Could not unlock workspace")
    await reload()
  }
  const removeResident = async (residentId: string) => {
    if (mode === "protected") {
      if (saving.current || workspace !== persisted.current)
        throw Error("Wait for changes to save before deleting a resident.")
      const response = await fetch("/api/echoes/workspace", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ residentId, revision: revision.current }),
      })
      const result = await response.json()
      if (!response.ok) throw Error(result.error || "Could not remove resident")
      await reload()
    } else {
      setWorkspace((current) => {
        const next = removeResidentData(current, residentId)
        if (!next.residents.length) next.residents = [blankResident()]
        return next
      })
    }
  }
  useEffect(() => {
    latest.current = workspace
    if (locked || mode === "checking") return
    if (mode === "demo") {
      let active = true
      queueMicrotask(() => {
        if (active) setSaveState("Saving changes…")
      })
      void browserWorkspaceStorage
        .write(workspace)
        .then(() => {
          if (!active) return
          if (window.location.hash.startsWith("#workspace="))
            window.history.replaceState(null, "", window.location.pathname)
          setSavedWorkspace(workspace)
          setSaveState("Saved in this browser")
          setNotice("")
        })
        .catch(() => {
          if (!active) return
          setSaveState("Not saved — keep this tab open")
          setNotice(
            "Browser storage is full or blocked. Allow site storage or free space, then retry. These changes will be lost if you reload."
          )
        })
      return () => {
        active = false
      }
    }
    if (workspace === persisted.current || blocked.current) return
    queueMicrotask(() => setSaveState("Saving changes…"))
    const timer = setTimeout(async () => {
      if (saving.current || !authorized.current) return
      saving.current = true
      const snapshot = latest.current
      try {
        const response = await fetch("/api/echoes/workspace", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            revision: revision.current,
            workspace: snapshot,
          }),
        })
        const result = await response.json()
        if (response.status === 401) {
          await lock()
          return
        }
        if (!response.ok) {
          blocked.current = true
          throw Error(result.error || "Save failed. Reload before continuing.")
        }
        revision.current = result.revision
        persisted.current = snapshot
        setSavedWorkspace(snapshot)
        setSaveState("Saved to protected workspace")
      } catch (error) {
        blocked.current = true
        setNotice(error instanceof Error ? error.message : "Save failed")
        setSaveState("Not saved — keep this tab open")
      } finally {
        saving.current = false
        if (authorized.current) setSaveTick((t) => t + 1)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [workspace, mode, locked, saveTick, lock])
  useEffect(() => {
    if (mode !== "protected" || locked) return
    let timer: ReturnType<typeof setTimeout>
    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(() => void lock(), 5 * 60_000)
    }
    reset()
    window.addEventListener("pointerdown", reset)
    window.addEventListener("keydown", reset)
    return () => {
      clearTimeout(timer)
      window.removeEventListener("pointerdown", reset)
      window.removeEventListener("keydown", reset)
    }
  }, [mode, locked, lock])
  useEffect(() => {
    if (locked || mode === "checking" || workspace === savedWorkspace) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [workspace, savedWorkspace, locked, mode])
  return {
    workspace,
    setWorkspace,
    mode,
    locked,
    ready: mode !== "checking" && !locked,
    notice,
    saveState,
    isSaved: workspace === savedWorkspace,
    unlock,
    lock,
    reload,
    removeResident,
    retrySave: () => setSaveTick((tick) => tick + 1),
  }
}
