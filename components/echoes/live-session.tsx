"use client"

import type { FeedbackRecord, ResidentInput, SessionKit } from "@/lib/echoes/types"
import { useEffect, useState } from "react"

export default function LiveSession({ kit, residents, feedback, onFeedback, onClose }: { kit: SessionKit; residents: ResidentInput[]; feedback: FeedbackRecord[]; onFeedback: (record: FeedbackRecord) => void; onClose: () => void }) {
  const [index, setIndex] = useState(0)
  const [seconds, setSeconds] = useState(30 * 60)
  const [engagement, setEngagement] = useState<1 | 2 | 3 | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const item = kit.items[index]
  useEffect(() => { const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000); return () => window.clearInterval(timer) }, [])
  const respond = (status: FeedbackRecord["status"]) => {
    item.matchedResidentIds.forEach((residentId) => onFeedback({ residentId, entityId: item.entityId, status }))
    if (index < kit.items.length - 1) setIndex((value) => value + 1)
  }
  const draftNote = async () => {
    const resident = residents.find((candidate) => candidate.id === item.matchedResidentIds[0]) ?? residents[0]
    const response = await fetch("/api/echoes/note", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resident, items: kit.items, feedback, engagement }) })
    const payload = await response.json(); setNote(payload.note || payload.error || "Draft unavailable.")
  }
  return <section className="live-session card"><div className="live-top"><div><p className="eyebrow">LIVE SESSION</p><h2>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</h2><p>One touchstone at a time. Follow their lead.</p></div><button className="secondary" onClick={onClose}>Exit live session</button></div><div className="live-item"><span className="verified">✦ Qloo-matched</span><span className="year-evidence">{item.yearEvidence.year} · {item.yearEvidence.source}</span><h3>{item.name}</h3><p>{item.whyItFits.slice(1, 3).join(" · ")}</p></div><div className="live-actions"><button onClick={() => respond("sparked")} className="spark">Sparked response</button><button onClick={() => respond("neutral")}>Neutral</button><button onClick={() => respond("distressed")} className="distress">Not for us</button></div><div className="engagement"><p>Observed engagement / pleasant moments</p>{([1, 2, 3] as const).map((value) => <button className={engagement === value ? "selected" : ""} key={value} onClick={() => setEngagement(value)}>{value} <span>{value === 1 ? "low" : value === 2 ? "some" : "strong"}</span></button>)}</div><button className="primary" onClick={draftNote}>Draft session note for review</button>{note && <div className="draft-note"><p className="eyebrow">DRAFT FOR STAFF REVIEW</p><p>{note}</p></div>}</section>
}
