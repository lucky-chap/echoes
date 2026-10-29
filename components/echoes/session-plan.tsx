"use client"
import type { Activity, ResidentInput, SessionKit } from "@/lib/echoes/types"
import { sentences } from "@/lib/echoes/text"
import { mediaSearch } from "@/lib/echoes/media"
import {
  rebalancePlan,
  itemPrompt,
  replacementPrompt,
} from "@/lib/echoes/planner"
import MediaLinks from "./media-links"
import QlooArtwork from "./qloo-artwork"

export default function SessionPlan({
  kit,
  resident,
  onChange,
}: {
  kit: SessionKit
  resident?: ResidentInput
  onChange: (kit: SessionKit) => void
}) {
  const activities = kit.activities ?? []
  const pool = [
    ...new Map(
      [...kit.items, ...(kit.alternatives ?? [])].map((i) => [i.entityId, i])
    ).values(),
  ]
  const update = (next: Activity[], rebalance = false) => {
    const plan = rebalance
      ? rebalancePlan(next, {
          ...kit.residents[0],
          birthYear: 0,
          country: "",
          lovedThings: [],
          sensitivities: [],
        })
      : next
    const used = new Set(plan.flatMap((a) => (a.itemId ? [a.itemId] : [])))
    onChange({
      ...kit,
      activities: plan,
      prompts: plan.filter((a) => a.kind !== "media").map((a) => a.prompt),
      items: pool.filter((i) => used.has(i.entityId)),
      alternatives: pool.filter((i) => !used.has(i.entityId)),
    })
  }
  const move = (activity: Activity, direction: -1 | 1) => {
    const editable = activities.filter((a) => !a.id.startsWith("pause:"))
    const index = editable.findIndex((a) => a.id === activity.id)
    const target = index + direction
    if (target <= 0 || target >= editable.length - 1) return
    ;[editable[index], editable[target]] = [editable[target], editable[index]]
    update(editable, true)
  }
  return (
    <section className="plan-editor" aria-labelledby="plan-title">
      <div className="panel-title">
        <h2 id="plan-title">Your running order</h2>
        <p>
          Skim the plan, then start when it feels right. You can pause, skip, or
          finish early at any point.
        </p>
      </div>
      {kit.notes
        .filter((note) => /^(No (film|TV|book)|Less personalised:)/.test(note))
        .map((note) => (
          <p className="coverage-note" key={note}>
            {note}
          </p>
        ))}
      {(kit.dateChecks ?? [])
        .filter(
          (check) =>
            check.favorite &&
            !activities.some((a) => a.itemId === check.entity.entityId)
        )
        .map((check) => {
          const favorite = pool.find(
            (i) => i.entityId === check.entity.entityId
          )
          return (
            <div className="activity-card" key={check.entity.entityId}>
              <strong>{check.entity.name} · Named favourite</strong>
              <p>
                {favorite?.eraLabel ??
                  (favorite
                    ? "Available to add to this running order"
                    : `Original date unknown or unverified. ${check.reason}`)}
              </p>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  update(
                    [
                      ...activities.slice(0, -1),
                      {
                        id: `media:${check.entity.entityId}`,
                        kind:
                          check.entity.type === "urn:entity:book"
                            ? "conversation"
                            : "media",
                        title: check.entity.name,
                        itemId: check.entity.entityId,
                        minutes: 4,
                        prompt: favorite
                          ? itemPrompt(
                              favorite,
                              activities.filter((a) => a.kind === "media")
                                .length
                            )
                          : `What would you like to hear from ${check.entity.name}, or would you prefer to skip it?`,
                        rationale: favorite
                          ? sentences(favorite.whyItFits)
                          : "Included at the caregiver’s request; original date unknown, outside the verified discovery pool.",
                        approved: true,
                      },
                      ...activities.slice(-1),
                    ],
                    true
                  )
                }
              >
                {favorite ? "Add named favourite" : "Include anyway"}
              </button>
            </div>
          )
        })}
      <ol className="activity-list">
        {activities.map((activity, index) => {
          const from = activities
            .slice(0, index)
            .reduce((sum, entry) => sum + entry.minutes, 0)
          const minute = from + activity.minutes
          const item = pool.find((i) => i.entityId === activity.itemId)
          const manual =
            !item &&
            kit.dateChecks?.find(
              (c) => c.favorite && c.entity.entityId === activity.itemId
            )
          const replacements = pool.filter(
            (i) =>
              i.kind === item?.kind &&
              i.entityId !== item?.entityId &&
              !activities.some((a) => a.itemId === i.entityId)
          )
          return (
            <li className="activity-card" key={activity.id}>
              <div className="activity-heading">
                <span>
                  {from}–{minute} min
                </span>
                <h3>{activity.title}</h3>
              </div>
              <p className="activity-prompt">{activity.prompt}</p>
              <p>{activity.rationale}</p>
              {manual && manual.entity.type !== "urn:entity:book" && (
                <div className="media-options">
                  <span className="year-evidence">
                    Named favourite · original date unknown
                  </span>
                  <a
                    className="media-link"
                    href={mediaSearch(manual.entity.name)[0].url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Find this
                  </a>
                </div>
              )}
              {item && (
                <div className="media-options">
                  <QlooArtwork item={item} />
                  <span className="year-evidence">
                    {item.namedFavorite ? "Named favourite · " : ""}
                    {item.yearEvidence.source}
                    {item.yearEvidence.cached ? " (cached)" : ""}{" "}
                    {item.yearEvidence.firstAirYear &&
                    item.yearEvidence.lastAirYear
                      ? `${item.yearEvidence.firstAirYear}–${item.yearEvidence.lastAirYear}`
                      : item.yearEvidence.year}
                  </span>
                  <MediaLinks item={item} />
                  <details className="media-details">
                    <summary>Details</summary>
                    <p>{item.media?.[0]?.instructions}</p>
                    <p>{item.whyItFits.join(" ")}</p>
                  </details>
                </div>
              )}
              <details
                className="activity-controls"
                hidden={activity.id.startsWith("pause:")}
              >
                <summary>Adjust this activity</summary>
                {activity.kind !== "welcome" && activity.kind !== "closing" && (
                  <>
                    <button
                      className="secondary"
                      disabled={index <= 1}
                      aria-label={`Move ${activity.title} up`}
                      onClick={() => move(activity, -1)}
                    >
                      ↑ Up
                    </button>
                    <button
                      className="secondary"
                      disabled={index >= activities.length - 2}
                      aria-label={`Move ${activity.title} down`}
                      onClick={() => move(activity, 1)}
                    >
                      ↓ Down
                    </button>
                    <button
                      className="secondary"
                      onClick={() =>
                        update(
                          activities.filter((a) => a.id !== activity.id),
                          true
                        )
                      }
                    >
                      Remove
                    </button>
                    {item && replacements.length > 0 && (
                      <label>
                        Replace with
                        <select
                          value=""
                          onChange={(e) => {
                            const replacement = pool.find(
                              (i) => i.entityId === e.target.value
                            )
                            if (replacement)
                              update(
                                activities.map((a) =>
                                  a.id === activity.id
                                    ? {
                                        ...a,
                                        id: `media:${replacement.entityId}`,
                                        title: replacement.name,
                                        kind:
                                          replacement.kind === "book"
                                            ? "conversation"
                                            : "media",
                                        itemId: replacement.entityId,
                                        rationale: sentences(
                                          replacement.whyItFits
                                        ),
                                        prompt: replacementPrompt(
                                          replacement,
                                          activities.filter(
                                            (a) => a.id !== activity.id
                                          ),
                                          pool,
                                          resident ?? {
                                            ...kit.residents[0],
                                            birthYear: 0,
                                            country: "",
                                            lovedThings: [],
                                            sensitivities: [],
                                          }
                                        ),
                                      }
                                    : a
                                ),
                                true
                              )
                          }}
                        >
                          <option value="">
                            Choose a verified alternative
                          </option>
                          {replacements.map((i) => (
                            <option key={i.entityId} value={i.entityId}>
                              {i.name} · {i.yearEvidence.year}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </>
                )}
              </details>
            </li>
          )
        })}
      </ol>
      {!kit.alternatives?.length && (
        <p>
          No additional verified alternatives are available. Remove an activity
          for a non-media plan, or rerun discovery from the profile.
        </p>
      )}
    </section>
  )
}
