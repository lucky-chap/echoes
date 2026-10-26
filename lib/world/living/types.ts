import type {
  DestinationId,
  Point,
  ResidentId,
  Situation,
  Taste,
} from "../profiles"
export const actions = [
  "talk",
  "laugh",
  "shrug",
  "wave",
  "point",
  "walk_to",
  "sit",
  "observe",
  "sketch",
  "dance",
  "react",
] as const
export type Action = (typeof actions)[number]
export const emotions = [
  "content",
  "curious",
  "excited",
  "thoughtful",
  "tired",
  "annoyed",
  "embarrassed",
  "amused",
] as const
export type Emotion = (typeof emotions)[number]
export interface Memory {
  id: string
  kind: "activity" | "conversation" | "discovery" | "promise" | "incident"
  text: string
  day: number
  scene: number
  location: DestinationId | null
  positive: boolean
}
export interface Agent {
  id: ResidentId
  mood: Emotion
  energy: number
  hunger: number
  social: number
  goal: string
  currentActivity: string
  location: DestinationId | "square" | "path"
  recentVisits: DestinationId[]
  memories: Memory[]
  important: Memory[]
  memorySummary: string
  relationships: Record<ResidentId, number>
  learned: Partial<Taste>
}
export const culturalCategories = [
  "artist",
  "movie",
  "book",
  "place",
  "tv_show",
  "podcast",
] as const
export type CulturalCategory = (typeof culturalCategories)[number]
export type QlooEntityType = `urn:entity:${CulturalCategory}`
export interface VerifiedInterest {
  entityId: string
  name: string
  type: QlooEntityType
  initial: boolean
  weight: number
  verifiedAt: string
}
export interface PreferenceChange {
  entityId: string
  delta: number
  reason: string
  day: number
  scene: number
}
export interface TasteProfile {
  residentId: ResidentId
  configuredInterests: { name: string; type: QlooEntityType; weight: number }[]
  verifiedInterests: VerifiedInterest[]
  preferenceChanges: PreferenceChange[]
  lastUpdated: string | null
}
export type DiscoveryStatus =
  | "discovered"
  | "considered"
  | "experienced"
  | "liked"
  | "disliked"
  | "dismissed"
export interface QlooProvenance {
  provider: "Qloo"
  endpoint: "/v2/insights"
  requestedAt: string
  requestCategory: QlooEntityType
  signalEntityIds: string[]
  excludedEntityIds: string[]
  delivery: "live" | "cache"
}
export interface Discovery {
  entityId: string
  name: string
  type: QlooEntityType
  description: string | null
  residentId: ResidentId
  discoveredAt: string
  day: number
  scene: number
  status: DiscoveryStatus
  affinity: number | null
  properties: Record<string, unknown>
  explainability: Record<string, unknown> | null
  provenance: QlooProvenance
  reaction: string | null
}
export interface SocialMemory {
  id: string
  participants: ResidentId[]
  sceneId: string
  location: DestinationId | "square"
  summary: string
  day: number
  hour: number
  referencedEntityIds: string[]
  confirmedOutcome: string
}
export type InvitationResponse = "pending" | "accepted" | "declined"
export interface Gathering {
  id: string
  organizer: ResidentId
  invited: ResidentId[]
  responses: Partial<Record<ResidentId, InvitationResponse>>
  location: "square"
  scheduledDay: number
  scheduledHour: number
  reason: string
  entityId: string | null
  status: "planned" | "traveling" | "active" | "completed" | "cancelled"
  timeoutHour: number
}
export const encounterModes = ["auto", "pair", "trio", "join", "solo"] as const
export type EncounterMode = (typeof encounterModes)[number]
export interface RecentScene {
  sceneId: string
  topic: string
  lines: { speaker: ResidentId; text: string }[]
}
export interface Snapshot {
  recentScenes?: RecentScene[]
  encounter?: EncounterMode
  version: 1
  seed: number
  completed: number
  day: number
  hour: number
  situation: Situation
  agents: Agent[]
  positions: Point[]
  recentDialogue: { speaker: ResidentId; text: string }[]
  events: string[]
  incidents: string[]
  lastParticipants: ResidentId[]
  tasteProfiles: TasteProfile[]
  discoveries: Discovery[]
  socialMemories: SocialMemory[]
  gatherings: Gathering[]
}
export interface CulturalSignal {
  residentId: ResidentId
  name: string
  category: CulturalCategory
  entityId: string
  affinity: number | null
  description: string | null
  properties: Record<string, unknown>
  explainability: Record<string, unknown> | null
  source: "LIVE Qloo" | "CACHED Qloo"
  provenance: QlooProvenance
}
export interface CulturalDecision {
  residentId: ResidentId
  entityId: string
  entityName: string
  category: CulturalCategory
  action: "listen" | "read" | "watch" | "dining_inspiration" | "save"
  destinationId: DestinationId | null
  tasteSignalEntityIds: string[]
  rationale: string
  completed: boolean
  preferenceChanged: boolean
}
export interface Score {
  residentId: ResidentId
  destinationId: DestinationId
  total: number
  factors: Record<
    | "culture"
    | "mood"
    | "energy"
    | "goal"
    | "social"
    | "relationships"
    | "experience"
    | "recency"
    | "novelty"
    | "event"
    | "variation",
    number
  >
}
export interface Incident {
  id: string
  actor: ResidentId
  description: string
  emotion: Emotion
  destination: DestinationId | null
}
export interface Plan {
  initialParticipants: ResidentId[]
  arrival: { residentId: ResidentId; beforeBeat: number } | null
  topic: string
  number: number
  participants: ResidentId[]
  destinations: Record<ResidentId, DestinationId>
  scores: Score[]
  incident: Incident | null
  summary: string
  sceneType:
    | "casual_encounter"
    | "group_hangout"
    | "disagreement"
    | "discovery"
    | "unexpected_event"
    | "personal_moment"
  gathering: Gathering | null
  culturalDecision: CulturalDecision | null
}
export interface Beat {
  replyTo: number | null
  references: string[]
  speaker: ResidentId
  dialogue: string
  emotion: Emotion
  action: Action
  targetLocation: DestinationId | null
}
export interface Scene {
  ending: "closure" | "interruption" | "transition"
  sceneId: string
  participants: ResidentId[]
  sceneType:
    | "casual_encounter"
    | "group_hangout"
    | "disagreement"
    | "discovery"
    | "unexpected_event"
    | "personal_moment"
  summary: string
  beats: Beat[]
  suggestedMemoryUpdates: {
    residentId: ResidentId
    beatIndex: number
    kind: "conversation" | "promise" | "discovery"
  }[]
  suggestedRelationshipChanges: {
    from: ResidentId
    to: ResidentId
    beatIndex: number
    delta: number
  }[]
}
export interface SceneDiagnostics {
  llm: "Groq Live" | "Fallback" | "Waiting"
  requestStatus: "success" | "failed" | "skipped" | "waiting"
  attempts: number
  repetition: string
  model: string
  taste: "Qloo Live" | "Qloo Cache" | "Qloo Unavailable" | "Qloo Error"
  reason: string | null
  tasteReason: string | null
  calls: number
  limit: number
  signals: CulturalSignal[]
  qloo: {
    configured: boolean | null
    baseUrl: "https://hackathon.api.qloo.com"
    lastSuccessfulCall: string | null
    requestCategories: string[]
    cacheStatus: "hit" | "miss" | "mixed" | "none"
    lastError: string | null
    recommendations: number
    liveRequests: number
    cachedRequests: number
  }
  inputTokens?: number
  outputTokens?: number
  retryAt?: number | null
}
export interface SceneBundle {
  scene: Scene
  plan: Plan
  diagnostics: SceneDiagnostics
  tasteProfiles?: TasteProfile[]
}
