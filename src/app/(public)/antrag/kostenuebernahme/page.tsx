import type { Metadata } from "next"
import { KostenuebernahmeFormular } from "@/components/kostenuebernahme-formular"

export const metadata: Metadata = {
  title: "Kostenübernahme-Antrag - CBS-Mannheim Förderverein",
  description:
    "Stellen Sie einen Antrag auf Kostenübernahme beim CBS-Mannheim Förderverein.",
}

export default function KostenuebernahmePage() {
  return (
    <main className="flex min-h-screen items-start justify-center px-4 py-8 sm:py-12">
      <KostenuebernahmeFormular />
    </main>
  )
}
