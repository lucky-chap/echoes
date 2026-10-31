"use client"

import { useRef, useState, type ReactNode } from "react"

const tabs = ["overview", "tips", "qloo"] as const
type Tab = (typeof tabs)[number]

const labels: Record<Tab, string> = {
  overview: "Overview",
  tips: "Tips",
  qloo: "What Qloo added",
}

export default function KitTabs({
  overview,
  tips,
  qloo,
}: {
  overview: ReactNode
  tips: ReactNode
  qloo: ReactNode
}) {
  const [active, setActive] = useState<Tab>("overview")
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  return (
    <div className="kit-tabs">
      <div className="kit-tab-list" role="tablist" aria-label="Session kit">
        {tabs.map((tab, index) => (
          <button
            key={tab}
            ref={(element) => {
              tabRefs.current[index] = element
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
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? tabs.length - 1
                    : (index +
                        (event.key === "ArrowRight" ? 1 : -1) +
                        tabs.length) %
                      tabs.length
              setActive(tabs[next])
              tabRefs.current[next]?.focus()
            }}
          >
            {labels[tab]}
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
      <div
        id="kit-panel-qloo"
        role="tabpanel"
        aria-labelledby="kit-tab-qloo"
        tabIndex={0}
        hidden={active !== "qloo"}
      >
        {qloo}
      </div>
    </div>
  )
}
