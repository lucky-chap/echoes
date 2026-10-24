"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import Link from "next/link"
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Flag,
  Leaf,
  MapPin,
  MessageCircle,
  Minus,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Sun,
  Users,
  X,
  Music2,
  Volume2,
  VolumeX,
  CloudRain,
} from "lucide-react"
import { drawResident, drawTown, HEIGHT, WIDTH } from "@/lib/world/art"
import {
  residents,
  destination,
  situationNames,
  type Situation,
} from "@/lib/world/profiles"
import { phaseNames, phases } from "@/lib/world/simulation"
import { useWorld } from "./use-world"

function Portrait({
  index,
  large = false,
}: {
  index: number
  large?: boolean
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current?.getContext("2d")
    if (c) {
      c.clearRect(0, 0, 24, 28)
      drawResident(c, index, 12, 24)
    }
  }, [index])
  return (
    <span className={`portrait portrait-${index} ${large ? "large" : ""}`}>
      <canvas
        ref={ref}
        width={24}
        height={28}
        aria-label={`${residents[index].name} pixel portrait`}
        role="img"
      />
    </span>
  )
}
export default function Worldlings() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const {
    sim,
    paused,
    hidden,
    loading,
    error,
    audioNotice,
    audioSettings,
    updateAudio,
    start,
    changeSituation,
    reset,
    togglePause,
    interaction,
  } = useWorld()
  const [selected, setSelected] = useState(0),
    [labels, setLabels] = useState(true),
    [tab, setTab] = useState<"dialogue" | "log">("dialogue"),
    [help, setHelp] = useState(false)
  const started = sim.phase !== "idle",
    complete = sim.phase === "finished",
    elapsed = sim.total
  const spoken = sim.history,
    current = sim.speech ?? spoken.at(-1)
  const speaker = current
    ? residents.findIndex((r) => r.id === current.speaker)
    : selected
  const activeSpeaker = sim.speech
    ? residents.findIndex((r) => r.id === sim.speech!.speaker)
    : -1
  const moving = sim.phase === "gathering" || sim.phase === "traveling"
  const decided = ["deciding", "traveling", "completing", "finished"].includes(
    sim.phase
  )
  const winner = sim.decision ? destination(sim.decision.winner.id) : null
  const logs = sim.logs
  useEffect(() => {
    const c = canvas.current?.getContext("2d")
    if (c)
      drawTown(
        c,
        elapsed,
        selected,
        labels,
        sim.positions,
        moving,
        activeSpeaker,
        sim.phase === "completing" ? sim.decision?.winner.id : undefined
      )
  }, [
    elapsed,
    selected,
    labels,
    sim.positions,
    moving,
    activeSpeaker,
    sim.phase,
    sim.decision,
  ])
  useEffect(() => {
    if (!help) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHelp(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [help])
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Worldlings home">
          <span className="brand-mark">
            <i />
            <i />
            <i />
          </span>
          worldlings<span className="alpha">EARLY DAYS</span>
        </Link>
        <div className="header-right">
          <span className="header-note">
            Little lives. Lovely possibilities.
          </span>
          <button
            className="icon-button"
            aria-label="About this demo"
            onClick={() => setHelp(true)}
          >
            <CircleHelp size={19} />
          </button>
        </div>
      </header>
      <main>
        <section className="page-heading">
          <div>
            <div className="eyebrow">
              <span className="status-dot" /> A SMALL WORLD, COMING TO LIFE
            </div>
            <h1>
              Welcome to Littlehaven<span>.</span>
            </h1>
            <p>A place to slow down, cross paths, and see what happens.</p>
          </div>
          <div className="day-card">
            {sim.situation === "rain" ? (
              <CloudRain size={25} />
            ) : (
              <Sun size={25} />
            )}
            <div>
              <strong>
                Day 01 <span>·</span> {situationNames[sim.situation]}
              </strong>
              <small>
                {sim.situation === "rain"
                  ? "A little rain. A fresh perspective."
                  : sim.situation === "performance"
                    ? "A new melody is coming to town."
                    : "Clear skies. Plenty of possibilities."}
              </small>
            </div>
          </div>
        </section>
        <div className="game-layout">
          <section className="town-panel" aria-label="Littlehaven town">
            <div className="panel-toolbar">
              <div>
                <MapPin size={16} />
                <strong>Littlehaven</strong>
                <span className="toolbar-divider" />
                <span className="muted">Your little corner of the world</span>
              </div>
              <span className="live-badge">
                <span className="status-dot" />
                {hidden
                  ? "Tab paused"
                  : paused
                    ? "Paused"
                    : phaseNames[sim.phase]}
              </span>
            </div>
            <div className="map-wrap">
              <canvas
                ref={canvas}
                width={WIDTH}
                height={HEIGHT}
                className="town-canvas"
                role="img"
                aria-label="Pixel-art Littlehaven: a café and music venue to the north, a fountain in the central town square, a pond to the west, and a museum to the east. Mia, Kai, and Luna gather here."
              />
              <div className="map-label">
                <Sun size={14} /> LITTLEHAVEN <span>•</span> 2:
                {String(30 + Math.floor(elapsed / 60)).padStart(2, "0")} PM
              </div>
              <div className="square-label">TOWN SQUARE</div>
              {sim.situation === "rain" && (
                <div className="rain-overlay" aria-hidden="true" />
              )}
              {sim.speech && (
                <div
                  className={`speech-bubble speaker-${activeSpeaker}`}
                  style={
                    {
                      "--speaker-x": `${(sim.positions[activeSpeaker][0] / WIDTH) * 100}%`,
                      left: `${Math.max(23, Math.min(77, (sim.positions[activeSpeaker][0] / WIDTH) * 100))}%`,
                      top: `${(sim.positions[activeSpeaker][1] / HEIGHT) * 100}%`,
                    } as CSSProperties
                  }
                >
                  <strong>{residents[activeSpeaker].name}</strong>
                  <p>{sim.speech.text}</p>
                  <small>
                    {paused ? "Paused" : `${phaseNames[sim.phase]} · speaking`}
                  </small>
                </div>
              )}
              {sim.phase === "completing" && winner && (
                <div className="activity-banner">
                  At {winner.name} · {winner.activity}
                </div>
              )}
              <div className="map-bottom">
                <span>
                  <span className="status-dot" /> {phaseNames[sim.phase]}
                  {decided && winner ? ` · ${winner.name}` : ""}
                </span>
                <button
                  onClick={() => setLabels((v) => !v)}
                  aria-pressed={labels}
                  title="Toggle resident names"
                >
                  <Users size={15} />
                  <span>Names {labels ? "on" : "off"}</span>
                </button>
              </div>
            </div>
            <div className="map-controls">
              <span>
                <span className="tiny-square" /> Handcrafted pixels. Open-ended
                stories.
              </span>
              <div>
                <span className="mock-pill">DEMO WORLD</span>
                <button
                  className="icon-button"
                  disabled={!started || complete}
                  aria-label={paused ? "Resume simulation" : "Pause simulation"}
                  onClick={togglePause}
                >
                  {paused ? <Play size={15} /> : <Pause size={15} />}
                </button>
                <button
                  className="icon-button"
                  aria-label="Reset demo"
                  onClick={reset}
                >
                  <RotateCcw size={15} />
                </button>
              </div>
            </div>
            <div className="audio-controls">
              <div>
                <button
                  onClick={() =>
                    updateAudio({ musicEnabled: !audioSettings.musicEnabled })
                  }
                  aria-pressed={audioSettings.musicEnabled}
                  aria-label={
                    audioSettings.musicEnabled ? "Mute music" : "Enable music"
                  }
                >
                  <Music2 size={14} />
                  Music {audioSettings.musicEnabled ? "on" : "off"}
                </button>
                <input
                  aria-label="Music volume"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={audioSettings.musicVolume}
                  onChange={(e) =>
                    updateAudio({ musicVolume: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <button
                  onClick={() =>
                    updateAudio({
                      effectsEnabled: !audioSettings.effectsEnabled,
                    })
                  }
                  aria-pressed={audioSettings.effectsEnabled}
                  aria-label={
                    audioSettings.effectsEnabled
                      ? "Mute character and environment sounds"
                      : "Enable character and environment sounds"
                  }
                >
                  {audioSettings.effectsEnabled ? (
                    <Volume2 size={14} />
                  ) : (
                    <VolumeX size={14} />
                  )}
                  Sounds {audioSettings.effectsEnabled ? "on" : "off"}
                </button>
                <input
                  aria-label="Sound effects volume"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={audioSettings.effectsVolume}
                  onChange={(e) =>
                    updateAudio({ effectsVolume: Number(e.target.value) })
                  }
                />
              </div>
              <small>
                {audioNotice ||
                  (hidden
                    ? "Audio suspended while away"
                    : "Original village melody · starts on interaction")}
              </small>
            </div>
            <div className="town-quick-controls">
              <button
                className="start-button"
                aria-label={
                  complete ? "Replay event from town" : "Start event from town"
                }
                disabled={loading || (started && !complete)}
                onClick={start}
              >
                {complete
                  ? "Replay afternoon"
                  : started
                    ? phaseNames[sim.phase]
                    : "Start Event"}
              </button>
              <label>
                Situation
                <select
                  aria-label="Situation from town"
                  value={sim.situation}
                  disabled={loading}
                  onChange={(e) => changeSituation(e.target.value as Situation)}
                >
                  <option value="sunny">Gentle afternoon</option>
                  <option value="rain">Rain begins</option>
                  <option value="performance">Live performance</option>
                </select>
              </label>
            </div>
          </section>
          <aside className="sidebar">
            <section className="residents-card">
              <div className="section-heading">
                <h2>Your residents</h2>
                <span className="count">03</span>
              </div>
              <p className="section-subtitle">
                Different hearts. One little town.
              </p>
              <div className="residents-list">
                {residents.map((r, i) => (
                  <button
                    key={r.id}
                    className={`resident ${selected === i ? "selected" : ""}`}
                    onClick={() => {
                      setSelected(i)
                      interaction()
                    }}
                    aria-pressed={selected === i}
                  >
                    <Portrait index={i} />
                    <span className="resident-info">
                      <span className="resident-name">
                        {r.name}
                        <span className={`resident-state state-${i}`}>
                          {activeSpeaker === i
                            ? "Speaking"
                            : moving
                              ? "On the way"
                              : complete
                                ? "Content"
                                : started
                                  ? "Listening"
                                  : [
                                      "Feeling curious",
                                      "Taking it easy",
                                      "Daydreaming",
                                    ][i]}
                        </span>
                      </span>
                      <span className="interests">
                        {r.interests.join(" · ")}
                      </span>
                    </span>
                    <ChevronRight size={14} />
                  </button>
                ))}
              </div>
              <div className="resident-detail">
                <span className="status-dot" />
                {residents[selected].goal}
              </div>
            </section>
            <section className="event-card">
              <div className="eyebrow">
                <Sparkles size={14} /> A REASON TO COME TOGETHER
              </div>
              <div className="event-illustration" aria-hidden="true">
                <span className="pixel-spark spark-one" />
                <span className="pixel-spark spark-two" />
                <Portrait index={0} />
                <Portrait index={1} />
                <Portrait index={2} />
                <span className="ground-line" />
              </div>
              <h2>
                {decided && winner ? (
                  winner.name
                ) : (
                  <>
                    A little town
                    <br />
                    get-together
                  </>
                )}
              </h2>
              <p>
                {complete && winner
                  ? winner.outcome
                  : started
                    ? phaseNames[sim.phase]
                    : "Good company doesn’t need a big occasion. Bring everyone to the square."}
              </p>
              {started && (
                <div
                  className="phase-progress"
                  aria-label={`Stage ${phases.indexOf(sim.phase)} of 7: ${phaseNames[sim.phase]}`}
                >
                  {phases.slice(1).map((p, i) => (
                    <span
                      key={p}
                      className={phases.indexOf(sim.phase) > i ? "done" : ""}
                      title={phaseNames[p]}
                    />
                  ))}
                </div>
              )}
              {sim.decision && sim.phase !== "gathering" && (
                <div className="proposal-list">
                  {residents.map((r) => (
                    <div key={r.id}>
                      <strong>{r.name}</strong>
                      <span>
                        {destination(sim.decision!.proposals[r.id]).name}
                      </span>
                      <small>
                        {
                          sim.decision!.recommendations.find(
                            (v) =>
                              v.residentId === r.id &&
                              v.destinationId === sim.decision!.proposals[r.id]
                          )!.score
                        }
                      </small>
                    </div>
                  ))}
                  <details>
                    <summary>
                      {decided ? "Why this choice?" : "Compare all choices"}
                    </summary>
                    <p>{sim.decision.explanation}</p>
                    {sim.decision.alternatives.map((a) => (
                      <div key={a.id}>
                        {destination(a.id).name}
                        <strong>{a.collective.toFixed(1)}</strong>
                      </div>
                    ))}
                  </details>
                </div>
              )}
              {decided && sim.decision && (
                <p className="decision-summary">
                  Best shared fit: {sim.decision.winner.collective.toFixed(1)}
                  /100. Every resident scores at least{" "}
                  {sim.decision.winner.minimum}.
                </p>
              )}
              {complete && sim.decision && (
                <div className="outcome-reactions">
                  {residents.map((r) => (
                    <span key={r.id}>
                      {r.name}:{" "}
                      {sim.decision!.winner.scores[r.id] >= 75
                        ? "Loved it"
                        : sim.decision!.winner.scores[r.id] >= 60
                          ? "Glad we went"
                          : "Enjoyed the company"}
                    </span>
                  ))}
                </div>
              )}
              <div className="event-meta">
                <span>
                  <MapPin size={13} />
                  {decided && winner ? winner.name : "Town square"}
                </span>
                <span>
                  <Users size={13} />3 neighbors
                </span>
              </div>
              <button
                className="start-button"
                onClick={start}
                disabled={loading || (started && !complete)}
              >
                {complete ? (
                  <RotateCcw size={15} />
                ) : started ? (
                  <span className="status-dot" />
                ) : (
                  <Play size={14} fill="currentColor" />
                )}
                {loading
                  ? "Getting ready…"
                  : complete
                    ? "Replay afternoon"
                    : started
                      ? paused
                        ? "Afternoon paused"
                        : phaseNames[sim.phase]
                      : "Start Event"}
                {!started && <ArrowUpRight size={16} />}
              </button>
              <span className="event-footnote">
                {complete
                  ? "A lovely afternoon, ready to relive."
                  : "A small moment. A possible friendship."}
              </span>
              {error && <p role="alert">{error}</p>}
              <div className="situation-control">
                <label htmlFor="situation">Change the situation</label>
                <select
                  id="situation"
                  value={sim.situation}
                  disabled={loading}
                  onChange={(e) => changeSituation(e.target.value as Situation)}
                >
                  <option value="sunny">A gentle afternoon</option>
                  <option value="rain">Rain begins</option>
                  <option value="performance">Surprise live performance</option>
                </select>
                <small>
                  {started
                    ? "New context → fresh scores → a new conversation."
                    : "Choose a context, then start your afternoon."}
                </small>
              </div>
            </section>
          </aside>
          <section className="story-panel">
            <div
              className="story-tabs"
              role="tablist"
              aria-label="Town activity"
            >
              <button
                role="tab"
                aria-selected={tab === "dialogue"}
                aria-controls="story-content"
                onClick={() => setTab("dialogue")}
              >
                <MessageCircle size={15} />
                Town conversations
                {spoken.length > 0 && (
                  <span className="count">{spoken.length}</span>
                )}
              </button>
              <button
                role="tab"
                aria-selected={tab === "log"}
                aria-controls="story-content"
                onClick={() => setTab("log")}
              >
                <Flag size={14} />
                Decision log<span className="count">{logs.length}</span>
              </button>
              <span className="script-label">MOCK TASTES</span>
            </div>
            <div
              id="story-content"
              role="tabpanel"
              className="story-content"
              aria-live="polite"
            >
              {tab === "dialogue" ? (
                <>
                  <Portrait index={speaker} large />
                  <div className="dialogue-copy">
                    <div>
                      <strong>
                        {current
                          ? residents[speaker].name
                          : started
                            ? "Littlehaven"
                            : residents[selected].name}
                      </strong>
                      <span>
                        {current
                          ? phaseNames[sim.phase]
                          : started
                            ? "a story is beginning"
                            : "enjoying the afternoon"}
                      </span>
                    </div>
                    <p>
                      {current
                        ? `“${current.text}”`
                        : started
                          ? "Footsteps on the path. A familiar face. Something lovely is about to happen."
                          : "“There’s something about this town. It feels like a good day to meet someone new.”"}
                    </p>
                    <small>
                      {started
                        ? `${spoken.length} moments shared · ${phaseNames[sim.phase]}`
                        : "Start an event and watch a little story unfold."}
                    </small>
                  </div>
                  <span className="dialogue-decoration">
                    <MessageCircle size={30} />
                  </span>
                </>
              ) : (
                <ol className="decision-log">
                  {!logs.length && (
                    <li>
                      MOCK · Start an event to see every resident’s scores and
                      the collective decision.
                    </li>
                  )}
                  {logs.map((l) => (
                    <li key={l.id}>
                      <span>
                        <Check size={12} />
                      </span>
                      <time>
                        {Math.floor(l.time / 60)}:
                        {String(Math.floor(l.time % 60)).padStart(2, "0")}
                      </time>
                      {l.text}
                    </li>
                  ))}
                </ol>
              )}
            </div>
            {tab === "dialogue" && spoken.length > 0 && (
              <details className="conversation-history">
                <summary>
                  Conversation history · {spoken.length} messages
                </summary>
                <ol>
                  {spoken.map((line) => (
                    <li key={line.id}>
                      <strong>
                        {residents.find((r) => r.id === line.speaker)!.name}
                      </strong>{" "}
                      {line.text}
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </section>
          <div className="demo-note">
            <span className="note-icon">
              <Leaf size={18} />
            </span>
            <div>
              <strong>Small world. Room to grow.</strong>
              <p>
                Deterministic agents, contextual dialogue, and explicitly MOCK
                taste data. Decisions are calculated locally. No live AI or Qloo
                connection.
              </p>
            </div>
            <ArrowDownRight size={18} />
          </div>
        </div>
        <footer>
          <span className="footer-brand">
            worldlings <span>·</span> Made for the moments in between.
          </span>
          <span>
            LOCAL DEMO <Minus size={12} /> V.0.2
          </span>
        </footer>
      </main>
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <section
            className="help-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              autoFocus
              className="icon-button close-modal"
              aria-label="Close help"
              onClick={() => setHelp(false)}
              onKeyDown={(e) => {
                if (e.key === "Tab") e.preventDefault()
              }}
            >
              <X size={20} />
            </button>
            <Leaf size={28} />
            <h2 id="help-title">A little guide to Littlehaven</h2>
            <p>
              Select a resident to highlight them in town. Start an event to
              bring all three neighbors to the square and hear their
              conversation.
            </p>
            <p>
              Use pause to linger, or reset to begin again. The decision log
              records each step.
            </p>
            <div className="help-note">
              <Clock3 size={18} />
              <span>
                Residents propose, negotiate, choose, travel, and complete an
                activity. Change the situation to reevaluate their choices.
                Music and character sounds have independent controls. All taste
                data is MOCK, not live Qloo.
              </span>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
