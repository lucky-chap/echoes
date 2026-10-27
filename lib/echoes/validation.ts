import { z } from "zod"

const residentSchema = z.object({
  id: z.string().min(1).max(64),
  nickname: z.string().trim().min(1).max(40),
  birthYear: z.number().int().min(1900).max(new Date().getFullYear() - 13),
  hometown: z.string().trim().min(1).max(100),
  country: z.string().trim().min(2).max(60),
  language: z.string().trim().min(1).max(40),
  lovedThings: z.array(z.string().trim().min(1).max(100)).min(1).max(3),
  sensitivities: z.array(z.string().trim().min(1).max(80)).max(8),
})

export const kitRequestSchema = z.object({
  residents: z.array(residentSchema).min(1).max(12),
  feedback: z.array(z.object({
    residentId: z.string().min(1).max(64),
    entityId: z.string().min(1).max(160),
    status: z.enum(["sparked", "distressed"]),
  })).max(300).default([]),
})
