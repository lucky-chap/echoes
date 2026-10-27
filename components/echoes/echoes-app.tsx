"use client"

import { demoProfiles } from "@/lib/echoes/demos"
import { mergeFeedback } from "@/lib/echoes/feedback"
import type { FeedbackRecord, ResidentInput, SessionKit } from "@/lib/echoes/types"
import Link from "next/link"
import { useMemo, useState } from "react"

const storageKey = "echoes-feedback-v1"
const blankResident = (): ResidentInput => ({
  id: crypto.randomUUID(), nickname: "", birthYear: 1948, hometown: "", country: "", language: "English", lovedThings: [""], sensitivities: [],
})

function commaList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean)
}

export default function EchoesApp() {
  const [residents, setResidents] = useState<ResidentInput[]>([blankResident()])
  const [feedback, setFeedback] = useState<FeedbackRecord[]>(() => {
    if (typeof window === "undefined") return []
    try { return JSON.parse(localStorage.getItem(storageKey) || "[]") } catch { return [] }
  })
  const [kit, setKit] = useState<SessionKit | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const saveFeedback = (next: FeedbackRecord[]) => {
    setFeedback(next)
    localStorage.setItem(storageKey, JSON.stringify(next))
  }
  const update = (index: number, patch: Partial<ResidentInput>) => setResidents((current) => current.map((resident, candidate) => candidate === index ? { ...resident, ...patch } : resident))
  const loadDemo = (kind: "single" | "group") => {
    setKit(null); setError("")
    setResidents((kind === "single" ? demoProfiles.slice(0, 1) : demoProfiles).map((resident) => ({ ...resident, id: crypto.randomUUID() })))
  }
  const createKit = async () => {
    setLoading(true); setError(""); setKit(null)
    try {
      const response = await fetch("/api/echoes/kit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ residents, feedback }) })
      const payload = await response.json()
      if (!response.ok) throw Error(payload.error || "Could not prepare a session kit.")
      setKit(payload.kit)
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not prepare a session kit.") }
    finally { setLoading(false) }
  }
  const recordFeedback = (residentId: string, entityId: string, status: FeedbackRecord["status"]) => {
    saveFeedback(mergeFeedback(feedback, { residentId, entityId, status }))
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
      {!kit ? <section className="intake card">
        <div className="section-title"><div><p className="eyebrow">01 / INTAKE</p><h2>Who are we planning for?</h2></div><div className="demo-actions"><button type="button" onClick={() => loadDemo("single")}>Try a demo</button><button type="button" onClick={() => loadDemo("group")}>Try group demo</button></div></div>
        <p className="quiet">Use a first name or nickname only. Echoes keeps feedback in this browser; it does not store a profile on our servers.</p>
        {residents.map((resident, index) => <fieldset className="resident-form" key={resident.id}><legend>{residents.length > 1 ? `Person ${index + 1}` : "Person"}</legend>
          {residents.length > 1 && <button className="remove" type="button" onClick={() => setResidents((items) => items.filter((_, candidate) => candidate !== index))}>Remove</button>}
          <label>First name or nickname<input value={resident.nickname} onChange={(event) => update(index, { nickname: event.target.value })} placeholder="e.g. Marie" /></label>
          <label>Birth year<input type="number" value={resident.birthYear} onChange={(event) => update(index, { birthYear: Number(event.target.value) })} /></label>
          <label>Grew up in<input value={resident.hometown} onChange={(event) => update(index, { hometown: event.target.value })} placeholder="City or region" /></label>
          <label>Country<input value={resident.country} onChange={(event) => update(index, { country: event.target.value })} placeholder="Country" /></label>
          <label>Preferred language<input value={resident.language} onChange={(event) => update(index, { language: event.target.value })} /></label>
          <label className="wide">Loved things <span>1–3 artists, films, shows, books, or places</span><input value={resident.lovedThings.join(", ")} onChange={(event) => update(index, { lovedThings: commaList(event.target.value).slice(0, 3) })} placeholder="e.g. The Beatles, Roman Holiday" /></label>
          <label className="wide">Please avoid <span>Optional, comma-separated</span><input value={resident.sensitivities.join(", ")} onChange={(event) => update(index, { sensitivities: commaList(event.target.value) })} placeholder="e.g. war, loss" /></label>
        </fieldset>)}
        <div className="intake-footer"><button className="add-person" type="button" disabled={residents.length >= 12} onClick={() => setResidents((items) => [...items, blankResident()])}>+ Add another person</button><button className="primary" type="button" disabled={loading} onClick={createKit}>{loading ? "Finding verified touchstones…" : "Create a session kit →"}</button></div>
        {error && <p className="error" role="alert">{error}</p>}
      </section> : <section className="kit-view">
        <div className="kit-heading"><div><p className="eyebrow">02 / SESSION KIT</p><h2>A 30-minute moment of recognition</h2><p>For {kit.residents.map((resident) => resident.nickname).join(" & ")} · {kit.era.from}–{kit.era.to}</p></div><div><button className="secondary" type="button" onClick={() => window.print()}>Print about-me sheet</button><button className="primary" type="button" onClick={() => { setKit(null); window.scrollTo({ top: 0, behavior: "smooth" }) }}>New kit</button></div></div>
        <div className="coverage"><strong>{kit.coverage.percent}%</strong><span>group coverage</span><p>{kit.coverage.underservedNames.length ? `More individual tailoring may help ${kit.coverage.underservedNames.join(", ")}.` : "Each person has at least one Qloo-supported connection in this kit."}</p></div>
        <div className="kit-grid"><div className="items-panel"><h3>Choose one or two touchstones</h3>{kit.items.map((item) => <article className="kit-item" key={item.entityId}><div className="item-icon">{item.kind === "music" ? "♫" : item.kind === "book" ? "⌁" : item.kind === "place" ? "⌖" : "◐"}</div><div className="item-copy"><div><span className="verified">✦ Qloo-verified</span><span className="item-kind">{item.kind}</span></div><h4>{item.name}</h4><p>{item.whyItFits.filter((tag) => tag !== "Qloo-verified").slice(0, 2).join(" · ")}</p><div className="feedback">{item.matchedResidentIds.map((id) => <span key={id}>{kit.residents.find((resident) => resident.id === id)?.nickname}: <button className={feedbackByEntity.get(`${id}:${item.entityId}`) === "sparked" ? "active-spark" : ""} onClick={() => recordFeedback(id, item.entityId, "sparked")}>sparked response</button><button className={feedbackByEntity.get(`${id}:${item.entityId}`) === "distressed" ? "active-distress" : ""} onClick={() => recordFeedback(id, item.entityId, "distressed")}>not for us</button></span>)}</div></div></article>)}</div>
          <aside className="session-sidebar"><section><p className="eyebrow">CONVERSATION STARTERS</p>{kit.prompts.map((prompt, index) => <p className="prompt" key={prompt}><b>{index + 1}</b>{prompt}</p>)}</section><section className="about-sheet"><p className="eyebrow">ABOUT ME</p><h3>{kit.aboutMe.title}</h3><p>{kit.aboutMe.opening}</p>{kit.aboutMe.details.map((detail) => <p className="detail" key={detail}>{detail}</p>)}</section></aside></div>
        {kit.notes.length > 0 && <div className="kit-notes">{kit.notes.map((note) => <p key={note}>✦ {note}</p>)}</div>}
      </section>}
      <section className="trust" id="how-it-works"><p className="eyebrow">HOW ECHOES WORKS</p><div><p><b>1.</b> Starts in the reminiscence window—ages 13 to 25.</p><p><b>2.</b> Qloo resolves and ranks every cultural item before it appears.</p><p><b>3.</b> Your feedback shapes the next kit on this browser.</p></div></section>
    </main>
    <footer>Echoes is for activity support. It does not provide medical advice or treatment.</footer>
  </div>
}
