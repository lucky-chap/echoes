import type { ResidentInput } from "./types"
// Fictional demo inputs with reviewed preferences. Entity IDs and dates come from providers.
export const reliabilityDemoProfiles: ResidentInput[] = [
  {
    id: "demo-dorothy",
    nickname: "Dorothy",
    birthYear: 1944,
    hometown: "Memphis, Tennessee",
    country: "United States",
    language: "English",
    lovedThings: ["Aretha Franklin", "Elvis Presley", "I Love Lucy"],
    sensitivities: ["funeral hymns", "hospital scenes"],
    notes:
      "Dorothy enjoys singing with a choir and talking about how she makes her afternoon tea. She likes familiar tunes and short listening sessions with pauses. Offer a chance to hum along without asking her to remember lyrics. Sit on her right and keep the volume low. Avoid funeral hymns and hospital scenes.",
    preferences: {
      confirmed: true,
      sourceNotes:
        "Dorothy enjoys singing with a choir and talking about how she makes her afternoon tea. She likes familiar tunes and short listening sessions with pauses. Offer a chance to hum along without asking her to remember lyrics. Sit on her right and keep the volume low. Avoid funeral hymns and hospital scenes.",
      liked_traits: ["choir singing", "afternoon tea", "familiar tunes"],
      disliked_traits: ["funeral hymns", "hospital scenes"],
      format_prefs: ["short items", "pauses"],
      logistics: ["Sit on her right", "keep the volume low"],
      people: [],
      places: [],
    },
    consent: {
      authority: "caregiver",
      recordedAt: "2026-10-29T00:00:00.000Z",
    },
  },
  {
    id: "demo-margaret",
    nickname: "Margaret",
    birthYear: 1946,
    hometown: "Liverpool, England",
    country: "United Kingdom",
    language: "English",
    lovedThings: ["The Beatles", "Dusty Springfield", "Coronation Street"],
    sensitivities: ["war", "hospital scenes"],
    notes:
      "Margaret enjoys dancing to pop music and talking about cooking Sunday lunch. She likes a steady beat and the option to move her hands while seated. She prefers short clips with a quiet pause between them. Sit facing her so she can see your face. Avoid war and hospital scenes, including those in otherwise familiar TV shows.",
    preferences: {
      confirmed: true,
      sourceNotes:
        "Margaret enjoys dancing to pop music and talking about cooking Sunday lunch. She likes a steady beat and the option to move her hands while seated. She prefers short clips with a quiet pause between them. Sit facing her so she can see your face. Avoid war and hospital scenes, including those in otherwise familiar TV shows.",
      liked_traits: ["dancing", "pop music", "cooking Sunday lunch"],
      disliked_traits: ["war", "hospital scenes"],
      format_prefs: ["short clips", "quiet pauses"],
      logistics: ["Sit facing her so she can see your face"],
      people: [],
      places: [],
    },
    consent: {
      authority: "caregiver",
      recordedAt: "2026-10-29T00:00:00.000Z",
    },
  },
  {
    id: "demo-robert",
    nickname: "Robert",
    birthYear: 1950,
    hometown: "Detroit, Michigan",
    country: "United States",
    language: "English",
    lovedThings: ["Stevie Wonder", "Carole King", "The Mary Tyler Moore Show"],
    sensitivities: ["war", "politics"],
    notes:
      "Robert enjoys listening to radio dramas and talking about cooking breakfast, especially pancakes. He likes tapping his fingers to a steady rhythm but does not want to be asked to sing. Offer one choice at a time and leave a pause between activities. Sit on his left. Avoid war and politics.",
    preferences: {
      confirmed: true,
      sourceNotes:
        "Robert enjoys listening to radio dramas and talking about cooking breakfast, especially pancakes. He likes tapping his fingers to a steady rhythm but does not want to be asked to sing. Offer one choice at a time and leave a pause between activities. Sit on his left. Avoid war and politics.",
      liked_traits: [
        "radio dramas",
        "cooking breakfast",
        "tapping along to music",
      ],
      disliked_traits: ["being asked to sing", "war", "politics"],
      format_prefs: ["one choice at a time", "pauses"],
      logistics: ["Sit on his left"],
      people: [],
      places: [],
    },
    consent: {
      authority: "caregiver",
      recordedAt: "2026-10-29T00:00:00.000Z",
    },
  },
]
