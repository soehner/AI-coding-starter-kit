"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertCircle,
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Hash,
  Link2,
  Link2Off,
  Loader2,
  RefreshCw,
} from "lucide-react"
import { Progress } from "@/components/ui/progress"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import type { Psd2Status } from "@/lib/types"

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  try {
    return new Date(value).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  } catch {
    return value
  }
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—"
  try {
    return new Date(value).toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return value
  }
}

export function Psd2VerbindungsKarte() {
  const [status, setStatus] = useState<Psd2Status | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false)
  const [isBackfilling, setIsBackfilling] = useState(false)
  const [backfillVerarbeitet, setBackfillVerarbeitet] = useState(0)

  const fetchStatus = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/psd2/status")
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(
          data.error || "Status konnte nicht geladen werden."
        )
      }
      const data: Psd2Status = await res.json()
      setStatus(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const handleConnect = useCallback(async () => {
    setIsConnecting(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/psd2/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Bankzugang konnte nicht gestartet werden.")
      }
      if (data.link) {
        // Weiterleitung zum Enable-Banking-Consent-Flow
        window.location.href = data.link as string
        return
      }
      throw new Error("Keine Weiterleitungs-URL erhalten.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler.")
      setIsConnecting(false)
    }
  }, [])

  const handleDisconnect = useCallback(async () => {
    setIsDisconnecting(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/psd2/connect", {
        method: "DELETE",
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(
          data.error || "Bankzugang konnte nicht getrennt werden."
        )
      }
      toast.success("Bankzugang getrennt.")
      setDisconnectDialogOpen(false)
      await fetchStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler.")
    } finally {
      setIsDisconnecting(false)
    }
  }, [fetchStatus])

  const handleBackfillHashes = useCallback(async () => {
    setIsBackfilling(true)
    setBackfillVerarbeitet(0)
    setError(null)
    try {
      let gesamt = 0
      let sicherheitsAbbruch = 0
      // Solange Batches verarbeitet werden können, weiter aufrufen.
      // Sicherheitsabbruch nach max. 50 Iterationen (= 5.000 Einträge bei
      // batch_size 100), um keine Endlosschleife zu riskieren.
      while (sicherheitsAbbruch < 50) {
        sicherheitsAbbruch++
        const res = await fetch("/api/admin/psd2/backfill-hashes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batch_size: 100 }),
        })
        const data = await res.json()
        if (!res.ok) {
          throw new Error(
            data.error || "Hash-Backfill konnte nicht ausgeführt werden."
          )
        }
        if (data.fertig) {
          toast.success(
            gesamt === 0
              ? "Alle bestehenden Einträge haben bereits einen Hash."
              : `Hash-Backfill abgeschlossen: ${gesamt} Einträge aktualisiert.`
          )
          break
        }
        gesamt += Number(data.verarbeitet ?? 0)
        setBackfillVerarbeitet(gesamt)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unbekannter Fehler."
      setError(message)
      toast.error(message)
    } finally {
      setIsBackfilling(false)
    }
  }, [])

  const handleManualSync = useCallback(async () => {
    setIsSyncing(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/psd2/sync", {
        method: "POST",
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Abruf fehlgeschlagen.")
      }
      toast.success("Bank-Abruf erfolgreich durchgeführt.")
      await fetchStatus()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unbekannter Fehler."
      setError(message)
      toast.error(message)
    } finally {
      setIsSyncing(false)
    }
  }, [fetchStatus])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Banknote className="h-5 w-5" />
            <CardTitle>Bankzugang (PSD2)</CardTitle>
          </div>
          <CardDescription>
            Direkter Bankabruf bei der BBBank über die PSD2-Schnittstelle.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-9 w-48" />
        </CardContent>
      </Card>
    )
  }

  const verbunden = status?.verbunden ?? false
  const bereit = status?.bereit ?? false
  const tageBisAblauf = status?.tage_bis_ablauf ?? null
  const laeuftBaldAb = tageBisAblauf !== null && tageBisAblauf <= 7 && tageBisAblauf >= 0
  const abgelaufen = tageBisAblauf !== null && tageBisAblauf < 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Banknote className="h-5 w-5" />
          <CardTitle>Bankzugang (PSD2)</CardTitle>
        </div>
        <CardDescription>
          Verbinde CBS-Finanz direkt mit deinem BBBank-Konto, damit Umsätze
          täglich automatisch abgerufen werden. Die Authentifizierung erfolgt
          über SecureGo plus bei der BBBank. Die 90-tägige Zustimmung muss
          anschließend regelmäßig erneuert werden.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Status-Anzeige */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Status:</span>
            {!verbunden ? (
              <Badge variant="secondary">Nicht eingerichtet</Badge>
            ) : !bereit ? (
              <Badge
                variant="outline"
                className="border-orange-500 bg-orange-50 text-orange-700"
              >
                Consent-Freigabe ausstehend
              </Badge>
            ) : abgelaufen ? (
              <Badge variant="destructive">Zustimmung abgelaufen</Badge>
            ) : laeuftBaldAb ? (
              <Badge
                variant="outline"
                className="border-orange-500 bg-orange-50 text-orange-700"
              >
                <AlertTriangle className="mr-1 h-3 w-3" />
                Läuft in {tageBisAblauf} Tag{tageBisAblauf === 1 ? "" : "en"} ab
              </Badge>
            ) : (
              <Badge className="bg-green-600 hover:bg-green-700">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Verbunden
              </Badge>
            )}
          </div>

          {verbunden && bereit && status?.consent_gueltig_bis && (
            <div className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
              <div>
                <span className="font-medium text-foreground">
                  Zustimmung gültig bis:
                </span>{" "}
                {formatDate(status.consent_gueltig_bis)}
              </div>
              <div>
                <span className="font-medium text-foreground">
                  Letzter Abruf:
                </span>{" "}
                {formatDateTime(status.letzter_abruf_am)}
                {status.letzter_abruf_status === "fehler" && (
                  <Badge variant="destructive" className="ml-2">
                    Fehler
                  </Badge>
                )}
                {status.letzter_abruf_status === "erfolg" && (
                  <Badge
                    variant="outline"
                    className="ml-2 border-green-500 text-green-700"
                  >
                    Erfolg
                  </Badge>
                )}
              </div>
            </div>
          )}

          {verbunden && status?.letzter_abruf_fehler && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Letzter Abruf fehlgeschlagen: {status.letzter_abruf_fehler}
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Aktionen */}
        <div className="flex flex-wrap gap-2 pt-2">
          {!verbunden && (
            <Button onClick={handleConnect} disabled={isConnecting}>
              {isConnecting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="mr-2 h-4 w-4" />
              )}
              Bankzugang verbinden
            </Button>
          )}

          {verbunden && !bereit && (
            <Button onClick={handleConnect} disabled={isConnecting}>
              {isConnecting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="mr-2 h-4 w-4" />
              )}
              Consent-Freigabe abschließen
            </Button>
          )}

          {verbunden && (laeuftBaldAb || abgelaufen) && (
            <Button onClick={handleConnect} disabled={isConnecting}>
              {isConnecting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Zustimmung erneuern
            </Button>
          )}

          {verbunden && bereit && !abgelaufen && (
            <Button
              variant="outline"
              onClick={handleManualSync}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Jetzt manuell abrufen
            </Button>
          )}

          {verbunden && bereit && !abgelaufen && (
            <Button
              variant="outline"
              onClick={handleBackfillHashes}
              disabled={isBackfilling}
              aria-label="Matching-Hashes für Altdaten nachberechnen"
            >
              {isBackfilling ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Hash className="mr-2 h-4 w-4" />
              )}
              Hash-Backfill ausführen
            </Button>
          )}

          {verbunden && (
            <AlertDialog
              open={disconnectDialogOpen}
              onOpenChange={setDisconnectDialogOpen}
            >
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={isDisconnecting}>
                  <Link2Off className="mr-2 h-4 w-4" />
                  Verbindung aufheben
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Bankzugang wirklich trennen?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Der automatische Abruf wird deaktiviert. Bereits
                    importierte Umsätze bleiben erhalten. Du kannst den
                    Bankzugang später jederzeit neu verbinden.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDisconnecting}>
                    Abbrechen
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault()
                      handleDisconnect()
                    }}
                    disabled={isDisconnecting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isDisconnecting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Verbindung trennen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {isBackfilling && (
          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Hash-Backfill läuft...</span>
              <span className="text-muted-foreground">
                {backfillVerarbeitet} Einträge verarbeitet
              </span>
            </div>
            <Progress value={undefined} className="h-1.5" />
            <p className="text-xs text-muted-foreground">
              Die Matching-Hashes werden für bestehende Buchungen
              nachberechnet. Bitte nicht schließen.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
