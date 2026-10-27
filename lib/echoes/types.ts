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
}

export interface FeedbackRecord {
  residentId: string
  entityId: string
  status: "sparked" | "neutral" | "distressed"
}

export interface AgentTrace {
  id: string
  createdAt: string
  tool: "qloo_search" | "qloo_insights" | "qloo_score" | "era_verify" | "safety_filter" | "group_optimizer" | "memory_read" | "memory_write" | "note_writer"
  summary: string
}

export interface KitItem {
  entityId: string
  name: string
  kind: EchoesKind
  type: EchoesEntityType
  whyItFits: string[]
  matchedResidentIds: string[]
  affinity: number | null
  yearEvidence: {
    year: number
    source: "MusicBrainz" | "TMDB"
    residentIds: string[]
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
  coverage: { percent: number; servedResidentIds: string[]; underservedNames: string[] }
  notes: string[]
  agentTrace: AgentTrace[]
}

export interface SessionRecord {
  id: string
  createdAt: string
  kit: SessionKit
  feedback: FeedbackRecord[]
  engagement: 1 | 2 | 3 | null
  noteDraft: string | null
}

export interface EchoesWorkspace {
  version: 1
  secret: string
  mode: "team" | "family"
  residents: ResidentInput[]
  feedback: FeedbackRecord[]
  sessions: SessionRecord[]
  traces: AgentTrace[]
}
