import { z } from "zod"
import { preferencesSchema, historyImportSchema } from "./preferences"

export const entityTypeSchema = z.enum([
  "urn:entity:artist",
  "urn:entity:movie",
  "urn:entity:tv_show",
  "urn:entity:book",
  "urn:entity:place",
])
export const entitySchema = z.object({
  entityId: z.string().min(1).max(160),
  name: z.string().min(1).max(250),
  type: entityTypeSchema,
  description: z.string().max(10000).nullable(),
  affinity: z.number().nullable(),
  properties: z.record(z.string(), z.unknown()),
  imageUrl: z
    .string()
    .url()
    .refine(
      (value) =>
        new URL(value).protocol === "https:" &&
        !new URL(value).username &&
        !new URL(value).password
    )
    .optional(),
})
export const residentSchema = z.object({
  id: z.string().min(1).max(64),
  nickname: z.string().trim().min(1).max(40),
  birthYear: z
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear() - 13),
  hometown: z.string().trim().min(1).max(100),
  country: z.string().trim().min(2).max(60),
  language: z.string().trim().min(1).max(40),
  lovedThings: z.array(z.string().trim().min(1).max(100)).min(1).max(3),
  sensitivities: z.array(z.string().trim().min(1).max(80)).max(8),
  resolvedFavorites: z
    .array(
      z.object({
        query: z.string().max(100),
        entityId: z.string().max(160),
        type: entityTypeSchema,
        name: z.string().max(250),
      })
    )
    .max(3)
    .optional(),
  notes: z.string().max(6000).optional(),
  intake: z.string().max(1200).optional(),
  intakeNote: z.string().max(1200).optional(),
  memories: z.string().max(1200).optional(),
  importantMemories: z.string().max(1200).optional(),
  preferences: preferencesSchema.optional(),
  responseHistory: historyImportSchema.optional(),
  consent: z
    .object({
      authority: z.enum(["caregiver", "family"]),
      recordedAt: z.string().datetime(),
    })
    .optional(),
})

export const memorySchema = z
  .object({
    id: z.string().max(160),
    residentId: z.string().max(64),
    kind: z.enum(["biography", "preference", "observation", "discovery"]),
    status: z.enum(["confirmed", "reported", "suggested"]),
    text: z.string().max(2000),
    source: z.enum(["caregiver", "family", "Qloo"]),
    createdAt: z.string().datetime(),
    sessionId: z.string().max(64).optional(),
    entityId: z.string().max(160).optional(),
    response: z
      .enum([
        "engaged",
        "no_response",
        "distress",
        "shared_story",
        "not_used",
        "not_for_us",
      ])
      .optional(),
  })
  .refine(
    (m) =>
      m.source !== "Qloo" ||
      (m.kind === "discovery" &&
        m.status === "suggested" &&
        m.response === undefined),
    "Qloo suggestions cannot be confirmed personal memories"
  )

export const feedbackSchema = z.object({
  residentId: z.string().min(1).max(64),
  entityId: z.string().min(1).max(160),
  status: z.enum(["sparked", "neutral", "distressed", "not_for_us"]),
  recordedAt: z.string().datetime().optional(),
  sessionId: z.string().max(64).optional(),
})

export const kitRequestSchema = z.object({
  residents: z.array(residentSchema).length(1),
  feedback: z.array(feedbackSchema).max(5000).default([]),
  memories: z.array(memorySchema).max(1000).default([]),
})
