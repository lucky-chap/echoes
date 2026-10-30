import type { ResidentInput } from "./types"

export type IntakeMode = "plan" | "profile" | "add"

export const blankResident = (id = crypto.randomUUID()): ResidentInput => ({
  id,
  nickname: "",
  birthYear: 1948,
  hometown: "",
  country: "",
  language: "English",
  lovedThings: [""],
  sensitivities: [],
})

/**
 * The person shown in the intake form. The add flow always returns its own
 * blank draft and never an existing resident's saved details.
 */
export function intakeResidents(
  all: ResidentInput[],
  activeResidentId: string,
  mode: IntakeMode,
  draft: ResidentInput | null = null
): ResidentInput[] {
  if (mode === "add") return draft ? [draft] : []
  const active = all.find((resident) => resident.id === activeResidentId) ?? all[0]
  return active ? [active] : []
}
