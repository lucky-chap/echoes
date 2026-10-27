import {
  residents,
  destination,
  type ResidentId,
  type DestinationId,
  type Situation,
} from "../profiles"
import { idleSimulation, type Simulation, type Speech } from "./base"
import {
  alongRoute,
  routeLength,
  routeToDestination,
  routeToSquare,
  type Route,
} from "../movement"
import { newWorld, nextGoal, seeded } from "./planner"
import { atVenue } from "./presence"
import { validateScene } from "./validation"
import type { SceneBundle, Snapshot, Memory, Beat } from "./types"
export interface LivingSimulation extends Simulation {
  logSequence: number
  present: ResidentId[]
  joining: boolean
  transits: Partial<
    Record<
      ResidentId,
      {
        route: Route
        elapsed: number
        duration: number
        target: DestinationId | "square"
      }
    >
  >
  world: Snapshot
  bundle: SceneBundle | null
  beat: number
  speech: (Speech & Pick<Beat, "action" | "emotion" | "targetLocation">) | null
}
export function idleLiving(situation: Situation = "sunny"): LivingSimulation {
  return {
    ...idleSimulation(situation),
    speech: null,
    logSequence: 0,
    present: [],
    joining: false,
    transits: {},
    world: { ...newWorld(), situation },
    bundle: null,
    beat: 0,
  }
}
export function restoreLiving(world: Snapshot): LivingSimulation {
  const simulation = idleLiving(world.situation)
  simulation.world = structuredClone(world)
  simulation.positions = structuredClone(world.positions)
  simulation.phase = "finished"
  simulation.round = world.completed
  return simulation
}
const clamp = (n: number) => Math.max(0, Math.min(100, n))
function log(s: LivingSimulation, text: string) {
  s.logs = [
    ...s.logs,
    { id: `${s.round}-${++s.logSequence}`, time: s.total, text },
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
function send(
  s: LivingSimulation,
  id: ResidentId,
  target: DestinationId | "square"
) {
  const index = residents.findIndex((r) => r.id === id),
    from = s.positions[index]
  const route =
    target === "square"
      ? routeToSquare(from, index)
      : routeToDestination(from, target, index)
  s.transits[id] = {
    route,
    elapsed: 0,
    duration: Math.max(0.01, routeLength(route) / 28),
    target,
  }
  s.world.agents.find((a) => a.id === id)!.location = "path"
  s.world.agents.find((a) => a.id === id)!.currentActivity =
    target === "square" ? "Walking to a gathering" : "Traveling to an activity"
}
function move(s: LivingSimulation, delta: number) {
  for (const [id, transit] of Object.entries(s.transits) as [
    ResidentId,
    NonNullable<LivingSimulation["transits"][ResidentId]>,
  ][]) {
    transit.elapsed = Math.min(transit.duration, transit.elapsed + delta)
    s.positions[residents.findIndex((r) => r.id === id)] = alongRoute(
      transit.route,
      transit.elapsed / transit.duration
    )
    if (transit.elapsed >= transit.duration - 1e-7) {
      s.world.agents.find((a) => a.id === id)!.location = transit.target
      delete s.transits[id]
    }
  }
}
function remainingTravel(s: LivingSimulation) {
  return Math.max(
    0.01,
    ...Object.values(s.transits).map((t) => t.duration - t.elapsed)
  )
}
function activate(s: LivingSimulation, ids: ResidentId[]) {
  const venue = s.bundle!.plan.gathering?.location ?? "square"
  for (const id of ids) {
    const agent = s.world.agents.find((a) => a.id === id)!
    if (
      s.transits[id] ||
      agent.location !== venue ||
      !atVenue(s.positions[residents.findIndex((r) => r.id === id)], venue)
    )
      throw Error("Resident has not arrived at the gathering")
    if (!s.present.includes(id)) s.present.push(id)
  }
}
function speak(s: LivingSimulation) {
  const b = s.bundle!.scene.beats[s.beat]
  if (
    !s.present.includes(b.speaker) ||
    s.transits[b.speaker] ||
    !atVenue(
      s.positions[residents.findIndex((r) => r.id === b.speaker)],
      s.bundle!.plan.gathering?.location ?? "square"
    )
  )
    throw Error("Absent resident cannot speak")
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
  const actor = s.world.agents.find((a) => a.id === b.speaker)!
  actor.mood = b.emotion
  const venue = s.bundle!.plan.gathering?.location ?? "square"
  actor.currentActivity = `${b.action === "sketch" ? "Sketching" : b.action === "dance" ? "Dancing" : b.action === "sit" ? "Sitting with the conversation" : "Talking"} at ${venue === "square" ? "the town square" : destination(venue).name}`
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
  // Only completed, physically performed actions affect needs and preferences.
  // Dialogue text and model-proposed future actions do not authorize effects.
  const actor = s.world.agents.find((a) => a.id === b.speaker)!
  const venue = s.bundle!.plan.gathering?.location ?? "square"
  if (["sketch", "dance", "sit"].includes(b.action)) {
    const trait =
      b.action === "sketch" ? "art" : b.action === "dance" ? "music" : "quiet"
    actor.learned[trait] = Math.min(0.2, (actor.learned[trait] ?? 0) + 0.02)
    actor.energy = clamp(
      actor.energy + (b.action === "dance" ? -3 : b.action === "sit" ? 2 : -1)
    )
    remember(s, actor.id, {
      kind: "activity",
      text: `${b.action === "sketch" ? "Sketched" : b.action === "dance" ? "Danced" : "Sat down to rest"} at ${venue === "square" ? "the town square" : destination(venue).name}.`,
      location: venue === "square" ? null : venue,
      positive: true,
    })
    actor.goal = nextGoal(actor)
  }
  log(
    s,
    `${residents.find((r) => r.id === b.speaker)!.name}: ${b.action} · ${b.emotion}`
  )
}
function nextBeat(s: LivingSimulation) {
  const arrival = s.bundle!.plan.arrival
  if (
    arrival &&
    s.beat === arrival.beforeBeat &&
    !s.present.includes(arrival.residentId)
  ) {
    s.speech = null
    s.joining = true
    s.phase = "gathering"
    s.time = 0
    send(s, arrival.residentId, s.bundle!.plan.gathering?.location ?? "square")
    s.duration = remainingTravel(s)
    log(
      s,
      `${residents.find((r) => r.id === arrival.residentId)!.name} walks over to join the conversation.`
    )
  } else speak(s)
}
function travel(s: LivingSimulation) {
  s.phase = "traveling"
  s.time = 0
  s.speech = null
  s.present = []
  for (const id of s.bundle!.plan.participants) {
    const agent = s.world.agents.find((a) => a.id === id)!
    if (!s.transits[id] && agent.location !== s.bundle!.plan.destinations[id])
      send(s, id, s.bundle!.plan.destinations[id])
  }
  s.duration = remainingTravel(s)
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
  const activityVisit = s.bundle!.plan.activityVisit === true
  const wasMorningAssembly =
    !activityVisit &&
    s.world.hour === 9 &&
    s.bundle!.plan.gathering?.location === "square"
  for (const a of s.world.agents) {
    if (activityVisit) continue
    const d = s.bundle!.plan.destinations[a.id]
    a.recentVisits = [d, ...a.recentVisits].slice(0, 5)
    a.energy = clamp(a.energy + (d === "music" ? -18 : 12))
    a.hunger = clamp(a.hunger + (d === "cafe" ? -55 : 22))
    a.social = clamp(
      a.social +
        (s.bundle!.scene.beats.length &&
        s.bundle!.plan.participants.includes(a.id)
          ? -15
          : 20)
    )
    remember(s, a.id, {
      kind: "activity",
      text: `Spent ${s.world.hour < 12 ? "the morning" : s.world.hour < 17 ? "the afternoon" : "the evening"} at ${destination(d).name}.`,
      location: d,
      positive: a.mood !== "annoyed",
    })
    a.currentActivity = `Spending time at ${destination(d).name}`
    a.goal = nextGoal(a)
  }
  const decision = s.bundle!.plan.culturalDecision
  if (decision) {
    const discovery = s.world.discoveries.find(
      (item) =>
        item.entityId === decision.entityId &&
        item.residentId === decision.residentId
    )
    const resident = s.world.agents.find(
      (agent) => agent.id === decision.residentId
    )!
    const completed =
      decision.destinationId !== null &&
      resident.location === decision.destinationId &&
      decision.action !== "save"
    decision.completed = completed
    if (discovery) {
      if (completed) {
        const liked =
          seeded(
            s.world.seed,
            s.world.completed * 97 +
              residents.findIndex((item) => item.id === decision.residentId) *
                19
          ) > 0.3
        discovery.status = liked ? "liked" : "disliked"
        discovery.reaction = liked
          ? `${resident.mood} and keen to explore more like this`
          : `${resident.mood}, but it did not land this time`
        remember(s, resident.id, {
          kind: "discovery",
          text: `${liked ? "Enjoyed" : "Tried but did not enjoy"} ${discovery.name}.`,
          location: decision.destinationId,
          positive: liked,
        })
        const profile = s.world.tasteProfiles.find(
          (item) => item.residentId === resident.id
        )!
        const delta = liked ? 0.06 : -0.04
        profile.preferenceChanges.push({
          entityId: discovery.entityId,
          delta,
          reason: discovery.reaction,
          day: s.world.day,
          scene: s.round,
        })
        profile.preferenceChanges = profile.preferenceChanges.slice(-12)
        profile.lastUpdated = discovery.provenance.requestedAt
        if (
          liked &&
          !profile.verifiedInterests.some(
            (interest) => interest.entityId === discovery.entityId
          )
        )
          profile.verifiedInterests.push({
            entityId: discovery.entityId,
            name: discovery.name,
            type: discovery.type,
            initial: false,
            weight: 0.56,
            verifiedAt: discovery.provenance.requestedAt,
          })
        decision.preferenceChanged = true
      } else discovery.status = "considered"
    }
  }
  if (s.bundle!.scene.beats.length) {
    s.world.recentScenes = [
      ...(s.world.recentScenes ?? []),
      {
        sceneId: s.bundle!.scene.sceneId,
        topic: s.bundle!.plan.topic,
        lines: s.bundle!.scene.beats.map((b) => ({
          speaker: b.speaker,
          text: b.dialogue,
        })),
      },
    ].slice(-4)
    s.world.socialMemories = [
      ...s.world.socialMemories,
      {
        id: `social-${s.round}`,
        participants: [...s.bundle!.plan.participants],
        sceneId: s.bundle!.scene.sceneId,
        location: s.bundle!.plan.gathering?.location ?? "square",
        summary: s.bundle!.scene.summary,
        day: s.world.day,
        hour: s.world.hour,
        referencedEntityIds: decision ? [decision.entityId] : [],
        confirmedOutcome: s.bundle!.scene.ending,
      },
    ].slice(-12)
    if (activityVisit) {
      for (const id of s.bundle!.plan.participants) {
        const a = s.world.agents.find((agent) => agent.id === id)!
        a.social = clamp(a.social - 10)
        for (const other of s.bundle!.plan.participants)
          if (other !== id)
            a.relationships[other] = clamp(a.relationships[other] + 1)
        a.goal = nextGoal(a)
      }
    }
  }
  if (s.bundle!.plan.gathering) {
    const gathering = s.world.gatherings.find(
      (item) => item.id === s.bundle!.plan.gathering!.id
    )
    if (gathering)
      gathering.status = s.bundle!.scene.beats.length
        ? "completed"
        : "cancelled"
  }
  // The director creates one concrete, local daytime commitment after every
  // morning assembly. It is an engine decision, never a model instruction.
  if (wasMorningAssembly) {
    const decision = s.bundle!.plan.culturalDecision
    const venue =
      decision?.destinationId ??
      (s.world.situation === "rain" ? "cafe" : "museum")
    const organizer = decision?.residentId ?? "luna"
    const invited = residents.map((resident) => resident.id)
    const responses = Object.fromEntries(
      invited.map((id, index) => {
        const agent = s.world.agents.find((item) => item.id === id)!
        const roll = seeded(s.world.seed, s.world.completed * 131 + index)
        return [
          id,
          id === organizer || (agent.energy > 35 && roll > 0.14)
            ? "accepted"
            : roll > 0.07
              ? "late"
              : "declined",
        ]
      })
    ) as import("./types").Gathering["responses"]
    s.world.gatherings = [
      ...s.world.gatherings,
      {
        id: `day-${s.world.day}-commitment-${s.world.completed + 1}`,
        organizer,
        invited,
        responses,
        location: venue,
        scheduledDay: s.world.day,
        scheduledHour: 14,
        reason: decision
          ? `Share the verified discovery ${decision.entityName} together.`
          : "Follow through on the morning assembly's shared plan.",
        entityId: decision?.entityId ?? null,
        status: "planned" as const,
        timeoutHour: 17,
      },
    ].slice(-8)
    log(
      s,
      `Morning assembly set a ${destination(venue).name} commitment for 14:00.`
    )
  }
  s.world.completed++
  if (activityVisit) {
    s.world.pendingVisits = (s.world.pendingVisits ?? []).slice(1)
  } else {
    // Arrival is followed by conversation at each occupied venue. Shared visits
    // take priority; a lone resident may have a short contextual aside.
    const covered = s.bundle!.plan.gathering?.location
    s.world.pendingVisits = (["cafe", "music", "museum"] as DestinationId[])
      .map((location) => ({
        location,
        participants: s.world.agents
          .filter(
            (a) =>
              a.location === location &&
              atVenue(
                s.positions[residents.findIndex((r) => r.id === a.id)],
                location
              )
          )
          .map((a) => a.id),
      }))
      .filter(
        (visit) => visit.participants.length > 0 && visit.location !== covered
      )
      .sort((a, b) => b.participants.length - a.participants.length)
  }
  if (!s.world.pendingVisits?.length) s.world.hour += 5
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
  if (
    bundle.diagnostics.llm === "Groq Live" ||
    bundle.diagnostics.llm === "Cerebras Live"
  )
    validateScene(bundle.scene, bundle.plan)
  else if (
    bundle.scene.beats.length ||
    bundle.scene.suggestedMemoryUpdates.length ||
    bundle.scene.suggestedRelationshipChanges.length
  )
    throw Error("Fallback must not contain dialogue or social updates")
  const s = structuredClone(previous)
  s.bundle = structuredClone(bundle)
  s.round = s.world.completed + 1
  s.phase = "gathering"
  s.time = 0
  s.beat = 0
  s.speech = null
  s.present = []
  s.joining = false
  s.transits = {}
  if (bundle.tasteProfiles)
    s.world.tasteProfiles = structuredClone(bundle.tasteProfiles)
  const decision = s.bundle.plan.culturalDecision
  if (decision) {
    const signal = bundle.diagnostics.signals.find(
      (item) =>
        item.entityId === decision.entityId &&
        item.residentId === decision.residentId
    )
    if (
      signal &&
      !s.world.discoveries.some(
        (item) =>
          item.entityId === signal.entityId &&
          item.residentId === signal.residentId
      )
    )
      s.world.discoveries.push({
        entityId: signal.entityId,
        name: signal.name,
        type: signal.provenance.requestCategory,
        description: signal.description,
        residentId: signal.residentId,
        discoveredAt: signal.provenance.requestedAt,
        day: s.world.day,
        scene: s.round,
        status: decision.action === "save" ? "discovered" : "considered",
        affinity: signal.affinity,
        properties: signal.properties,
        explainability: signal.explainability,
        provenance: signal.provenance,
        reaction: null,
      })
    s.world.discoveries = s.world.discoveries.slice(-30)
  }
  if (s.bundle.plan.gathering) {
    const gathering = structuredClone(s.bundle.plan.gathering)
    gathering.status = "traveling"
    s.world.gatherings = [
      ...s.world.gatherings.filter((item) => item.id !== gathering.id),
      gathering,
    ].slice(-8)
  }
  for (const r of residents) {
    if (bundle.plan.initialParticipants.includes(r.id)) {
      const venue = bundle.plan.gathering?.location ?? "square"
      if (
        !atVenue(
          s.positions[residents.findIndex((resident) => resident.id === r.id)],
          venue
        ) ||
        s.world.agents.find((agent) => agent.id === r.id)!.location !== venue
      )
        send(s, r.id, venue)
    } else if (
      bundle.plan.arrival?.residentId !== r.id &&
      !bundle.plan.activityVisit
    )
      send(s, r.id, bundle.plan.destinations[r.id])
  }
  if (bundle.diagnostics.llm === "Fallback") {
    s.phase = "traveling"
    // No gathering occurred, so a square-only social incident cannot have happened.
    if (!s.bundle.plan.incident?.destination) s.bundle.plan.incident = null
    for (const r of residents) send(s, r.id, bundle.plan.destinations[r.id])
    log(
      s,
      `Fallback: ${bundle.diagnostics.reason ?? "dialogue withheld; independent activities continue."}`
    )
  }
  s.duration = remainingTravel(s)
  if (
    bundle.diagnostics.llm === "Groq Live" ||
    bundle.diagnostics.llm === "Cerebras Live"
  )
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
    previous.phase === "waiting" ||
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
    move(s, step)
    if (s.time < s.duration - 1e-7) continue
    if (s.phase === "gathering") {
      if (s.joining) {
        activate(s, [s.bundle!.plan.arrival!.residentId])
        log(s, `${s.bundle!.plan.arrival!.residentId} joined after arriving.`)
        s.joining = false
      } else activate(s, s.bundle!.plan.initialParticipants)
      if (s.bundle!.plan.gathering) {
        const gathering = s.world.gatherings.find(
          (item) => item.id === s.bundle!.plan.gathering!.id
        )
        if (gathering) gathering.status = "active"
      }
      // A transient Groq cooldown is a social state, not a reason for the
      // residents to abandon an accepted meeting. They remain in the square
      // until the client retries this exact scene.
      if (s.bundle!.diagnostics.llm === "Waiting") {
        s.phase = "waiting"
        s.speech = null
        s.duration = 0
        log(s, "Everyone waits together for the conversation to continue.")
        break
      } else {
        s.phase = "proposing"
        speak(s)
      }
    } else if (s.phase === "proposing") {
      finishBeat(s)
      const beat = s.bundle!.scene.beats[s.beat]
      if (beat.action === "walk_to") {
        s.present = s.present.filter((id) => id !== beat.speaker)
        send(s, beat.speaker, beat.targetLocation!)
        log(s, `${beat.speaker} leaves the conversation: ${beat.dialogue}`)
      }
      s.beat++
      if (s.beat < s.bundle!.scene.beats.length) nextBeat(s)
      else travel(s)
    } else if (s.phase === "traveling") arrive(s)
    else if (s.phase === "completing") finish(s)
  }
  s.world.positions = s.positions
  return s
}
