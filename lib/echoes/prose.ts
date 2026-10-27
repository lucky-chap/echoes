import Groq from "groq-sdk"
import { z } from "zod"
import type { FeedbackRecord, KitItem, ResidentInput } from "./types"
import { draftNoteFromFacts } from "./note"

const extractedSchema = z.object({
  birthYear: z.number().int().min(1900).max(new Date().getFullYear() - 13).optional(),
  hometown: z.string().max(100).optional(),
  country: z.string().max(60).optional(),
  language: z.string().max(40).optional(),
  lovedThings: z.array(z.string().max(100)).max(3).optional(),
  sensitivities: z.array(z.string().max(80)).max(8).optional(),
})

function fallbackIntake(note: string) {
  const birthYear = /\b(19\d{2}|20[01]\d)\b/.exec(note)?.[1]
  return extractedSchema.parse({ birthYear: birthYear ? Number(birthYear) : undefined })
}

export async function extractIntake(note: string) {
  if (!process.env.GROQ_API_KEY) return { profile: fallbackIntake(note), source: "local fallback" as const }
  try {
    const client = new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: 12_000, maxRetries: 0 })
    const response = await client.chat.completions.create({
      model: process.env.GROQ_MODEL || "openai/gpt-oss-20b", temperature: 0,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: "Extract only explicitly stated profile fields from the caregiver note. Return JSON with optional birthYear, hometown, country, language, lovedThings (max 3), sensitivities. Never infer medical information or invent a favorite." }, { role: "user", content: note.slice(0, 1200) }],
    })
    return { profile: extractedSchema.parse(JSON.parse(response.choices[0]?.message.content || "{}")), source: "Groq" as const }
  } catch { return { profile: fallbackIntake(note), source: "local fallback" as const } }
}

export async function writeSessionNote(input: { resident: ResidentInput; items: KitItem[]; feedback: FeedbackRecord[]; engagement: 1 | 2 | 3 | null }) {
  const deterministic = draftNoteFromFacts(input)
  const used = input.items.map((item) => item.name).join(", ") || "no verified items"
  const responses = input.feedback.map((item) => `${input.items.find((candidate) => candidate.entityId === item.entityId)?.name ?? "item"}: ${item.status}`).join("; ") || "No responses recorded."
  if (!process.env.GROQ_API_KEY) return deterministic
  try {
    const client = new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: 12_000, maxRetries: 0 })
    const response = await client.chat.completions.create({ model: process.env.GROQ_MODEL || "openai/gpt-oss-20b", temperature: 0.2, max_completion_tokens: 220, messages: [{ role: "system", content: "Write a concise activity-support participation note from only the supplied facts. Label it 'Draft for staff review.' Do not claim treatment, medical benefit, agitation reduction, cognition change, or facts not present." }, { role: "user", content: JSON.stringify({ nickname: input.resident.nickname, items: used, responses, engagement: input.engagement }) }] })
    return response.choices[0]?.message.content?.trim().slice(0, 1000) || deterministic
  } catch { return deterministic }
}
