"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, AlertTriangle, CheckCircle2, Split } from "lucide-react"
import { toast } from "sonner"
import type { Transaction } from "@/lib/types"

interface TransactionAbgleichDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction: Transaction | null
  /**
   * Alle Transaktionen der aktuellen Seite — wird für die Suche nach dem
   * passenden Fuzzy-Match-Partner genutzt (gleiches Buchungsdatum ±1 Tag,
   * Betrag exakt, IBAN exakt, unterschiedliche Quelle).
   */
  allTransactions: Transaction[]
  /**
   * Wird nach erfolgreicher Entscheidung aufgerufen, damit das Dashboard
   * die Tabelle neu lädt.
   */
  onDecided: () => void
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function findFuzzyPartner(
  target: Transaction,
  candidates: Transaction[]
): Transaction | null {
  if (!target.quelle) return null
  const targetDate = new Date(target.booking_date).getTime()
  const oneDayMs = 24 * 60 * 60 * 1000

  return (
    candidates.find((c) => {
      if (c.id === target.id) return false
      if (!c.quelle || c.quelle === target.quelle) return false
      if (c.quelle === "beide") return false
      // Betrag exakt
      if (Number(c.amount) !== Number(target.amount)) return false
      // IBAN exakt (wenn vorhanden)
      if (target.iban_gegenseite && c.iban_gegenseite) {
        if (target.iban_gegenseite !== c.iban_gegenseite) return false
      }
      // Datum ±1 Tag
      const cDate = new Date(c.booking_date).getTime()
      if (Math.abs(cDate - targetDate) > oneDayMs) return false
      return true
    }) ?? null
  )
}

export function TransactionAbgleichDialog({
  open,
  onOpenChange,
  transaction,
  allTransactions,
  onDecided,
}: TransactionAbgleichDialogProps) {
  const [partner, setPartner] = useState<Transaction | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !transaction) {
      setPartner(null)
      setError(null)
      return
    }
    if (transaction.status === "vorschlag") {
      const found = findFuzzyPartner(transaction, allTransactions)
      setPartner(found)
      if (!found) {
        setError(
          "Der passende Gegeneintrag konnte auf der aktuellen Seite nicht gefunden werden. Bitte prüfe den Filter oder blättere zur Seite mit dem Partner-Eintrag."
        )
      }
    } else {
      setPartner(null)
    }
  }, [open, transaction, allTransactions])

  const handleDecision = useCallback(
    async (entscheidung: "bestaetigt" | "getrennt") => {
      if (!transaction || !partner) return

      setIsSubmitting(true)
      setError(null)

      try {
        const res = await fetch(
          `/api/transactions/${transaction.id}/abgleich`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              entscheidung,
              partner_id: partner.id,
            }),
          }
        )

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || "Entscheidung konnte nicht gespeichert werden.")
        }

        toast.success(
          entscheidung === "bestaetigt"
            ? "Einträge erfolgreich zusammengeführt."
            : "Einträge als getrennt markiert."
        )
        onDecided()
        onOpenChange(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler.")
      } finally {
        setIsSubmitting(false)
      }
    },
    [transaction, partner, onDecided, onOpenChange]
  )

  if (!transaction) {
    return null
  }

  const isKonflikt = transaction.status === "konflikt"
  const isVorschlag = transaction.status === "vorschlag"

  const dialogTitle = isKonflikt
    ? "Konflikt zwischen PDF und PSD2"
    : "Abgleich-Vorschlag bestätigen"

  const dialogDescription = isKonflikt
    ? "Der PDF-Eintrag und der PSD2-Eintrag haben unterschiedliche Werte. Das PDF-Dokument gilt als verbindliche Quelle und wurde übernommen. Die ursprünglichen PSD2-Daten bleiben zur Nachvollziehbarkeit gesichert."
    : "Die folgenden beiden Einträge sehen aus wie derselbe Umsatz — sie passen bei Betrag und Kontoverbindung, unterscheiden sich aber leicht in Datum oder Verwendungszweck. Bitte entscheide, ob es sich um einen einzigen oder zwei verschiedene Umsätze handelt."

  const pdfOriginal = isKonflikt ? transaction.psd2_original_data : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isKonflikt ? (
              <AlertTriangle className="h-5 w-5 text-red-600" />
            ) : (
              <Split className="h-5 w-5 text-orange-600" />
            )}
            {dialogTitle}
          </DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isVorschlag && (
          <div className="grid gap-4 md:grid-cols-2">
            <EintragCard
              titel="PDF-Eintrag"
              badgeColor="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
              transaction={
                transaction.quelle === "pdf" ? transaction : partner
              }
            />
            <EintragCard
              titel="PSD2-Eintrag"
              badgeColor="bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300"
              transaction={
                transaction.quelle === "psd2" ? transaction : partner
              }
            />
          </div>
        )}

        {isKonflikt && (
          <div className="space-y-4">
            <div className="rounded-md border border-green-500/40 bg-green-50 p-4 dark:bg-green-950/40">
              <div className="mb-2 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-700" />
                <span className="font-medium text-green-700 dark:text-green-300">
                  Aktuell gespeichert (PDF = Source of Truth)
                </span>
              </div>
              <FeldListe transaction={transaction} />
            </div>

            {pdfOriginal && (
              <div className="rounded-md border border-muted bg-muted/30 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    Ursprüngliche PSD2-Daten (Audit)
                  </Badge>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(pdfOriginal).map(([key, value]) => (
                    <div key={key} className="col-span-2 grid grid-cols-2 gap-2">
                      <dt className="text-muted-foreground">{key}:</dt>
                      <dd className="font-mono text-xs break-all">
                        {typeof value === "string" || typeof value === "number"
                          ? String(value)
                          : JSON.stringify(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {isVorschlag && partner && (
            <>
              <Button
                variant="outline"
                onClick={() => handleDecision("getrennt")}
                disabled={isSubmitting}
              >
                <Split className="mr-2 h-4 w-4" />
                Als separate Einträge behandeln
              </Button>
              <Button
                onClick={() => handleDecision("bestaetigt")}
                disabled={isSubmitting}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Als identisch bestätigen
              </Button>
            </>
          )}
          {isVorschlag && !partner && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Schließen
            </Button>
          )}
          {isKonflikt && (
            <Button onClick={() => onOpenChange(false)}>Verstanden</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EintragCard({
  titel,
  badgeColor,
  transaction,
}: {
  titel: string
  badgeColor: string
  transaction: Transaction | null
}) {
  return (
    <div className="rounded-md border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="font-medium">{titel}</h4>
        <span className={`rounded px-2 py-0.5 text-xs ${badgeColor}`}>
          {titel.includes("PDF") ? "PDF" : "PSD2"}
        </span>
      </div>
      {transaction ? (
        <FeldListe transaction={transaction} />
      ) : (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      )}
    </div>
  )
}

function FeldListe({ transaction }: { transaction: Transaction }) {
  const amount = Number(transaction.amount)
  return (
    <dl className="space-y-2 text-sm">
      <div className="grid grid-cols-3 gap-2">
        <dt className="text-muted-foreground">Datum:</dt>
        <dd className="col-span-2 font-medium">
          {formatDate(transaction.booking_date)}
        </dd>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <dt className="text-muted-foreground">Betrag:</dt>
        <dd
          className={`col-span-2 font-medium ${
            amount >= 0 ? "text-green-600" : "text-red-600"
          }`}
        >
          {formatCurrency(amount)}
        </dd>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <dt className="text-muted-foreground">Verwendung:</dt>
        <dd className="col-span-2 break-words">{transaction.description}</dd>
      </div>
      {transaction.counterpart && (
        <div className="grid grid-cols-3 gap-2">
          <dt className="text-muted-foreground">Gegenseite:</dt>
          <dd className="col-span-2 break-words">{transaction.counterpart}</dd>
        </div>
      )}
      {transaction.iban_gegenseite && (
        <div className="grid grid-cols-3 gap-2">
          <dt className="text-muted-foreground">IBAN:</dt>
          <dd className="col-span-2 break-all font-mono text-xs">
            {transaction.iban_gegenseite}
          </dd>
        </div>
      )}
    </dl>
  )
}
