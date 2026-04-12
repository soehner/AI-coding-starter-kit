"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { GenehmigungTabelle } from "@/components/genehmigungen-tabelle"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus } from "lucide-react"
import Link from "next/link"
import type { ApprovalRequestWithDecisions } from "@/lib/types"

export default function GenehmigungPage() {
  const { user, isLoading: authLoading, isAdmin } = useAuth()
  const router = useRouter()

  const [requests, setRequests] = useState<ApprovalRequestWithDecisions[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRequests = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/approvals")
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Anträge konnten nicht geladen werden.")
        return
      }

      setRequests(data as ApprovalRequestWithDecisions[])
    } catch {
      setError("Netzwerkfehler beim Laden der Anträge.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login")
    }
  }, [authLoading, user, router])

  useEffect(() => {
    if (user) {
      fetchRequests()
    }
  }, [user, fetchRequests])

  async function handleRetrySend(requestId: string) {
    const response = await fetch(`/api/approvals/${requestId}/retry-send`, {
      method: "POST",
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || "E-Mail-Versand erneut fehlgeschlagen.")
    }

    await fetchRequests()
  }

  if (authLoading) {
    return (
      <div className="container px-4 py-8 md:px-6">
        <Skeleton className="mb-6 h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="container px-4 py-8 md:px-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Genehmigungen</h2>
          <p className="text-sm text-muted-foreground">
            Übersicht aller Genehmigungsanträge.
          </p>
        </div>
        {isAdmin && (
          <Button asChild>
            <Link href="/dashboard/admin/genehmigungen/neu">
              <Plus className="mr-2 h-4 w-4" />
              Neuer Antrag
            </Link>
          </Button>
        )}
      </div>

      <GenehmigungTabelle
        requests={requests}
        isLoading={isLoading}
        error={error}
        isAdmin={isAdmin}
        onRefresh={isAdmin ? fetchRequests : undefined}
        onRetrySend={isAdmin ? handleRetrySend : undefined}
      />
    </div>
  )
}
