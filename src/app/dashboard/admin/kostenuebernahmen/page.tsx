"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { KostenuebernahmenTabelle } from "@/components/kostenuebernahmen-tabelle"
import { Skeleton } from "@/components/ui/skeleton"
import type { Antrag } from "@/lib/types"

export default function AdminKostenuebernahmenPage() {
  const {
    profile,
    isLoading: authLoading,
    isAdmin,
    canSeeAntraege,
  } = useAuth()
  const router = useRouter()

  const [antraege, setAntraege] = useState<Antrag[]>([])
  const [isLoadingAntraege, setIsLoadingAntraege] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAntraege = useCallback(async () => {
    setIsLoadingAntraege(true)
    setError(null)

    try {
      const response = await fetch("/api/antraege")
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Anträge konnten nicht geladen werden.")
        return
      }

      setAntraege(data)
    } catch {
      setError("Netzwerkfehler beim Laden der Anträge.")
    } finally {
      setIsLoadingAntraege(false)
    }
  }, [])

  useEffect(() => {
    if (!authLoading && (!profile || !canSeeAntraege)) {
      router.replace("/dashboard")
    }
  }, [authLoading, profile, canSeeAntraege, router])

  useEffect(() => {
    if (canSeeAntraege) {
      fetchAntraege()
    }
  }, [canSeeAntraege, fetchAntraege])

  if (authLoading) {
    return (
      <div className="container px-4 py-8 md:px-6">
        <Skeleton className="mb-6 h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!canSeeAntraege) {
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
        antraege={antraege}
        isLoading={isLoadingAntraege}
        error={error}
        canEdit={isAdmin}
        onAntraegeChanged={fetchAntraege}
      />
    </div>
  )
}
