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
import { residents, destination, type Situation } from "@/lib/world/profiles"
import {
  phaseNames as originalPhaseNames,
  phases,
} from "@/lib/world/living/base"
import { squareOccupants } from "@/lib/world/living/presence"
import type { EncounterMode } from "@/lib/world/living/types"
import { useWorld } from "./use-world"

const phaseNames = {
  ...originalPhaseNames,
  gathering: "Crossing paths",
  waiting: "Waiting for conversation…",
  proposing: "A chance encounter",
  completing: "Following our interests",
  finished: "A little pause",
}

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
    speed,
    setSpeed,
    nextEvent,
    checkpoint,
    paused,
    hidden,
    loading,
    error,
    audioNotice,
    audioSettings,
    updateAudio,
    start,
    changeSituation,
    changeEncounter,
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
    current = sim.speech
  const speaker = current
    ? residents.findIndex((r) => r.id === current.speaker)
    : selected
  const activeSpeaker = sim.speech
    ? residents.findIndex((r) => r.id === sim.speech!.speaker)
    : -1
  const moving = Object.keys(sim.transits).length > 0
  const occupants = squareOccupants(sim.positions)
  const decided = ["deciding", "traveling", "completing", "finished"].includes(
    sim.phase
  )
  const winner = sim.bundle
    ? destination(sim.bundle.plan.destinations[residents[selected].id])
    : null
  const meeting =
    sim.bundle &&
    sim.bundle.plan.participants.every(
      (id) =>
        sim.bundle!.plan.destinations[id] ===
        sim.bundle!.plan.destinations[sim.bundle!.plan.participants[0]]
    )
      ? destination(
          sim.bundle.plan.destinations[sim.bundle.plan.participants[0]]
        )
      : null
  const agent = sim.world.agents[selected]
  const diagnostics = sim.bundle?.diagnostics
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
        residents.map((r) => !!sim.transits[r.id]),
        activeSpeaker,
        sim.phase === "completing" ? sim.bundle?.plan.destinations : undefined
      )
  }, [
    elapsed,
    selected,
    labels,
    sim.positions,
    moving,
    activeSpeaker,
    sim.phase,
    sim.bundle,
    sim.transits,
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
                Day {String(sim.world.day).padStart(2, "0")} <span>·</span>{" "}
                {sim.world.hour < 12
                  ? "Morning"
                  : sim.world.hour < 17
                    ? "Afternoon"
                    : "Evening"}
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
                    : sim.joining
                      ? "A neighbor is joining"
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
                <Sun size={14} /> LITTLEHAVEN <span>•</span> Day {sim.world.day}{" "}
                · {sim.world.hour}:00
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
                  <strong>
                    {residents[activeSpeaker].name}{" "}
                    <span aria-label={sim.speech.action}>
                      {
                        {
                          laugh: "♫",
                          wave: "👋",
                          shrug: "…",
                          point: "☞",
                          sketch: "✎",
                          dance: "♪",
                          sit: "☕",
                          observe: "◉",
                          react: "!",
                          talk: "",
                          walk_to: "➜",
                        }[sim.speech.action]
                      }
                    </span>
                  </strong>
                  <p>{sim.speech.text}</p>
                  <small>
                    {paused
                      ? "Paused"
                      : `${sim.speech.emotion} · ${sim.speech.action}`}
                  </small>
                </div>
              )}
              {sim.phase === "completing" && sim.bundle?.plan.incident && (
                <div
                  className="incident-emote"
                  style={{
                    left: `${(sim.positions[residents.findIndex((r) => r.id === sim.bundle!.plan.incident!.actor)][0] / WIDTH) * 100}%`,
                    top: `${(sim.positions[residents.findIndex((r) => r.id === sim.bundle!.plan.incident!.actor)][1] / HEIGHT) * 100}%`,
                  }}
                  aria-label={sim.bundle.plan.incident.description}
                >
                  {sim.bundle.plan.incident.id === "unexpected-portrait"
                    ? "✎"
                    : sim.bundle.plan.incident.emotion === "annoyed"
                      ? "☂"
                      : "♫"}
                </div>
              )}
              {sim.phase === "completing" && winner && (
                <div className="activity-banner">
                  Everyone settles into their plans
                </div>
              )}
              <div className="map-bottom">
                <span>
                  <span className="status-dot" /> {phaseNames[sim.phase]}
                  {decided && winner
                    ? ` · ${residents[selected].name}: ${winner.name}`
                    : ""}
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
                <span className="provider-pill">
                  {diagnostics?.llm ?? "Not generated"} ·{" "}
                  {diagnostics?.taste ?? "Qloo not requested"}
                </span>
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
                  aria-label="Reset World"
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
                  complete ? "Continue from town" : "Start event from town"
                }
                disabled={loading || (started && !complete)}
                onClick={start}
              >
                {complete
                  ? "Continue"
                  : started
                    ? phaseNames[sim.phase]
                    : "Start Event"}
              </button>
              <button
                onClick={nextEvent}
                disabled={loading || (started && !complete)}
              >
                Next Event
              </button>
              <label>
                Speed{" "}
                <select
                  aria-label="Simulation speed"
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                >
                  <option value={1}>1×</option>
                  <option value={2}>2×</option>
                  <option value={4}>4×</option>
                </select>
              </label>
              <label>
                Situation
                <select
                  aria-label="Situation from town"
                  value={sim.situation}
                  disabled={loading || (started && !complete)}
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
                            : sim.world.agents[i].mood}
                        </span>
                      </span>
                      <span className="interests">
                        {sim.world.agents[i].location === "square"
                          ? "Town square"
                          : sim.world.agents[i].location === "path"
                            ? "Walking through town"
                            : destination(
                                sim.world.agents[i].location as
                                  "cafe" | "music" | "museum"
                              ).name}{" "}
                        ·{" "}
                        {sim.transits[r.id]
                          ? "On the way"
                          : sim.world.agents[i].goal}
                      </span>
                    </span>
                    <ChevronRight size={14} />
                  </button>
                ))}
              </div>
              <div className="resident-detail">
                <span className="status-dot" />
                {agent.goal}
              </div>
              <details className="memory-panel">
                <summary>
                  {residents[selected].name}’s memories & friendships
                </summary>
                <p>
                  {agent.mood} · Energy {Math.round(agent.energy)} ·{" "}
                  {agent.goal}
                </p>
                {residents
                  .filter((r) => r.id !== agent.id)
                  .map((r) => (
                    <p key={r.id}>
                      {r.name}:{" "}
                      {agent.relationships[r.id] >= 65
                        ? "Growing closer"
                        : agent.relationships[r.id] < 45
                          ? "A little tension"
                          : "Getting to know each other"}
                    </p>
                  ))}
                <ul>
                  {agent.memories.slice(-4).map((m) => (
                    <li key={m.id}>
                      Day {m.day}: {m.text}
                    </li>
                  ))}
                </ul>
                {agent.memorySummary && <p>{agent.memorySummary}</p>}
                {!agent.memories.length && (
                  <p>A fresh page. Experiences will stay with them.</p>
                )}
                {agent.important.length > 0 && (
                  <>
                    <strong>What stays with me</strong>
                    <ul>
                      {agent.important.map((m) => (
                        <li key={m.id}>{m.text}</li>
                      ))}
                    </ul>
                  </>
                )}
              </details>
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
                {decided && sim.bundle ? (
                  (meeting?.name ?? "Different little adventures")
                ) : (
                  <>
                    A little town
                    <br />
                    get-together
                  </>
                )}
              </h2>
              <p>
                {sim.bundle?.scene.summary ??
                  "A chance encounter, separate plans, and something unexpected around the corner."}
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
              {sim.bundle && (
                <div className="proposal-list">
                  {residents.map((r) => (
                    <div key={r.id}>
                      <strong>{r.name}</strong>
                      <span>
                        {destination(sim.bundle!.plan.destinations[r.id]).name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {sim.world.events.length > 0 && (
                <p className="recent-incident">
                  Recently: {sim.world.events.at(-1)}
                </p>
              )}
              <div className="event-meta">
                <span>
                  <MapPin size={13} />
                  {decided
                    ? (meeting?.name ?? "Around Littlehaven")
                    : "Town square"}
                </span>
                <span>
                  <Users size={13} />
                  {occupants.length} in the square
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
                    ? "Continue"
                    : started
                      ? paused
                        ? "Afternoon paused"
                        : phaseNames[sim.phase]
                      : "Start Event"}
                {!started && <ArrowUpRight size={16} />}
              </button>
              <span className="event-footnote">
                {complete
                  ? sim.world.completed >= checkpoint
                    ? "A quiet checkpoint. Continue for three more scenes."
                    : "The next moment is on its way."
                  : "A small moment. A possible friendship."}
              </span>
              {error && <p role="alert">{error}</p>}
              <div className="situation-control">
                <label htmlFor="situation">Change the situation</label>
                <select
                  id="situation"
                  value={sim.situation}
                  disabled={loading || (started && !complete)}
                  onChange={(e) => changeSituation(e.target.value as Situation)}
                >
                  <option value="sunny">A gentle afternoon</option>
                  <option value="rain">Rain begins</option>
                  <option value="performance">Surprise live performance</option>
                </select>
                <small>
                  {started
                    ? "Change the weather between scenes."
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
                World log<span className="count">{logs.length}</span>
              </button>
              <span className="script-label">
                {diagnostics?.taste ?? "Qloo not requested"}
              </span>
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
                            ? diagnostics?.llm === "Fallback"
                              ? "independent activities"
                              : "between conversations"
                            : "enjoying the afternoon"}
                      </span>
                    </div>
                    <p>
                      {current
                        ? `“${current.text}”`
                        : started
                          ? diagnostics?.llm === "Fallback"
                            ? (diagnostics.reason ??
                              "Dialogue unavailable. The neighbors continue their own activities.")
                            : "The neighbors are following their plans."
                          : "Start the simulation to meet the neighbors."}
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
                      Start an event to see every resident’s scores and the
                      collective decision.
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
          <details className="provider-details">
            <summary>
              Cultural signals & developer inspection ·{" "}
              {diagnostics?.llm ?? "Not generated"} ·{" "}
              {diagnostics?.taste ?? "Qloo not requested"}
            </summary>
            <p>
              {diagnostics?.reason ??
                "Live status appears only after a successful scene response."}
            </p>
            <p>{diagnostics?.tasteReason}</p>
            <p data-testid="qloo-diagnostics">
              Qloo:{" "}
              {diagnostics?.qloo.configured === true
                ? "configured"
                : diagnostics?.qloo.configured === false
                  ? "credentials missing"
                  : "configuration unknown (scene request failed)"}
              {" · "}Host:{" "}
              {diagnostics?.qloo.baseUrl ?? "https://hackathon.api.qloo.com"}
              {" · "}Last authenticated success:{" "}
              {diagnostics?.qloo.lastSuccessfulCall ?? "none"}
              {" · "}Cache: {diagnostics?.qloo.cacheStatus ?? "none"}
              {" · "}Recommendations: {diagnostics?.qloo.recommendations ?? 0}
              {" · "}Requests: {diagnostics?.qloo.liveRequests ?? 0} live /{" "}
              {diagnostics?.qloo.cachedRequests ?? 0} cached
            </p>
            {diagnostics?.qloo.requestCategories.length ? (
              <p>
                Qloo request categories:{" "}
                {diagnostics.qloo.requestCategories.join(", ")}
              </p>
            ) : null}
            {diagnostics?.qloo.lastError ? (
              <p role="status">Qloo error: {diagnostics.qloo.lastError}</p>
            ) : null}
            <p data-testid="dialogue-diagnostics">
              Dialogue source: {diagnostics?.llm ?? "not requested"} · Model:{" "}
              {diagnostics?.model ?? "pending"} · Scene:{" "}
              {sim.bundle?.scene.sceneId ?? "none"} · Participants:{" "}
              {sim.bundle?.plan.participants.join(", ") ?? "none"} · Request:{" "}
              {diagnostics?.requestStatus ?? "not requested"} · Attempts:{" "}
              {diagnostics?.attempts ?? 0} · Validation:{" "}
              {diagnostics?.repetition ?? "not checked"}
            </p>
            <label>
              Gathering scenario{" "}
              <select
                aria-label="Gathering scenario"
                disabled={loading || (started && !complete)}
                value={sim.world.encounter ?? "auto"}
                onChange={(e) =>
                  changeEncounter(e.target.value as EncounterMode)
                }
              >
                <option value="auto">Natural schedules</option>
                <option value="pair">Mia & Kai</option>
                <option value="trio">All three together</option>
                <option value="join">Luna joins Mia & Kai</option>
                <option value="solo">Luna’s quiet moment</option>
              </select>
            </label>
            <p data-testid="square-occupants">
              In the square: {occupants.join(", ") || "nobody yet"}.
              Conversation: {sim.present.join(", ") || "none"}.
            </p>
            <p>
              Groq requests: {diagnostics?.calls ?? 0}/
              {diagnostics?.limit ?? 10} · Scene tokens:{" "}
              {diagnostics?.inputTokens ?? 0} in /{" "}
              {diagnostics?.outputTokens ?? 0} out
            </p>
            <ul>
              {diagnostics?.signals.map((signal, i) => (
                <li key={i}>
                  {signal.residentId}: {signal.name} · {signal.source}
                  {` · ${signal.entityId}`}
                  {signal.affinity !== null
                    ? ` · affinity ${signal.affinity}`
                    : ""}
                </li>
              ))}
            </ul>
            <p>
              Local activity scores combine cultural fit, mood, energy, goals,
              relationships, weather, recent visits and seeded variation. They
              are not Qloo affinity scores.
            </p>
            {sim.bundle?.plan.culturalDecision && (
              <div data-testid="cultural-decision">
                <strong>Latest Qloo-driven decision</strong>
                <p>
                  {sim.bundle.plan.culturalDecision.residentId} ·{" "}
                  {sim.bundle.plan.culturalDecision.entityName} ·{" "}
                  {sim.bundle.plan.culturalDecision.action} ·{" "}
                  {sim.bundle.plan.culturalDecision.rationale}
                </p>
                <p>
                  Verified signals:{" "}
                  {sim.bundle.plan.culturalDecision.tasteSignalEntityIds.join(
                    ", "
                  )}
                  {" · "}Completed:{" "}
                  {sim.bundle.plan.culturalDecision.completed ? "yes" : "no"}
                  {" · "}Preference changed:{" "}
                  {sim.bundle.plan.culturalDecision.preferenceChanged
                    ? "yes"
                    : "no"}
                </p>
              </div>
            )}
            {sim.world.gatherings.at(-1) && (
              <p data-testid="gathering-diagnostics">
                Gathering: {sim.world.gatherings.at(-1)!.reason} ·{" "}
                {sim.world.gatherings.at(-1)!.status} · invitees{" "}
                {sim.world.gatherings.at(-1)!.invited.join(", ")}
              </p>
            )}
            {sim.bundle?.plan.scores.map((row) => (
              <p key={`${row.residentId}-${row.destinationId}`}>
                {row.residentId} → {destination(row.destinationId).name}:{" "}
                {row.total} ·{" "}
                {Object.entries(row.factors)
                  .map(([key, value]) => `${key} ${value}`)
                  .join(" / ")}
              </p>
            ))}
          </details>
          <div className="demo-note">
            <span className="note-icon">
              <Leaf size={18} />
            </span>
            <div>
              <strong>Small world. Room to grow.</strong>
              <p>
                {diagnostics?.llm === "Groq Live"
                  ? "Groq Live · A new story, shaped by their memories."
                  : `Fallback · ${diagnostics?.reason ?? "Dialogue unavailable. Residents continue their own activities."}`}
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
              Select a resident to see their memories and friendships. Start an
              event to watch neighbors cross paths and follow their interests.
            </p>
            <p>
              Use pause to linger, or reset to begin again. The decision log
              records each step.
            </p>
            <div className="help-note">
              <Clock3 size={18} />
              <span>
                Watch three connected scenes, then Continue at the checkpoint.
                Next Event plays one scene. Change the situation between scenes.
                Music and character sounds have independent controls. Provider
                status and cultural evidence appear below the town.
              </span>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
