export const dynamic = "force-dynamic"

import { EinladungAnnehmenForm } from "@/components/einladung-annehmen-form"

export const metadata = {
  title: "Einladung annehmen - CBS-Finanz",
  description: "Legen Sie Ihr Passwort fest, um Ihr Konto zu aktivieren.",
}

export default function EinladungAnnehmenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <EinladungAnnehmenForm />
    </main>
  )
}
