import type { ResidentId } from "../profiles"
export interface Voice {
  waveform: OscillatorType
  base: number
  intervals: number[]
  cadence: number
  duration: number
  gain: number
  harmonic?: number
}
export const voices: Record<ResidentId, Voice> = {
  mia: {
    waveform: "sine",
    base: 470,
    intervals: [0, 2, 4, 2, 0, 7],
    cadence: 210,
    duration: 0.085,
    gain: 0.1,
  },
  kai: {
    waveform: "triangle",
    base: 270,
    intervals: [0, 7, 3, 10, 5, 0],
    cadence: 145,
    duration: 0.065,
    gain: 0.085,
  },
  luna: {
    waveform: "sine",
    base: 590,
    intervals: [0, 2, 7, 4, 2, 0],
    cadence: 275,
    duration: 0.095,
    gain: 0.065,
    harmonic: 2,
  },
}
