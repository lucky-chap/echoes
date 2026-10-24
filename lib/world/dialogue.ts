import {
  destination,
  residents,
  situationNames,
  type ResidentId,
  type Situation,
} from "./profiles"
import type { Decision } from "./decision"
export type SpeakingPhase =
  "proposing" | "deliberating" | "deciding" | "completing"
export interface Line {
  speaker: ResidentId
  text: string
}
/** Contextual templates express computed preferences and compromises, not a fixed event script. */
export function composeDialogue(
  phase: SpeakingPhase,
  decision: Decision,
  situation: Situation
): Line[] {
  const winner = destination(decision.winner.id)
  if (phase === "deciding")
    return [
      {
        speaker: "mia",
        text: `Let's try ${winner.name}. I want to see what catches your eye.`,
      },
    ]
  return residents.map((r) => {
    const proposal = destination(decision.proposals[r.id])
    const score = decision.winner.scores[r.id]
    if (phase === "proposing")
      return {
        speaker: r.id,
        text: `${situation === "sunny" ? "For this afternoon" : situationNames[situation] + ". Now"} I'd pick ${proposal.name}! I want to ${r.goal.toLowerCase()}.`,
      }
    if (phase === "deliberating")
      return {
        speaker: r.id,
        text:
          proposal.id === winner.id
            ? `${winner.name} is my first choice. ${winner.activity[0].toUpperCase() + winner.activity.slice(1)} would be lovely. How does that feel for everyone?`
            : `I prefer ${proposal.name} but I’m curious about ${winner.name}. ${score >= 60 ? "I can happily meet you halfway." : "That is a stretch for my tastes, but I will give our shared choice a try."} ${r.id === "kai" ? "Finding something new together counts too." : r.id === "luna" ? "I can look for a quiet little detail there." : "Being together matters to me."}`,
      }
    return {
      speaker: r.id,
      text: `${score >= 75 ? "That was just my kind of afternoon." : score >= 60 ? "I am glad we tried that together." : "Not quite my usual thing, but I liked being with you."} ${r.id === "mia" ? `We made time to connect while ${winner.activity}.` : r.id === "kai" ? `A new memory at ${winner.name}! Next time, I have another idea.` : `I found a little inspiration at ${winner.name}. I will keep this moment in my sketchbook.`}`,
    }
  })
}
