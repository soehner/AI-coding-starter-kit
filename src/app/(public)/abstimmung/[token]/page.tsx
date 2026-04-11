import type { Metadata } from "next"
import { AbstimmungsSeite } from "@/components/abstimmungs-seite"

export const metadata: Metadata = {
  title: "Abstimmung - CBS-Mannheim Förderverein",
  description: "Abstimmung über einen Kostenübernahme-Antrag.",
}

export default async function AbstimmungPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  return (
    <main className="flex min-h-screen items-start justify-center px-4 py-8 sm:py-12">
      <AbstimmungsSeite token={token} />
    </main>
  )
}
