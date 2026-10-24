"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  advanceLiving as advanceSimulation,
  beginLiving,
  idleLiving as idleSimulation,
} from "@/lib/world/living/engine"
import { MockLLMProvider, mockSignals } from "@/lib/world/living/mock"
import { planScene } from "@/lib/world/living/planner"
import type { SceneBundle } from "@/lib/world/living/types"
import { type Situation } from "@/lib/world/profiles"
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
  const [speed, setSpeed] = useState(1)
  const [checkpoint, setCheckpoint] = useState(0)
  const sessionReady = useRef(false)
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
      setSim((s) => advanceSimulation(s, delta * speed))
    }, 50)
    return () => clearInterval(timer)
  }, [paused, hidden, loading, sim.phase, speed])
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
      engine.speak(s.speech.speaker, s.speech.text, remaining / speed)
    } else engine.stopSpeech()
    return () => engine.stopSpeech()
  }, [
    speechId,
    speed,
    paused,
    hidden,
    loading,
    audioSettings.effectsEnabled,
    audioSettings.effectsVolume,
  ])
  useEffect(() => {
    if (sim.phase === "deciding") audio.current?.cue("decision")
  }, [sim.phase, sim.round])
  const run = useCallback(
    async (freshSession = false) => {
      if (busy.current) return
      busy.current = true
      const token = ++request.current
      setLoading(true)
      setError("")
      audio.current?.stopSpeech()
      enableAudio()
      const world = latest.current.world
      try {
        if (freshSession || !sessionReady.current) {
          const response = await fetch("/api/world/session", {
            method: "POST",
            signal: AbortSignal.timeout(10000),
          })
          if (!response.ok)
            throw Error((await response.json()).error || "Session unavailable")
          sessionReady.current = true
        }
        const response = await fetch("/api/world/scene", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(world),
          signal: AbortSignal.timeout(45000),
        })
        if (!response.ok)
          throw Error((await response.json()).error || "Scene unavailable")
        const bundle: SceneBundle = await response.json()
        if (token === request.current)
          setSim(beginLiving(latest.current, bundle))
      } catch (e) {
        const plan = planScene(world, mockSignals)
        const scene = await new MockLLMProvider().generateScene({
          world,
          plan,
          signals: mockSignals,
        })
        if (token === request.current) {
          const reason =
            e instanceof Error ? e.message : "Connection unavailable"
          setError(reason)
          setSim(
            beginLiving(latest.current, {
              scene,
              plan,
              diagnostics: {
                llm: "Groq Mock",
                model: "openai/gpt-oss-120b",
                taste: "Qloo Mock",
                reason,
                tasteReason: "Offline interests",
                calls: 0,
                limit: 10,
                signals: mockSignals,
              },
            })
          )
        }
      } finally {
        if (token === request.current) {
          busy.current = false
          setLoading(false)
        }
      }
    },
    [enableAudio]
  )
  useEffect(() => {
    if (
      sim.phase !== "finished" ||
      paused ||
      hidden ||
      loading ||
      sim.world.completed >= checkpoint
    )
      return
    const timer = setTimeout(() => void run(), 1500)
    return () => clearTimeout(timer)
  }, [sim.phase, sim.world.completed, paused, hidden, loading, checkpoint, run])
  function start() {
    if (!["idle", "finished"].includes(latest.current.phase)) return
    setCheckpoint(latest.current.world.completed + 3)
    setPaused(false)
    void run(true)
  }
  function nextEvent() {
    if (!["idle", "finished"].includes(latest.current.phase) || busy.current)
      return
    setCheckpoint(latest.current.world.completed + 1)
    setPaused(false)
    void run(
      !sessionReady.current || latest.current.world.completed >= checkpoint
    )
  }
  function changeSituation(situation: Situation) {
    if (busy.current || !["idle", "finished"].includes(latest.current.phase))
      return
    setSim((s) => ({ ...s, situation, world: { ...s.world, situation } }))
  }
  function reset() {
    request.current++
    setCheckpoint(0)
    busy.current = false
    audio.current?.stopSpeech()
    setLoading(false)
    setPaused(false)
    setError("")
    setSim(idleSimulation(latest.current.situation))
  }
  return {
    sim,
    speed,
    setSpeed,
    nextEvent,
    checkpoint,
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
