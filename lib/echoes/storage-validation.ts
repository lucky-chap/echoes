import { z } from "zod"
import {
  feedbackSchema,
  memorySchema,
  residentSchema,
  entitySchema,
} from "./validation"
const safeUrl = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value)
    return (
      url.protocol === "https:" &&
      [
        "www.youtube.com",
        "open.spotify.com",
        "musicbrainz.org",
        "www.themoviedb.org",
      ].includes(url.hostname) &&
      !url.username &&
      !url.password
    )
  }, "Only supported media and evidence destinations are allowed")
const safeImageUrl = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value)
    return url.protocol === "https:" && !url.username && !url.password
  }, "Only HTTPS artwork without credentials is allowed")
const traceSchema = z.object({
  id: z.string().max(160),
  createdAt: z.string(),
  tool: z.enum([
    "qloo_search",
    "qloo_insights",
    "qloo_score",
    "era_verify",
    "safety_filter",
    "group_optimizer",
    "memory_read",
    "memory_write",
    "note_writer",
    "context_research",
    "plan_session",
    "media_lookup",
    "replan",
  ]),
  summary: z.string().max(4000),
  role: z
    .enum([
      "Cultural Researcher",
      "Qloo Taste Explorer",
      "Session Planner",
      "Response Adapter",
    ])
    .optional(),
  outcome: z
    .enum(["ok", "empty", "unavailable", "replanned", "excluded"])
    .optional(),
  input: z.record(z.string(), z.unknown()).optional(),
  output: z.record(z.string(), z.unknown()).optional(),
})
const seedSchema = z.object({
  entityId: z.string().max(160),
  name: z.string().max(250),
  evidence: z.enum(["sparked", "named", "inferred"]),
})
const itemSchema = z.object({
  seed: seedSchema.optional(),
  traits: z.array(z.string().max(160)).max(20).optional(),
  namedFavorite: z.boolean().optional(),
  eraLabel: z.string().max(500).optional(),
  prompt: z.string().max(1500).optional(),
  score: z.number().optional(),
  replacementIds: z.array(z.string().max(160)).max(3).optional(),
  cautions: z
    .array(
      z.object({
        topic: z.string().max(500),
        sourceField: z.string().max(160),
        matchedTerm: z.string().max(500).optional(),
        source: z.enum(["caregiver", "conservative_default"]).optional(),
      })
    )
    .max(5)
    .optional(),
  entityId: z.string().max(160),
  name: z.string().max(250),
  kind: z.enum(["music", "film", "television", "book", "place"]),
  type: z.enum([
    "urn:entity:artist",
    "urn:entity:movie",
    "urn:entity:tv_show",
    "urn:entity:book",
    "urn:entity:place",
  ]),
  whyItFits: z.array(z.string().max(2000)).max(12),
  matchedResidentIds: z.array(z.string().max(64)).max(12),
  affinity: z.number().nullable(),
  yearEvidence: z.object({
    year: z.number().int(),
    source: z.enum(["MusicBrainz", "TMDB", "Qloo"]),
    residentIds: z.array(z.string().max(64)).max(12),
    title: z.string().max(500).optional(),
    url: safeUrl.optional(),
    cached: z.boolean().optional(),
    fetchedAt: z.string().datetime().optional(),
    workType: z.enum(["track", "album", "series"]).optional(),
    firstAirYear: z.number().int().optional(),
    lastAirYear: z.number().int().optional(),
    ongoing: z.boolean().optional(),
    artistLevel: z.boolean().optional(),
    releaseCount: z.number().int().optional(),
  }),
  media: z
    .array(
      z.object({
        label: z.string().max(100),
        url: safeUrl,
        status: z.enum(["provider-checked", "search"]),
        checkedAt: z.string().optional(),
        instructions: z.string().max(1000),
      })
    )
    .max(5)
    .optional(),
  imageUrl: safeImageUrl.optional(),
})
export const activitySchema = z.object({
  id: z.string().max(200),
  kind: z.enum(["welcome", "media", "conversation", "closing"]),
  title: z.string().max(300),
  minutes: z.number().int().min(1).max(30),
  prompt: z.string().max(1500),
  rationale: z.string().max(3000),
  itemId: z.string().max(160).optional(),
  approved: z.boolean(),
})
export const sessionKitSchema = z.object({
  id: z.string().max(64),
  createdAt: z.string().datetime(),
  residents: z
    .array(
      z.object({
        id: z.string().max(64),
        nickname: z.string().max(40),
        language: z.string().max(40),
        hometown: z.string().max(100),
      })
    )
    .min(1)
    .max(12),
  era: z.object({ from: z.number(), to: z.number() }),
  items: z.array(itemSchema).max(12),
  alternatives: z.array(itemSchema).max(12).optional(),
  activities: z.array(activitySchema).max(24).optional(),
  dateChecks: z
    .array(
      z.object({
        entity: entitySchema,
        seed: seedSchema.optional(),
        traits: z.array(z.string().max(160)).max(20).optional(),
        status: z.enum([
          "verified_in_window",
          "verified_out_of_window",
          "unchecked_unavailable",
          "unknown_date",
        ]),
        reason: z.string().max(2000),
        favorite: z.boolean(),
        checkedAt: z.string().datetime(),
        cached: z.boolean().optional(),
        blocked: z
          .object({
            topic: z.string().max(500),
            source: z.enum(["caregiver", "conservative_default", "feedback"]),
            sourceField: z.string().max(160).optional(),
          })
          .optional(),
      })
    )
    .max(40)
    .optional(),
  resolutionChoices: z
    .array(
      z.object({
        query: z.string().max(100),
        candidates: z.array(entitySchema).max(5),
      })
    )
    .max(3)
    .optional(),
  prompts: z.array(z.string().max(2000)).max(12),
  aboutMe: z.object({
    title: z.string().max(200),
    details: z.array(z.string().max(6500)).max(40),
    opening: z.string().max(2000),
  }),
  coverage: z.object({
    percent: z.number(),
    servedResidentIds: z.array(z.string()).max(12),
    underservedNames: z.array(z.string()).max(12),
    level: z.enum(["strong", "partial", "thin"]).optional(),
    domainCount: z.number().int().min(0).max(5).optional(),
  }),
  notes: z.array(z.string().max(3000)).max(30),
  agentTrace: z.array(traceSchema).max(400),
  logistics: z.array(z.string().max(160)).max(20).optional(),
  research: z
    .array(
      z.object({
        context: z.string().max(2000),
        source: z.string().max(100),
        url: safeUrl.optional(),
      })
    )
    .max(12)
    .optional(),
  diagnostics: z
    .object({
      resolved: z.number(),
      requested: z.number(),
      candidates: z.number(),
      verified: z.number(),
      unavailable: z.number(),
      toolCalls: z.number(),
    })
    .optional(),
})
export const wrapUpSchema = z.object({
  recordedAt: z.string().datetime(),
  observations: z
    .array(
      z.object({
        activityId: z.string().max(200),
        entityId: z.string().max(160).optional(),
        status: z.enum([
          "engaged",
          "no_response",
          "distress",
          "shared_story",
          "not_used",
          "not_for_us",
        ]),
        story: z.string().max(600).optional(),
      })
    )
    .max(24),
  engagement: z.union([z.literal(1), z.literal(2), z.literal(3), z.null()]),
  caregiverNote: z.string().max(1200),
})
const draftResident = residentSchema.extend({
  nickname: z.string().max(40),
  hometown: z.string().max(100),
  country: z.string().max(60),
  language: z.string().max(40),
  birthYear: z.number().int().min(0).max(new Date().getFullYear()),
  lovedThings: z.array(z.string().max(100)).max(3),
  sensitivities: z.array(z.string().max(80)).max(8),
})
export const workspaceSchema = z.object({
  version: z.literal(1),
  secret: z.string().max(100),
  mode: z.enum(["team", "family"]),
  residents: z.array(draftResident).max(60),
  feedback: z.array(feedbackSchema).max(5000),
  memories: z.array(memorySchema).max(20000).optional(),
  traces: z.array(traceSchema).max(200),
  sessions: z
    .array(
      z.object({
        id: z.string().max(64),
        createdAt: z.string(),
        kit: sessionKitSchema,
        feedback: z.array(feedbackSchema).max(300),
        engagement: z.union([
          z.literal(1),
          z.literal(2),
          z.literal(3),
          z.null(),
        ]),
        noteDraft: z.string().max(5000).nullable(),
        wrapUp: wrapUpSchema.optional(),
        progress: z
          .object({
            activityId: z.string().max(200),
            updatedAt: z.string().datetime(),
          })
          .optional(),
      })
    )
    .max(600),
})
