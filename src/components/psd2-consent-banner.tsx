"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import type { Psd2Status } from "@/lib/types"

/**
 * PROJ-16: Persistentes Banner im Dashboard, das erscheint, wenn die
 * PSD2-Zustimmung in ≤ 7 Tagen abläuft oder bereits abgelaufen ist.
 *
 * Wird nur für Admins angezeigt, weil nur diese den Bankzugang erneuern
 * können. Das Banner verlinkt zur Einstellungen-Seite (Tab "Bankzugang").
 */
export function Psd2ConsentBanner() {
  const { isAdmin, isLoading: authLoading } = useAuth()
  const [status, setStatus] = useState<Psd2Status | null>(null)

  useEffect(() => {
    if (authLoading || !isAdmin) return

    let cancelled = false
    const loadStatus = async () => {
      try {
        const res = await fetch("/api/admin/psd2/status")
        if (!res.ok) return
        const data: Psd2Status = await res.json()
        if (!cancelled) {
          setStatus(data)
        }
      } catch {
        // Fehler stillschweigend ignorieren — das Banner ist optional
      }
    }
    loadStatus()
    return () => {
      cancelled = true
    }
  }, [authLoading, isAdmin])

  if (!isAdmin || !status?.verbunden || !status.bereit) {
    return null
  }

  const tage = status.tage_bis_ablauf ?? null
  if (tage === null) return null

  const abgelaufen = tage < 0
  const laeuftBaldAb = tage >= 0 && tage <= 7

  if (!abgelaufen && !laeuftBaldAb) {
    return null
  }

  const titel = abgelaufen
    ? "Bankzugang abgelaufen"
    : `Bankzugang läuft in ${tage} Tag${tage === 1 ? "" : "en"} ab`

  const beschreibung = abgelaufen
    ? "Die 90-tägige PSD2-Zustimmung ist abgelaufen. Der automatische Abruf pausiert, bis du die Verbindung erneuerst."
    : "Die 90-tägige PSD2-Zustimmung endet bald. Erneuere die Verbindung rechtzeitig, damit der automatische Abruf nicht unterbrochen wird."

  return (
    <Alert
      variant={abgelaufen ? "destructive" : "default"}
      className={
        abgelaufen
          ? ""
          : "border-orange-500 bg-orange-50 text-orange-900 dark:bg-orange-950/40 dark:text-orange-200"
      }
    >
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{titel}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>{beschreibung}</span>
        <Button
          asChild
          size="sm"
          variant={abgelaufen ? "secondary" : "outline"}
          className="shrink-0"
        >
          <Link href="/dashboard/einstellungen?tab=bankzugang">
            Jetzt erneuern
          </Link>
        </Button>
      </AlertDescription>
    </Alert>
  )
}
