export function cleanText(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/\.{2,}/g, ".")
    .replace(/this television\b/gi, "this TV show")
    .trim()
}
export function sentences(parts: (string | undefined | null | false)[]) {
  return (
    parts
      .filter(
        (part): part is string =>
          typeof part === "string" && Boolean(part.trim())
      )
      .map((part) => cleanText(part).replace(/[.!?。\s]+$/g, ""))
      .filter(Boolean)
      .join(". ") + (parts.some(Boolean) ? "." : "")
  )
}
