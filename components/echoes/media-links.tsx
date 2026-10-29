"use client"

import { ArrowUpRight, Play } from "lucide-react"
import MediaBrandIcon from "./media-brand-icon"
import { primaryMedia } from "@/lib/echoes/media"
import type { KitItem } from "@/lib/echoes/types"

export default function MediaLinks({ item }: { item: KitItem }) {
  const primary = primaryMedia(item)
  if (!primary)
    return <p>Conversation topic · Talk about the title or cover.</p>
  const links = [primary]
  return (
    <div className="media-links">
      {links.map((link) => {
        const host = new URL(link.url).hostname
        const spotify = host === "open.spotify.com"
        const youtube = host === "www.youtube.com"
        const provider = spotify ? "Spotify" : youtube ? "YouTube" : link.label
        return (
          <a
            key={link.url}
            className={`media-link ${spotify ? "media-spotify" : youtube ? "media-youtube" : ""}`}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            title={link.instructions}
          >
            <span className="media-provider-icon">
              {spotify || youtube ? (
                <MediaBrandIcon provider={spotify ? "spotify" : "youtube"} />
              ) : (
                <Play size={23} aria-hidden="true" />
              )}
            </span>
            <span>
              <strong>
                {link.status === "search" ? "Find this" : `Open ${provider}`}
              </strong>
              <small>
                {link.status === "search"
                  ? "Choose a version to preview"
                  : "Preview this recording"}
              </small>
            </span>
            <ArrowUpRight size={18} aria-hidden="true" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        )
      })}
    </div>
  )
}
