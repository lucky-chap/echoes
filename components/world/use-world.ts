"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  advanceSimulation,
  beginSimulation,
  idleSimulation,
} from "@/lib/world/simulation"
import { mockTasteProvider } from "@/lib/world/taste-provider"
import { residents, destinations, type Situation } from "@/lib/world/profiles"
import {
  WorldAudio,
  defaultAudioSettings,
  type AudioSettings,
} from "@/lib/world/audio/engine"
export function useWorld() {
  const [sim, setSim] = useState(() => idleSimulation())
  const [paused, setPaused] = useState(false),
    [hidden, setHidden] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [audioNotice, setAudioNotice] = useState(""),
    [audioSettings, setAudioSettings] = useState(defaultAudioSettings)
  const audio = useRef<WorldAudio | null>(null),
    request = useRef(0),
    busy = useRef(false)
  const latest = useRef(sim)
  useEffect(() => {
    latest.current = sim
  }, [sim])
  const settings = useRef(audioSettings)
  const enableAudio = useCallback(() => {
    if (!audio.current) audio.current = new WorldAudio()
    audio.current.setSettings(settings.current)
    void audio.current
      .unlock()
      .then((ok) => {
        setAudioNotice(
          ok ? "" : "Audio unavailable or blocked; the simulation still works."
        )
      })
      .catch(() =>
        setAudioNotice("Audio unavailable; the simulation still works.")
      )
  }, [])
  function updateAudio(patch: Partial<AudioSettings>) {
    const next = { ...settings.current, ...patch }
    settings.current = next
    setAudioSettings(next)
    audio.current?.setSettings(next)
    enableAudio()
  }
  useEffect(() => {
    const lifecycle = request
    const onVisibility = () => {
      const value = document.hidden
      if (value) {
        setHidden(true)
        void audio.current?.setHidden(true)
      } else if (audio.current) {
        // Resume the audio context before resuming the active utterance.
        void audio.current
          .setHidden(false)
          .finally(() => setHidden(document.hidden))
      } else setHidden(false)
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      lifecycle.current++
      busy.current = false
      audio.current?.dispose()
      audio.current = null
    }
  }, [])
  useEffect(() => {
    if (
      paused ||
      hidden ||
      loading ||
      sim.phase === "idle" ||
      sim.phase === "finished"
    )
      return
    let previous = performance.now()
    const timer = setInterval(() => {
      const now = performance.now(),
        delta = Math.min(0.2, (now - previous) / 1000)
      previous = now
      setSim((s) => advanceSimulation(s, delta))
    }, 50)
    return () => clearInterval(timer)
  }, [paused, hidden, loading, sim.phase])
  const speechId = sim.speech?.id
  useEffect(() => {
    const engine = audio.current,
      s = latest.current
    if (!engine) return
    if (
      !paused &&
      !hidden &&
      !loading &&
      s.speech &&
      audioSettings.effectsEnabled
    ) {
      const remaining = s.speech.time + s.speech.duration - s.total
      engine.speak(s.speech.speaker, s.speech.text, remaining)
    } else engine.stopSpeech()
    return () => engine.stopSpeech()
  }, [
    speechId,
    paused,
    hidden,
    loading,
    audioSettings.effectsEnabled,
    audioSettings.effectsVolume,
  ])
  useEffect(() => {
    if (sim.phase === "deciding") audio.current?.cue("decision")
  }, [sim.phase, sim.round])
  async function run(situation: Situation, replay = false) {
    if (busy.current) return
    busy.current = true
    const token = ++request.current
    setLoading(true)
    setError("")
    audio.current?.stopSpeech()
    enableAudio()
    try {
      const previous = replay ? idleSimulation(situation) : latest.current
      const recommendations = await mockTasteProvider.recommend({
        profiles: residents,
        destinations: destinations,
        situation,
      })
      if (token !== request.current) return
      setSim(beginSimulation(previous, situation, recommendations))
      setPaused(false)
    } catch {
      if (token === request.current)
        setError("Could not evaluate the destinations. Please try again.")
    } finally {
      if (token === request.current) {
        busy.current = false
        setLoading(false)
      }
    }
  }
  function start() {
    if (latest.current.phase !== "idle" && latest.current.phase !== "finished")
      return
    void run(latest.current.situation, true)
  }
  function changeSituation(situation: Situation) {
    if (busy.current || situation === latest.current.situation) return
    audio.current?.cue("select")
    if (latest.current.phase === "idle") setSim(idleSimulation(situation))
    else void run(situation)
  }
  function reset() {
    request.current++
    busy.current = false
    audio.current?.stopSpeech()
    setLoading(false)
    setPaused(false)
    setError("")
    setSim(idleSimulation(latest.current.situation))
  }
  return {
    sim,
    paused,
    hidden,
    loading,
    error,
    audioNotice,
    audioSettings,
    updateAudio,
    start,
    changeSituation,
    reset,
    togglePause: () => {
      audio.current?.stopSpeech()
      setPaused((p) => !p)
    },
    interaction: () => audio.current?.cue("select"),
  }
}
