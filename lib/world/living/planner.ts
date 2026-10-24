import { squareOccupants } from "./presence"
import {
  destination,
  destinations,
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
      location: ["cafe", "music", "museum"][i] as DestinationId,
      recentVisits: [],
      memories: [],
      important: [],
      memorySummary: "",
      relationships: { mia: 55, kai: 60, luna: 52 },
      learned: {},
    })),
    recentDialogue: [],
    events: [],
    incidents: [],
    lastParticipants: [],
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
          s.source === "LIVE Qloo" &&
          s.affinity !== null
      )
      // Qloo's real affinity stays on the signal. This bounded mapping is a simulated activity influence.
      const affinity =
        (affinitySignals.reduce(
          (sum, s) =>
            sum +
            (s.affinity ?? 0) *
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
        mood:
          agent.mood === "thoughtful"
            ? d.traits.quiet * 7
            : agent.mood === "excited"
              ? d.traits.music * 7
              : agent.mood === "annoyed"
                ? d.traits.quiet * 9
                : 0,
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
  const occupants=squareOccupants(world.positions)
  // Evaluate every nonempty subset, rather than selecting from a fixed list of pairs.
  const groups=Array.from({length:(1<<residents.length)-1},(_,mask)=>residents.filter((_,i)=>(mask+1)&(1<<i)).map(r=>r.id))
  const ranked=groups.map((group,index)=>{
    const agents=group.map(id=>world.agents.find(a=>a.id===id)!)
    const social=agents.reduce((sum,a)=>sum+a.social,0)/agents.length
    const bonds=agents.flatMap(a=>agents.filter(b=>a.id!==b.id).map(b=>a.relationships[b.id]))
    const bond=bonds.reduce((s,n)=>s+n,0)/Math.max(1,bonds.length)
    const score=group.length===1?45+(100-social)*.25+(agents[0].energy<30?15:0)-(social>40?35:0):
      bond+social/5-(group.length===3?14:0)+(world.situation==='performance'&&group.length===3?25:0)+
      (group.every(id=>occupants.includes(id))?10:0)-(group.length===world.lastParticipants.length&&group.every(id=>world.lastParticipants.includes(id))?20:0)
    return {group,score:score+seeded(world.seed,world.completed*37+index+41)*6}
  }).sort((a,b)=>b.score-a.score)
  let initialParticipants:ResidentId[]=[...ranked[0].group]
  const mode=world.encounter??'auto'
  if(mode==='pair'||mode==='join')initialParticipants=['mia','kai']
  if(mode==='trio')initialParticipants=residents.map(r=>r.id)
  if(mode==='solo')initialParticipants=['luna']
  const candidate=world.agents.find(a=>!initialParticipants.includes(a.id)&&a.energy>25&&a.social>30)
  const joining=mode==='join'?world.agents.find(a=>a.id==='luna'):mode==='auto'&&initialParticipants.length===2&&candidate&&(occupants.includes(candidate.id)||seeded(world.seed,world.completed*17+91)>.55)?candidate:null
  const arrival=joining?{residentId:joining.id,beforeBeat:2}:null
  const participants=arrival?[...initialParticipants,arrival.residentId]:initialParticipants
  // Meeting never requires everyone to choose the same subsequent destination.
  if(participants.length>1){
    const candidates=destinations.map(d=>({id:d.id,loss:participants.map(id=>{const rows=scores.filter(s=>s.residentId===id);return Math.max(...rows.map(s=>s.total))-rows.find(s=>s.destinationId===d.id)!.total})})).filter(c=>c.loss.every(n=>n<=6))
    candidates.sort((a,b)=>a.loss.reduce((s,n)=>s+n,0)-b.loss.reduce((s,n)=>s+n,0))
    if(candidates[0])for(const id of participants)choices[id]=candidates[0].id
  }
  const sharedMemory=world.agents.filter(a=>participants.includes(a.id)).flatMap(a=>a.important.concat(a.memories)).filter(m=>m.kind!=='activity').at(-1)
  const discovery=signals.find(s=>participants.includes(s.residentId)&&s.source==='LIVE Qloo')
  const topics=[world.situation==='rain'?'Their attempt to stay dry has gone slightly wrong.':'A pigeon is behaving as though it owns the fountain.',
    'A ridiculous little disagreement about whether humming counts as singing.',
    'Someone has lost their train of thought; the others are no help.',
    discovery?`A recent cultural discovery: ${discovery.name}.`:"An opinion about music or art that someone wants to take back.",
    sharedMemory?`A callback to an actual shared experience: ${sharedMemory.text}`:'The awkward comfort of having nothing urgent to do.']
  const topic=topics[Math.floor(seeded(world.seed,world.completed*13+209)*topics.length)]
  const groundedIncident =
    incident &&
    ((incident.destination &&
      choices[incident.actor] !== incident.destination) ||
      (!incident.destination && !participants.includes(incident.actor)))
      ? null
      : incident
  return {
    number: world.completed + 1,
    participants,
    destinations: choices,
    scores,
    incident: groundedIncident,
    initialParticipants, arrival, topic,
    summary: `${initialParticipants.map(id=>residents.find(r=>r.id===id)!.name).join(' and ')} ${initialParticipants.length===1?'takes a quiet moment':'cross paths'} in the square.${arrival?` ${residents.find(r=>r.id===arrival.residentId)!.name} is on the way.`:''}`,

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
