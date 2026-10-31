export type EchoesEntityType =
  | "urn:entity:artist"
  | "urn:entity:movie"
  | "urn:entity:tv_show"
  | "urn:entity:book"
  | "urn:entity:place"

export type EchoesKind = "music" | "film" | "television" | "book" | "place"

export interface EchoesEntity {
  entityId: string
  name: string
  type: EchoesEntityType
  description: string | null
  affinity: number | null
  properties: Record<string, unknown>
  /** Optional artwork returned by Qloo. It is decorative and never used as evidence. */
  imageUrl?: string
}

export interface PersonPreferences {
  liked_traits: string[]
  disliked_traits: string[]
  format_prefs: string[]
  logistics: string[]
  people: string[]
  places: string[]
  confirmed: boolean
  sourceNotes: string
}
export interface ResponseHistory {
  item: string
  domain: EchoesKind
  traits: string[]
  response: "sparked" | "not_for_us"
  note: string
  session: string
  entityId?: string
}
export interface ResidentInput {
  id: string
  nickname: string
  birthYear: number
  hometown: string
  country: string
  language: string
  lovedThings: string[]
  sensitivities: string[]
  resolvedFavorites?: {
    query: string
    entityId: string
    type: EchoesEntityType
    name: string
  }[]
  notes?: string
  preferences?: PersonPreferences
  responseHistory?: ResponseHistory[]
  importantMemories?: string
  consent?: { authority: "caregiver" | "family"; recordedAt: string }
}

export interface FeedbackRecord {
  residentId: string
  entityId: string
  status: "sparked" | "neutral" | "distressed" | "not_for_us"
  recordedAt?: string
  sessionId?: string
}

export interface AgentTrace {
  id: string
  createdAt: string
  tool:
    | "qloo_search"
    | "qloo_insights"
    | "qloo_score"
    | "era_verify"
    | "safety_filter"
    | "group_optimizer"
    | "memory_read"
    | "memory_write"
    | "note_writer"
    | "context_research"
    | "plan_session"
    | "media_lookup"
    | "replan"
  summary: string
  role?:
    | "Cultural Researcher"
    | "Qloo Taste Explorer"
    | "Session Planner"
    | "Response Adapter"
  outcome?: "ok" | "empty" | "unavailable" | "replanned" | "excluded"
  input?: Record<string, unknown>
  output?: Record<string, unknown>
}

export interface KitItem {
  traits?: string[]
  seed?: {
    entityId: string
    name: string
    evidence: "sparked" | "named" | "inferred"
  }
  namedFavorite?: boolean
  eraLabel?: string
  prompt?: string
  score?: number
  replacementIds?: string[]
  cautions?: {
    topic: string
    sourceField: string
    matchedTerm?: string
    source?: "caregiver" | "conservative_default"
  }[]
  entityId: string
  name: string
  kind: EchoesKind
  type: EchoesEntityType
  whyItFits: string[]
  matchedResidentIds: string[]
  affinity: number | null
  yearEvidence: {
    year: number
    source: "MusicBrainz" | "TMDB" | "Qloo"
    residentIds: string[]
    title?: string
    url?: string
    cached?: boolean
    fetchedAt?: string
    workType?: "track" | "album" | "series"
    firstAirYear?: number
    lastAirYear?: number
    ongoing?: boolean
    artistLevel?: boolean
    releaseCount?: number
  }
  media?: {
    label: string
    url: string
    status: "provider-checked" | "search"
    checkedAt?: string
    instructions: string
  }[]
  /** Decorative Qloo artwork, when Qloo supplied a safe HTTPS URL. */
  imageUrl?: string
}

export type DateStatus =
  | "verified_in_window"
  | "verified_out_of_window"
  | "unchecked_unavailable"
  | "unknown_date"
export interface DateCheck {
  seed?: KitItem["seed"]
  traits?: string[]
  entity: EchoesEntity
  status: DateStatus
  reason: string
  favorite: boolean
  checkedAt: string
  cached?: boolean
  blocked?: {
    topic: string
    source: "caregiver" | "conservative_default" | "feedback"
    sourceField?: string
  }
}
export interface SessionKit {
  id: string
  createdAt: string
  residents: Pick<ResidentInput, "id" | "nickname" | "language" | "hometown">[]
  era: { from: number; to: number }
  items: KitItem[]
  prompts: string[]
  aboutMe: { title: string; details: string[]; opening: string }
  coverage: {
    percent: number
    servedResidentIds: string[]
    underservedNames: string[]
    level?: "strong" | "partial" | "thin"
    domainCount?: number
  }
  notes: string[]
  agentTrace: AgentTrace[]
  dateChecks?: DateCheck[]
  resolutionChoices?: { query: string; candidates: EchoesEntity[] }[]
  activities?: Activity[]
  alternatives?: KitItem[]
  logistics?: string[]
  research?: { context: string; source: string; url?: string }[]
  diagnostics?: {
    resolved: number
    requested: number
    candidates: number
    verified: number
    unavailable: number
    toolCalls: number
  }
  /** Set when the caregiver chose to plan without reviewing the prior session. */
  plannedWithoutReview?: {
    sessionId: string
    sessionNumber: number
  }
}

export interface SessionRecord {
  id: string
  createdAt: string
  kit: SessionKit
  feedback: FeedbackRecord[]
  engagement: 1 | 2 | 3 | null
  noteDraft: string | null
  wrapUp?: WrapUp
  progress?: SessionProgress
}

export interface SessionProgress {
  /** The current activity, so a caregiver can resume where they paused. */
  activityId: string
  updatedAt: string
}

export interface EchoesWorkspace {
  version: 1
  secret: string
  mode: "team" | "family"
  residents: ResidentInput[]
  feedback: FeedbackRecord[]
  sessions: SessionRecord[]
  traces: AgentTrace[]
  memories?: MemoryRecord[]
}

export interface Activity {
  id: string
  kind: "welcome" | "media" | "conversation" | "closing"
  title: string
  minutes: number
  prompt: string
  rationale: string
  itemId?: string
  approved: boolean
}

export interface Observation {
  activityId: string
  entityId?: string
  status:
    | "engaged"
    | "no_response"
    | "distress"
    | "shared_story"
    | "not_used"
    | "not_for_us"
  story?: string
}

export interface WrapUp {
  recordedAt: string
  observations: Observation[]
  engagement: 1 | 2 | 3 | null
  caregiverNote: string
}

export interface MemoryRecord {
  id: string
  residentId: string
  kind: "biography" | "preference" | "observation" | "discovery"
  status: "confirmed" | "reported" | "suggested"
  text: string
  source: "caregiver" | "family" | "Qloo"
  createdAt: string
  sessionId?: string
  entityId?: string
  response?: Observation["status"]
}
