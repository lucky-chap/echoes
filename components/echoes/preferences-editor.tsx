"use client"
import { useState } from "react"
import type {
  PersonPreferences,
  ResidentInput,
  ResponseHistory,
} from "@/lib/echoes/types"
import {
  emptyPreferences,
  confirmedPreferences,
  historyImportSchema,
  historySchema,
  mergeResponseHistory,
} from "@/lib/echoes/preferences"

const groups = {
  liked_traits: "Enjoys",
  disliked_traits: "Prefers to avoid",
} as const
export default function PreferencesEditor({
  resident,
  onChange,
  onExtract,
  extracting,
  demo,
}: {
  resident: ResidentInput
  onChange: (patch: Partial<ResidentInput>) => void
  onExtract: () => void
  extracting: boolean
  demo: boolean
}) {
  const prefs = resident.preferences ?? emptyPreferences()
  const [json, setJson] = useState("")
  const [error, setError] = useState("")
  const [past, setPast] = useState({
    item: "",
    domain: "music",
    traits: "",
    response: "sparked",
    note: "",
    session: "past-session",
  })
  const edit = (patch: Partial<PersonPreferences>) =>
    onChange({
      preferences: {
        ...prefs,
        ...patch,
        confirmed: false,
        sourceNotes: resident.notes ?? "",
      },
    })
  const addHistory = (entries: ResponseHistory[]) =>
    onChange({
      responseHistory: mergeResponseHistory(
        resident.responseHistory ?? [],
        entries
      ),
    })
  return (
    <section
      className="wide preference-editor"
      aria-label="Preferences and past responses"
    >
      <button
        type="button"
        className="secondary"
        disabled={
          extracting ||
          !resident.consent ||
          (resident.notes?.trim().length ?? 0) < 8
        }
        onClick={onExtract}
      >
        {extracting ? "Reading your note…" : "Help understand these notes"}
      </button>
      <p className="hint">
        The optional helper sends these notes to the configured language
        provider. Review the interests and avoid topics it found; session tips
        and practical details will appear with the finished plan.
      </p>
      {resident.notes?.trim() && !confirmedPreferences(resident).confirmed && (
        <p role="status" className="coverage-note">
          Your notes are saved, but their preferences are not yet confirmed.
          Review the summary below and confirm it to include personal activities
          and guidance in the plan.
        </p>
      )}
      <details
        open={Boolean(resident.preferences) || Boolean(resident.notes?.trim())}
      >
        <summary>What we understood — review and confirm</summary>
        {Object.entries(groups).map(([key, label]) => {
          const field = key as keyof typeof groups
          return (
            <div key={key} className="preference-group">
              <label>
                {label}
                <input
                  aria-label={label}
                  value={prefs[field].join(", ")}
                  onChange={(e) =>
                    edit({
                      [field]: e.target.value
                        .split(",")
                        .map((v) => v.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="Separate phrases with commas"
                />
              </label>
              <div className="preference-chips">
                {prefs[field].map((value, index) => (
                  <button
                    key={`${value}:${index}`}
                    type="button"
                    className="secondary"
                    aria-label={`Remove ${value}`}
                    onClick={() =>
                      edit({
                        [field]: prefs[field].filter((_, i) => i !== index),
                      })
                    }
                  >
                    {value} ×
                  </button>
                ))}
              </div>
            </div>
          )
        })}
        <label className="check-label">
          <input
            type="checkbox"
            checked={
              prefs.confirmed && prefs.sourceNotes === (resident.notes ?? "")
            }
            onChange={(e) =>
              onChange({
                preferences: {
                  ...prefs,
                  confirmed: e.target.checked,
                  sourceNotes: resident.notes ?? "",
                },
              })
            }
          />
          I reviewed and confirm these preferences
        </label>
      </details>
      <details>
        <summary>
          Past responses ({resident.responseHistory?.length ?? 0})
        </summary>
        <p>
          Record a response to a particular item; “not for us” lowers similar
          traits without excluding an entire artist.
        </p>
        <label>
          Past item
          <input
            value={past.item}
            onChange={(e) => setPast({ ...past, item: e.target.value })}
          />
        </label>
        <label>
          Domain
          <select
            value={past.domain}
            onChange={(e) => setPast({ ...past, domain: e.target.value })}
          >
            {["music", "film", "television", "book", "place"].map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
        <label>
          Traits observed
          <input
            value={past.traits}
            onChange={(e) => setPast({ ...past, traits: e.target.value })}
            placeholder="e.g. upbeat, call-and-response"
          />
        </label>
        <label>
          Response
          <select
            value={past.response}
            onChange={(e) => setPast({ ...past, response: e.target.value })}
          >
            <option value="sparked">Sparked</option>
            <option value="not_for_us">Not for us</option>
          </select>
        </label>
        <label>
          Response note
          <input
            value={past.note}
            onChange={(e) => setPast({ ...past, note: e.target.value })}
          />
        </label>
        <label>
          Session reference
          <input
            value={past.session}
            onChange={(e) => setPast({ ...past, session: e.target.value })}
          />
        </label>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            const parsed = historySchema.safeParse({
              ...past,
              traits: past.traits
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
            if (!parsed.success) {
              setError(
                "Enter an item, session reference, and valid short details."
              )
              return
            }
            addHistory([parsed.data])
            setPast({ ...past, item: "", traits: "", note: "" })
            setError("")
          }}
        >
          Save past response
        </button>
        {demo && (
          <>
            <label>
              Import response history (JSON)
              <textarea
                value={json}
                onChange={(e) => setJson(e.target.value)}
                placeholder={
                  '[{"item":"Osibisa","domain":"music","traits":["dance"],"response":"sparked","note":"","session":"demo-1"}]'
                }
              />
            </label>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                try {
                  addHistory(historyImportSchema.parse(JSON.parse(json)))
                  setJson("")
                  setError("")
                } catch {
                  setError(
                    "Check the JSON: each entry needs item, domain, traits, response, and session."
                  )
                }
              }}
            >
              Import history
            </button>
          </>
        )}
        <ul>
          {(resident.responseHistory ?? []).map((h, i) => (
            <li key={`${h.session}:${h.item}:${i}`}>
              {h.item} · {h.response.replaceAll("_", " ")} ·{" "}
              {h.traits.join(", ")}{" "}
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  onChange({
                    responseHistory: resident.responseHistory?.filter(
                      (_, index) => index !== i
                    ),
                  })
                }
              >
                Remove response
              </button>
            </li>
          ))}
        </ul>
      </details>
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
