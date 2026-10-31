import type { EchoesKind, SessionKit } from "@/lib/echoes/types"
import { qlooAdded, type HeldBackReason } from "@/lib/echoes/qloo-summary"

const domainLabels: Record<EchoesKind, string> = {
  music: "Music",
  film: "Film",
  television: "TV",
  book: "Books",
  place: "Places",
}

const heldBackLabels: Record<HeldBackReason, string> = {
  outside_years: "Outside the release-year range",
  region: "Not plausible for the region",
  avoid_topic: "Matched an avoid topic",
  other: "Other checks",
}

export default function QlooAdded({ kit }: { kit: SessionKit }) {
  const summary = qlooAdded(kit)
  if (!summary.hasData) return null

  const candidateTotal = summary.candidatesByDomain.reduce(
    (total, entry) => total + entry.count,
    0
  )
  const heldBackTotal = summary.heldBack.reduce(
    (total, entry) => total + entry.count,
    0
  )

  return (
    <section className="qloo-added" aria-labelledby="qloo-added-title">
      <p className="eyebrow">FROM THE EXISTING TRACE</p>
      <h2 id="qloo-added-title">What Qloo added</h2>
      <p className="qloo-added-intro">
        Qloo suggested these possibilities. This is an aggregate view, not a
        prediction; familiarity is unconfirmed.
      </p>

      {candidateTotal > 0 && (
        <div className="qloo-added-group">
          <h3>Qloo suggested candidates</h3>
          <ul className="qloo-added-list">
            {summary.candidatesByDomain.map((entry) => (
              <li key={entry.kind}>
                <span>{domainLabels[entry.kind]}</span>
                <strong>{entry.count}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.passedChecks > 0 && (
        <p className="qloo-added-passed">
          <strong>{summary.passedChecks}</strong> passed our checks.
        </p>
      )}

      {heldBackTotal > 0 && (
        <div className="qloo-added-group">
          <h3>Held back</h3>
          <ul className="qloo-added-list">
            {summary.heldBack.map((entry) => (
              <li key={entry.reason}>
                <span>{heldBackLabels[entry.reason]}</span>
                <strong>{entry.count}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(summary.filters.country ||
        summary.filters.years ||
        summary.filters.regionalTag) && (
        <div className="qloo-added-group">
          <h3>Filters sent</h3>
          <dl className="qloo-added-filters">
            {summary.filters.country && (
              <>
                <dt>Country</dt>
                <dd>{summary.filters.country}</dd>
              </>
            )}
            {summary.filters.years && (
              <>
                <dt>Release-year range</dt>
                <dd>{summary.filters.years}</dd>
              </>
            )}
            {summary.filters.regionalTag && (
              <>
                <dt>Regional tag</dt>
                <dd>{summary.filters.regionalTag}</dd>
              </>
            )}
          </dl>
        </div>
      )}
    </section>
  )
}
