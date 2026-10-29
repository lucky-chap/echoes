"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  ArrowRight,
  FlaskConical,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react"

type Evaluation = {
  sampleProfiles: number
  pipeline: {
    entityResolutionRate: number
    eraWindowRate: number | null
    profileMediaCoverage: number
    itemsMeasured: number
  }
  baseline: {
    status: string
    entityResolutionRate: number | null
    eraWindowRate: number | null
    groupCoverage: number | null
  }
  note: string
}

export default function EvalPage() {
  const [data, setData] = useState<Evaluation | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const run = async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/echoes/eval")
      const body = await response.json()
      if (!response.ok)
        throw Error(
          body.error || "The evaluation couldn’t finish. Please try again."
        )
      setData(body)
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The evaluation couldn’t finish."
      )
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="echoes-shell">
      <header className="site-header">
        <nav className="nav-left">
          <Link className="nav-link" href="/">
            <ArrowLeft size={15} /> Back to Echoes
          </Link>
        </nav>
        <Link className="wordmark" href="/">
          echoes<span aria-hidden="true">✳</span>
        </Link>
        <nav className="nav-right">
          <span className="nav-link current">Our evidence</span>
        </nav>
      </header>
      <main className="eval-page">
        <section className="eval-hero">
          <ShieldCheck size={35} strokeWidth={1.25} />
          <p className="eyebrow">A LITTLE TRANSPARENCY</p>
          <h1>
            Made with care.
            <br />
            <em>Checked with evidence.</em>
          </h1>
          <p>
            See how our cultural matches hold up: real entities, independently
            checked years, and a connection for each person.
          </p>
        </section>
        <div className="eval-toolbar">
          <div>
            Three profiles. Three different starting points.
            <small>
              Dorothy · Margaret · Robert — fictional profiles, not health
              outcomes.
            </small>
          </div>
          <button className="primary" disabled={loading} onClick={run}>
            {loading ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <FlaskConical size={16} />
            )}
            {loading
              ? "Checking the evidence…"
              : data
                ? "Run again"
                : "Run an evaluation"}
          </button>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {!data && (
          <div className="eval-placeholder" role="status">
            {loading ? (
              <LoaderCircle className="spin" size={30} />
            ) : (
              <FlaskConical size={30} strokeWidth={1.3} />
            )}
            <h2>
              {loading
                ? "Following every thread."
                : "Real checks. Nothing pre-filled."}
            </h2>
            <p>
              {loading
                ? "Matching cultural items and checking their dates. This can take a few moments."
                : "Run an evaluation to see measured results from the live pipeline."}
            </p>
          </div>
        )}
        {data && (
          <>
            <div className="metric-grid">
              {[
                [
                  "01 / QLOO MATCHES",
                  data.pipeline.entityResolutionRate,
                  "Items that resolve to real Qloo entities",
                ],
                [
                  "02 / ERA EVIDENCE",
                  data.pipeline.eraWindowRate,
                  "Items independently confirmed inside the era",
                ],
                [
                  "03 / VERIFIED MEDIA",
                  data.pipeline.profileMediaCoverage,
                  "Profiles with at least one dated media item",
                ],
              ].map(([label, value, description]) => (
                <section key={label}>
                  <span className="metric-label">{label}</span>
                  <strong>{value === null ? "—" : `${value}%`}</strong>
                  <span>{description}</span>
                </section>
              ))}
            </div>
            <p className="eval-caption">
              {data.pipeline.itemsMeasured} items measured across{" "}
              {data.sampleProfiles} sample profiles.
              {!data.pipeline.itemsMeasured &&
                " No items were available to measure; in-window rate is not measured."}
            </p>
            <section className="baseline">
              <div>
                <p className="eyebrow">THE COMPARISON</p>
                <h2>LLM-only baseline</h2>
              </div>
              <p>{data.baseline.status}</p>
            </section>
            <p className="eval-note">{data.note}</p>
          </>
        )}
      </main>
      <footer className="site-footer">
        <div>
          <Link className="wordmark" href="/">
            echoes<span aria-hidden="true">✳</span>
          </Link>
          <span className="handwritten">A little more together.</span>
        </div>
        <p>
          Activity support for connection and pleasant moments.
          <br />
          Not medical advice. Always follow the person’s care plan.
        </p>
        <Link className="text-button" href="/">
          Back to Echoes <ArrowRight size={14} />
        </Link>
      </footer>
    </div>
  )
}
