import { squareOccupants } from "./presence"
import {
  destinations,
  destination,
  residents,
  type DestinationId,
  type ResidentId,
  type Taste,
} from "../profiles"
import type {
  Agent,
  CulturalSignal,
  Incident,
  Plan,
  Score,
  Snapshot,
} from "./types"
export function newWorld(): Snapshot {
  return {
    version: 1,
    encounter: "auto",
    seed: 4319,
    completed: 0,
    day: 1,
    hour: 9,
    situation: "sunny",
    positions: residents.map((r) => r.start),
    agents: residents.map((r, i) => ({
      id: r.id,
      mood: i === 1 ? "excited" : "curious",
      energy: [72, 91, 65][i],
      hunger: [72, 33, 40][i],
      social: [82, 70, 35][i],
      goal: r.goal,
      currentActivity: "Starting the day",
      location: ["cafe", "music", "museum"][i] as DestinationId,
      recentVisits: [],
      memories: [],
      important: [],
      memorySummary: "",
      relationships: { mia: 55, kai: 60, luna: 52 },
      learned: {},
    })),
    recentDialogue: [],
    recentScenes: [],
    events: [],
    incidents: [],
    lastParticipants: [],
    tasteProfiles: residents.map((r) => ({
      residentId: r.id,
      configuredInterests: r.qlooSeeds.map((interest) => ({ ...interest })),
      verifiedInterests: [],
      preferenceChanges: [],
      lastUpdated: null,
    })),
    discoveries: [],
    socialMemories: [],
    gatherings: [],
    pendingVisits: [],
  }
}
export function seeded(seed: number, salt: number) {
  let x = (seed + salt * 2654435761) >>> 0
  x ^= x << 13
  x ^= x >>> 17
  x ^= x << 5
  return (x >>> 0) / 4294967296
}
const round = (x: number) => Math.round(x * 10) / 10
export function chooseIncident(world: Snapshot): Incident | null {
  const candidates: Incident[] = []
  const a = (id: ResidentId) => world.agents.find((a) => a.id === id)!
  if (a("mia").hunger > 55)
    candidates.push({
      id: "pastry-trail",
      actor: "mia",
      description:
        "Mia catches the smell of fresh pastries and changes her plans.",
      emotion: "excited",
      destination: "cafe",
    })
  if (a("kai").energy > 55 || world.situation === "performance")
    candidates.push({
      id: "distant-rehearsal",
      actor: "kai",
      description:
        "Kai stops mid-thought: someone is rehearsing down the lane.",
      emotion: "curious",
      destination: "music",
    })
  if (a("luna").energy > 30 && world.lastParticipants.includes("luna"))
    candidates.push({
      id: "unexpected-portrait",
      actor: "luna",
      description: "Luna starts a tiny portrait of a neighbor, who notices.",
      emotion: "amused",
      destination: null,
    })
  if (world.situation === "rain")
    candidates.unshift({
      id: "sudden-rain",
      actor: "mia",
      description:
        "Rain catches the neighbors outside. Mia suggests somewhere warm.",
      emotion: "annoyed",
      destination: "cafe",
    })
  return (
    candidates.find(
      (c) =>
        !world.incidents.some((entry) => {
          const [scene, id] = entry.split(":")
          return id === c.id && world.completed - Number(scene) < 4
        })
    ) ?? null
  )
}
export function scoreDestinations(
  world: Snapshot,
  signals: CulturalSignal[],
  incident: Incident | null
): Score[] {
  return world.agents.flatMap((agent, i) =>
    destinations.map((d, j) => {
      const profile = residents.find((r) => r.id === agent.id)!
      const keys = Object.keys(profile.taste) as (keyof Taste)[]
      const taste = Object.fromEntries(
        keys.map((k) => [
          k,
          Math.min(1, profile.taste[k] + (agent.learned[k] ?? 0)),
        ])
      ) as Taste
      const culture =
        (keys.reduce((sum, k) => sum + taste[k] * d.traits[k], 0) /
          keys.reduce((sum, k) => sum + taste[k], 0)) *
        55
      const affinitySignals = signals.filter(
        (s) =>
          s.residentId === agent.id &&
          (s.source === "LIVE Qloo" || s.source === "CACHED Qloo") &&
          s.affinity !== null
      )
      // Qloo's real affinity stays on the signal. This bounded mapping is a simulated activity influence.
      const affinity =
        (affinitySignals.reduce(
          (sum, s) =>
            sum +
            Math.tanh(s.affinity ?? 0) *
              (s.category === "artist"
                ? d.traits.music
                : s.category === "movie"
                  ? d.traits.social
                  : d.traits.art),
          0
        ) /
          Math.max(1, affinitySignals.length)) *
        4
      const factors = {
        culture: round(culture + affinity),
        mood: round(
          agent.mood === "thoughtful"
            ? d.traits.quiet * 7
            : agent.mood === "excited"
              ? d.traits.music * 7
              : agent.mood === "annoyed"
                ? d.traits.quiet * 9
                : 0
        ),
        energy: round(
          ((100 - agent.energy) / 100) *
            (d.traits.quiet * 14 - d.traits.music * 5)
        ),
        goal: round(
          (agent.hunger / 100) * d.traits.food * 25 +
            (/sketch|inspiration/i.test(agent.goal)
              ? d.traits.art * 8
              : /melody|lively/i.test(agent.goal)
                ? d.traits.music * 8
                : /quiet|break/i.test(agent.goal)
                  ? d.traits.quiet * 8
                  : /outside|routine/i.test(agent.goal)
                    ? d.traits.discovery * 8
                    : 0)
        ),
        social: round((agent.social / 100) * d.traits.social * 8),
        relationships: round(
          ((Object.values(agent.relationships).reduce((s, n) => s + n, 0) / 3 -
            50) /
            50) *
            d.traits.social *
            3
        ),
        experience: round(
          agent.memories
            .filter((m) => m.location === d.id)
            .reduce((s, m) => s + (m.positive ? 1 : -2), 0)
        ),
        recency:
          agent.recentVisits[0] === d.id
            ? -18
            : agent.recentVisits.slice(1, 3).includes(d.id)
              ? -7
              : 0,
        novelty: agent.recentVisits.includes(d.id) ? 0 : 5,
        event:
          world.situation === "rain"
            ? d.id === "cafe"
              ? 15
              : -5
            : world.situation === "performance" && d.id === "music"
              ? 18
              : 0,
        variation: round(
          (seeded(world.seed, world.completed * 31 + i * 7 + j) - 0.5) * 6
        ),
      }
      if (incident?.actor === agent.id && incident.destination === d.id)
        factors.event += 12
      return {
        residentId: agent.id,
        destinationId: d.id,
        factors,
        total: round(Object.values(factors).reduce((a, b) => a + b, 0)),
      }
    })
  )
}
export function planScene(world: Snapshot, signals: CulturalSignal[]): Plan {
  const visit = world.pendingVisits?.[0]
  if (visit) {
    const names = visit.participants.map(
      (id) => residents.find((r) => r.id === id)!.name
    )
    const choices = Object.fromEntries(
      world.agents.map((a) => [
        a.id,
        visit.participants.includes(a.id)
          ? visit.location
          : destinations.some((d) => d.id === a.location)
            ? a.location
            : (a.recentVisits[0] ?? "cafe"),
      ])
    ) as Record<ResidentId, DestinationId>
    return {
      activityVisit: true,
      number: world.completed + 1,
      initialParticipants: [...visit.participants],
      participants: [...visit.participants],
      arrival: null,
      destinations: choices,
      scores: scoreDestinations(world, [], null),
      incident: null,
      culturalDecision: null,
      topic: `Visit ${world.completed + 1}: ${names.join(" and ")} at ${destination(visit.location).name}; respond to the activity and the supplied recent experiences.`,
      summary: `${names.join(" and ")} ${names.length === 1 ? "takes a moment" : "catch up"} at ${destination(visit.location).name}.`,
      sceneType:
        visit.participants.length === 1
          ? "personal_moment"
          : "casual_encounter",
      gathering: {
        id: `visit-${world.completed + 1}`,
        organizer: visit.participants[0],
        invited: [...visit.participants],
        responses: Object.fromEntries(
          visit.participants.map((id) => [id, "accepted"])
        ),
        location: visit.location,
        scheduledDay: world.day,
        scheduledHour: world.hour,
        timeoutHour: Math.min(23, world.hour + 2),
        reason: "A conversation during the activity they actually arrived for.",
        entityId: null,
        status: "planned",
      },
    }
  }
  const incident = chooseIncident(world),
    scores = scoreDestinations(world, signals, incident)
  const choices = Object.fromEntries(
    world.agents.map((a) => [
      a.id,
      scores
        .filter((s) => s.residentId === a.id)
        .sort(
          (a, b) =>
            b.total - a.total || a.destinationId.localeCompare(b.destinationId)
        )[0].destinationId,
    ])
  ) as Record<ResidentId, DestinationId>
  const occupants = squareOccupants(world.positions)
  // Evaluate every nonempty subset, rather than selecting from a fixed list of pairs.
  const groups = Array.from(
    { length: (1 << residents.length) - 1 },
    (_, mask) =>
      residents.filter((_, i) => (mask + 1) & (1 << i)).map((r) => r.id)
  )
  const ranked = groups
    .map((group, index) => {
      const agents = group.map((id) => world.agents.find((a) => a.id === id)!)
      const social =
        agents.reduce((sum, a) => sum + a.social, 0) / agents.length
      const bonds = agents.flatMap((a) =>
        agents.filter((b) => a.id !== b.id).map((b) => a.relationships[b.id])
      )
      const bond = bonds.reduce((s, n) => s + n, 0) / Math.max(1, bonds.length)
      const score =
        group.length === 1
          ? 45 +
            (100 - social) * 0.25 +
            (agents[0].energy < 30 ? 15 : 0) -
            (social > 40 ? 35 : 0)
          : bond +
            social / 5 -
            (group.length === 3 ? 14 : 0) +
            (world.situation === "performance" && group.length === 3 ? 25 : 0) +
            (group.every((id) => occupants.includes(id)) ? 10 : 0) -
            (group.length === world.lastParticipants.length &&
            group.every((id) => world.lastParticipants.includes(id))
              ? 20
              : 0)
      return {
        group,
        score:
          score + seeded(world.seed, world.completed * 37 + index + 41) * 6,
      }
    })
    .sort((a, b) => b.score - a.score)
  const freshSignals = signals.filter(
    (signal) =>
      !world.discoveries.some(
        (discovery) => discovery.entityId === signal.entityId
      )
  )
  const chosenSignal = freshSignals.toSorted(
    (a, b) => (b.affinity ?? 0) - (a.affinity ?? 0)
  )[0]
  const culturalDecision = chosenSignal
    ? (() => {
        const agent = world.agents.find(
          (candidate) => candidate.id === chosenSignal.residentId
        )!
        const destinationId =
          chosenSignal.category === "artist" ||
          chosenSignal.category === "podcast"
            ? ("music" as const)
            : chosenSignal.category === "book"
              ? ("museum" as const)
              : chosenSignal.category === "movie" ||
                  chosenSignal.category === "tv_show"
                ? ("cafe" as const)
                : null
        const action =
          chosenSignal.category === "artist" ||
          chosenSignal.category === "podcast"
            ? ("listen" as const)
            : chosenSignal.category === "book"
              ? ("read" as const)
              : chosenSignal.category === "movie" ||
                  chosenSignal.category === "tv_show"
                ? ("watch" as const)
                : chosenSignal.category === "place"
                  ? ("dining_inspiration" as const)
                  : ("save" as const)
        const selectedAction =
          destinationId && agent.energy > 25 ? action : ("save" as const)
        return {
          residentId: chosenSignal.residentId,
          entityId: chosenSignal.entityId,
          entityName: chosenSignal.name,
          category: chosenSignal.category,
          action: selectedAction,
          destinationId: selectedAction === "save" ? null : destinationId,
          tasteSignalEntityIds: chosenSignal.provenance.signalEntityIds,
          rationale: `${agent.mood} mood, current goal, recent visits, and verified cultural affinity favored ${selectedAction === "save" ? "saving this discovery" : `a ${selectedAction} activity`}.`,
          completed: false,
          preferenceChanged: false,
        }
      })()
    : null
  if (culturalDecision?.destinationId)
    choices[culturalDecision.residentId] = culturalDecision.destinationId

  // A due commitment always wins over a new opportunity.  This is the small
  // piece of state that lets a proposal in one scene become a real meeting.
  const morningAssembly = world.hour === 9
  const eveningWrapUp = world.hour >= 19
  const due = (morningAssembly ? [] : world.gatherings)
    .filter(
      (g) =>
        g.status === "planned" &&
        (g.scheduledDay < world.day ||
          (g.scheduledDay === world.day && g.scheduledHour <= world.hour))
    )
    .toSorted(
      (a, b) =>
        a.scheduledDay - b.scheduledDay || a.scheduledHour - b.scheduledHour
    )[0]
  // Scene zero is deliberately not an encounter lottery. It is the one
  // shared start-of-day moment, persisted by `completed` so restores cannot replay it.
  const opening = world.completed === 0
  const socialNeed =
    world.agents.reduce((sum, a) => sum + (100 - a.social), 0) / 3
  const relationshipNeed =
    world.agents.reduce(
      (sum, a) =>
        sum +
        Object.values(a.relationships)
          .filter((_, i) => residents[i].id !== a.id)
          .reduce((x, y) => x + (60 - y), 0),
      0
    ) / 6
  const scheduledTrio =
    morningAssembly ||
    eveningWrapUp ||
    world.completed === 2 ||
    world.situation === "performance" ||
    (world.agents.some((a) => a.social > 72) &&
      relationshipNeed > 8 &&
      seeded(world.seed, world.completed * 59) > 0.38)
  const culturalInvite =
    culturalDecision &&
    world.completed % 3 === 0 &&
    world.agents.find((a) => a.id === culturalDecision.residentId)!.social > 55
  const culturalPartner = culturalInvite
    ? residents
        .filter((resident) => resident.id !== culturalDecision.residentId)
        .toSorted(
          (a, b) =>
            world.agents.find(
              (agent) => agent.id === culturalDecision.residentId
            )!.relationships[b.id] -
            world.agents.find(
              (agent) => agent.id === culturalDecision.residentId
            )!.relationships[a.id]
        )[0].id
    : null
  const invited: ResidentId[] = scheduledTrio
    ? residents.map((resident) => resident.id)
    : culturalInvite
      ? [culturalDecision.residentId, culturalPartner!]
      : []
  const sharedVenue =
    culturalDecision?.destinationId ??
    (world.situation === "rain" ? "cafe" : socialNeed > 58 ? "music" : "museum")
  let gathering: import("./types").Gathering | null =
    due ??
    (scheduledTrio || culturalInvite
      ? {
          id: `gathering-${world.completed + 1}`,
          organizer: culturalInvite
            ? culturalDecision!.residentId
            : ("luna" as const),
          invited,
          responses: Object.fromEntries(
            invited.map((id, index) => {
              if (
                id === (culturalInvite ? culturalDecision!.residentId : "luna")
              )
                return [id, "accepted"]
              const roll = seeded(world.seed, world.completed * 71 + index * 17)
              const agent = world.agents.find((a) => a.id === id)!
              return [
                id,
                opening ||
                world.completed === 2 ||
                agent.energy < 22 ||
                (agent.social > 82 && roll < 0.28)
                  ? agent.energy < 22
                    ? "declined"
                    : "accepted"
                  : roll < 0.18
                    ? "late"
                    : "accepted",
              ]
            })
          ),
          location:
            morningAssembly || eveningWrapUp
              ? ("square" as const)
              : sharedVenue,
          scheduledDay: world.day,
          scheduledHour: world.hour,
          reason: morningAssembly
            ? "Morning assembly: the neighbors make their plans before the day begins."
            : eveningWrapUp
              ? "Evening wrap-up: the neighbors return to the square and reflect on the day."
              : culturalInvite
                ? `${residents.find((resident) => resident.id === culturalDecision!.residentId)!.name} wants to share the verified discovery ${culturalDecision!.entityName}.`
                : "A neighbor-led plan to spend time together.",
          entityId: culturalInvite ? culturalDecision!.entityId : null,
          status: "planned" as const,
          timeoutHour: Math.min(23, world.hour + 2),
        }
      : null)
  let initialParticipants: ResidentId[] = gathering
    ? gathering.invited.filter((id) => gathering!.responses[id] === "accepted")
    : [...ranked[0].group]
  if (gathering && initialParticipants.length < 2) {
    gathering.status = "cancelled"
    initialParticipants = [...ranked[0].group]
  }
  const mode = world.encounter ?? "auto"
  // Developer encounter controls apply after the deterministic opening only.
  if (!opening) {
    if (mode !== "auto") gathering = null
    if (mode === "pair" || mode === "join") initialParticipants = ["mia", "kai"]
    if (mode === "trio") initialParticipants = residents.map((r) => r.id)
    if (mode === "solo") initialParticipants = ["luna"]
  }
  const candidate = gathering
    ? world.agents.find((a) => gathering!.responses[a.id] === "late")
    : opening
      ? null
      : world.agents.find(
          (a) =>
            !initialParticipants.includes(a.id) &&
            a.energy > 25 &&
            a.social > 30
        )
  const joining =
    mode === "join"
      ? world.agents.find((a) => a.id === "luna")
      : mode === "auto" &&
          initialParticipants.length === 2 &&
          candidate &&
          (occupants.includes(candidate.id) ||
            seeded(world.seed, world.completed * 17 + 91) > 0.55)
        ? candidate
        : null
  const arrival = joining ? { residentId: joining.id, beforeBeat: 2 } : null
  const participants = arrival
    ? [...initialParticipants, arrival.residentId]
    : initialParticipants
  // Meeting never requires everyone to choose the same subsequent destination.
  if (participants.length > 1) {
    const candidates = destinations
      .map((d) => ({
        id: d.id,
        loss: participants.map((id) => {
          const rows = scores.filter((s) => s.residentId === id)
          return (
            Math.max(...rows.map((s) => s.total)) -
            rows.find((s) => s.destinationId === d.id)!.total
          )
        }),
      }))
      .filter((c) => c.loss.every((n) => n <= 6))
    candidates.sort(
      (a, b) =>
        a.loss.reduce((s, n) => s + n, 0) - b.loss.reduce((s, n) => s + n, 0)
    )
    if (candidates[0])
      for (const id of participants) choices[id] = candidates[0].id
  }
  if (gathering)
    for (const id of participants)
      choices[id] =
        gathering.location === "square" ? choices[id] : gathering.location
  // Angles describe current, observable circumstances, never fabricated past events.
  const topics = [
    ...(culturalDecision
      ? [
          `${residents.find((resident) => resident.id === culturalDecision.residentId)!.name} considers sharing the verified discovery ${culturalDecision.entityName}.`,
        ]
      : []),
    "Compare what each person wants from the rest of the day.",
    "Notice the fountain and offer a different way of looking at it.",
    "Ask a neighbor about one of their established cultural interests.",
    "Decide whether to linger in the square or head off independently.",
    "Discuss the current weather and how it affects today's plans.",
    "Offer a small creative challenge to try now, without claiming it already happened.",
    "Ask what makes a place inviting, drawing on actual recent visits if available.",
    "Share a current mood and respond to a neighbor's different energy level.",
  ]
  const exhausted = new Set((world.recentScenes ?? []).map((s) => s.topic))
  const available = topics.filter((t) => !exhausted.has(t))
  const topic =
    available[
      Math.floor(
        seeded(world.seed, world.completed * 13 + 209) * available.length
      )
    ]
  const groundedIncident =
    incident &&
    ((incident.destination &&
      choices[incident.actor] !== incident.destination) ||
      (!incident.destination && !participants.includes(incident.actor)))
      ? null
      : incident
  const sceneType =
    participants.length === 1
      ? ("personal_moment" as const)
      : opening
        ? ("group_hangout" as const)
        : gathering && participants.length === 3
          ? ("group_hangout" as const)
          : culturalDecision &&
              participants.includes(culturalDecision.residentId)
            ? ("discovery" as const)
            : groundedIncident
              ? ("unexpected_event" as const)
              : seeded(world.seed, world.completed * 11 + 17) > 0.82
                ? ("disagreement" as const)
                : ("casual_encounter" as const)
  return {
    number: world.completed + 1,
    participants,
    destinations: choices,
    scores,
    incident: groundedIncident,
    initialParticipants,
    arrival,
    topic,
    summary: `${initialParticipants.map((id) => residents.find((r) => r.id === id)!.name).join(" and ")} ${morningAssembly ? "begin the day together" : eveningWrapUp ? "return to reflect on the day" : initialParticipants.length === 1 ? "takes a quiet moment" : "meet"} at ${gathering?.location === "square" ? "the town square" : gathering ? destination(gathering.location).name : destination(choices[initialParticipants[0]]).name}.${arrival ? ` ${residents.find((r) => r.id === arrival.residentId)!.name} is on the way.` : ""}`,
    sceneType,
    gathering,
    culturalDecision,
  }
}
export function nextGoal(a: Agent) {
  return a.hunger > 60
    ? "Find something comforting to eat"
    : a.energy < 40
      ? "Take a quiet break"
      : a.social > 65
        ? "Catch up with a neighbor"
        : a.id === "kai"
          ? "Follow an unfamiliar melody"
          : a.id === "luna"
            ? "Find a detail worth sketching"
            : "Try something outside the usual routine"
}
