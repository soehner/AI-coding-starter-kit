export const dynamic = "force-dynamic"

import { PasswordResetForm } from "@/components/password-reset-form"

export const metadata = {
  title: "Passwort zurücksetzen - CBS-Finanz",
  description: "Setzen Sie Ihr Passwort zurück.",
}

export default function PasswordResetPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <PasswordResetForm />
    </main>
  )
}
