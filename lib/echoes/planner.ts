import { invitation } from "./language"
import { avoidMatch } from "./suitability"
import type { Activity, KitItem, MemoryRecord, ResidentInput } from "./types"
import { confirmedPreferences } from "./preferences"
import { sentences } from "./text"

export function promptConflicts(prompt: string, resident?: ResidentInput) {
  const dislikes = resident
    ? confirmedPreferences(resident).disliked_traits.join(" ")
    : ""
  return (
    /sing|hum|choir|vocal/i.test(dislikes) &&
    /\b(sing|singing|hum|humming|choir)\b/i.test(prompt)
  )
}

export function itemPrompt(item: KitItem, index = 0, resident?: ResidentInput) {
  if (item.prompt && !promptConflicts(item.prompt, resident)) return item.prompt
  const title = item.yearEvidence.title ?? item.name
  const music = item.kind === "music"
  const book = item.kind === "book"
  const label =
    item.yearEvidence.workType === "album"
      ? `the album “${title}”`
      : `“${title}”`
  const prompts = music
    ? [
        [
          `Tap along to ${label}, or simply listen`,
          `Puede marcar el ritmo de «${title}», o simplemente escuchar`,
          `Wo pɛ a, bɔ «${title}» so; anaa tie kɛkɛ`,
        ],
        [
          `Try humming a little of ${label}, or rest your voice`,
          `Puede tararear un poco de «${title}», o descansar la voz`,
          `Wo pɛ a, to «${title}» kakra; anaa home`,
        ],
        [
          `Listen for the instruments in ${label}, or enjoy a quiet pause`,
          `Escuche los instrumentos de «${title}», o descanse un momento`,
          `Tie nnwontode a ɛwɔ «${title}» mu; anaa home kakra`,
        ],
        [
          `Choose a comfortable volume for ${label}, or we can stop here`,
          `Elija un volumen cómodo para «${title}», o podemos parar aquí`,
          `Ma yɛnte «${title}» brɛoo; anaa yɛnnyae ha`,
        ],
        [
          `Stay with a short part of ${label}, or choose quiet company`,
          `Podemos escuchar un poco de «${title}», o estar en silencio`,
          `Yɛntie «${title}» kakra; anaa yɛntena komm`,
        ],
      ]
    : book
      ? [
          [
            `We can talk about the title “${title}”, or choose another topic`,
            `Podemos hablar del título «${title}», o elegir otro tema`,
            `Yebetumi aka edin «${title}» ho asɛm; anaa yɛafa asɛm foforo`,
          ],
          [
            `Choose whether to talk about “${title}” now, or put it aside`,
            `Puede elegir hablar de «${title}» ahora, o dejarlo a un lado`,
            `Paw sɛ yɛnka «${title}» ho asɛm seesei; anaa yɛnnyae`,
          ],
          [
            `Point out a colour on the cover of “${title}”, or leave it closed`,
            `Puede señalar un color de la portada de «${title}», o dejarlo cerrado`,
            `Kyerɛ ahosuo bi wɔ «${title}» nhoma no akyi; anaa yɛnnyae`,
          ],
          [
            `Say whether the title “${title}” interests you, or choose quiet company`,
            `Puede decir si le interesa el título «${title}», o estar en silencio`,
            `Ka sɛ wopɛ edin «${title}» no; anaa yɛntena komm`,
          ],
          [
            `Take a look at the cover of “${title}” if available, or leave the book aside`,
            `Puede mirar la portada de «${title}» si está disponible, o dejar el libro a un lado`,
            `Wo pɛ a, hwɛ «${title}» nhoma no akyi; anaa yɛnnyae`,
          ],
        ]
      : [
          [
            `Look at the setting in “${title}”, or skip this clip`,
            `Puede mirar el escenario de «${title}», o saltar este vídeo`,
            `Hwɛ baabi a «${title}» kɔ so; anaa yɛnnyae`,
          ],
          [
            `Watch the people in “${title}”, or simply rest`,
            `Puede observar a las personas de «${title}», o descansar`,
            `Hwɛ nnipa a wɔwɔ «${title}» mu; anaa home`,
          ],
          [
            `We can watch a short part of “${title}”, or turn the screen off`,
            `Podemos ver un poco de «${title}», o apagar la pantalla`,
            `Yebetumi ahwɛ «${title}» kakra; anaa yɛadum no`,
          ],
        ]
  const allowed = prompts.filter((row) => !promptConflicts(row[0], resident))
  const row = allowed[index % allowed.length]
  return invitation(resident, row[0], row[1], row[2])
}

export function promptTemplate(prompt: string, items: KitItem[]) {
  let text = prompt.toLowerCase()
  for (const item of items)
    for (const name of [item.name, item.yearEvidence.title]
      .filter(Boolean)
      .sort((a, b) => b!.length - a!.length))
      text = text.replaceAll(name!.toLowerCase(), "ITEM")
  return text
    .replace(/\d{4}/g, "YEAR")
    .replace(/[^a-z ]/gi, "")
    .replace(/\s+/g, " ")
    .trim()
}
export function replacementPrompt(
  item: KitItem,
  activities: Activity[],
  pool: KitItem[],
  resident?: ResidentInput
) {
  if (
    item.prompt &&
    !promptConflicts(item.prompt, resident) &&
    !activities.some(
      (a) =>
        promptTemplate(a.prompt, pool) === promptTemplate(item.prompt!, pool)
    )
  )
    return item.prompt
  const used = new Set(
    activities
      .filter((a) => a.kind === "media")
      .map((a) => promptTemplate(a.prompt, pool))
  )
  for (let index = 0; index < 5; index++) {
    const prompt = itemPrompt({ ...item, prompt: undefined }, index, resident)
    if (!used.has(promptTemplate(prompt, pool))) return prompt
  }
  return `What would you choose next after “${item.name}”, including the option to stop here?`
}

export function followThread(
  activities: Activity[],
  resident?: Pick<ResidentInput, "language">
) {
  const names = activities
    .filter((a) => a.itemId)
    .map((a) => a.title)
    .slice(-2)
  const titles = names.map((n) => `“${n}”`).join(" / ")
  return invitation(
    resident,
    names.length
      ? `Choose between ${titles} for another short moment, or enjoy quiet company`
      : "Choose a topic you enjoy, or we can sit quietly",
    names.length
      ? `Puede elegir ${titles} para un momento más, o descansar en silencio`
      : "Puede elegir un tema que le guste, o podemos estar en silencio",
    names.length
      ? `Paw ${titles} mu biako bio; anaa yɛntena komm`
      : "Paw asɛm a wopɛ; anaa yɛntena komm"
  )
}
export function rebalancePlan(
  activities: Activity[],
  resident?: ResidentInput
): Activity[] {
  const start = activities.find((a) => a.kind === "welcome")
  const end = activities.find((a) => a.kind === "closing")
  const middle: Activity[] = []
  const pausePrompts = [
    "Take a quiet moment; continue only when it feels welcome.",
    "Leave some space between choices, with no need to fill the silence.",
    "Offer a little breathing room, or end here if that feels better.",
    "Let the pace settle before deciding whether to continue.",
    "Make room for rest, letting the person choose when to move on.",
    "Allow an unhurried break, with stopping always an option.",
    "Enjoy some quiet company, without asking for a response.",
  ]
  let pauseIndex = 0
  for (const activity of activities.filter(
    (a) =>
      a.kind !== "welcome" && a.kind !== "closing" && !a.id.startsWith("pause:")
  )) {
    middle.push({
      ...activity,
      minutes:
        activity.kind === "media"
          ? Math.min(6, activity.minutes)
          : activity.minutes,
    })
    if (activity.kind === "media")
      middle.push({
        id: `pause:${activity.id}`,
        kind: "conversation",
        title: `A pause after ${activity.title}`,
        minutes: 1,
        prompt: invitation(
          resident,
          pausePrompts[pauseIndex % pausePrompts.length],
          [
            "Podemos descansar un momento, o terminar aquí",
            "Dejemos un poco de silencio, sin necesidad de hablar",
            "Puede tomarse su tiempo antes de continuar",
            "Podemos estar tranquilos, o elegir otra cosa",
          ][pauseIndex % 4],
          [
            "Yɛnhome kakra; anaa yɛnnyae ha",
            "Yɛntena komm kakra; ɛho nhia sɛ wokasa",
            "Gye wo bere; anaa yɛnnyae",
            "Yɛntena brɛoo; anaa paw foforo",
          ][pauseIndex++ % 4]
        ),
        rationale: "A short pause between items; no response is required.",
        approved: false,
      })
  }
  if (
    !middle.some((a) => a.kind === "conversation" && !a.id.startsWith("pause:"))
  )
    middle.push({
      id: "conversation",
      kind: "conversation",
      title: "Quiet company or a familiar topic",
      minutes: 1,
      prompt: followThread(middle, resident),
      rationale: "Follow the person’s choice and end early if preferred.",
      approved: false,
    })
  const conversations = middle.filter(
    (a) => a.kind === "conversation" && !a.id.startsWith("pause:")
  )
  const media = middle.filter((a) => a.kind === "media")
  const available = 30 - (start?.minutes ?? 0) - (end?.minutes ?? 0)
  while (
    media.reduce((n, a) => n + a.minutes, 0) +
      media.length +
      conversations.length >
      available &&
    media.some((a) => a.minutes > 1)
  ) {
    const longest = [...media].sort((a, b) => b.minutes - a.minutes)[0]
    longest.minutes--
  }
  const remaining =
    available - media.reduce((n, a) => n + a.minutes, 0) - media.length
  conversations.forEach((a, i) => {
    a.minutes =
      Math.floor(remaining / conversations.length) +
      (i < remaining % conversations.length ? 1 : 0)
  })
  const thread = middle.find((a) => a.id === "conversation")
  if (thread) thread.prompt = followThread(middle, resident)
  return [...(start ? [start] : []), ...middle, ...(end ? [end] : [])]
}

export function planSession(
  resident: ResidentInput,
  items: KitItem[],
  memories: MemoryRecord[]
): Activity[] {
  const preferences = confirmedPreferences(resident)
  const short = /short|pause|break/i.test(preferences.format_prefs.join(" "))
  const selected = items.slice(0, 4)
  const screen = items.find((i) => i.kind === "film" || i.kind === "television")
  if (screen && !selected.includes(screen))
    selected.splice(selected.length - 1, 1, screen)
  const discovery = items.find((i) => !i.namedFavorite && i.kind === "music")
  if (discovery && !selected.includes(discovery)) {
    const at = selected.findLastIndex((i) => i !== screen)
    if (at >= 0) selected.splice(at, 1, discovery)
  }
  const noteTopics: [RegExp, string, string, string, string][] = [
    [
      /danc/i,
      "dancing",
      "Try a small dance movement while seated, or let your feet rest",
      "Puede hacer un pequeño paso de baile sentada, o descansar los pies",
      "Wo pɛ a, tena ase na sa kakra; anaa home",
    ],
    [
      /proverb/i,
      "proverbs",
      "Share a favourite proverb if you like, or we can leave it for another time",
      "Puede compartir un refrán que le guste, o dejarlo para otro momento",
      "Wo pɛ a, ka ɛbɛ bi a wopɛ; anaa yɛnnyae mma akyiri",
    ],
    [
      /\btea\b/i,
      "tea",
      "Tell me how you like your tea, or we can sit quietly",
      "Puede contarme cómo le gusta el té, o podemos estar en silencio",
      "Ka sɛnea wopɛ wo tii; anaa yɛntena komm",
    ],
    [
      /choir|sing|call.and.response/i,
      "singing",
      "Hum a few notes together if you like, or rest your voice",
      "Podemos tararear un poco juntos, o descansar la voz",
      "Wo pɛ a, ma yɛnto dwom kakra; anaa home",
    ],
    [
      /radio|drama/i,
      "radio dramas",
      "Tell me whether you prefer a short radio story or music, or choose quiet",
      "Puede elegir entre un cuento de radio y música, o estar en silencio",
      "Paw radio so anansesɛm anaa nnwom; anaa yɛntena komm",
    ],
    [
      /cook|dish|food/i,
      "cooking",
      "Name a favourite dish to cook, or we can leave the kitchen talk for later",
      "Puede nombrar un plato que le guste cocinar, o dejar la cocina para otro momento",
      "Ka aduan a wopɛ sɛ wonoa; anaa yɛnnyae mma akyiri",
    ],
  ]
  const noteActivities: Activity[] = noteTopics
    .filter(
      ([pattern, topic, prompt]) =>
        preferences.liked_traits.some(
          (t) => pattern.test(t) && !avoidMatch(t, resident.sensitivities)
        ) &&
        !avoidMatch(topic, resident.sensitivities) &&
        !promptConflicts(prompt, resident)
    )
    .slice(0, 2)
    .map(([pattern, topic, en, es, tw], i) => {
      const note = preferences.liked_traits.find((trait) =>
        pattern.test(trait)
      )!
      if (/pancake/i.test(note)) {
        topic = "pancakes"
        en =
          "Tell me how you like to make pancakes, or we can choose another topic"
        es =
          "Puede contarme cómo le gusta preparar panqueques, o elegir otro tema"
        tw = "Ka sɛnea wopɛ sɛ woyɛ pancake; anaa yɛafa asɛm foforo"
      } else if (/sunday lunch/i.test(note)) {
        topic = "Sunday lunch"
        en =
          "Name a favourite part of Sunday lunch, or we can leave the kitchen talk for later"
        es =
          "Puede nombrar una parte favorita del almuerzo del domingo, o hablar de otra cosa"
        tw = "Ka Kwasiada awia aduan bi a wopɛ; anaa yɛnnyae saa asɛm yi"
      }
      return {
        id: `notes:${i}`,
        kind: "conversation" as const,
        title: `An invitation: ${topic}`,
        minutes: 2,
        prompt: invitation(resident, en, es, tw),
        rationale: sentences([
          `Chosen because confirmed notes mention ${note}`,
        ]),
        approved: false,
      }
    })
  const usedPrompts = new Set<string>()
  const chosenPrompt = (item: KitItem, index: number) => {
    let prompt = itemPrompt(item, index, resident)
    for (
      let offset = 0;
      usedPrompts.has(promptTemplate(prompt, items)) && offset < 5;
      offset++
    )
      prompt = itemPrompt(
        { ...item, prompt: undefined },
        index + offset + 1,
        resident
      )
    usedPrompts.add(promptTemplate(prompt, items))
    return prompt
  }
  return rebalancePlan(
    [
      {
        id: "welcome",
        kind: "welcome",
        title: "Settle in and offer a choice",
        minutes: 3,
        prompt: invitation(
          resident,
          "Choose some music, a conversation, or quiet company today",
          "Puede elegir música, conversación o compañía tranquila",
          "Paw nnwom, nkɔmmɔ, anaa ma yɛntena komm"
        ),
        rationale: sentences([
          "Check comfort and willingness before starting",
          ...preferences.logistics,
        ]),
        approved: false,
      },
      ...selected.map((item, index): Activity => ({
        id: `media:${item.entityId}`,
        kind: item.kind === "book" ? "conversation" : "media",
        title: item.name,
        itemId: item.entityId,
        minutes: short ? 4 : 6,
        prompt: chosenPrompt(item, index),
        rationale: sentences(item.whyItFits),
        approved: false,
      })),
      ...noteActivities,
      {
        id: "conversation",
        kind: "conversation",
        title: selected.length ? "Follow the thread" : "A gentle invitation",
        minutes: 4,
        prompt: "",
        rationale: memories.some(
          (m) => m.kind === "biography" && m.status === "confirmed"
        )
          ? "Caregiver-confirmed background is available on the About Me sheet; use only topics the person welcomes."
          : "Follow today’s choices without assuming a personal memory or asking for a correct answer.",
        approved: false,
      },
      {
        id: "closing",
        kind: "closing",
        title: "Close gently",
        minutes: 3,
        prompt: invitation(
          resident,
          "Thank you for this time together; we can rest now, or choose something familiar",
          "Gracias por este rato juntos; podemos descansar, o elegir algo conocido",
          "Meda wo ase sɛ yɛanya bere yi; yɛnnhome, anaa paw nea wopɛ"
        ),
        rationale: "Follow the person’s pace and established comfort approach.",
        approved: false,
      },
    ],
    resident
  )
}
