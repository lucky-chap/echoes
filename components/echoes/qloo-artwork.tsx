"use client"

import { useState } from "react"
import type { KitItem } from "@/lib/echoes/types"

export default function QlooArtwork({ item }: { item: KitItem }) {
  const [failedUrl, setFailedUrl] = useState<string>()
  if (!item.imageUrl || failedUrl === item.imageUrl) return null
  return (
    // Qloo supplies dynamic hosts; load validated HTTPS artwork directly.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="qloo-artwork"
      src={item.imageUrl}
      alt={`Artwork for ${item.name}`}
      referrerPolicy="no-referrer"
      onError={() => setFailedUrl(item.imageUrl)}
    />
  )
}
