"use client"

import { useRef, useState, type ReactNode } from "react"

export default function KitTabs({
  overview,
  tips,
}: {
  overview: ReactNode
  tips: ReactNode
}) {
  const [active, setActive] = useState<"overview" | "tips">("overview")
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  return (
    <div className="kit-tabs">
      <div className="kit-tab-list" role="tablist" aria-label="Session kit">
        {(["overview", "tips"] as const).map((tab, index) => (
          <button
            key={tab}
            ref={(element) => {
              tabs.current[index] = element
            }}
            type="button"
            role="tab"
            id={`kit-tab-${tab}`}
            aria-controls={`kit-panel-${tab}`}
            aria-selected={active === tab}
            tabIndex={active === tab ? 0 : -1}
            onClick={() => setActive(tab)}
            onKeyDown={(event) => {
              if (
                !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              )
                return
              event.preventDefault()
              const next =
                event.key === "Home" ? 0 : event.key === "End" ? 1 : 1 - index
              setActive(next === 0 ? "overview" : "tips")
              tabs.current[next]?.focus()
            }}
          >
            {tab === "overview" ? "Overview" : "Tips"}
          </button>
        ))}
      </div>
      <div
        id="kit-panel-overview"
        role="tabpanel"
        aria-labelledby="kit-tab-overview"
        tabIndex={0}
        hidden={active !== "overview"}
      >
        {overview}
      </div>
      <div
        id="kit-panel-tips"
        role="tabpanel"
        aria-labelledby="kit-tab-tips"
        tabIndex={0}
        hidden={active !== "tips"}
      >
        {tips}
      </div>
    </div>
  )
}
