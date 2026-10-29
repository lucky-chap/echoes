"use client"
import { useEffect, useState } from "react"
import type { FeedbackRecord, SessionKit } from "@/lib/echoes/types"
import { followThread } from "@/lib/echoes/planner"
import { mediaSearch } from "@/lib/echoes/media"
import MediaLinks from "./media-links"
import QlooArtwork from "./qloo-artwork"
import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react"

export default function LiveSession({
  kit,
  initialActivityId,
  onProgress,
  onFeedback,
  onClose,
  onFinish,
}: {
  kit: SessionKit
  initialActivityId?: string
  onProgress: (activityId: string) => void
  onFeedback: (record: FeedbackRecord) => void
  onClose: () => void
  onFinish: () => void
}) {
  const [index, setIndex] = useState(() => {
    const restored = kit.activities?.findIndex(
      (activity) => activity.id === initialActivityId
    )
    return restored && restored >= 0 ? restored : 0
  })
  const [seconds, setSeconds] = useState(1800)
  const [paused, setPaused] = useState(false)
  const [distress, setDistress] = useState(false)
  const [presented, setPresented] = useState<string[]>([])
  const activities = kit.activities ?? []
  const activity = activities[index]
  const item = kit.items.find((i) => i.entityId === activity?.itemId)
  const manual =
    !item &&
    kit.dateChecks?.find(
      (c) => c.favorite && c.entity.entityId === activity?.itemId
    )
  useEffect(() => {
    if (activity) {
      onProgress(activity.id)
    }
  }, [activity, onProgress])
  const rememberActivity = () => {
    if (activity?.kind === "media")
      setPresented((previous) =>
        previous.includes(activity.id) ? previous : [...previous, activity.id]
      )
  }
  useEffect(() => {
    if (paused || !activity) return
    const timer = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(timer)
  }, [paused, activity])
  if (!activity)
    return (
      <section className="card">
        <h2>This older kit needs a new plan.</h2>
        <button className="secondary" onClick={onClose}>
          Back to the kit
        </button>
      </section>
    )
  return (
    <section className="live-session card">
      <div className="live-top">
        <div>
          <p className="eyebrow">FOLLOW THEIR LEAD</p>
          <div className="live-timer">
            <strong>
              {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
            </strong>
            <button
              className="timer-toggle"
              aria-label={paused ? "Resume timer" : "Pause timer"}
              onClick={() => setPaused(!paused)}
            >
              {paused ? <Play size={20} /> : <Pause size={20} />}
            </button>
          </div>
        </div>
        <button className="secondary" onClick={onClose}>
          Back to the kit
        </button>
      </div>
      <div className="activity-stage" key={activity.id}>
        <div className="live-item">
          <h1>{activity.title}</h1>
          {item && <QlooArtwork item={item} />}
        </div>
        <p className="live-invitation">
          {activity.id === "conversation"
            ? followThread(
                activities.filter((a) => presented.includes(a.id)),
                kit.residents[0]
              )
            : activity.prompt}
        </p>
        {manual && manual.entity.type !== "urn:entity:book" && (
          <div className="live-media">
            <p>Named favourite · original date unknown</p>
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
          <div className="live-media">
            <p className="live-evidence">
              {item.name} · {item.yearEvidence.year} ·{" "}
              {item.yearEvidence.source}
              {item.yearEvidence.cached ? " (cached)" : ""}
            </p>
            <MediaLinks item={item} />
            <p className="media-hint">
              Preview the version and volume before sharing.
            </p>
          </div>
        )}
        {item && (
          <details>
            <summary>Optional: record a response now</summary>
            <div className="response-options">
              {(
                [
                  ["sparked", "Engaged"],
                  ["not_for_us", "Not for us"],
                  ["neutral", "No response"],
                  ["distressed", "Distress — stop stimulus"],
                ] as const
              ).map(([status, label]) => (
                <button
                  key={status}
                  onClick={() => {
                    onFeedback({
                      residentId: kit.residents[0].id,
                      entityId: item.entityId,
                      status,
                      sessionId: kit.id,
                      recordedAt: new Date().toISOString(),
                    })
                    if (status === "distressed") {
                      setPaused(true)
                      setDistress(true)
                    }
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </details>
        )}
        {distress && (
          <p className="error" role="alert">
            Stop the stimulus now and follow the person’s established comfort
            approach. The timer is paused and this item is excluded from future
            discovery. External media must be stopped in its playback tab.
          </p>
        )}
      </div>
      <footer className="live-footer">
        <p className="activity-count" role="status">
          Activity {index + 1} of {activities.length}
          <span>About {activity.minutes} minutes</span>
        </p>
        <div className="live-navigation">
          <div className="activity-navigation">
            <button
              className="secondary"
              disabled={index === 0}
              onClick={() => {
                rememberActivity()
                setIndex((i) => i - 1)
                setDistress(false)
              }}
            >
              <ArrowLeft size={16} /> Previous activity
            </button>
            <button
              className="primary"
              onClick={() => {
                rememberActivity()
                if (index === activities.length - 1) onFinish()
                else {
                  setIndex((i) => i + 1)
                  setDistress(false)
                }
              }}
            >
              {index === activities.length - 1
                ? "Finish & wrap up"
                : "Next activity"}
              <ArrowRight size={16} />
            </button>
          </div>
          <button className="text-button finish-early" onClick={onFinish}>
            Finish early & wrap up
          </button>
        </div>
        <p className="notice live-no-taps">
          No taps are needed during the session. Capture observations in the
          wrap-up.
        </p>
      </footer>
    </section>
  )
}
