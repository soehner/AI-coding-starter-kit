"use client"

import { useCallback, useMemo, useState } from "react"
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
import { AlertCircle, CheckCircle2, Link2 } from "lucide-react"
import { toast } from "sonner"
import type { Transaction } from "@/lib/types"

interface ManuellerAbgleichDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Die zwei vom Benutzer ausgewählten Buchungen. */
  transactions: Transaction[]
  /** Wird nach erfolgreichem Merge aufgerufen, damit das Dashboard neu lädt. */
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

type ValidationResult =
  | { ok: true; pdf: Transaction; psd2: Transaction }
  | { ok: false; reason: string }

function validateSelection(transactions: Transaction[]): ValidationResult {
  if (transactions.length !== 2) {
    return {
      ok: false,
      reason: "Bitte genau zwei Buchungen auswählen.",
    }
  }

  const [a, b] = transactions

  if (a.id === b.id) {
    return { ok: false, reason: "Es muss sich um zwei verschiedene Buchungen handeln." }
  }

  // Bereits zusammengeführte / bestätigte Einträge können nicht erneut abgeglichen werden
  for (const t of transactions) {
    if (t.quelle === "beide" || t.status === "bestaetigt") {
      return {
        ok: false,
        reason:
          "Mindestens eine der ausgewählten Buchungen ist bereits als bestätigter Abgleich markiert.",
      }
    }
    if (t.status === "konflikt") {
      return {
        ok: false,
        reason:
          "Konflikt-Einträge können nicht manuell abgeglichen werden — bitte Konflikt zuerst über das PDF lösen.",
      }
    }
  }

  const pdf = transactions.find((t) => t.quelle === "pdf")
  const psd2 = transactions.find((t) => t.quelle === "psd2")

  if (!pdf || !psd2) {
    return {
      ok: false,
      reason:
        "Ein Abgleich ist nur zwischen einem PDF-Eintrag und einem PSD2-Eintrag möglich. Bitte je eine Buchung pro Quelle auswählen.",
    }
  }

  // Plausibilitätswarnung: Beträge sollten gleich sein — sonst eher Konflikt
  if (Number(pdf.amount) !== Number(psd2.amount)) {
    return {
      ok: false,
      reason:
        "Die beiden Buchungen haben unterschiedliche Beträge. Ein Abgleich ist nur bei identischem Betrag sinnvoll — bitte überprüfen.",
    }
  }

  return { ok: true, pdf, psd2 }
}

export function ManuellerAbgleichDialog({
  open,
  onOpenChange,
  transactions,
  onDecided,
}: ManuellerAbgleichDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validation = useMemo(
    () => validateSelection(transactions),
    [transactions]
  )

  const handleConfirm = useCallback(async () => {
    if (!validation.ok) return

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch(
        `/api/transactions/${validation.pdf.id}/abgleich`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entscheidung: "bestaetigt",
            partner_id: validation.psd2.id,
          }),
        }
      )

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(
          data.error || "Abgleich konnte nicht gespeichert werden."
        )
      }

      toast.success("Buchungen erfolgreich zusammengeführt.")
      onDecided()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler.")
    } finally {
      setIsSubmitting(false)
    }
  }, [validation, onDecided, onOpenChange])

  const pdf = validation.ok ? validation.pdf : null
  const psd2 = validation.ok ? validation.psd2 : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Buchungen manuell abgleichen
          </DialogTitle>
          <DialogDescription>
            Du hast zwei Buchungen ausgewählt, die du als denselben Umsatz
            bestätigen möchtest. Der PDF-Eintrag bleibt als verbindliche Quelle
            erhalten, der PSD2-Eintrag wird mit ihm zusammengeführt und
            anschließend gelöscht.
          </DialogDescription>
        </DialogHeader>

        {!validation.ok && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{validation.reason}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {validation.ok && pdf && psd2 && (
          <div className="grid gap-4 md:grid-cols-2">
            <EintragCard
              titel="PDF-Eintrag (bleibt erhalten)"
              badgeColor="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
              transaction={pdf}
            />
            <EintragCard
              titel="PSD2-Eintrag (wird zusammengeführt)"
              badgeColor="bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300"
              transaction={psd2}
            />
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Abbrechen
          </Button>
          {validation.ok && (
            <Button onClick={handleConfirm} disabled={isSubmitting}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {isSubmitting ? "Wird zusammengeführt…" : "Als identisch bestätigen"}
            </Button>
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
  transaction: Transaction
}) {
  const amount = Number(transaction.amount)
  const isPdf = transaction.quelle === "pdf"
  return (
    <div className="rounded-md border p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium">{titel}</h4>
        <span className={`shrink-0 rounded px-2 py-0.5 text-xs ${badgeColor}`}>
          {isPdf ? "PDF" : "PSD2"}
        </span>
      </div>
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
    </div>
  )
}
