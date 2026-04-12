"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { ApiSettingsForm } from "@/components/api-settings-form"
import { SeafileSettingsForm } from "@/components/seafile-settings-form"
import { Skeleton } from "@/components/ui/skeleton"

export default function AdminSettingsPage() {
  const { user, profile, isLoading: authLoading, isAdmin } = useAuth()
  const router = useRouter()

  // Redirect falls kein Admin
  useEffect(() => {
    if (!authLoading && (!profile || !isAdmin)) {
      router.replace("/dashboard")
    }
  }, [authLoading, profile, isAdmin, router])

  // Lade-Zustand
  if (authLoading) {
    return (
      <div className="container px-4 py-8 md:px-6">
        <Skeleton className="mb-6 h-8 w-48" />
        <Skeleton className="h-64 w-full max-w-2xl" />
      </div>
    )
  }

  // Nicht-Admin: nichts anzeigen
  if (!isAdmin || !user) {
    return null
  }

  return (
    <div className="container px-4 py-8 md:px-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Einstellungen</h2>
        <p className="text-sm text-muted-foreground">
          Konfiguriere die KI-Integration und Seafile-Anbindung.
        </p>
      </div>

      <div className="max-w-2xl space-y-8">
        <ApiSettingsForm />
        <SeafileSettingsForm />
      </div>
    </div>
  )
}
