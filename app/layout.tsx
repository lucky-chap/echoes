import type { Metadata } from "next"
import { Geist } from "next/font/google"
import localFont from "next/font/local"
import "./globals.css"

const sans = localFont({
  src: [
    { path: "./fonts/dm-sans-regular.ttf", weight: "400" },
    { path: "./fonts/dm-sans-semibold.ttf", weight: "600" },
  ],
  variable: "--font-body",
  display: "swap",
})
const handwritten = localFont({
  src: "./fonts/caveat.ttf",
  variable: "--font-hand",
  display: "swap",
})
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
})
export const metadata: Metadata = {
  title: "Echoes — memory care, made personal",
  description:
    "Plan person-centred memory-care activities with music, films, and gentle conversation prompts. For carers and families, with or without a dementia diagnosis.",
}
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${handwritten.variable} ${geist.variable}`}
    >
      <body>{children}</body>
    </html>
  )
}
