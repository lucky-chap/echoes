import type { Metadata } from "next"
import FamilyIntake from "@/components/echoes/family-intake"
export const metadata: Metadata = {
  title: "Private family intake — Echoes",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}
export default function FamilyPage() {
  return <FamilyIntake />
}
