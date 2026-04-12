"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { GenehmigungsFormular } from "@/components/genehmigungs-formular"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function NeuerAntragPage() {
  const { profile, isLoading: authLoading, isAdmin } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && (!profile || !isAdmin)) {
      router.replace("/dashboard")
    }
  }, [authLoading, profile, isAdmin, router])

  function handleSuccess() {
    router.push("/dashboard/admin/genehmigungen")
  }

  if (authLoading) {
    return (
      <div className="container px-4 py-8 md:px-6">
        <Skeleton className="mb-6 h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!isAdmin) return null

  return (
    <div className="container px-4 py-8 md:px-6">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/dashboard/admin/genehmigungen">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück zur Übersicht
          </Link>
        </Button>
        <h2 className="text-2xl font-bold tracking-tight">
          Neuen Genehmigungsantrag stellen
        </h2>
        <p className="text-sm text-muted-foreground">
          Lade einen Beleg hoch und wähle die Genehmiger aus.
        </p>
      </div>

      <div className="max-w-2xl">
        <GenehmigungsFormular onSuccess={handleSuccess} />
      </div>
    </div>
  )
}
