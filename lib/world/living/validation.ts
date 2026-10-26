import { z } from "zod"
import { residents, type ResidentId, type DestinationId } from "../profiles"
import { compactMetadata } from "./metadata"
import {
  encounterModes,
  actions,
  emotions,
  type Memory,
  type Scene,
  type Snapshot,
  type Plan,
  type Beat,
} from "./types"
const ids = ["mia", "kai", "luna"]
const locations = ["cafe", "music", "museum"]
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v)
const text = (v: unknown, max: number) =>
  typeof v === "string" && v.length > 0 && v.length <= max
const finite = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max
function cleanMemory(m: Memory): Memory {
  return {
    id: m.id,
    kind: m.kind,
    text: m.text,
    day: m.day,
    scene: m.scene,
    location: m.location,
    positive: m.positive,
  }
}
export function validateSnapshot(value: unknown): Snapshot {
  if (
    object(value) &&
    value.encounter !== undefined &&
    !encounterModes.includes(value.encounter as never)
  )
    throw Error("Invalid encounter mode")
  if (
    !object(value) ||
    value.version !== 1 ||
    !Number.isInteger(value.seed) ||
    !finite(value.seed, 0, 4294967295) ||
    !Number.isInteger(value.completed) ||
    !finite(value.completed, 0, 10000) ||
    !Number.isInteger(value.day) ||
    !finite(value.day, 1, 10000) ||
    !finite(value.hour, 0, 23) ||
    !["sunny", "rain", "performance"].includes(String(value.situation))
  )
    throw Error("Invalid world clock or context")
  if (
    !Array.isArray(value.agents) ||
    value.agents.length !== 3 ||
    new Set(value.agents.map((a) => a?.id)).size !== 3
  )
    throw Error("Invalid residents")
  for (const a of value.agents) {
    if (
      !object(a) ||
      !ids.includes(String(a.id)) ||
      !emotions.includes(a.mood as never) ||
      !finite(a.energy, 0, 100) ||
      !finite(a.hunger, 0, 100) ||
      !finite(a.social, 0, 100) ||
      !text(a.goal, 150) ||
      !text(a.currentActivity, 160) ||
      !["square", "path", ...locations].includes(String(a.location))
    )
      throw Error("Invalid resident state")
    if (typeof a.memorySummary !== "string" || a.memorySummary.length > 320)
      throw Error("Invalid memory summary")
    for (const field of ["memories", "important"]) {
      if (
        !Array.isArray(a[field]) ||
        a[field].length > (field === "memories" ? 8 : 4)
      )
        throw Error("Memory limit exceeded")
      for (const m of a[field])
        if (
          !object(m) ||
          !text(m.id, 80) ||
          !text(m.text, 240) ||
          ![
            "activity",
            "conversation",
            "discovery",
            "promise",
            "incident",
          ].includes(String(m.kind)) ||
          !finite(m.day, 1, 10000) ||
          !finite(m.scene, 0, 10000) ||
          !(m.location === null || locations.includes(String(m.location))) ||
          typeof m.positive !== "boolean"
        )
          throw Error("Invalid memory")
    }
    if (
      !Array.isArray(a.recentVisits) ||
      a.recentVisits.length > 5 ||
      !a.recentVisits.every((d) => locations.includes(String(d)))
    )
      throw Error("Invalid visits")
    if (
      !object(a.relationships) ||
      !ids.every((id) =>
        finite((a.relationships as Record<string, unknown>)[id], 0, 100)
      )
    )
      throw Error("Invalid relationships")
    if (
      !object(a.learned) ||
      Object.entries(a.learned).some(
        ([k, v]) =>
          !["food", "music", "art", "quiet", "social", "discovery"].includes(
            k
          ) || !finite(v, 0, 0.2)
      )
    )
      throw Error("Invalid learned interests")
  }
  if (
    !Array.isArray(value.positions) ||
    value.positions.length !== 3 ||
    !value.positions.every(
      (p) =>
        Array.isArray(p) &&
        p.length === 2 &&
        finite(p[0], 0, 480) &&
        finite(p[1], 0, 320)
    )
  )
    throw Error("Invalid positions")
  if (
    !Array.isArray(value.recentDialogue) ||
    value.recentDialogue.length > 8 ||
    !value.recentDialogue.every(
      (l) => object(l) && ids.includes(String(l.speaker)) && text(l.text, 220)
    )
  )
    throw Error("Dialogue context too large")
  for (const field of ["events", "incidents"])
    if (
      !Array.isArray(value[field]) ||
      value[field].length > 8 ||
      !value[field].every((t) => text(t, 240))
    )
      throw Error("Invalid recent events")
  if (
    !Array.isArray(value.lastParticipants) ||
    value.lastParticipants.length > 3 ||
    !value.lastParticipants.every((id) => ids.includes(String(id)))
  )
    throw Error("Invalid participants")
  const recentScenes = z
    .array(
      z.strictObject({
        sceneId: z.string().min(1).max(80),
        topic: z.string().min(1).max(300),
        lines: z
          .array(
            z.strictObject({
              speaker: z.enum(["mia", "kai", "luna"]),
              text: z.string().min(1).max(220),
            })
          )
          .min(2)
          .max(8),
      })
    )
    .max(4)
    .parse(value.recentScenes ?? [])
  const qlooType = z.enum([
    "urn:entity:artist",
    "urn:entity:book",
    "urn:entity:movie",
    "urn:entity:place",
    "urn:entity:tv_show",
    "urn:entity:podcast",
  ])
  const verifiedInterest = z.strictObject({
    entityId: z.string().min(4).max(120),
    name: z.string().min(1).max(240),
    type: qlooType,
    initial: z.boolean(),
    weight: z.number().finite().min(0).max(1),
    verifiedAt: z.string().min(1).max(40),
  })
  const tasteProfiles = z
    .array(
      z.strictObject({
        residentId: z.enum(["mia", "kai", "luna"]),
        configuredInterests: z
          .array(
            z.strictObject({
              name: z.string().min(1).max(120),
              type: qlooType,
              weight: z.number().finite().min(0).max(1),
            })
          )
          .max(8),
        verifiedInterests: z.array(verifiedInterest).max(16),
        preferenceChanges: z
          .array(
            z.strictObject({
              entityId: z.string().min(4).max(120),
              delta: z.number().finite().min(-1).max(1),
              reason: z.string().min(1).max(240),
              day: z.number().int().min(1).max(10000),
              scene: z.number().int().min(0).max(10000),
            })
          )
          .max(12),
        lastUpdated: z.string().min(1).max(40).nullable(),
      })
    )
    .length(3)
    .refine((profiles) => new Set(profiles.map((p) => p.residentId)).size === 3)
    .parse(value.tasteProfiles)
  const provenance = z.strictObject({
    provider: z.literal("Qloo"),
    endpoint: z.literal("/v2/insights"),
    requestedAt: z.string().min(1).max(40),
    requestCategory: qlooType,
    signalEntityIds: z.array(z.string().min(4).max(120)).max(8),
    excludedEntityIds: z.array(z.string().min(4).max(120)).max(20),
    delivery: z.enum(["live", "cache"]),
  })
  const discoveries = z
    .array(
      z
        .strictObject({
          entityId: z.string().min(4).max(120),
          name: z.string().min(1).max(240),
          type: qlooType,
          description: z.string().max(1000).nullable(),
          residentId: z.enum(["mia", "kai", "luna"]),
          discoveredAt: z.string().min(1).max(40),
          day: z.number().int().min(1).max(10000),
          scene: z.number().int().min(0).max(10000),
          status: z.enum([
            "discovered",
            "considered",
            "experienced",
            "liked",
            "disliked",
            "dismissed",
          ]),
          affinity: z.number().finite().nullable(),
          properties: z.record(z.string(), z.unknown()),
          explainability: z.record(z.string(), z.unknown()).nullable(),
          provenance,
          reaction: z.string().max(240).nullable(),
        })
        .transform((item) => ({
          ...item,
          properties: compactMetadata(item.properties),
          explainability: item.explainability
            ? compactMetadata(item.explainability)
            : null,
        }))
    )
    .max(30)
    .parse(value.discoveries)
  const socialMemories = z
    .array(
      z.strictObject({
        id: z.string().min(1).max(80),
        participants: z
          .array(z.enum(["mia", "kai", "luna"]))
          .min(1)
          .max(3),
        sceneId: z.string().min(1).max(80),
        location: z.enum(["square", "cafe", "music", "museum"]),
        summary: z.string().min(1).max(240),
        day: z.number().int().min(1).max(10000),
        hour: z.number().min(0).max(23),
        referencedEntityIds: z.array(z.string().min(4).max(120)).max(6),
        confirmedOutcome: z.string().min(1).max(240),
      })
    )
    .max(12)
    .parse(value.socialMemories)
  const gatherings = z
    .array(
      z.strictObject({
        id: z.string().min(1).max(80),
        organizer: z.enum(["mia", "kai", "luna"]),
        invited: z
          .array(z.enum(["mia", "kai", "luna"]))
          .min(1)
          .max(3),
        responses: z.partialRecord(
          z.enum(["mia", "kai", "luna"]),
          z.enum(["pending", "accepted", "declined"])
        ),
        location: z.literal("square"),
        scheduledDay: z.number().int().min(1).max(10000),
        scheduledHour: z.number().min(0).max(23),
        reason: z.string().min(1).max(300),
        entityId: z.string().min(4).max(120).nullable(),
        status: z.enum([
          "planned",
          "traveling",
          "active",
          "completed",
          "cancelled",
        ]),
        timeoutHour: z.number().min(0).max(23),
      })
    )
    .max(8)
    .parse(value.gatherings)
  // Normalize to stable resident order. Extra untrusted fields never reach a prompt.
  const world = value as unknown as Snapshot
  return {
    version: 1,
    recentScenes,
    encounter: world.encounter ?? "auto",
    seed: world.seed,
    completed: world.completed,
    day: world.day,
    hour: world.hour,
    situation: world.situation,
    agents: residents.map((r) => {
      const a = world.agents.find((a) => a.id === r.id)!
      return {
        id: a.id,
        mood: a.mood,
        energy: a.energy,
        hunger: a.hunger,
        social: a.social,
        goal: a.goal,
        currentActivity: a.currentActivity,
        location: a.location,
        recentVisits: a.recentVisits,
        memorySummary: a.memorySummary,
        memories: a.memories.map(cleanMemory),
        important: a.important.map(cleanMemory),
        relationships: {
          mia: a.relationships.mia,
          kai: a.relationships.kai,
          luna: a.relationships.luna,
        },
        learned: a.learned,
      }
    }),
    positions: world.positions,
    recentDialogue: world.recentDialogue.map((l) => ({
      speaker: l.speaker,
      text: l.text,
    })),
    events: world.events,
    incidents: world.incidents,
    lastParticipants: world.lastParticipants,
    tasteProfiles: tasteProfiles as Snapshot["tasteProfiles"],
    discoveries: discoveries as Snapshot["discoveries"],
    socialMemories,
    gatherings: gatherings as Snapshot["gatherings"],
  }
}
export function validateScene(value: unknown, plan: Plan): Scene {
  sceneValidator.parse(value)
  if (
    !object(value) ||
    value.sceneId !== `scene-${plan.number}` ||
    !text(value.sceneId, 80) ||
    !Array.isArray(value.participants) ||
    value.participants.join(",") !== plan.participants.join(",") ||
    ![
      "casual_encounter",
      "group_hangout",
      "disagreement",
      "discovery",
      "unexpected_event",
      "personal_moment",
    ].includes(String(value.sceneType)) ||
    !text(value.summary, 180) ||
    !Array.isArray(value.beats) ||
    value.beats.length < (plan.participants.length === 1 ? 2 : 4) ||
    value.beats.length > 8
  )
    throw Error("Invalid scene structure")
  const present = new Set(plan.initialParticipants)
  const attendance: Set<ResidentId>[] = []
  for (const [index, b] of value.beats.entries()) {
    if (plan.arrival && index === plan.arrival.beforeBeat)
      present.add(plan.arrival.residentId)
    attendance.push(new Set(present))
    if (
      (index === 0 && b.replyTo !== null) ||
      (index > 0 &&
        (!Number.isInteger(b.replyTo) || b.replyTo < 0 || b.replyTo >= index))
    )
      throw Error("Scene continuity requires a preceding reply target")
    if (
      index > 0 &&
      !attendance[b.replyTo as number]?.has(b.speaker as ResidentId)
    )
      throw Error(
        "Resident cannot reply to a statement made before they arrived"
      )
    if (
      plan.arrival &&
      index === plan.arrival.beforeBeat &&
      (b.speaker === plan.arrival.residentId ||
        !new RegExp(`\\b${plan.arrival.residentId}\\b`, "i").test(b.dialogue))
    )
      throw Error("Arrival must be acknowledged by a present resident")
    if (!present.has(b.speaker as ResidentId))
      throw Error("Absent resident cannot speak")
    if (
      !object(b) ||
      !plan.participants.includes(b.speaker as ResidentId) ||
      !text(b.dialogue, 220) ||
      !emotions.includes(b.emotion as never) ||
      !actions.includes(b.action as never)
    )
      throw Error("Invalid scene beat")
    if (
      /\d|\b(score|scores|affinity|percent|algorithm|Qloo|Gemini|API|compatibility)\b/i.test(
        b.dialogue as string
      )
    )
      throw Error("Technical or numerical speech rejected")
    if (
      b.targetLocation !== null &&
      !locations.includes(String(b.targetLocation))
    )
      throw Error("Unknown destination")
    if (b.action === "walk_to") present.delete(b.speaker as ResidentId)
    if (
      b.action === "walk_to" &&
      b.targetLocation !== plan.destinations[b.speaker as ResidentId]
    )
      throw Error("Movement contradicts engine plan")
    if (
      b.action !== "walk_to" &&
      b.action !== "point" &&
      b.targetLocation !== null
    )
      throw Error("Impossible action target")
    if (b.action === "point" && b.targetLocation === null)
      throw Error("Pointing needs a valid target")
  }
  if (
    !plan.participants.every((id) =>
      (value.beats as Beat[]).some((b) => b.speaker === id)
    )
  )
    throw Error("Missing participant")
  if (
    !Array.isArray(value.suggestedMemoryUpdates) ||
    value.suggestedMemoryUpdates.length > 3 ||
    !Array.isArray(value.suggestedRelationshipChanges) ||
    value.suggestedRelationshipChanges.length > 2
  )
    throw Error("Too many state suggestions")
  for (const m of value.suggestedMemoryUpdates) {
    if (
      !object(m) ||
      !Number.isInteger(m.beatIndex) ||
      !finite(m.beatIndex, 0, value.beats.length - 1) ||
      !attendance[m.beatIndex as number]?.has(m.residentId as ResidentId) ||
      (m.kind === "promise" &&
        value.beats[m.beatIndex as number].speaker !== m.residentId) ||
      !["conversation", "promise", "discovery"].includes(String(m.kind))
    )
      throw Error("Ungrounded memory suggestion")
    if (
      m.kind === "promise" &&
      !/promise|next time|tomorrow|save you|meet you/i.test(
        value.beats[m.beatIndex as number].dialogue
      )
    )
      throw Error("No promise occurred")
  }
  for (const r of value.suggestedRelationshipChanges)
    if (
      !object(r) ||
      !Number.isInteger(r.beatIndex) ||
      !finite(r.beatIndex, 0, value.beats.length - 1) ||
      !attendance[r.beatIndex as number]?.has(r.from as ResidentId) ||
      !attendance[r.beatIndex as number]?.has(r.to as ResidentId) ||
      r.from === r.to ||
      !Number.isInteger(r.delta) ||
      !finite(r.delta, -2, 2)
    )
      throw Error("Invalid relationship change")
  return value as unknown as Scene
}
const residentSchema = z.enum(["mia", "kai", "luna"])
const locationSchema = z.enum(["cafe", "music", "museum"])
const memoryUpdateSchema = z.strictObject({
  residentId: residentSchema,
  beatIndex: z.number().int().min(0).max(7),
  kind: z.enum(["conversation", "promise", "discovery"]),
})
const relationshipChangeSchema = z.strictObject({
  from: residentSchema,
  to: residentSchema,
  beatIndex: z.number().int().min(0).max(7),
  delta: z.number().int().min(-2).max(2),
})
const sceneValidator = z.strictObject({
  ending: z.enum(["closure", "interruption", "transition"]),
  sceneId: z.string().min(1).max(80),
  participants: z.array(residentSchema).min(1).max(3),
  sceneType: z.enum([
    "casual_encounter",
    "group_hangout",
    "disagreement",
    "discovery",
    "unexpected_event",
    "personal_moment",
  ]),
  summary: z.string().min(1).max(180),
  beats: z
    .array(
      z.union([
        z.strictObject({
          replyTo: z.number().int().min(0).max(7).nullable(),
          references: z.array(z.string().min(1).max(100)).max(3),
          speaker: residentSchema,
          dialogue: z.string().min(1).max(220),
          emotion: z.enum(emotions),
          action: z.enum([
            "talk",
            "laugh",
            "shrug",
            "wave",
            "sit",
            "observe",
            "sketch",
            "dance",
            "react",
            "walk_to",
          ]),
          targetLocation: z.null(),
        }),
        z.strictObject({
          replyTo: z.number().int().min(0).max(7).nullable(),
          references: z.array(z.string().min(1).max(100)).max(3),
          speaker: residentSchema,
          dialogue: z.string().min(1).max(220),
          emotion: z.enum(emotions),
          action: z.enum(["point", "walk_to"]),
          targetLocation: locationSchema,
        }),
      ])
    )
    .min(2)
    .max(8),
  suggestedMemoryUpdates: z.array(memoryUpdateSchema).max(3),
  suggestedRelationshipChanges: z.array(relationshipChangeSchema).max(2),
})
// Groq generates the square encounter's expressive actions. Travel remains an
// engine transition after dialogue. Keeping this schema flat avoids Groq's
// action-union compiler limitation; the runtime accepts validated targeted actions too.
export const sceneSchema = z.toJSONSchema(
  sceneValidator.extend({
    beats: z
      .array(
        z.strictObject({
          replyTo: z.number().int().min(0).max(7).nullable(),
          references: z.array(z.string().min(1).max(100)).max(3),
          speaker: residentSchema,
          dialogue: z.string().min(1).max(220),
          emotion: z.enum(emotions),
          action: z.enum([
            "talk",
            "laugh",
            "shrug",
            "wave",
            "sit",
            "observe",
            "sketch",
            "dance",
            "react",
          ]),
          targetLocation: z.null(),
        })
      )
      .min(2)
      .max(8),
    // Groq's constrained decoder does not reliably enforce maxItems here.
    // The server normalizes these advisory fields to [] before validation.
    suggestedMemoryUpdates: z.array(memoryUpdateSchema),
    suggestedRelationshipChanges: z.array(relationshipChangeSchema),
  })
)
export const isDestination = (value: unknown): value is DestinationId =>
  locations.includes(String(value))
