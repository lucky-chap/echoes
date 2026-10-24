export type ResidentId = "mia" | "kai" | "luna"
export type DestinationId = "cafe" | "music" | "museum"
export type Situation = "sunny" | "rain" | "performance"
export type Point = readonly [number, number]
export type Taste = Record<
  "food" | "music" | "art" | "quiet" | "social" | "discovery",
  number
>
export const situationNames: Record<Situation, string> = {
  sunny: "A gentle afternoon",
  rain: "Rain begins",
  performance: "Surprise live performance",
}
export const residents = [
  {
    id: "mia" as const,
    name: "Mia",
    description: "A little curiosity, a lot of heart.",
    personality: "Warm, expressive, sociable, and mischievous",
    goal: "Find a comfortable place to connect",
    interests: ["Coffee", "Indie films"],
    culture: ["independent cinema", "acoustic folk", "neighborhood cafés"],
    color: "#b96749",
    start: [140, 144] as Point,
    end: [229, 206] as Point,
    taste: {
      food: 0.9,
      music: 0.35,
      art: 0.6,
      quiet: 0.65,
      social: 0.85,
      discovery: 0.7,
    },
  },
  {
    id: "kai" as const,
    name: "Kai",
    description: "Always finding a new rhythm.",
    personality: "Playful, outgoing, and spontaneous",
    goal: "Discover something lively with friends",
    interests: ["Live music", "Good company"],
    culture: ["hip-hop", "indie pop", "live performance"],
    color: "#507b68",
    start: [363, 141] as Point,
    end: [251, 211] as Point,
    taste: {
      food: 0.45,
      music: 1,
      art: 0.4,
      quiet: 0.2,
      social: 0.9,
      discovery: 0.8,
    },
  },
  {
    id: "luna" as const,
    name: "Luna",
    description: "Collecting small, lovely moments.",
    personality: "Dreamy, reflective, and observant",
    goal: "Find inspiration without too much bustle",
    interests: ["Art", "Quiet places"],
    culture: ["watercolor art", "jazz", "local history"],
    color: "#84749b",
    start: [347, 264] as Point,
    end: [238, 227] as Point,
    taste: {
      food: 0.3,
      music: 0.4,
      art: 1,
      quiet: 1,
      social: 0.4,
      discovery: 0.85,
    },
  },
]
export type Resident = (typeof residents)[number]
export const destinations = [
  {
    id: "cafe" as const,
    name: "The Daily Cup",
    activity: "sharing cinnamon rolls and swapping favorite films",
    outcome:
      "A shared plate, three film recommendations, and a promise to meet again.",
    traits: {
      food: 1,
      music: 0.25,
      art: 0.25,
      quiet: 0.8,
      social: 0.9,
      discovery: 0.35,
    },
    arrival: [134, 140] as Point,
  },
  {
    id: "music" as const,
    name: "The Green Room",
    activity: "listening to an intimate acoustic set",
    outcome: "A new favorite melody and three neighbors keeping time together.",
    traits: {
      food: 0.3,
      music: 1,
      art: 0.4,
      quiet: 0.2,
      social: 1,
      discovery: 0.7,
    },
    arrival: [359, 137] as Point,
  },
  {
    id: "museum" as const,
    name: "The Museum",
    activity: "sketching and exploring the local art collection",
    outcome:
      "A page of little sketches and three different ways of seeing the same painting.",
    traits: {
      food: 0.2,
      music: 0.2,
      art: 1,
      quiet: 1,
      social: 0.5,
      discovery: 1,
    },
    arrival: [375, 269] as Point,
  },
]
export function destination(id: DestinationId) {
  return destinations.find((d) => d.id === id)!
}
