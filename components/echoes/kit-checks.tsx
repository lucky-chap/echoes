"use client"
import { useEffect, useRef, useState } from "react"
import { coverageSummary } from "@/lib/echoes/coverage"
import type {
  FeedbackRecord,
  ResidentInput,
  SessionKit,
} from "@/lib/echoes/types"
export default function KitChecks({
  kit,
  resident,
  feedback,
  onChange,
  onResolve,
  resolving = false,
}: {
  kit: SessionKit
  resolving?: boolean
  resident?: ResidentInput
  feedback: FeedbackRecord[]
  onChange: (kit: SessionKit) => void
  onResolve: (
    query: string,
    candidate: NonNullable<
      SessionKit["resolutionChoices"]
    >[number]["candidates"][number]
  ) => void
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("")
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  const status = coverageSummary(kit)
  return (
    <div className="kit-checks">
      {(kit.resolutionChoices ?? []).map((choice) => (
        <fieldset className="resolution-choice" key={choice.query}>
          <legend>Did you mean one of these for “{choice.query}”?</legend>
          {choice.candidates.map((candidate) => (
            <button
              className="secondary"
              key={candidate.entityId}
              disabled={resolving || busy}
              onClick={() => onResolve(choice.query, candidate)}
            >
              <strong>{candidate.name}</strong>
              <small>
                {[
                  candidate.type.replace("urn:entity:", "").replace("_", " "),
                  candidate.properties.country,
                  candidate.properties.start_year
                    ? `active from ${candidate.properties.start_year}`
                    : null,
                  candidate.description,
                ]
                  .filter(
                    (value) =>
                      typeof value === "string" || typeof value === "number"
                  )
                  .join(" · ")
                  .slice(0, 240)}
              </small>
            </button>
          ))}
        </fieldset>
      ))}
      {status.showFew && (
        <p className="coverage-note">
          Less personalised: we found few dated items from this era. Add another
          favourite for broader results.
        </p>
      )}
      {status.pending.length > 0 && (
        <section
          className="pending-checks"
          aria-labelledby="pending-checks-title"
        >
          <p role="status">
            {status.pending.length} date checks remain incomplete, so these
            items are held back.
          </p>
          <button
            className="secondary"
            disabled={busy || resolving || !resident}
            onClick={async () => {
              setBusy(true)
              setError("")
              controller.current = new AbortController()
              try {
                const response = await fetch("/api/echoes/kit/retry", {
                  method: "POST",
                  signal: controller.current.signal,
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ kit, resident, feedback }),
                })
                const body = await response.json()
                if (!response.ok)
                  throw Error(body.error || "Date checks could not be retried")
                onChange(body.kit)
              } catch (error) {
                setError(
                  error instanceof Error ? error.message : "Retry unavailable"
                )
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? "Checking…" : "Retry checking"}
          </button>
          <h3 id="pending-checks-title">Checks still needed</h3>
          <ul>
            {status.pending.map((check) => (
              <li key={check.entity.entityId}>
                <strong>{check.entity.name}</strong>
                <span>{check.reason}</span>
              </li>
            ))}
          </ul>
          <p>
            Coverage based on {status.completed} checked items;{" "}
            {status.pending.length} still awaiting a result.
          </p>
        </section>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  )
}
