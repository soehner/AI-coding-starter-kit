"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { KostenuebernahmenTabelle } from "@/components/kostenuebernahmen-tabelle"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import type { CostRequestWithVotes } from "@/lib/types"

export default function AdminKostenuebernahmenPage() {
  const { profile, isLoading: authLoading, isAdmin } = useAuth()
  const router = useRouter()

  const [requests, setRequests] = useState<CostRequestWithVotes[]>([])
  const [isLoadingRequests, setIsLoadingRequests] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRequests = useCallback(async () => {
    setIsLoadingRequests(true)
    setError(null)

    try {
      const response = await fetch("/api/cost-requests")
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Anträge konnten nicht geladen werden.")
        return
      }

      setRequests(data)
    } catch {
      setError("Netzwerkfehler beim Laden der Anträge.")
    } finally {
      setIsLoadingRequests(false)
    }
  }, [])

  // Redirect falls kein Admin
  useEffect(() => {
    if (!authLoading && (!profile || !isAdmin)) {
      router.replace("/dashboard")
    }
  }, [authLoading, profile, isAdmin, router])

  // Anträge laden
  useEffect(() => {
    if (isAdmin) {
      fetchRequests()
    }
  }, [isAdmin, fetchRequests])

  // E-Mail erneut senden
  async function handleRetryEmail(requestId: string) {
    try {
      const response = await fetch(
        `/api/cost-requests/${requestId}/retry-email`,
        { method: "POST" }
      )

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || "E-Mail konnte nicht erneut gesendet werden.")
        return
      }

      toast.success("E-Mails werden erneut gesendet.")

      // Liste aktualisieren
      setRequests((prev) =>
        prev.map((r) =>
          r.id === requestId ? { ...r, email_status: "gesendet" as const } : r
        )
      )
    } catch {
      toast.error("Netzwerkfehler beim erneuten Senden der E-Mails.")
    }
  }

  // Lade-Zustand während Auth noch läuft
  if (authLoading) {
    return (
      <div className="container px-4 py-8 md:px-6">
        <Skeleton className="mb-6 h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  // Nicht-Admin: nichts anzeigen (Redirect passiert im useEffect)
  if (!isAdmin) {
    return null
  }

  return (
    <div className="container px-4 py-8 md:px-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">
          Anträge auf Kostenübernahme
        </h2>
        <p className="text-sm text-muted-foreground">
          Übersicht aller eingereichten Anträge auf Kostenübernahme und deren
          Abstimmungsstatus.
        </p>
      </div>

      <KostenuebernahmenTabelle
        requests={requests}
        isLoading={isLoadingRequests}
        error={error}
        onRetryEmail={handleRetryEmail}
      />
    </div>
  )
}
