export const dynamic = "force-dynamic"

import { LoginForm } from "@/components/login-form"

export const metadata = {
  title: "Anmelden - CBS-Finanz",
  description: "Melden Sie sich bei CBS-Finanz an.",
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <LoginForm callbackError={params.error === "auth_callback_error"} />
    </main>
  )
}
