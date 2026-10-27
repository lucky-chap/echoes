"use client"

import { demoProfiles } from "@/lib/echoes/demos"
import { mergeFeedback } from "@/lib/echoes/feedback"
import type { EchoesWorkspace, FeedbackRecord, ResidentInput, SessionKit } from "@/lib/echoes/types"
import { clearWorkspaceStorage, createWorkspace, workspaceKey } from "@/lib/echoes/workspace"
import LiveSession from "@/components/echoes/live-session"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

const blankResident = (): ResidentInput => ({
  id: crypto.randomUUID(), nickname: "", birthYear: 1948, hometown: "", country: "", language: "English", lovedThings: [""], sensitivities: [],
})

function initialWorkspace(): EchoesWorkspace {
  if (typeof window === "undefined") return createWorkspace("local", [blankResident()])
  const secret = window.location.hash.replace("#workspace=", "") || crypto.randomUUID()
  try {
    const saved = JSON.parse(localStorage.getItem(workspaceKey(secret)) || "null") as EchoesWorkspace | null
    if (saved?.version === 1) return saved
  } catch { /* start a fresh workspace */ }
  return createWorkspace(secret, [blankResident()])
}

function commaList(value: string) {
  // Keep spaces while a caregiver types (for example, "The Beatles").
  // Values are normalized only at submit time.
  return value.split(",")
}

export default function EchoesApp() {
  const [workspace, setWorkspace] = useState<EchoesWorkspace>(initialWorkspace)
  const [kit, setKit] = useState<SessionKit | null>(null)
  const [live, setLive] = useState(false)
  const [intakeNote, setIntakeNote] = useState("")
  const [extracting, setExtracting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const residents = workspace.residents
  const feedback = workspace.feedback
  useEffect(() => {
    if (typeof window === "undefined") return
    localStorage.setItem(workspaceKey(workspace.secret), JSON.stringify(workspace))
    window.history.replaceState(null, "", `#workspace=${workspace.secret}`)
  }, [workspace])
  const setResidents = (next: ResidentInput[] | ((current: ResidentInput[]) => ResidentInput[])) => setWorkspace((current) => ({ ...current, residents: typeof next === "function" ? next(current.residents) : next }))
  const saveFeedback = (next: FeedbackRecord[]) => setWorkspace((current) => ({ ...current, feedback: next }))
  const update = (index: number, patch: Partial<ResidentInput>) => setResidents((current) => current.map((resident, candidate) => candidate === index ? { ...resident, ...patch } : resident))
  const loadDemo = (kind: "single" | "group") => {
    setKit(null); setError("")
    setResidents((kind === "single" ? demoProfiles.slice(0, 1) : demoProfiles).map((resident) => ({ ...resident, id: crypto.randomUUID() })))
  }
  const createKit = async () => {
    setLoading(true); setError(""); setKit(null)
    try {
      const normalizedResidents = residents.map((resident) => ({
        ...resident,
        lovedThings: resident.lovedThings.map((item) => item.trim()).filter(Boolean),
        sensitivities: resident.sensitivities.map((item) => item.trim()).filter(Boolean),
      }))
      const response = await fetch("/api/echoes/kit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ residents: normalizedResidents, feedback }) })
      const payload = await response.json()
      if (!response.ok) throw Error(payload.error || "Could not prepare a session kit.")
      setKit(payload.kit)
      setWorkspace((current) => ({ ...current, traces: [...payload.kit.agentTrace, ...current.traces].slice(0, 200), sessions: [{ id: payload.kit.id, createdAt: payload.kit.createdAt, kit: payload.kit, feedback: current.feedback, engagement: null, noteDraft: null }, ...current.sessions].slice(0, 50) }))
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not prepare a session kit.") }
    finally { setLoading(false) }
  }
  const recordFeedback = (residentId: string, entityId: string, status: FeedbackRecord["status"]) => {
    saveFeedback(mergeFeedback(feedback, { residentId, entityId, status }))
  }
  const extractNote = async () => {
    setExtracting(true); setError("")
    try {
      const response = await fetch("/api/echoes/intake", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note: intakeNote }) })
      const payload = await response.json(); if (!response.ok) throw Error(payload.error)
      update(0, { ...payload.profile, lovedThings: payload.profile.lovedThings ?? residents[0].lovedThings, sensitivities: payload.profile.sensitivities ?? residents[0].sensitivities })
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not read that note.") } finally { setExtracting(false) }
  }
  const feedbackByEntity = useMemo(() => new Map(feedback.map((record) => [`${record.residentId}:${record.entityId}`, record.status])), [feedback])

  return <div className="echoes-shell">
    <header className="echoes-header">
      <Link className="echoes-logo" href="/"><span aria-hidden>✦</span> echoes</Link>
      <nav><a href="#how-it-works">How it works</a><Link href="/eval">Evaluation</Link></nav>
      <p>Activity support, not treatment</p>
    </header>
    <main>
      <section className="hero">
        <div><p className="eyebrow">REMINISCENCE, GENTLY PREPARED</p><h1>Start with what<br /><em>still feels familiar.</em></h1><p className="hero-copy">Echoes turns a few remembered favorites into a considerate, 30-minute activity-support session—grounded in the cultural world of a person’s younger years.</p></div>
        <aside className="hero-note"><span>30 min</span><strong>A small shared moment</strong><p>Verified cultural touchstones, conversation starters, and room to follow their lead.</p></aside>
      </section>
      {kit && live && <LiveSession kit={kit} residents={residents} feedback={feedback} onFeedback={(record) => recordFeedback(record.residentId, record.entityId, record.status)} onClose={() => setLive(false)} />}
      {!kit ? <section className="intake card">
        <div className="section-title"><div><p className="eyebrow">01 / INTAKE</p><h2>Who are we planning for?</h2></div><div className="demo-actions"><button type="button" onClick={() => loadDemo("single")}>Try a demo</button><button type="button" onClick={() => loadDemo("group")}>Try group demo</button></div></div>
        <p className="quiet">Use a first name or nickname only. This private workspace stays in this browser and can be cleared at any time.</p>
        <div className="note-intake"><label>Paste a memory or handover note <textarea value={intakeNote} onChange={(event) => setIntakeNote(event.target.value)} placeholder="For example: Sam was born in 1942 in Accra, loved ABBA, and prefers to avoid war stories." /></label><button type="button" className="secondary" disabled={extracting || intakeNote.trim().length < 8} onClick={extractNote}>{extracting ? "Reading note…" : "Extract details"}</button></div>
        {residents.map((resident, index) => <fieldset className="resident-form" key={resident.id}><legend>{residents.length > 1 ? `Person ${index + 1}` : "Person"}</legend>
          {residents.length > 1 && <button className="remove" type="button" onClick={() => setResidents((items) => items.filter((_, candidate) => candidate !== index))}>Remove</button>}
          <label>First name or nickname<input value={resident.nickname} onChange={(event) => update(index, { nickname: event.target.value })} placeholder="e.g. Marie" /></label>
          <label>Birth year<input type="number" value={resident.birthYear} onChange={(event) => update(index, { birthYear: Number(event.target.value) })} /></label>
          <label>Grew up in<input value={resident.hometown} onChange={(event) => update(index, { hometown: event.target.value })} placeholder="City or region" /></label>
          <label>Country<input value={resident.country} onChange={(event) => update(index, { country: event.target.value })} placeholder="Country" /></label>
          <label>Preferred language<input value={resident.language} onChange={(event) => update(index, { language: event.target.value })} /></label>
          <label className="wide">Loved things <span>1–3 artists, films, shows, books, or places</span><input value={resident.lovedThings.join(",")} onChange={(event) => update(index, { lovedThings: commaList(event.target.value).slice(0, 3) })} placeholder="e.g. The Beatles, Roman Holiday" /></label>
          <label className="wide">Please avoid <span>Optional, comma-separated</span><input value={resident.sensitivities.join(",")} onChange={(event) => update(index, { sensitivities: commaList(event.target.value) })} placeholder="e.g. war, loss" /></label>
        </fieldset>)}
        <div className="intake-footer"><button className="add-person" type="button" disabled={residents.length >= 12} onClick={() => setResidents((items) => [...items, blankResident()])}>+ Add another person</button><button className="primary" type="button" disabled={loading} onClick={createKit}>{loading ? "Finding verified touchstones…" : "Create a session kit →"}</button></div>
        {error && <p className="error" role="alert">{error}</p>}
      </section> : <section className="kit-view">
        <div className="kit-heading"><div><p className="eyebrow">02 / SESSION KIT</p><h2>A 30-minute moment of recognition</h2><p>For {kit.residents.map((resident) => resident.nickname).join(" & ")} · {kit.era.from}–{kit.era.to}</p></div><div><button className="secondary" type="button" onClick={() => window.print()}>Print about-me sheet</button><button className="secondary" type="button" onClick={() => setLive(true)}>Start live session</button><button className="primary" type="button" onClick={() => { setKit(null); window.scrollTo({ top: 0, behavior: "smooth" }) }}>New kit</button></div></div>
        {kit.residents.length > 1 && <div className="coverage"><strong>{kit.coverage.percent}%</strong><span>group coverage</span><p>{kit.coverage.underservedNames.length ? `More individual tailoring may help ${kit.coverage.underservedNames.join(", ")}.` : "Each person has at least one Qloo-supported connection in this kit."}</p></div>}
        <div className="kit-grid"><div className="items-panel"><h3>Choose one or two touchstones</h3>{kit.items.map((item) => <article className="kit-item" key={item.entityId}><div className="item-icon">{item.kind === "music" ? "♫" : item.kind === "book" ? "⌁" : item.kind === "place" ? "⌖" : "◐"}</div><div className="item-copy"><div><span className="verified">✦ Qloo-matched</span><span className="year-evidence">{item.yearEvidence.year} · {item.yearEvidence.source}</span><span className="item-kind">{item.kind}</span></div><h4>{item.name}</h4><p>{item.whyItFits.filter((tag) => tag !== "Qloo-verified").slice(0, 2).join(" · ")}</p><div className="feedback">{item.matchedResidentIds.map((id) => <span key={id}>{kit.residents.find((resident) => resident.id === id)?.nickname}: <button className={feedbackByEntity.get(`${id}:${item.entityId}`) === "sparked" ? "active-spark" : ""} onClick={() => recordFeedback(id, item.entityId, "sparked")}>sparked response</button><button className={feedbackByEntity.get(`${id}:${item.entityId}`) === "distressed" ? "active-distress" : ""} onClick={() => recordFeedback(id, item.entityId, "distressed")}>not for us</button></span>)}</div></div></article>)}</div>
          <aside className="session-sidebar"><section><p className="eyebrow">CONVERSATION STARTERS</p>{kit.prompts.map((prompt, index) => <p className="prompt" key={prompt}><b>{index + 1}</b>{prompt}</p>)}</section><section className="about-sheet"><p className="eyebrow">ABOUT ME</p><h3>{kit.aboutMe.title}</h3><p>{kit.aboutMe.opening}</p>{kit.aboutMe.details.map((detail) => <p className="detail" key={detail}>{detail}</p>)}</section></aside></div>
        {kit.notes.length > 0 && <div className="kit-notes">{kit.notes.map((note) => <p key={note}>✦ {note}</p>)}</div>}
        <details className="agent-trace"><summary>What the agent did</summary>{kit.agentTrace.map((entry) => <p key={entry.id}><b>{entry.tool.replaceAll("_", " ")}</b> — {entry.summary}</p>)}</details>
      </section>}
      <section className="trust" id="how-it-works"><p className="eyebrow">HOW ECHOES WORKS</p><div><p><b>1.</b> Starts in the reminiscence window—ages 13 to 25.</p><p><b>2.</b> Qloo resolves and ranks every cultural item before it appears.</p><p><b>3.</b> Your feedback shapes the next kit on this browser.</p></div></section>
    </main>
    <footer>Echoes supports connection and pleasant moments. It is not medical advice or treatment—follow the person’s care plan. <button onClick={() => { clearWorkspaceStorage(localStorage); window.location.hash = ""; window.location.reload() }}>Delete everything in this browser</button></footer>
  </div>
}
