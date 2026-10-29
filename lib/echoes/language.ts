import type { ResidentInput } from "./types"
import { sentences } from "./text"
export function preferredLanguage(resident?: Pick<ResidentInput, "language">) {
  const value = resident?.language ?? "English"
  return /spanish|español/i.test(value)
    ? "es"
    : /twi|akan/i.test(value)
      ? "tw"
      : "en"
}
export function invitation(
  resident: Pick<ResidentInput, "language"> | undefined,
  en: string,
  es: string,
  tw: string
) {
  const language = preferredLanguage(resident)
  const local = sentences([
    language === "es" ? es : language === "tw" ? tw : en,
  ])
  return language !== "en" &&
    /english|bilingual/i.test(resident?.language ?? "")
    ? `${local}\n${sentences([en])}`
    : local
}
