"use client"
import { useEffect, useState } from "react"
import type { FamilySubmission } from "@/lib/echoes/secure-store"

export function WorkspaceUnlock({
  onUnlock,
  onBack,
}: {
  onUnlock: (code: string) => Promise<void>
  onBack: () => void
}) {
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  return (
    <main className="access-page card">
      <p className="wordmark">echoes</p>
      <h1>Caregiver workspace</h1>
      <p>
        Unlock this shared tablet using your site’s caregiver passphrase. Never
        share it with families.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          try {
            await onUnlock(code)
            setCode("")
          } catch (error) {
            setError(error instanceof Error ? error.message : "Unlock failed")
          } finally {
            setBusy(false)
          }
        }}
      >
        <label>
          Caregiver passphrase
          <input
            type="password"
            autoComplete="current-password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            maxLength={200}
          />
        </label>
        <button className="primary" disabled={busy}>
          {busy ? "Unlocking…" : "Unlock workspace"}
        </button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="secondary" onClick={onBack}>
        Back to Echoes
      </button>
    </main>
  )
}

type Invite = { id: string; residentId: string; expires: number; used: boolean }
export function FamilyPanel({
  residentId,
  enabled,
  saved,
  onAccepted,
}: {
  residentId: string
  enabled: boolean
  saved: boolean
  onAccepted: () => Promise<void>
}) {
  const [authority, setAuthority] = useState(false)
  const [link, setLink] = useState("")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [submissions, setSubmissions] = useState<FamilySubmission[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const refresh = async () => {
    const response = await fetch("/api/echoes/family", { cache: "no-store" })
    const data = await response.json()
    if (!response.ok)
      throw Error(data.error || "Could not load family responses")
    setSubmissions(data.submissions)
    setInvites(data.invites)
  }
  useEffect(() => {
    if (!enabled) return
    let active = true
    fetch("/api/echoes/family", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json()
        if (!active) return
        if (!response.ok) {
          setMessage(data.error || "Family inbox unavailable")
          return
        }
        setSubmissions(data.submissions)
        setInvites(data.invites)
      })
      .catch(() => {
        if (active) setMessage("Family inbox unavailable")
      })
    return () => {
      active = false
    }
  }, [enabled])
  const act = async (action: string, id?: string) => {
    setBusy(true)
    setMessage("")
    try {
      const response = await fetch("/api/echoes/family", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, residentId, id, authority }),
      })
      const data = await response.json()
      if (!response.ok) throw Error(data.error || "Family action failed")
      if (data.url) {
        setLink(data.url)
        setMessage(
          `Link expires ${new Date(data.expires).toLocaleDateString()}. It can be submitted once.`
        )
      }
      if (action === "revoke") {
        setLink("")
        setMessage("Link revoked.")
      }
      if (action === "accept") {
        await onAccepted()
        setMessage("Family information reviewed and saved with its source.")
      }
      await refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed")
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="family-panel card">
      <h3>Invite their family</h3>
      {!enabled ? (
        <p>
          Protected server storage must be configured before family links are
          available. Browser workspace fragments are not shareable intake links.
        </p>
      ) : (
        <>
          <p>
            A private, one-use form. The family cannot see existing care
            records. Share only with the intended, authorised contributor;
            anyone holding the link can submit.
          </p>
          <label className="check-label">
            <input
              type="checkbox"
              checked={authority}
              onChange={(e) => setAuthority(e.target.checked)}
            />
            I have authority to invite this contributor and review their
            information.
          </label>
          <button
            className="secondary"
            disabled={!authority || !saved || busy}
            onClick={() => void act("invite")}
          >
            Create family intake link
          </button>
          {link && (
            <label>
              Share privately
              <input readOnly value={link} onFocus={(e) => e.target.select()} />
              <button
                className="secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link)
                    setMessage(
                      "Link copied. Share privately with the intended family member."
                    )
                  } catch {
                    setMessage("Select the link and copy it manually.")
                  }
                }}
              >
                Copy link
              </button>
            </label>
          )}
          {invites
            .filter((i) => i.residentId === residentId)
            .map((i) => (
              <div key={i.id}>
                <p>
                  {i.used ? "Submitted" : "Awaiting family"} · expires{" "}
                  {new Date(i.expires).toLocaleDateString()}
                </p>
                <button
                  className="secondary"
                  disabled={!authority || busy}
                  onClick={() => void act("revoke", i.id)}
                >
                  Revoke link
                </button>
              </div>
            ))}
          <button
            className="text-button"
            disabled={busy}
            onClick={() => void refresh().catch((e) => setMessage(e.message))}
          >
            Check for family responses
          </button>
          {submissions
            .filter((s) => s.residentId === residentId)
            .map((s) => (
              <article key={s.id}>
                <h4>Review family information</h4>
                <p>
                  {s.relationship} ·{" "}
                  {new Date(s.receivedAt).toLocaleDateString()} ·
                  consent/authority attested
                </p>
                <dl>
                  {Object.entries(s.profile)
                    .filter(([key]) => key !== "consent")
                    .map(([key, value]) => (
                      <div key={key}>
                        <dt>{key}</dt>
                        <dd>
                          {Array.isArray(value)
                            ? value.join(", ")
                            : String(value)}
                        </dd>
                      </div>
                    ))}
                </dl>
                <p>
                  Accepting replaces this resident’s profile fields. Check the
                  details with the person or an authorised caregiver first.
                </p>
                <button
                  className="primary"
                  disabled={!authority || !saved || busy}
                  onClick={() => void act("accept", s.id)}
                >
                  Reviewed — accept profile
                </button>
                <button
                  className="secondary"
                  disabled={!authority || busy}
                  onClick={() => void act("dismiss", s.id)}
                >
                  Dismiss submission
                </button>
              </article>
            ))}
        </>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  )
}
