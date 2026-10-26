import {
  residents,
  type Point,
  type ResidentId,
  type Situation,
} from "../profiles"
import type { Route } from "../movement"

export const phases = [
  "idle",
  "gathering",
  "waiting",
  "proposing",
  "deliberating",
  "deciding",
  "traveling",
  "completing",
  "finished",
] as const
export type Phase = (typeof phases)[number]
export const phaseNames: Record<Phase, string> = {
  idle: "Ready for a little adventure",
  gathering: "Gathering in the square",
  waiting: "Waiting for conversation",
  proposing: "Sharing our ideas",
  deliberating: "Considering the moment",
  deciding: "Choosing what comes next",
  traveling: "On our way",
  completing: "Making a memory",
  finished: "An afternoon well spent",
}
export interface Speech {
  speaker: ResidentId
  text: string
  id: string
  time: number
  duration: number
}
export interface LogEntry {
  id: string
  time: number
  text: string
}
export interface Simulation {
  phase: Phase
  time: number
  total: number
  round: number
  situation: Situation
  positions: Point[]
  routes: Route[]
  duration: number
  speech: Speech | null
  history: Speech[]
  logs: LogEntry[]
}
export function idleSimulation(situation: Situation = "sunny"): Simulation {
  return {
    phase: "idle",
    time: 0,
    total: 0,
    round: 0,
    situation,
    positions: residents.map((resident) => resident.start),
    routes: [],
    duration: 0,
    speech: null,
    history: [],
    logs: [],
  }
}
