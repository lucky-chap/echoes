import {
  residents,
  destination,
  type ResidentId,
  type Situation,
} from "../profiles"
import { idleSimulation, type Simulation, type Speech } from "../simulation"
import {
  alongRoute,
  routeLength,
  routeToDestination,
  routeToSquare,
} from "../movement"
import { newWorld, nextGoal, seeded } from "./planner"
import { validateScene } from "./validation"
import type { SceneBundle, Snapshot, Memory, Beat } from "./types"
export interface LivingSimulation extends Simulation {
  world: Snapshot
  bundle: SceneBundle | null
  beat: number
  speech: (Speech & Pick<Beat, "action" | "emotion" | "targetLocation">) | null
}
export function idleLiving(situation: Situation = "sunny"): LivingSimulation {
  return {
    ...idleSimulation(situation),
    speech: null,
    world: { ...newWorld(), situation },
    bundle: null,
    beat: 0,
  }
}
const clamp = (n: number) => Math.max(0, Math.min(100, n))
function log(s: LivingSimulation, text: string) {
  s.logs = [
    ...s.logs,
    { id: `${s.round}-${s.total}-${s.logs.length}`, time: s.total, text },
  ].slice(-100)
}
function remember(
  s: LivingSimulation,
  id: ResidentId,
  memory: Omit<Memory, "id" | "day" | "scene">
) {
  const a = s.world.agents.find((a) => a.id === id)!
  const m = {
    ...memory,
    id: `${s.round}-${s.beat}-${id}-${memory.kind}`,
    day: s.world.day,
    scene: s.round,
  }
  a.memories = [...a.memories, m].slice(-8)
  if (["promise", "discovery", "incident"].includes(m.kind))
    a.important = [...a.important.filter((x) => x.text !== m.text), m].slice(-4)
}
function speak(s: LivingSimulation) {
  const b = s.bundle!.scene.beats[s.beat]
  s.duration = Math.max(3, Math.min(9, b.dialogue.length / 24 + 1))
  s.time = 0
  s.speech = {
    ...b,
    text: b.dialogue,
    id: `${s.round}-beat-${s.beat}`,
    time: s.total,
    duration: s.duration,
  }
  s.history = [...s.history, s.speech].slice(-80)
  s.world.agents.find((a) => a.id === b.speaker)!.mood = b.emotion
}
function finishBeat(s: LivingSimulation) {
  const { scene } = s.bundle!,
    b = scene.beats[s.beat]
  s.world.recentDialogue = [
    ...s.world.recentDialogue,
    { speaker: b.speaker, text: b.dialogue },
  ].slice(-8)
  for (const m of scene.suggestedMemoryUpdates.filter(
    (m) => m.beatIndex === s.beat
  ))
    remember(s, m.residentId, {
      kind: m.kind,
      text: b.dialogue,
      location: null,
      positive: !["annoyed", "embarrassed"].includes(b.emotion),
    })
  for (const r of scene.suggestedRelationshipChanges.filter(
    (r) => r.beatIndex === s.beat
  )) {
    const a = s.world.agents.find((a) => a.id === r.from)!
    a.relationships[r.to] = clamp(a.relationships[r.to] + r.delta)
  }
  log(
    s,
    `${residents.find((r) => r.id === b.speaker)!.name}: ${b.action} · ${b.emotion}`
  )
}
function travel(s: LivingSimulation) {
  s.phase = "traveling"
  s.time = 0
  s.speech = null
  s.routes = s.positions.map((p, i) =>
    s.bundle!.plan.participants.includes(residents[i].id)
      ? routeToDestination(p, s.bundle!.plan.destinations[residents[i].id], i)
      : [p]
  )
  s.duration = Math.max(1, ...s.routes.map((r) => routeLength(r) / 28))
  log(s, "The neighbors follow their own plans.")
}
function arrive(s: LivingSimulation) {
  s.phase = "completing"
  s.time = 0
  s.duration = 5
  for (const a of s.world.agents) {
    a.location = s.bundle!.plan.destinations[a.id]
  }
  const incident = s.bundle!.plan.incident
  if (incident) {
    s.world.agents.find((a) => a.id === incident.actor)!.mood = incident.emotion
    s.world.incidents = [
      ...s.world.incidents,
      `${s.world.completed}:${incident.id}`,
    ].slice(-8)
    s.world.events = [...s.world.events, incident.description].slice(-8)
    remember(s, incident.actor, {
      kind: "incident",
      text: incident.description,
      location: incident.destination,
      positive: incident.emotion !== "annoyed",
    })
    log(s, incident.description)
  }
}
function finish(s: LivingSimulation) {
  for (const a of s.world.agents) {
    const d = s.bundle!.plan.destinations[a.id]
    a.recentVisits = [d, ...a.recentVisits].slice(0, 5)
    a.energy = clamp(a.energy + (d === "music" ? -18 : 12))
    a.hunger = clamp(a.hunger + (d === "cafe" ? -55 : 22))
    a.social = clamp(
      a.social + (s.bundle!.plan.participants.includes(a.id) ? -15 : 20)
    )
    remember(s, a.id, {
      kind: "activity",
      text: `Spent ${s.world.hour < 12 ? "the morning" : s.world.hour < 17 ? "the afternoon" : "the evening"} at ${destination(d).name}.`,
      location: d,
      positive: a.mood !== "annoyed",
    })
    const signal = s.bundle!.diagnostics.signals.find(
      (x) => x.residentId === a.id && x.source === "LIVE Qloo"
    )
    if (signal) {
      remember(s, a.id, {
        kind: "discovery",
        text: `Discovered ${signal.name}.`,
        location: d,
        positive: true,
      })
      const key = signal.category === "artist" ? "music" : "art"
      a.learned[key] = Math.min(0.2, (a.learned[key] ?? 0) + 0.02)
    }
    a.goal = nextGoal(a)
  }
  s.world.completed++
  s.world.hour += 5
  if (s.world.hour >= 22) {
    s.world.day++
    const weather = seeded(s.world.seed, s.world.day * 109)
    s.world.situation =
      weather < 0.2 ? "rain" : weather > 0.85 ? "performance" : "sunny"
    s.situation = s.world.situation
    s.world.hour = 9
    for (const a of s.world.agents) {
      a.energy = 80
      a.hunger = 60
      a.social = clamp(a.social + 25)
      a.mood = a.id === "kai" ? "excited" : "curious"
      a.goal = nextGoal(a)
    }
    log(s, `A new morning in Littlehaven. Day ${s.world.day}.`)
  }
  s.world.lastParticipants = s.bundle!.plan.participants
  s.world.positions = s.positions
  s.phase = "finished"
  s.speech = null
  s.time = 0
  log(s, `Scene ${s.round} complete. Memories saved.`)
}
export function beginLiving(
  previous: LivingSimulation,
  bundle: SceneBundle
): LivingSimulation {
  validateScene(bundle.scene, bundle.plan)
  const s = structuredClone(previous)
  s.bundle = bundle
  s.round = s.world.completed + 1
  s.phase = "gathering"
  s.time = 0
  s.beat = 0
  s.speech = null
  s.routes = s.positions.map((p, i) =>
    bundle.plan.participants.includes(residents[i].id)
      ? routeToSquare(p, i)
      : [
          ...routeToSquare(p, i),
          ...routeToDestination(
            residents[i].end,
            bundle.plan.destinations[residents[i].id],
            i
          ).slice(1),
        ]
  )
  s.duration = Math.max(1, ...s.routes.map((r) => routeLength(r) / 28))
  log(s, bundle.plan.summary)
  for (const row of bundle.plan.scores)
    log(
      s,
      `${row.residentId} → ${destination(row.destinationId).name}: ${row.total}; ${Object.entries(
        row.factors
      )
        .map(([k, v]) => `${k} ${v}`)
        .join(", ")}`
    )
  return s
}
/** Pure transitions split at every utterance and arrival: no unplayed memory commits. */
export function advanceLiving(
  previous: LivingSimulation,
  delta: number
): LivingSimulation {
  if (
    delta <= 0 ||
    !Number.isFinite(delta) ||
    previous.phase === "idle" ||
    previous.phase === "finished"
  )
    return previous
  const s = structuredClone(previous)
  let remaining = delta
  while (remaining > 0 && s.phase !== "finished") {
    const step = Math.min(remaining, s.duration - s.time)
    s.time += step
    s.total += step
    remaining -= step
    if (s.phase === "gathering" || s.phase === "traveling")
      s.positions = s.routes.map((r) => alongRoute(r, s.time / s.duration))
    if (s.time < s.duration - 1e-7) continue
    if (s.phase === "gathering") {
      for (const a of s.world.agents)
        a.location = s.bundle!.plan.participants.includes(a.id)
          ? "square"
          : s.bundle!.plan.destinations[a.id]
      s.phase = "proposing"
      speak(s)
    } else if (s.phase === "proposing") {
      finishBeat(s)
      s.beat++
      if (s.beat < s.bundle!.scene.beats.length) speak(s)
      else travel(s)
    } else if (s.phase === "traveling") arrive(s)
    else if (s.phase === "completing") finish(s)
  }
  s.world.positions = s.positions
  return s
}
