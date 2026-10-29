"use client"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Check, LoaderCircle } from "lucide-react"
import { draftWrapUpNote } from "@/lib/echoes/note"
import type {
  Observation,
  SessionKit,
  SessionRecord,
  WrapUp,
} from "@/lib/echoes/types"

export default function SessionReview({
  kit,
  record,
  onSave,
  isSaved,
  saveError,
  storageMode,
}: {
  kit: SessionKit
  record?: SessionRecord
  onSave: (wrapUp: WrapUp, note: string) => void
  isSaved: boolean
  saveError: string
  storageMode: "protected" | "browser"
}) {
  const [observations, setObservations] = useState<Observation[]>(
    record?.wrapUp?.observations ??
      (record?.feedback ?? []).flatMap((f) => {
        const activity = kit.activities?.find((a) => a.itemId === f.entityId)
        return activity
          ? [
              {
                activityId: activity.id,
                entityId: f.entityId,
                status:
                  f.status === "distressed"
                    ? ("distress" as const)
                    : f.status === "not_for_us"
                      ? ("not_for_us" as const)
                      : f.status === "neutral"
                        ? ("no_response" as const)
                        : ("engaged" as const),
              },
            ]
          : []
      })
  )
  const [engagement, setEngagement] = useState<1 | 2 | 3 | null>(
    record?.engagement ?? null
  )
  const [caregiverNote, setCaregiverNote] = useState(
    record?.wrapUp?.caregiverNote ?? ""
  )
  const [note, setNote] = useState(record?.noteDraft ?? "")
  const [message, setMessage] = useState("")
  const [dirty, setDirty] = useState(false)
  const [completionOpen, setCompletionOpen] = useState(false)
  const completionDialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (completionOpen) completionDialog.current?.showModal()
    else completionDialog.current?.close()
  }, [completionOpen])
  const wrapUp = (): WrapUp => ({
    recordedAt: new Date().toISOString(),
    observations,
    engagement,
    caregiverNote,
  })
  const change = (activityId: string, patch: Partial<Observation>) => {
    const activity = kit.activities?.find((a) => a.id === activityId)
    const previous = observations.find((o) => o.activityId === activityId)
    setObservations([
      ...observations.filter((o) => o.activityId !== activityId),
      {
        activityId,
        entityId: activity?.itemId,
        status: previous?.status ?? "shared_story",
        ...previous,
        ...patch,
        ...(patch.status && patch.status !== "shared_story"
          ? { story: undefined }
          : {}),
      },
    ])
    setDirty(true)
    setMessage("")
  }
  return (
    <section className="session-review card" aria-labelledby="review-title">
      <p className="eyebrow">TWO-MINUTE WRAP-UP</p>
      <h2 id="review-title">What did you notice?</h2>
      <p>
        All feedback is optional. Leave an activity blank if you didn’t observe
        a response; blank never means “no response”.
      </p>
      {(kit.activities ?? [])
        .filter((a) => a.kind !== "welcome" && a.kind !== "closing")
        .map((activity) => (
          <fieldset key={activity.id}>
            <legend>{activity.title}</legend>
            <div className="response-options">
              {(
                [
                  ["engaged", "Engaged"],
                  ["not_for_us", "Not for us"],
                  ["no_response", "No response"],
                  ["distress", "Distress"],
                  ["shared_story", "Shared a story"],
                  ["not_used", "Not used"],
                ] as const
              ).map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={
                    observations.find((o) => o.activityId === activity.id)
                      ?.status === value
                  }
                  onClick={() => change(activity.id, { status: value })}
                >
                  {label}
                </button>
              ))}
            </div>
            {observations.find((o) => o.activityId === activity.id)?.status ===
              "shared_story" && (
              <label>
                Optional words or context, as observed
                <textarea
                  maxLength={600}
                  value={
                    observations.find((o) => o.activityId === activity.id)
                      ?.story ?? ""
                  }
                  onChange={(e) =>
                    change(activity.id, { story: e.target.value })
                  }
                />
              </label>
            )}
          </fieldset>
        ))}
      {observations.some((o) => o.status === "distress") && (
        <p className="notice" role="status">
          If distress is happening now, stop the stimulus and follow the
          person’s established comfort approach. This stimulus will be excluded
          from future discovery.
        </p>
      )}
      <fieldset>
        <legend>Overall engagement (optional)</legend>
        <div className="response-options">
          {([1, 2, 3] as const).map((n) => (
            <button
              key={n}
              aria-pressed={engagement === n}
              onClick={() => {
                setEngagement(engagement === n ? null : n)
                setDirty(true)
              }}
            >
              {n === 1 ? "Low" : n === 2 ? "Some" : "Strong"}
            </button>
          ))}
        </div>
      </fieldset>
      <label>
        Anything else for the next caregiver? (optional)
        <textarea
          maxLength={1200}
          value={caregiverNote}
          onChange={(e) => {
            setCaregiverNote(e.target.value)
            setDirty(true)
          }}
        />
      </label>
      <button
        className="secondary"
        onClick={() => {
          setNote(draftWrapUpNote(kit, wrapUp()))
          setDirty(false)
          setMessage(
            "Draft uses only the observations above. Review before copying."
          )
        }}
      >
        Generate note from observations
      </button>
      {note && (
        <label>
          Editable session note
          <textarea
            className="session-note-editor"
            value={note}
            maxLength={5000}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      )}
      {dirty && note && (
        <p className="notice">
          Observations changed after this draft. Regenerate the note or review
          it before saving.
        </p>
      )}
      <div className="review-actions">
        <button
          className="primary"
          onClick={() => {
            const data = wrapUp()
            const draft = note && !dirty ? note : draftWrapUpNote(kit, data)
            setNote(draft)
            setDirty(false)
            onSave(data, draft)
            setMessage("")
            setCompletionOpen(true)
          }}
        >
          Save review & memory
        </button>
        <button
          className="secondary"
          disabled={!note || dirty}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(note)
              setMessage("Session note copied.")
            } catch {
              setMessage(
                "Copy is unavailable. Select the note text and copy it manually."
              )
            }
          }}
        >
          Copy note
        </button>
      </div>
      {message && <p role="status">{message}</p>}
      <dialog
        ref={completionDialog}
        className="completion-dialog"
        aria-labelledby="completion-title"
        aria-describedby="completion-description"
        onClose={() => setCompletionOpen(false)}
      >
        <div
          className={`completion-icon ${!isSaved && !saveError ? "is-saving" : ""}`}
          aria-hidden="true"
        >
          {isSaved ? (
            <Check size={28} />
          ) : !saveError ? (
            <LoaderCircle size={28} />
          ) : (
            "!"
          )}
        </div>
        <div role="status" aria-live="polite">
          <h2 id="completion-title">
            {saveError
              ? "Your review couldn’t be saved"
              : isSaved
                ? "Your session is complete"
                : "Saving your review…"}
          </h2>
          <p id="completion-description">
            {saveError ||
              (isSaved
                ? `Your observations and note are saved ${storageMode === "browser" ? "in this browser" : "to your workspace"}, ready for next time.`
                : "Keep this page open for a moment while we save your observations and note.")}
          </p>
        </div>
        <div className="completion-actions">
          {isSaved && !saveError && (
            <Link className="primary" href="/dashboard">
              Back to dashboard
            </Link>
          )}
          <button
            className="secondary"
            autoFocus
            onClick={() => setCompletionOpen(false)}
          >
            {saveError ? "Back to review" : "Stay on review"}
          </button>
        </div>
      </dialog>
    </section>
  )
}
