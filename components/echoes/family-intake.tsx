"use client"
import { useEffect, useState } from "react"
export default function FamilyIntake() {
  const [token, setToken] = useState("")
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const value = window.location.hash.slice(1)
    queueMicrotask(() => setToken(/^[a-f\d]{64}$/.test(value) ? value : ""))
    window.history.replaceState(null, "", window.location.pathname)
  }, [])
  return (
    <main className="family-intake access-page card">
      <p className="wordmark">echoes</p>
      <p className="eyebrow">PRIVATE FAMILY INTAKE</p>
      <h1>A little about their life.</h1>
      {done ? (
        <p role="status">
          Thank you. The caregiver will review what you shared before using it.
          This one-use link can no longer be submitted.
        </p>
      ) : (
        <>
          <p>
            Share only what you are comfortable and authorised to share. Use no
            full names, contact details, diagnoses, or medical records. The care
            team will review this information; it is not sent directly to
            discovery services by this form.
          </p>
          {!token && (
            <p className="notice">
              Open the private link sent by the caregiver. If you refreshed this
              page, reopen that link.
            </p>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              const values = new FormData(e.currentTarget)
              setBusy(true)
              setError("")
              const value = (name: string) =>
                String(values.get(name) ?? "").trim()
              try {
                const response = await fetch("/api/echoes/family", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "submit",
                    token,
                    authority: values.get("authority") === "on",
                    relationship: value("relationship"),
                    profile: {
                      birthYear: Number(value("birthYear")),
                      hometown: value("hometown"),
                      country: value("country"),
                      language: value("language"),
                      lovedThings: [
                        value("music"),
                        value("film"),
                        value("tv"),
                      ].filter(Boolean),
                      sensitivities: value("avoid")
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                      importantMemories: value("memories"),
                    },
                  }),
                })
                const data = await response.json()
                if (!response.ok)
                  throw Error(data.error || "Could not submit this form")
                e.currentTarget?.reset()
                setDone(true)
                setToken("")
              } catch (error) {
                setError(
                  error instanceof Error ? error.message : "Submission failed"
                )
              } finally {
                setBusy(false)
              }
            }}
          >
            <label>
              Your relationship (no name needed)
              <input
                name="relationship"
                required
                maxLength={80}
                placeholder="e.g. daughter, partner, authorised representative"
              />
            </label>
            <div className="family-grid">
              <label>
                Birth year
                <input
                  name="birthYear"
                  type="number"
                  min={1900}
                  max={new Date().getFullYear() - 13}
                  required
                />
              </label>
              <label>
                Preferred language
                <input name="language" required maxLength={40} />
              </label>
              <label>
                Hometown or region
                <input name="hometown" required maxLength={100} />
              </label>
              <label>
                Country
                <input name="country" required maxLength={60} />
              </label>
            </div>
            <p>
              Add at least one favourite below. One artist or title per field is
              enough.
            </p>
            <label>
              Favourite musician or band
              <input name="music" maxLength={100} />
            </label>
            <label>
              Favourite film
              <input name="film" maxLength={100} />
            </label>
            <label>
              Favourite TV programme
              <input name="tv" maxLength={100} />
            </label>
            <label>
              Important memories and everyday pleasures (optional)
              <textarea name="memories" maxLength={1200} />
            </label>
            <label>
              Things to avoid (optional, separated by commas)
              <input name="avoid" maxLength={500} />
            </label>
            <label className="check-label">
              <input type="checkbox" name="authority" required />I have the
              person’s consent or appropriate authority to share this
              information with their care team for activity planning. I
              understand the caregiver will review it, and I can ask the care
              team to correct or remove it.
            </label>
            <button className="primary" disabled={!token || busy}>
              {busy ? "Sending securely…" : "Send to their caregiver"}
            </button>
          </form>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </>
      )}
    </main>
  )
}
