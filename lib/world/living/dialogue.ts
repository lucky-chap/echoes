import type { SceneContext } from "./context"
import type { Scene, Snapshot } from "./types"

export class DialogueQualityError extends Error {}
export function normalizeDialogue(text: string) {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ")
}
/** Token overlap plus character trigrams catches small edits without an embedding API. */
export function similarDialogue(a: string, b: string) {
  const x = normalizeDialogue(a),
    y = normalizeDialogue(b)
  if (x === y) return true
  if (Math.min(x.length, y.length) < 24) return false
  const overlap = (a: Set<string>, b: Set<string>) => {
    const common = [...a].filter((t) => b.has(t)).length
    return common / (a.size + b.size - common || 1)
  }
  const grams = (s: string) =>
    new Set(Array.from({ length: s.length - 2 }, (_, i) => s.slice(i, i + 3)))
  return (
    overlap(new Set(x.split(" ")), new Set(y.split(" "))) >= 0.78 ||
    overlap(grams(x), grams(y)) >= 0.8
  )
}
export function dialogueHistory(world: Snapshot) {
  // Canonical scene storage; derive resident histories without duplicating state.
  return [
    ...(world.recentScenes ?? []).flatMap((s) => s.lines),
    ...world.recentDialogue,
  ].filter(
    (line, i, all) =>
      all.findIndex(
        (l) => l.speaker === line.speaker && l.text === line.text
      ) === i
  )
}
export function confirmedFacts({ world, plan, signals }: SceneContext) {
  return [
    ...world.events.slice(-2).map((text, i) => ({ id: `event:${i}`, text })),
    ...world.recentDialogue.map((l, i) => ({
      id: `dialogue:${i}`,
      text: `${l.speaker} said: ${l.text}`,
    })),
    ...world.agents
      .filter((a) => plan.participants.includes(a.id))
      .flatMap((a) =>
        [...a.memories, ...a.important]
          .filter((m) => m.kind !== "conversation" && m.kind !== "promise")
          .filter((m, i, all) => all.findIndex((n) => n.id === m.id) === i)
          .slice(-3)
          .map((m) => ({
            id: `memory:${a.id}:${m.id}`,
            text: `${a.id} experienced: ${m.text}`,
          }))
      ),
    ...signals
      .filter((signal) => plan.participants.includes(signal.residentId))
      .slice(0, 4)
      .map((signal) => ({
        id: `qloo:${signal.entityId}`,
        text: `${signal.residentId} received the verified Qloo discovery ${signal.name} (${signal.provenance.requestCategory}).`,
      })),
    ...world.socialMemories
      .filter((memory) =>
        memory.participants.some((id) => plan.participants.includes(id))
      )
      .slice(-2)
      .map((memory) => ({
        id: `social:${memory.id}`,
        text: `${memory.participants.join(", ")} previously shared: ${memory.summary}; confirmed outcome: ${memory.confirmedOutcome}.`,
      })),
  ]
}
export function validateDialogue(scene: Scene, context: SceneContext) {
  const history = dialogueHistory(context.world)
  const issues: string[] = []
  const lines = scene.beats.map((b) => b.dialogue)
  const matched = lines.filter((line, i) => {
    const previous = [...history.map((h) => h.text), ...lines.slice(0, i)]
    return previous.some((p) => similarDialogue(line, p))
  })
  // A single substantive recycled line is enough; two tiny stock replies also fail.
  if (
    matched.some((l) => normalizeDialogue(l).length >= 20) ||
    matched.length >= 2
  )
    issues.push(
      `repeated dialogue (${matched.length} lines, across scene/resident histories)`
    )
  for (const prior of context.world.recentScenes ?? []) {
    for (let i = 0; i <= lines.length - 3; i++) {
      for (let j = 0; j <= prior.lines.length - 3; j++) {
        if (
          lines
            .slice(i, i + 3)
            .every((l, k) => similarDialogue(l, prior.lines[j + k].text))
        )
          issues.push("repeated multi-line sequence")
      }
    }
  }
  if (
    (context.world.recentScenes ?? []).some(
      (s) => s.topic === context.plan.topic
    )
  )
    issues.push("recently exhausted topic")
  const facts = confirmedFacts(context)
  for (const [index, beat] of scene.beats.entries()) {
    if (beat.references.some((id) => !facts.some((f) => f.id === id)))
      issues.push(`unknown evidence at beat ${index}`)
    const referenced = facts.filter((f) => beat.references.includes(f.id))
    if (
      /\bI (visited|spent|discovered|went|saw)\b/i.test(beat.dialogue) &&
      referenced.some(
        (f) =>
          f.id.startsWith("memory:") &&
          !f.id.startsWith(`memory:${beat.speaker}:`)
      )
    )
      issues.push(`misattributed personal experience at beat ${index}`)
    const namedCallback = beat.dialogue.match(
      /\b(Mia|Kai|Luna),? you (said|told me)\b/i
    )
    if (
      namedCallback &&
      referenced.some(
        (f) =>
          f.id.startsWith("dialogue:") &&
          !f.text.startsWith(`${namedCallback[1].toLowerCase()} said:`)
      )
    )
      issues.push(`misattributed quotation at beat ${index}`)
    const past =
      /\b(yesterday|last time|earlier today|remember when|you promised|you told me|we already)\b/i.test(
        beat.dialogue
      )
    const unsupportedOpening =
      index === 0 &&
      /\b(again|that bit|as you said|what you said|take it back|your debut)\b/i.test(
        beat.dialogue
      )
    if ((past || unsupportedOpening) && !beat.references.length)
      issues.push(`unestablished callback at beat ${index}`)
    // Quoted callbacks must actually occur in supplied evidence or preceding speech.
    const quotes = [...beat.dialogue.matchAll(/[“"]([^”"]{12,})[”"]/g)]
    const evidence = [
      ...facts.filter((f) => beat.references.includes(f.id)).map((f) => f.text),
      ...scene.beats.slice(0, index).map((b) => b.dialogue),
    ]
    if (
      quotes.some(
        (q) =>
          !evidence.some((e) =>
            normalizeDialogue(e).includes(normalizeDialogue(q[1]))
          )
      )
    )
      issues.push(`unestablished quotation at beat ${index}`)
  }
  if (scene.ending === "closure" && /\?\s*$/.test(lines.at(-1) ?? ""))
    issues.push("closure leaves an unanswered question")
  if (issues.length)
    throw new DialogueQualityError([...new Set(issues)].join("; "))
  return "passed: exact, near, sequence, topic and grounding checks"
}
