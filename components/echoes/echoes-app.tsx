"use client"
import { itemDateLabel, logisticsSentence } from "@/lib/echoes/text"

import PreferencesEditor from "./preferences-editor"
import {
  confirmedPreferences,
  migrateResidentNotes,
  mergeResponseHistory,
} from "@/lib/echoes/preferences"
import { demoProfiles } from "@/lib/echoes/demos"
import { mergeFeedback } from "@/lib/echoes/feedback"
import type {
  FeedbackRecord,
  ResidentInput,
  SessionKit,
} from "@/lib/echoes/types"
import { browserWorkspaceStorage } from "@/lib/echoes/browser-storage"
import LiveSession from "./live-session"
import SessionPlan from "./session-plan"
import KitTabs from "./kit-tabs"
import KitChecks from "./kit-checks"
import SessionReview from "./session-review"
import { useWorkspace, blankResident } from "./use-workspace"
import { WorkspaceUnlock, FamilyPanel } from "./workspace-access"
import {
  confirmProfile,
  relevantMemories,
  saveWrapUp,
} from "@/lib/echoes/memory"
import {
  ConnectionIllustration,
  MemoryIllustration,
  RecordIllustration,
} from "./illustrations"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Clock3,
  Heart,
  LoaderCircle,
  LockKeyhole,
  MessageCircle,
  Music2,
  Printer,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

export default function EchoesApp() {
  const {
    workspace,
    setWorkspace,
    ready,
    mode,
    locked,
    notice: storageNotice,
    saveState,
    isSaved,
    unlock,
    lock,
    reload,
    removeResident,
    retrySave,
  } = useWorkspace()
  const pathname = usePathname()
  type Screen = "home" | "dashboard" | "intake" | "kit" | "live" | "review"
  const [, routeScreen, sessionId] = pathname.split("/")
  const screen = (routeScreen || "home") as Screen
  const [activeKit, setKit] = useState<SessionKit | null>(null)
  const kit = sessionId
    ? (workspace.sessions.find((session) => session.id === sessionId)?.kit ??
      (activeKit?.id === sessionId ? activeKit : null))
    : activeKit
  const [extracting, setExtracting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [activeResidentId, setActiveResidentId] = useState("")
  const [residentSearch, setResidentSearch] = useState("")
  const requestController = useRef<AbortController | null>(null)
  const residents = [
    workspace.residents.find((r) => r.id === activeResidentId) ??
      workspace.residents[0],
  ].filter(Boolean)
  const feedback = workspace.feedback
  const kitResident = kit
    ? workspace.residents.find(
        (resident) => resident.id === kit.residents[0]?.id
      )
    : undefined
  const kitPreferences = kitResident
    ? confirmedPreferences(kitResident)
    : undefined

  useEffect(() => {
    if (locked) {
      requestController.current?.abort()
      queueMicrotask(() => {
        setKit(null)
        setResidentSearch("")
        setActiveResidentId("")
        setDeleteOpen(false)
      })
    }
  }, [locked])

  const navigate = (next: Screen, id = kit?.id) => {
    const path =
      next === "home"
        ? "/"
        : `/${next}${
            id && ["kit", "live", "review"].includes(next)
              ? `/${encodeURIComponent(id)}`
              : ""
          }`
    window.history.pushState(null, "", path)
    setError("")
    window.scrollTo({ top: 0, behavior: "instant" })
  }
  const saveProgress = useCallback(
    (activityId: string) => {
      if (!kit) return
      setWorkspace((current) => ({
        ...current,
        sessions: current.sessions.map((session) =>
          session.id === kit.id
            ? {
                ...session,
                progress: { activityId, updatedAt: new Date().toISOString() },
              }
            : session
        ),
      }))
    },
    [kit, setWorkspace]
  )
  const startSession = () => {
    if (!kit?.activities?.length) return
    const saved = workspace.sessions.find((session) => session.id === kit.id)
    const savedActivity = kit.activities.some(
      (activity) => activity.id === saved?.progress?.activityId
    )
      ? saved?.progress?.activityId
      : kit.activities[0].id
    if (!savedActivity) return
    saveProgress(savedActivity)
    navigate("live")
  }
  const setResidents = (
    next: ResidentInput[] | ((current: ResidentInput[]) => ResidentInput[])
  ) =>
    setWorkspace((current) => ({
      ...current,
      residents: typeof next === "function" ? next(current.residents) : next,
    }))
  const update = (index: number, patch: Partial<ResidentInput>) =>
    setResidents((current) =>
      current.map((resident) =>
        resident.id === residents[index]?.id
          ? { ...resident, ...patch }
          : resident
      )
    )
  const loadDemo = (all = false) => {
    const examples = (all ? demoProfiles : demoProfiles.slice(0, 1)).map(
      (resident) => ({
        ...resident,
        id: crypto.randomUUID(),
        consent: {
          authority: "caregiver" as const,
          recordedAt: new Date().toISOString(),
        },
      })
    )
    setResidents((current) =>
      [...current.filter((r) => r.nickname), ...examples].slice(0, 60)
    )
    setActiveResidentId(examples[0].id)
    navigate("intake")
  }
  const createKit = async (chosenResidents = residents) => {
    requestController.current = new AbortController()
    setLoading(true)
    setError("")
    try {
      const normalizedResidents = chosenResidents.map((resident) => ({
        ...migrateResidentNotes(resident),
        lovedThings: resident.lovedThings
          .map((item) => item.trim())
          .filter(Boolean),
        sensitivities: resident.sensitivities
          .map((item) => item.trim())
          .filter(Boolean),
      }))
      const response = await fetch("/api/echoes/kit", {
        signal: requestController.current.signal,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          residents: normalizedResidents,
          feedback: feedback.filter(
            (f) => f.residentId === normalizedResidents[0].id
          ),
          memories: relevantMemories(
            workspace.memories ?? [],
            normalizedResidents[0].id
          ),
        }),
      })
      const payload = await response.json()
      if (!response.ok)
        throw Error(payload.error || "Could not prepare a session kit.")
      setKit(payload.kit)
      setWorkspace((current) => ({
        ...current,
        memories: [
          ...confirmProfile(normalizedResidents[0], current.memories ?? []),
          ...payload.kit.items.map((item: SessionKit["items"][number]) => ({
            id: crypto.randomUUID(),
            residentId: normalizedResidents[0].id,
            kind: "discovery" as const,
            status: "suggested" as const,
            text: `${item.name}: Qloo suggestion, not a personal memory. ${item.yearEvidence.source}, ${item.yearEvidence.year}.`,
            source: "Qloo" as const,
            createdAt: payload.kit.createdAt,
            entityId: item.entityId,
            sessionId: payload.kit.id,
          })),
        ],
        traces: [...payload.kit.agentTrace, ...current.traces].slice(0, 200),
        sessions: [
          {
            id: payload.kit.id,
            createdAt: payload.kit.createdAt,
            kit: payload.kit,
            feedback: [],
            engagement: null,
            noteDraft: null,
            progress: payload.kit.activities?.[0]
              ? {
                  activityId: payload.kit.activities[0].id,
                  updatedAt: payload.kit.createdAt,
                }
              : undefined,
          },
          ...current.sessions,
        ].slice(0, 600),
      }))
      navigate("kit", payload.kit.id)
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not prepare a session kit."
      )
    } finally {
      setLoading(false)
    }
  }
  const recordFeedback = (
    residentId: string,
    entityId: string,
    status: FeedbackRecord["status"]
  ) => {
    setWorkspace((current) => ({
      ...current,
      residents: current.residents.map((r) =>
        r.id !== residentId
          ? r
          : {
              ...r,
              responseHistory: mergeResponseHistory(
                (r.responseHistory ?? []).filter(
                  (h) => !(h.session === kit?.id && h.entityId === entityId)
                ),
                status === "sparked" || status === "not_for_us"
                  ? [
                      {
                        item:
                          kit?.items.find((i) => i.entityId === entityId)
                            ?.name ?? "Activity",
                        domain:
                          kit?.items.find((i) => i.entityId === entityId)
                            ?.kind ?? "music",
                        traits:
                          kit?.items.find((i) => i.entityId === entityId)
                            ?.traits ?? [],
                        response: status,
                        note: "Live caregiver response",
                        session: kit?.id ?? "live",
                        entityId,
                      },
                    ]
                  : []
              ),
            }
      ),
      feedback: mergeFeedback(current.feedback, {
        residentId,
        entityId,
        status,
        recordedAt: new Date().toISOString(),
        sessionId: kit?.id,
      }),
      memories: [
        ...(current.memories ?? []).filter(
          (m) => m.id !== `${kit?.id}:media:${entityId}`
        ),
        {
          id: `${kit?.id}:media:${entityId}`,
          residentId,
          entityId,
          sessionId: kit?.id,
          kind: "observation",
          status: "reported",
          source: "caregiver",
          createdAt: new Date().toISOString(),
          response:
            status === "distressed"
              ? "distress"
              : status === "not_for_us"
                ? "not_for_us"
                : status === "neutral"
                  ? "no_response"
                  : "engaged",
          text: `${kit?.items.find((i) => i.entityId === entityId)?.name ?? "Activity"}: ${status} (live caregiver observation).`,
        },
      ],
      sessions: current.sessions.map((s) =>
        s.id === kit?.id
          ? {
              ...s,
              feedback: mergeFeedback(s.feedback, {
                residentId,
                entityId,
                status,
                sessionId: kit?.id,
                recordedAt: new Date().toISOString(),
              }),
            }
          : s
      ),
    }))
  }
  const extractNote = async () => {
    requestController.current = new AbortController()
    setExtracting(true)
    setError("")
    try {
      const response = await fetch("/api/echoes/intake", {
        signal: requestController.current.signal,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: migrateResidentNotes(residents[0]).notes,
          authority: Boolean(residents[0]?.consent),
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw Error(payload.error)
      update(0, { preferences: payload.preferences })
      if (payload.source !== "Groq")
        setError(
          "The notes helper is unavailable. Your notes are saved; enter and confirm preferences manually, or try again."
        )
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not read that note."
      )
    } finally {
      setExtracting(false)
    }
  }
  const feedbackByEntity = useMemo(
    () =>
      new Map(
        feedback.map((record) => [
          `${record.residentId}:${record.entityId}`,
          record.status,
        ])
      ),
    [feedback]
  )
  const begin = () => navigate("dashboard")
  const resumeSession = (session: (typeof workspace.sessions)[number]) => {
    setActiveResidentId(session.kit.residents[0]?.id ?? "")
    setKit(session.kit)
    navigate("live", session.id)
  }
  const openKit = (session: (typeof workspace.sessions)[number]) => {
    setActiveResidentId(session.kit.residents[0]?.id ?? "")
    setKit(session.kit)
    navigate("kit", session.id)
  }
  const lastUnfinishedSession = workspace.sessions.find(
    (session) => !session.wrapUp && session.kit.activities?.length
  )

  if (mode === "protected" && locked && screen !== "home")
    return <WorkspaceUnlock onUnlock={unlock} onBack={() => navigate("home")} />

  return (
    <div className={`echoes-shell screen-${screen}`}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <nav className="nav-left" aria-label="Main navigation">
          <Link
            className={screen === "home" ? "nav-link current" : "nav-link"}
            href="/"
            onNavigate={(event) => {
              event.preventDefault()
              navigate("home")
            }}
          >
            Discover
          </Link>
          <Link
            className={screen !== "home" ? "nav-link current" : "nav-link"}
            href="/dashboard"
            onNavigate={(event) => {
              event.preventDefault()
              begin()
            }}
          >
            Your workspace
          </Link>
        </nav>
        <Link
          className="wordmark"
          href="/"
          aria-label="Echoes home"
          onNavigate={(event) => {
            event.preventDefault()
            navigate("home")
          }}
        >
          echoes<span aria-hidden="true">✳</span>
        </Link>
        <nav className="nav-right" aria-label="Resources">
          <Link className="nav-link" href="/eval">
            Our evidence
          </Link>
          <Link
            className="header-cta"
            href="/dashboard"
            onNavigate={(event) => {
              event.preventDefault()
              begin()
            }}
          >
            Let’s begin <ArrowUpRight />
          </Link>
        </nav>
      </header>
      <main id="main">
        {mode === "demo" && !locked && (
          <p className="hint" role="status">
            {saveState}
          </p>
        )}
        {mode === "protected" && !locked && (
          <div className="workspace-protection">
            <span role="status">{saveState}</span>
            <button
              className="secondary"
              disabled={saveState === "Saving changes…"}
              onClick={() => void lock()}
            >
              Lock this tablet
            </button>
            <small>
              Locks after 5 minutes of inactivity; access expires after 30
              minutes.
            </small>
          </div>
        )}
        {storageNotice && (
          <p className="notice" role="status">
            {storageNotice}
            {mode === "demo" && saveState.startsWith("Not saved") && (
              <button className="text-button" onClick={retrySave}>
                Retry saving
              </button>
            )}
          </p>
        )}
        {screen === "home" && (
          <>
            <section className="landing-hero">
              <MemoryIllustration />
              <div className="hero-content">
                <p className="eyebrow">
                  <span className="little-dot" /> FAMILIAR THINGS. PERSON-FIRST
                  CARE.
                </p>
                <h1>
                  Memory care,
                  <br />
                  <em>made personal.</em>
                </h1>
                <p className="hero-description">
                  Personalised music, films, and gentle conversation prompts
                  <br className="desktop-break" /> for carers, families, and the
                  people they support.
                </p>
                <div className="hero-actions">
                  <button
                    className="primary"
                    onClick={begin}
                    disabled={mode === "checking"}
                  >
                    Plan a meaningful session <ArrowRight size={17} />
                  </button>
                  <span className="handwritten hero-hand">
                    a good place to start <span aria-hidden="true">⤴</span>
                  </span>
                </div>
                <p className="hero-meta">
                  <Clock3 size={13} /> One person, one thoughtful session{" "}
                  <span>·</span> Led by you, at their pace
                </p>
              </div>
            </section>
            <section className="introducing" aria-labelledby="intro-title">
              <div>
                <p className="eyebrow">MEMORY CARE IS OUR STARTING POINT</p>
                <h2 id="intro-title">
                  Built for memory care.
                  <br />
                  <span>Open to every story.</span>
                </h2>
              </div>
              <p>
                For dementia care, older-adult activities, or a family visit:
                Echoes helps you plan time around someone’s life and interests.
                No diagnosis is needed. Just a person you want to connect with.
              </p>
            </section>
            <section
              className="feature-grid"
              aria-label="What goes into a moment"
            >
              <article className="feature-card music-card">
                <div className="feature-art">
                  <RecordIllustration />
                  <span className="handwritten">
                    the soundtrack
                    <br />
                    to their story
                  </span>
                </div>
                <div className="feature-copy">
                  <span className="feature-number">01 / FIND THE FAMILIAR</span>
                  <h3>Their life, not a diagnosis.</h3>
                  <p>
                    Start with their favourites, where they grew up, and their
                    younger years. Echoes suggests cultural touchstones matched
                    by Qloo, with independently checked release years.
                  </p>
                  <button className="text-button" onClick={() => loadDemo()}>
                    Explore a demo profile <ArrowRight size={16} />
                  </button>
                </div>
              </article>
              <article className="feature-card together-card">
                <div className="feature-art">
                  <ConnectionIllustration />
                  <span className="handwritten">
                    no perfect words
                    <br />
                    needed
                  </span>
                </div>
                <div className="feature-copy">
                  <span className="feature-number">
                    02 / MAKE ROOM FOR CONNECTION
                  </span>
                  <h3>Less planning. More personal care.</h3>
                  <p>
                    A session guide, gentle prompts, and a two-minute wrap-up.
                    Plan for one person at a time. Pause, skip, or simply
                    listen—there’s no right answer to remember.
                  </p>
                  <button className="text-button" onClick={begin}>
                    Create your first session <ArrowRight size={16} />
                  </button>
                </div>
              </article>
            </section>
            <section className="how-section" id="how-it-works">
              <p className="eyebrow">THREE SMALL STEPS</p>
              <h2>From a life story to a care session.</h2>
              <div className="how-grid">
                {[
                  [
                    "01",
                    "Tell us a little.",
                    "Share a nickname, where they grew up, and a few favourites. Add any topics you’d like to avoid.",
                  ],
                  [
                    "02",
                    "Find a familiar thread.",
                    "Get cultural suggestions, conversation prompts, and a printable about-me sheet for the session.",
                  ],
                  [
                    "03",
                    "See where it takes you.",
                    "Invite a response, not a correct answer. Record what resonates to help shape your next session.",
                  ],
                ].map(([number, title, copy]) => (
                  <article key={number}>
                    <span className="handwritten">{number}</span>
                    <h3>{title}</h3>
                    <p>{copy}</p>
                  </article>
                ))}
              </div>
            </section>
            <section className="closing-note">
              <Heart size={24} strokeWidth={1.4} />
              <p>Connection matters more than recall.</p>
              <span className="handwritten">
                An invitation to share, never a test to pass.
              </span>
              <button className="primary" onClick={begin}>
                Plan a session around them <ArrowRight size={17} />
              </button>
            </section>
          </>
        )}

        {screen !== "home" && screen !== "dashboard" && (
          <div className="workspace-bar">
            <Link
              className="text-button"
              href="/dashboard"
              onNavigate={(event) => {
                event.preventDefault()
                navigate("dashboard")
              }}
            >
              <ArrowLeft size={15} /> Back to your dashboard
            </Link>
          </div>
        )}
        {screen === "dashboard" && (
          <section
            className="workspace-dashboard"
            aria-labelledby="dashboard-title"
          >
            <div className="dashboard-heading">
              <div>
                <p className="eyebrow">YOUR WORKSPACE</p>
                <h1 id="dashboard-title">What would you like to do?</h1>
                <p>
                  Choose a simple next step. You can always pause or change
                  course.
                </p>
              </div>
              <Link
                className="primary dashboard-create"
                href="/intake"
                onNavigate={(event) => {
                  event.preventDefault()
                  navigate("intake")
                }}
              >
                Create a new kit <ArrowRight size={17} />
              </Link>
            </div>
            {lastUnfinishedSession && (
              <section
                className="continue-card"
                aria-labelledby="continue-title"
              >
                <div>
                  <p className="eyebrow">READY WHEN YOU ARE</p>
                  <h2 id="continue-title">
                    Continue with{" "}
                    {lastUnfinishedSession.kit.residents[0]?.nickname ??
                      "your last session"}
                  </h2>
                  <p>
                    Pick up at{" "}
                    {lastUnfinishedSession.kit.activities?.find(
                      (activity) =>
                        activity.id ===
                        lastUnfinishedSession.progress?.activityId
                    )?.title ?? "the first activity"}
                    .
                  </p>
                </div>
                <button
                  className="primary session-start"
                  onClick={() => resumeSession(lastUnfinishedSession)}
                >
                  Continue session <ArrowRight size={18} />
                </button>
              </section>
            )}
            <section className="dashboard-kits" aria-labelledby="kits-title">
              <div className="panel-title">
                <div>
                  <p className="eyebrow">MY KITS</p>
                  <h2 id="kits-title">Recent session plans</h2>
                </div>
                <span>{workspace.sessions.length} saved</span>
              </div>
              {workspace.sessions.length ? (
                <div className="kit-history">
                  {workspace.sessions.slice(0, 6).map((session) => (
                    <article key={session.id}>
                      <div>
                        <h3>
                          {session.kit.residents
                            .map((resident) => resident.nickname)
                            .join(" & ")}
                        </h3>
                        <p>
                          {new Date(session.createdAt).toLocaleDateString(
                            undefined,
                            { month: "short", day: "numeric" }
                          )}
                          {session.wrapUp
                            ? " · wrapped up"
                            : " · ready to continue"}
                        </p>
                      </div>
                      <button
                        className="secondary"
                        onClick={() => openKit(session)}
                      >
                        View kit <ArrowRight size={15} />
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="dashboard-empty">
                  <h3>Your first kit starts with a few familiar details.</h3>
                  <p>
                    Add a person, a birth year, and a favourite to create a
                    calm, reviewable plan.
                  </p>
                  <button
                    className="secondary"
                    onClick={() => navigate("intake")}
                  >
                    Create your first kit <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </section>
          </section>
        )}
        {screen === "intake" && (
          <>
            <section
              className="resident-roster"
              aria-label="Resident directory"
            >
              <div>
                <h2>Your residents</h2>
                <p>
                  Choose one person to prepare their next session.{" "}
                  {workspace.residents.length}/60 profiles.
                </p>
              </div>
              <label>
                Find a resident
                <input
                  type="search"
                  value={residentSearch}
                  onChange={(e) => setResidentSearch(e.target.value)}
                  placeholder="Search by nickname"
                />
              </label>
              <div className="roster-options">
                {workspace.residents
                  .filter((r) =>
                    r.nickname
                      .toLowerCase()
                      .includes(residentSearch.toLowerCase())
                  )
                  .map((r) => (
                    <button
                      key={r.id}
                      aria-pressed={residents[0]?.id === r.id}
                      onClick={() => {
                        setActiveResidentId(r.id)
                        setKit(null)
                      }}
                    >
                      {r.nickname || "New resident"}
                    </button>
                  ))}
                <button
                  disabled={workspace.residents.length >= 60}
                  onClick={() => {
                    const next = blankResident()
                    setResidents((current) => [...current, next])
                    setActiveResidentId(next.id)
                    setResidentSearch("")
                  }}
                >
                  + Add resident
                </button>
              </div>
            </section>
            <div className="workspace-layout">
              <section className="intake card" aria-labelledby="intake-title">
                <div className="section-title">
                  <p className="eyebrow">YOUR NEXT LITTLE MOMENT</p>
                  <span className="step-label">
                    01 <span>/ 03</span>
                  </span>
                </div>
                <h1 id="intake-title">Who’s on your mind?</h1>
                <p className="section-description">
                  A few familiar details help us find a thoughtful starting
                  point.
                </p>
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    void createKit()
                  }}
                >
                  {residents.map((resident, index) => (
                    <fieldset className="resident-form" key={resident.id}>
                      <legend>
                        <span className="person-number">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        {resident.nickname || "Someone special"}
                      </legend>
                      {residents.length > 1 && (
                        <button
                          className="remove"
                          type="button"
                          aria-label={`Remove person ${index + 1}`}
                          onClick={() =>
                            setResidents((items) =>
                              items.filter(
                                (_, candidate) => candidate !== index
                              )
                            )
                          }
                        >
                          <X size={16} />
                        </button>
                      )}
                      <label>
                        First name or nickname
                        <input
                          required
                          maxLength={40}
                          value={resident.nickname}
                          onChange={(event) =>
                            update(index, { nickname: event.target.value })
                          }
                          placeholder="What do you call them?"
                          autoComplete="off"
                        />
                      </label>
                      <label>
                        Birth year
                        <input
                          required
                          type="number"
                          min={1900}
                          max={new Date().getFullYear() - 13}
                          value={resident.birthYear || ""}
                          onChange={(event) =>
                            update(index, {
                              birthYear: Number(event.target.value),
                            })
                          }
                          placeholder="e.g. 1948"
                        />
                      </label>
                      <label>
                        Where they grew up
                        <input
                          required
                          maxLength={100}
                          value={resident.hometown}
                          onChange={(event) =>
                            update(index, { hometown: event.target.value })
                          }
                          placeholder="City or region"
                        />
                      </label>
                      <label>
                        Country
                        <input
                          required
                          maxLength={60}
                          value={resident.country}
                          onChange={(event) =>
                            update(index, { country: event.target.value })
                          }
                          placeholder="e.g. United States"
                        />
                      </label>
                      <label className="wide">
                        Preferred language
                        <input
                          required
                          maxLength={40}
                          value={resident.language}
                          onChange={(event) =>
                            update(index, { language: event.target.value })
                          }
                        />
                      </label>
                      <label className="wide">
                        A few things they love{" "}
                        <span>1–3 favourites, separated by commas</span>
                        <input
                          required
                          value={resident.lovedThings.join(",")}
                          onChange={(event) =>
                            update(index, {
                              lovedThings: event.target.value.split(","),
                            })
                          }
                          placeholder="The Beatles, Roman Holiday…"
                        />
                        <small>
                          Artists, films, shows, books, or places that mean
                          something to them.
                        </small>
                      </label>
                      <label className="wide">
                        Anything to gently avoid? <span>Optional</span>
                        <input
                          value={resident.sensitivities.join(",")}
                          onChange={(event) =>
                            update(index, {
                              sensitivities: event.target.value.split(","),
                            })
                          }
                          placeholder="e.g. war, loss"
                        />
                      </label>
                      <label className="wide">
                        Anything else we should know?
                        <textarea
                          maxLength={6000}
                          value={resident.notes ?? ""}
                          onChange={(e) =>
                            update(index, {
                              notes: e.target.value,
                              preferences: resident.preferences
                                ? { ...resident.preferences, confirmed: false }
                                : undefined,
                            })
                          }
                          placeholder="What they loved, family, work, how they like sessions to feel, practical things like where to sit"
                        />
                      </label>
                      <PreferencesEditor
                        resident={resident}
                        onChange={(patch) => update(index, patch)}
                        onExtract={extractNote}
                        extracting={extracting}
                        demo={mode === "demo"}
                      />
                      <label className="wide check-label">
                        <input
                          type="checkbox"
                          required
                          checked={Boolean(resident.consent)}
                          onChange={(e) =>
                            update(index, {
                              consent: e.target.checked
                                ? {
                                    authority: "caregiver",
                                    recordedAt: new Date().toISOString(),
                                  }
                                : undefined,
                            })
                          }
                        />
                        I have appropriate consent or authority to record this
                        information and use the stated favourites for external
                        cultural discovery. I have reviewed these profile
                        details.
                      </label>
                    </fieldset>
                  ))}
                  {error && (
                    <p className="error" role="alert">
                      {error}
                    </p>
                  )}
                  <div className="intake-footer">
                    <p>
                      <LockKeyhole size={14} /> Nicknames only. A little privacy
                      goes a long way.
                    </p>
                    <button
                      className="primary"
                      type="submit"
                      disabled={loading || !ready}
                    >
                      {loading ? (
                        <>
                          <LoaderCircle size={17} className="spin" /> Finding
                          familiar things…
                        </>
                      ) : (
                        <>
                          Create a session kit <ArrowRight size={17} />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </section>
              <aside className="intake-aside">
                <FamilyPanel
                  key={residents[0]?.id}
                  residentId={residents[0]?.id}
                  enabled={mode === "protected"}
                  saved={saveState === "Saved to protected workspace"}
                  onAccepted={reload}
                />
                <div className="little-note">
                  <span className="handwritten">
                    No need to know everything.
                  </span>
                  <p>
                    A favourite song or film is a lovely place to start. You can
                    learn the rest together.
                  </p>
                  <Heart size={25} strokeWidth={1.4} />
                </div>
                <section className="kit-preview">
                  <RecordIllustration />
                  <p className="eyebrow">A LITTLE LOOK AHEAD</p>
                  <h3>Inside your session kit</h3>
                  <ul>
                    <li>
                      <Check size={15} /> Carefully matched touchstones
                    </li>
                    <li>
                      <Check size={15} /> Gentle conversation starters
                    </li>
                    <li>
                      <Check size={15} /> A 30-minute session guide
                    </li>
                    <li>
                      <Check size={15} /> A printable about-me sheet
                    </li>
                  </ul>
                </section>
                <section className="demo-panel">
                  <p>Just exploring?</p>
                  <button className="text-button" onClick={() => loadDemo()}>
                    Try one demo person <ArrowRight size={15} />
                  </button>
                  <button
                    className="text-button"
                    onClick={() => loadDemo(true)}
                  >
                    Add three fictional profiles <Users size={15} />
                  </button>
                </section>
                {workspace.sessions.length > 0 && (
                  <section className="recent-sessions">
                    <p className="eyebrow">YOUR RECENT KITS</p>
                    {workspace.sessions
                      .filter((s) =>
                        s.kit.residents.some((r) => r.id === residents[0]?.id)
                      )
                      .slice(0, 5)
                      .map((session) => (
                        <button
                          key={session.id}
                          onClick={() => {
                            setKit(session.kit)
                            openKit(session)
                          }}
                        >
                          <span>
                            {session.kit.residents
                              .map((person) => person.nickname)
                              .join(" & ")}
                            <small>
                              {new Date(session.createdAt).toLocaleDateString(
                                undefined,
                                { month: "short", day: "numeric" }
                              )}{" "}
                              · {session.kit.items.length} touchstones
                            </small>
                          </span>
                          <ArrowRight size={16} />
                        </button>
                      ))}
                  </section>
                )}
                <details className="memory-panel">
                  <summary>What Echoes knows about this person</summary>
                  {(workspace.memories ?? [])
                    .filter((m) => m.residentId === residents[0]?.id)
                    .slice(-15)
                    .reverse()
                    .map((m) => (
                      <article key={m.id}>
                        <small>
                          {m.createdAt.slice(0, 10)} · {m.source} · {m.status}{" "}
                          {m.kind}
                        </small>
                        <p>{m.text}</p>
                      </article>
                    ))}
                  <p>
                    Qloo discoveries are suggestions. A reported story is not
                    automatically a confirmed biographical fact.
                  </p>
                </details>
              </aside>
            </div>
          </>
        )}

        {["kit", "live", "review"].includes(screen) && !kit && (
          <section className="card access-page">
            <h1>{ready ? "Session unavailable" : "Loading your session…"}</h1>
            {ready && (
              <p>
                This session is not in this workspace. Choose a saved session
                from your dashboard.
              </p>
            )}
            <Link className="secondary" href="/dashboard">
              Back to dashboard
            </Link>
          </section>
        )}
        {kit && screen === "live" && (
          <LiveSession
            key={kit.id}
            kit={kit}
            initialActivityId={
              workspace.sessions.find((session) => session.id === kit.id)
                ?.progress?.activityId
            }
            onProgress={saveProgress}
            onFeedback={(record) =>
              recordFeedback(record.residentId, record.entityId, record.status)
            }
            onClose={() => navigate("kit")}
            onFinish={() => navigate("review")}
          />
        )}
        {kit && screen === "review" && (
          <SessionReview
            key={kit.id}
            kit={kit}
            record={workspace.sessions.find((s) => s.id === kit.id)}
            isSaved={isSaved}
            saveError={
              saveState.startsWith("Not saved")
                ? storageNotice || saveState
                : ""
            }
            storageMode={mode === "protected" ? "protected" : "browser"}
            onSave={(wrapUp, note) =>
              setWorkspace((current) => saveWrapUp(current, kit, wrapUp, note))
            }
          />
        )}
        {kit && screen === "kit" && (
          <section className="kit-view">
            <div className="kit-heading">
              <div>
                <p className="eyebrow">A MOMENT, MADE FOR THEM</p>
                <h1>
                  A familiar thread
                  <br />
                  <em>
                    for{" "}
                    {kit.residents
                      .map((resident) => resident.nickname)
                      .join(" & ")}
                    .
                  </em>
                </h1>
                <p className="kit-meta">
                  <Clock3 size={15} /> 30 minutes <span>·</span> {kit.era.from}–
                  {kit.era.to} <span>·</span> {kit.items.length} touchstones
                </p>
              </div>
              <div className="kit-heading-actions">
                <button
                  className="primary session-start"
                  disabled={!kit.activities?.length}
                  onClick={startSession}
                >
                  {workspace.sessions.find((session) => session.id === kit.id)
                    ?.progress?.activityId !== kit.activities?.[0]?.id
                    ? "Resume your session"
                    : "Start your 30-minute session"}{" "}
                  <ArrowRight size={18} />
                </button>
                <p>Start now, or make optional adjustments below.</p>
              </div>
            </div>
            {kit.residents.length > 1 && (
              <div className="coverage">
                <Users size={22} />
                <strong>{kit.coverage.percent}%</strong>
                <div>
                  <b>Something for everyone</b>
                  <p>
                    {kit.coverage.underservedNames.length
                      ? `More individual tailoring may help ${kit.coverage.underservedNames.join(", ")}.`
                      : "Each person has at least one Qloo-supported connection."}
                  </p>
                </div>
              </div>
            )}
            <KitTabs
              key={kit.id}
              overview={
                <>
                  <KitChecks
                    resolving={loading}
                    key={kit.id}
                    kit={kit}
                    resident={workspace.residents.find(
                      (r) => r.id === kit.residents[0]?.id
                    )}
                    feedback={feedback}
                    onChange={(next) => {
                      setKit(next)
                      setWorkspace((current) => ({
                        ...current,
                        sessions: current.sessions.map((s) =>
                          s.id === next.id ? { ...s, kit: next } : s
                        ),
                      }))
                    }}
                    onResolve={(query, candidate) => {
                      const person = workspace.residents.find(
                        (r) => r.id === kit.residents[0]?.id
                      )
                      if (!person) return
                      const next = {
                        ...person,
                        resolvedFavorites: [
                          ...(person.resolvedFavorites ?? []).filter(
                            (c) => c.query !== query
                          ),
                          {
                            query,
                            entityId: candidate.entityId,
                            type: candidate.type,
                            name: candidate.name,
                          },
                        ].slice(-3),
                      }
                      setWorkspace((current) => ({
                        ...current,
                        residents: current.residents.map((r) =>
                          r.id === next.id ? next : r
                        ),
                      }))
                      void createKit([next])
                    }}
                  />
                  <div className="items-panel">
                    {kit.activities && (
                      <SessionPlan
                        kit={kit}
                        resident={workspace.residents.find(
                          (r) => r.id === kit.residents[0]?.id
                        )}
                        onChange={(next) => {
                          setKit(next)
                          setWorkspace((current) => ({
                            ...current,
                            sessions: current.sessions.map((s) =>
                              s.id === next.id ? { ...s, kit: next } : s
                            ),
                          }))
                        }}
                      />
                    )}
                    <div hidden={Boolean(kit.activities)}>
                      <div className="panel-title">
                        <h2>Start with something familiar.</h2>
                        <p>
                          Choose what feels right. There’s no need to use
                          everything.
                        </p>
                      </div>
                      {!kit.items.length && (
                        <div className="empty-state">
                          <Music2 size={30} />
                          <h3>A different starting point?</h3>
                          <p>
                            We couldn’t verify a match this time. Try another
                            favourite to help us find a familiar thread.
                          </p>
                          <button className="secondary" onClick={begin}>
                            Edit their favourites <ArrowRight size={16} />
                          </button>
                        </div>
                      )}
                      {kit.items.map((item, index) => (
                        <article
                          className={`kit-item item-${index % 3}`}
                          key={item.entityId}
                        >
                          <div className="item-icon">
                            <span>{String(index + 1).padStart(2, "0")}</span>
                            <Music2 size={25} strokeWidth={1.4} />
                          </div>
                          <div className="item-copy">
                            <div className="item-badges">
                              <span className="item-kind">{item.kind}</span>
                              <span className="verified">
                                <Check size={11} /> Qloo-matched
                              </span>
                              {item.yearEvidence && (
                                <span className="year-evidence">
                                  {itemDateLabel(item, kit.era)} ·{" "}
                                  {item.yearEvidence.source}
                                </span>
                              )}
                            </div>
                            <h3>{item.name}</h3>
                            <p>
                              {item.whyItFits
                                .filter((tag) => tag !== "Qloo-verified")
                                .slice(0, 2)
                                .join(" · ")}
                            </p>
                            <div className="feedback">
                              {item.matchedResidentIds.map((id) => (
                                <div key={id}>
                                  {kit.residents.length > 1 && (
                                    <span>
                                      {
                                        kit.residents.find(
                                          (resident) => resident.id === id
                                        )?.nickname
                                      }
                                    </span>
                                  )}
                                  <button
                                    aria-pressed={
                                      feedbackByEntity.get(
                                        `${id}:${item.entityId}`
                                      ) === "sparked"
                                    }
                                    className={
                                      feedbackByEntity.get(
                                        `${id}:${item.entityId}`
                                      ) === "sparked"
                                        ? "active-spark"
                                        : ""
                                    }
                                    onClick={() =>
                                      recordFeedback(
                                        id,
                                        item.entityId,
                                        "sparked"
                                      )
                                    }
                                  >
                                    <Heart size={13} /> Sparked a response
                                  </button>
                                  <button
                                    aria-pressed={
                                      feedbackByEntity.get(
                                        `${id}:${item.entityId}`
                                      ) === "not_for_us"
                                    }
                                    className={
                                      feedbackByEntity.get(
                                        `${id}:${item.entityId}`
                                      ) === "not_for_us"
                                        ? "active-distress"
                                        : ""
                                    }
                                    onClick={() =>
                                      recordFeedback(
                                        id,
                                        item.entityId,
                                        "not_for_us"
                                      )
                                    }
                                  >
                                    Not for us
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>

                  {kit.notes.length > 0 && (
                    <div className="kit-notes">
                      {kit.notes.map((note) => (
                        <p key={note}>{note}</p>
                      ))}
                    </div>
                  )}
                  <details className="agent-trace">
                    <summary>
                      <Sparkles size={16} /> A little transparency: what went
                      into this kit <ChevronDown size={16} />
                    </summary>
                    {kit.agentTrace?.map((entry) => (
                      <div key={entry.id}>
                        <p>
                          <b>
                            {entry.role ?? "Orchestrator"} ·{" "}
                            {entry.tool.replaceAll("_", " ")} ·{" "}
                            {entry.outcome ?? "ok"}
                          </b>
                          {entry.summary}
                        </p>
                        {(entry.input || entry.output) && (
                          <details>
                            <summary>Tool inputs and evidence</summary>
                            <pre>
                              {JSON.stringify(
                                { input: entry.input, output: entry.output },
                                null,
                                2
                              )}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </details>
                </>
              }
              tips={
                <aside className="session-sidebar">
                  {kitPreferences?.confirmed &&
                    (
                      [
                        ["Session pace", kitPreferences.format_prefs],
                        ["Practical details", kitPreferences.logistics],
                        ["People mentioned", kitPreferences.people],
                        ["Places", kitPreferences.places],
                      ] as const
                    ).some(([, values]) => values.length > 0) && (
                      <section className="confirmed-note-tips">
                        <div className="tips-card-heading">
                          <Sparkles size={22} strokeWidth={1.5} />
                          <div>
                            <p className="eyebrow">FROM THE CONFIRMED NOTES</p>
                            <h2>Helpful details for this session.</h2>
                          </div>
                        </div>
                        <div className="confirmed-note-grid">
                          {(
                            [
                              ["Session pace", kitPreferences.format_prefs],
                              ["Practical details", kitPreferences.logistics.map(logisticsSentence)],
                              ["People mentioned", kitPreferences.people],
                              ["Places", kitPreferences.places],
                            ] as const
                          ).map(
                            ([label, values]) =>
                              values.length > 0 && (
                                <section
                                  className="confirmed-note-group"
                                  key={label}
                                >
                                  <h3>{label}</h3>
                                  <ul>
                                    {values.map((value) => (
                                      <li key={value}>{value}</li>
                                    ))}
                                  </ul>
                                </section>
                              )
                          )}
                        </div>
                      </section>
                    )}
                  <section className="prompt-card">
                    <MessageCircle size={21} strokeWidth={1.4} />
                    <p className="eyebrow">LET THE CONVERSATION WANDER</p>
                    <h2>A gentle way in.</h2>
                    {kit.prompts.map((prompt, index) => (
                      <p className="prompt" key={prompt}>
                        <span className="handwritten">0{index + 1}</span>
                        {prompt}
                      </p>
                    ))}
                    <span className="handwritten">
                      Listening is a lovely answer, too.
                    </span>
                  </section>
                  <section className="about-sheet">
                    <p className="eyebrow">THE LITTLE THINGS THAT MATTER</p>
                    <h2>{kit.aboutMe.title}</h2>
                    <p>{kit.aboutMe.opening}</p>
                    {kit.aboutMe.details.map((detail) => (
                      <p className="detail" key={detail}>
                        {detail}
                      </p>
                    ))}
                    <button
                      className="text-button"
                      onClick={() => window.print()}
                    >
                      <Printer size={15} /> Print this sheet
                    </button>
                  </section>
                </aside>
              }
            />
          </section>
        )}
      </main>
      <footer className="site-footer">
        <div>
          <Link
            className="wordmark"
            href="/"
            onNavigate={(event) => {
              event.preventDefault()
              navigate("home")
            }}
          >
            echoes<span aria-hidden="true">✳</span>
          </Link>
          <span className="handwritten">A little more together.</span>
        </div>
        <p>
          Activity planning for memory care and everyday connection.
          <br />
          Not medical advice. Always follow the person’s care plan.
        </p>
        {mode !== "protected" && (
          <button className="footer-delete" onClick={() => setDeleteOpen(true)}>
            <Trash2 size={13} /> Delete browser data
          </button>
        )}
      </footer>
      {deleteOpen && (
        <div className="dialog-backdrop">
          <section
            className="delete-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <h2 id="delete-title">Clear your workspace?</h2>
            <p>
              This removes saved people, kits, and feedback from this browser.
              It cannot be undone.
            </p>
            <div>
              <button
                className="secondary"
                autoFocus
                onClick={() => setDeleteOpen(false)}
              >
                Keep my workspace
              </button>
              <button
                className="primary danger"
                onClick={async () => {
                  try {
                    await browserWorkspaceStorage.clear()
                    window.history.replaceState(null, "", "/")
                    window.location.reload()
                  } catch (error) {
                    setError(
                      error instanceof Error
                        ? error.message
                        : "Could not clear browser data."
                    )
                  }
                }}
              >
                Delete everything
              </button>
            </div>
            <button
              className="text-button"
              disabled={loading || saveState === "Saving changes…"}
              onClick={async () => {
                if (
                  !window.confirm(
                    `Remove ${residents[0]?.nickname || "this resident"}, their sessions, memories, pending family submissions and intake links? This cannot be undone in the app.`
                  )
                )
                  return
                try {
                  await removeResident(residents[0].id)
                  setKit(null)
                  setActiveResidentId("")
                  setError("")
                } catch (reason) {
                  setError(
                    reason instanceof Error ? reason.message : "Removal failed"
                  )
                }
              }}
            >
              Remove selected resident’s data
            </button>
          </section>
        </div>
      )}
    </div>
  )
}

function ArrowUpRight() {
  return <ArrowRight size={14} className="diagonal-arrow" />
}
