import {
  residents,
  destination,
  situationNames,
  type Point,
  type Situation,
} from "./profiles"
import { negotiate, type Decision } from "./decision"
import { composeDialogue, type Line, type SpeakingPhase } from "./dialogue"
import {
  alongRoute,
  routeLength,
  routeToDestination,
  routeToSquare,
  type Route,
} from "./movement"
import type { TasteRecommendation } from "./taste-provider"
export const phases = [
  "idle",
  "gathering",
  "proposing",
  "deliberating",
  "deciding",
  "traveling",
  "completing",
  "finished",
] as const
export type Phase = (typeof phases)[number]
export const phaseNames: Record<Phase, string> = {
  idle: "Ready for a little adventure",
  gathering: "Gathering in the square",
  proposing: "Sharing our ideas",
  deliberating: "Finding common ground",
  deciding: "A decision, together",
  traveling: "On our way",
  completing: "Making a memory",
  finished: "An afternoon well spent",
}
export interface Speech extends Line {
  id: string
  time: number
  duration: number
}
export interface LogEntry {
  id: string
  time: number
  text: string
}
export interface Simulation {
  phase: Phase
  time: number
  total: number
  round: number
  situation: Situation
  positions: Point[]
  routes: Route[]
  duration: number
  decision: Decision | null
  speech: Speech | null
  history: Speech[]
  logs: LogEntry[]
}
export function idleSimulation(situation: Situation = "sunny"): Simulation {
  return {
    phase: "idle",
    time: 0,
    total: 0,
    round: 0,
    situation,
    positions: residents.map((r) => r.start),
    routes: [],
    duration: 0,
    decision: null,
    speech: null,
    history: [],
    logs: [],
  }
}
function log(s: Simulation, text: string) {
  s.logs = [
    ...s.logs,
    { id: `${s.round}-${s.logs.length}`, time: s.total, text },
  ]
}
const isSpeaking = (p: Phase): p is SpeakingPhase =>
  ["proposing", "deliberating", "deciding", "completing"].includes(p)
export function lineDuration(line: Line) {
  return Math.max(5, Math.min(10, line.text.length / 28 + 1))
}
function linesFor(s: Simulation) {
  return isSpeaking(s.phase) && s.decision
    ? composeDialogue(s.phase, s.decision, s.situation)
    : []
}
function updateSpeech(s: Simulation) {
  const lines = linesFor(s)
  let at = 0
  for (let i = 0; i < lines.length; i++) {
    const duration = lineDuration(lines[i])
    if (s.time < at + duration) {
      const id = `${s.round}-${s.phase}-${i}`
      if (s.speech?.id !== id) {
        s.speech = { ...lines[i], id, time: s.total - s.time + at, duration }
        s.history = [...s.history, s.speech]
        if (s.phase === "deliberating")
          log(
            s,
            `${residents.find((r) => r.id === s.speech!.speaker)!.name} negotiates: ${s.speech.text}`
          )
      }
      return
    }
    at += duration
  }
  s.speech = null
}
function enter(s: Simulation, phase: Phase) {
  s.phase = phase
  s.time = 0
  s.speech = null
  if (phase === "gathering")
    s.routes = s.positions.map((p, i) => routeToSquare(p, i))
  if (phase === "traveling")
    s.routes = s.positions.map((p, i) =>
      routeToDestination(p, s.decision!.winner.id, i)
    )
  if (phase === "gathering" || phase === "traveling")
    s.duration = Math.max(4, ...s.routes.map((r) => routeLength(r) / 28))
  else if (isSpeaking(phase))
    s.duration = linesFor(s).reduce((sum, l) => sum + lineDuration(l), 0)
  else s.duration = 0
  if (phase === "proposing")
    for (const r of residents) {
      const rec = s.decision!.recommendations.filter(
        (v) => v.residentId === r.id
      )
      log(
        s,
        `${r.name} · ${r.personality}. Goal: ${r.goal}. Cultural tastes: ${r.culture.join(", ")}. ${rec.map((v) => `${destination(v.destinationId).name} ${v.score}: ${v.reasons.join("; ")}`).join(" | ")}. Proposes ${destination(s.decision!.proposals[r.id]).name}.`
      )
    }
  if (phase === "deliberating")
    for (const a of s.decision!.alternatives)
      log(
        s,
        `${destination(a.id).name}: ${residents.map((r) => `${r.name} ${a.scores[r.id]}`).join(" / ")}; average ${a.mean.toFixed(1)}, minimum ${a.minimum}, collective ${a.collective.toFixed(1)}.`
      )
  if (phase === "deciding")
    log(s, `Final compromise: ${s.decision!.explanation}`)
  if (phase === "traveling")
    log(
      s,
      `All three neighbors set off for ${destination(s.decision!.winner.id).name}.`
    )
  if (phase === "completing")
    log(
      s,
      `Arrived at ${destination(s.decision!.winner.id).name}; now ${destination(s.decision!.winner.id).activity}.`
    )
  if (phase === "finished")
    log(s, `Completed: ${destination(s.decision!.winner.id).outcome}`)
  updateSpeech(s)
}
export function beginSimulation(
  previous: Simulation,
  situation: Situation,
  recommendations: TasteRecommendation[]
): Simulation {
  const decision = negotiate(recommendations)
  const s: Simulation = {
    ...previous,
    positions: [...previous.positions],
    logs: [...previous.logs],
    history: [...previous.history],
    round: previous.round + 1,
    situation,
    decision,
  }
  const changed = previous.round > 0
  log(
    s,
    `${recommendations
      .map((r) => r.source)
      .filter((v, i, a) => a.indexOf(v) === i)
      .join(
        " + "
      )} recommendations. ${situationNames[situation]}. ${changed ? `Reevaluating every score; previous choice was ${destination(previous.decision!.winner.id).name}. ${decision.winner.id === previous.decision!.winner.id ? "The calculated leading choice remains the same." : "The updated scores favor a different destination."}` : "Every resident contributes equally; collective score = 65% average + 35% minimum. Ties use highest minimum, then destination ID."}`
  )
  enter(s, "gathering")
  return s
}
/** Pure deterministic transitions. Large ticks are split at phase and utterance boundaries. */
export function advanceSimulation(
  previous: Simulation,
  delta: number
): Simulation {
  if (previous.phase === "idle" || previous.phase === "finished" || delta <= 0)
    return previous
  const s = { ...previous }
  let remaining = delta
  while (remaining > 0 && s.phase !== "finished") {
    const speechBoundary = s.speech
      ? s.speech.time + s.speech.duration - s.total
      : Infinity
    const step = Math.min(
      remaining,
      s.duration - s.time,
      Math.max(0.000001, speechBoundary)
    )
    s.time += step
    s.total += step
    remaining -= step
    if (s.phase === "gathering" || s.phase === "traveling")
      s.positions = s.routes.map((r) => alongRoute(r, s.time / s.duration))
    if (s.time >= s.duration - 1e-7)
      enter(s, phases[phases.indexOf(s.phase) + 1])
    else updateSpeech(s)
  }
  return s
}
