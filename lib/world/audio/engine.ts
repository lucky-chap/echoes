import type { ResidentId } from "../profiles"
import { voices } from "./voices"
export interface AudioSettings {
  musicEnabled: boolean
  musicVolume: number
  effectsEnabled: boolean
  effectsVolume: number
}
export const defaultAudioSettings: AudioSettings = {
  musicEnabled: true,
  musicVolume: 0.22,
  effectsEnabled: true,
  effectsVolume: 0.32,
}
type Tone = { osc: OscillatorNode; gain: GainNode; bus: "music" | "effects" }
// Original eight-bar phrase, in C major / A minor. One scheduled beat per entry.
const melody = [
  64,
  67,
  69,
  67,
  64,
  null,
  62,
  60,
  64,
  69,
  72,
  71,
  69,
  null,
  67,
  64,
  65,
  69,
  67,
  65,
  64,
  62,
  60,
  null,
  62,
  67,
  69,
  67,
  62,
  59,
  60,
  null,
]
const chords = [
  [48, 52, 55],
  [45, 48, 52],
  [41, 45, 48],
  [43, 47, 50],
]
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12)
export class WorldAudio {
  private context: AudioContext | null = null
  private music: GainNode | null = null
  private effects: GainNode | null = null
  private compressor: DynamicsCompressorNode | null = null
  private settings: AudioSettings = { ...defaultAudioSettings }
  private scheduler: ReturnType<typeof setInterval> | null = null
  private chatter: ReturnType<typeof setInterval> | null = null
  private tones = new Set<Tone>()
  private nextBeat = 0
  private beat = 0
  private hidden = false
  private disposed = false
  get ready() {
    return this.context?.state === "running"
  }
  setSettings(settings: AudioSettings) {
    this.settings = { ...settings }
    this.applyGains()
    if (!settings.effectsEnabled || settings.effectsVolume === 0)
      this.stopSpeech()
  }
  private applyGains() {
    const ctx = this.context
    if (!ctx) return
    this.music?.gain.setTargetAtTime(
      this.settings.musicEnabled ? this.settings.musicVolume : 0,
      ctx.currentTime,
      0.03
    )
    this.effects?.gain.setTargetAtTime(
      this.settings.effectsEnabled ? this.settings.effectsVolume : 0,
      ctx.currentTime,
      0.02
    )
  }
  /** Called only from click/input handlers. No AudioContext is created at mount. */
  async unlock() {
    if (this.disposed) return false
    try {
      if (!this.context) {
        this.context = new AudioContext()
        const c = this.context
        this.music = c.createGain()
        this.effects = c.createGain()
        this.compressor = c.createDynamicsCompressor()
        this.compressor.threshold.value = -16
        this.compressor.ratio.value = 3
        this.music.connect(this.compressor)
        this.effects.connect(this.compressor)
        this.compressor.connect(c.destination)
        this.music.gain.value = 0
        this.effects.gain.value = 0
        this.applyGains()
        this.nextBeat = c.currentTime + 0.08
      }
      if (this.hidden) return false
      await this.context.resume()
      if (this.disposed) return false
      if (this.hidden) {
        await this.context.suspend()
        return false
      }
      if (!this.scheduler)
        this.scheduler = setInterval(() => this.schedule(), 25)
      return this.ready
    } catch {
      return false
    }
  }
  private tone(
    frequency: number,
    when: number,
    duration: number,
    wave: OscillatorType,
    volume: number,
    bus: "music" | "effects"
  ) {
    const c = this.context,
      target = bus === "music" ? this.music : this.effects
    if (!c || !target || this.disposed) return
    const osc = c.createOscillator(),
      gain = c.createGain()
    osc.type = wave
    osc.frequency.setValueAtTime(frequency, when)
    gain.gain.setValueAtTime(0, when)
    gain.gain.linearRampToValueAtTime(
      volume,
      when + Math.min(0.012, duration / 4)
    )
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration)
    osc.connect(gain)
    gain.connect(target)
    const tone = { osc, gain, bus }
    this.tones.add(tone)
    osc.onended = () => {
      osc.disconnect()
      gain.disconnect()
      this.tones.delete(tone)
    }
    osc.start(when)
    osc.stop(when + duration + 0.01)
  }
  private schedule() {
    const c = this.context
    if (!c || c.state !== "running" || this.hidden) return
    const beatLength = 60 / 76
    if (this.nextBeat < c.currentTime - 0.3)
      this.nextBeat = c.currentTime + 0.04
    while (this.nextBeat < c.currentTime + 0.16) {
      const index = this.beat % melody.length,
        bar = Math.floor(index / 8),
        note = melody[index]
      if (this.settings.musicEnabled && this.settings.musicVolume > 0) {
        if (note !== null)
          this.tone(
            hz(note),
            this.nextBeat,
            beatLength * 0.85,
            "triangle",
            0.1,
            "music"
          )
        if (index % 4 === 0) {
          for (const n of chords[bar])
            this.tone(
              hz(n),
              this.nextBeat,
              beatLength * 3.8,
              "sine",
              0.035,
              "music"
            )
        }
        if (index % 2 === 0)
          this.tone(
            hz(chords[bar][index % 3] + 12),
            this.nextBeat + beatLength * 0.5,
            beatLength * 0.7,
            "sine",
            0.045,
            "music"
          )
      }
      // A quiet bird every other phrase, never a continuous ambient loop.
      if (
        this.beat > 0 &&
        this.beat % 64 === 0 &&
        this.settings.effectsEnabled
      ) {
        this.tone(1050, this.nextBeat, 0.08, "sine", 0.018, "effects")
        this.tone(1230, this.nextBeat + 0.14, 0.09, "sine", 0.014, "effects")
      }
      this.beat++
      this.nextBeat += beatLength
    }
  }
  speak(speaker: ResidentId, text: string, remainingSeconds: number) {
    this.stopSpeech()
    if (
      !this.ready ||
      this.hidden ||
      !this.settings.effectsEnabled ||
      this.settings.effectsVolume === 0
    )
      return
    const voice = voices[speaker]
    let index = 0
    const maxChirps = Math.min(
      Math.ceil(text.length / 7),
      Math.ceil((remainingSeconds * 1000) / voice.cadence)
    )
    const chirp = () => {
      if (!this.ready || this.hidden || index >= maxChirps) {
        if (this.chatter) clearInterval(this.chatter)
        this.chatter = null
        return
      }
      const c = this.context!,
        interval = voice.intervals[index % voice.intervals.length],
        variation = ((text.charCodeAt(index % text.length) % 5) - 2) * 0.003
      const frequency = voice.base * 2 ** (interval / 12) * (1 + variation)
      this.tone(
        frequency,
        c.currentTime + 0.005,
        voice.duration,
        voice.waveform,
        voice.gain,
        "effects"
      )
      if (voice.harmonic)
        this.tone(
          frequency * voice.harmonic,
          c.currentTime + 0.005,
          voice.duration * 0.75,
          "sine",
          voice.gain * 0.14,
          "effects"
        )
      index++
    }
    chirp()
    this.chatter = setInterval(chirp, voice.cadence)
  }
  stopSpeech() {
    if (this.chatter) clearInterval(this.chatter)
    this.chatter = null
    const c = this.context
    if (!c) return
    for (const tone of this.tones)
      if (tone.bus === "effects") {
        tone.gain.gain.cancelScheduledValues(c.currentTime)
        tone.gain.gain.setTargetAtTime(0.0001, c.currentTime, 0.006)
        try {
          tone.osc.stop(c.currentTime + 0.03)
        } catch {}
      }
  }
  cue(kind: "decision" | "select") {
    if (!this.ready || this.hidden || !this.settings.effectsEnabled) return
    const now = this.context!.currentTime
    ;(kind === "decision" ? [60, 64, 67] : [64]).forEach((n, i) =>
      this.tone(hz(n), now + i * 0.12, 0.1, "sine", 0.055, "effects")
    )
  }
  async setHidden(hidden: boolean) {
    this.hidden = hidden
    if (hidden) {
      this.stopSpeech()
      if (this.context?.state === "running")
        await this.context.suspend().catch(() => {})
    } else if (this.context && !this.disposed) {
      await this.unlock()
    }
  }
  dispose() {
    this.disposed = true
    if (this.scheduler) clearInterval(this.scheduler)
    this.scheduler = null
    this.stopSpeech()
    for (const t of this.tones) {
      t.osc.onended = null
      try {
        t.osc.stop()
      } catch {}
      t.osc.disconnect()
      t.gain.disconnect()
    }
    this.tones.clear()
    this.music?.disconnect()
    this.effects?.disconnect()
    this.compressor?.disconnect()
    void this.context?.close().catch(() => {})
    this.context = null
  }
}
