import type { Metadata } from "next"
import "./globals.css"
export const metadata: Metadata = {
  title: "Worldlings — Welcome to Littlehaven",
  description:
    "A cozy pixel-art town. Three neighbors, small moments, and a world of possibilities. An original local simulation demo.",
}
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
