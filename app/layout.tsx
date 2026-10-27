import type { Metadata } from "next"
import "./globals.css"
export const metadata: Metadata = {
  title: "Echoes — familiar moments, thoughtfully prepared",
  description: "A Qloo-powered reminiscence-session kit generator for activity support.",
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
