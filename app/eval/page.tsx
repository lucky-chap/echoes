"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

type Evaluation = { sampleProfiles: number; pipeline: { entityResolutionRate: number; eraWindowRate: number; groupCoverage: number; itemsMeasured: number }; baseline: { status: string; entityResolutionRate: number | null; eraWindowRate: number | null; groupCoverage: number | null }; note: string }
export default function EvalPage() {
  const [data, setData] = useState<Evaluation | null>(null); const [error, setError] = useState("")
  useEffect(() => { fetch("/api/echoes/eval").then(async (response) => { const body = await response.json(); if (!response.ok) throw Error(body.error); setData(body) }).catch((reason) => setError(reason.message)) }, [])
  return <main className="eval-page"><Link className="back" href="/">← Echoes</Link><p className="eyebrow">EVALUATION</p><h1>Measurable, not magical.</h1><p>Echoes evaluates cultural grounding, era constraints, and group fit—not health outcomes.</p>{error && <p className="error">{error}</p>}{!data && !error && <p className="loading">Running the Qloo pipeline against three sample profiles…</p>}{data && <><div className="metric-grid"><section><strong>{data.pipeline.entityResolutionRate}%</strong><span>items resolve to Qloo entities</span></section><section><strong>{data.pipeline.eraWindowRate}%</strong><span>items requested within the era window</span></section><section><strong>{data.pipeline.groupCoverage}%</strong><span>average profile coverage</span></section></div><p className="eval-caption">{data.pipeline.itemsMeasured} verified items across {data.sampleProfiles} profiles, including Ghana, Japan, and Spain.</p><section className="baseline"><h2>LLM-only comparison</h2><p>{data.baseline.status}</p></section><p className="eval-note">{data.note}</p></>}</main>
}
