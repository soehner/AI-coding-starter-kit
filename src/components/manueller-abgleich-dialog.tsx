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
  | { ok: true; mode: "merge"; pdf: Transaction; psd2: Transaction }
  | {
      ok: true
      mode: "duplicate"
      /** Der bereits abgeglichene Eintrag, der erhalten bleibt. */
      bestaetigt: Transaction
      /** Der PSD2-Duplikat-Eintrag, der gelöscht wird. */
      duplikat: Transaction
    }
  | { ok: false; reason: string }

/**
 * Erkennt, ob ein PSD2-Eintrag ein Duplikat eines bereits abgeglichenen
 * Eintrags ist (entstanden vor dem Fix 71d146c, als der PSD2-Hash beim
 * Merge nicht persistiert wurde). Kriterium: der `matching_hash` des
 * PSD2-Eintrags entspricht dem `matching_hash_psd2` des bestätigten.
 */
function istDuplikatVonBestaetigtem(
  bestaetigt: Transaction,
  psd2: Transaction
): boolean {
  if (bestaetigt.quelle !== "beide") return false
  if (psd2.quelle !== "psd2") return false
  if (!bestaetigt.matching_hash_psd2 || !psd2.matching_hash) return false
  return bestaetigt.matching_hash_psd2 === psd2.matching_hash
}

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

  // Sonderfall: ein bereits abgeglichener Eintrag + sein PSD2-Duplikat
  // (Alt-Bestand vor dem Hash-Persistier-Fix). Wir erlauben hier, das
  // Duplikat zu entfernen, ohne den bestätigten Eintrag anzufassen.
  const bestaetigt = transactions.find((t) => t.quelle === "beide")
  const psd2Kandidat = transactions.find((t) => t.quelle === "psd2")
  if (bestaetigt && psd2Kandidat && istDuplikatVonBestaetigtem(bestaetigt, psd2Kandidat)) {
    return { ok: true, mode: "duplicate", bestaetigt, duplikat: psd2Kandidat }
  }

  // Bereits zusammengeführte / bestätigte Einträge können sonst nicht erneut abgeglichen werden
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

  return { ok: true, mode: "merge", pdf, psd2 }
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
      const primaryId =
        validation.mode === "merge" ? validation.pdf.id : validation.bestaetigt.id
      const partnerId =
        validation.mode === "merge"
          ? validation.psd2.id
          : validation.duplikat.id

      const res = await fetch(
        `/api/transactions/${primaryId}/abgleich`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entscheidung: "bestaetigt",
            partner_id: partnerId,
          }),
        }
      )

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(
          data.error || "Abgleich konnte nicht gespeichert werden."
        )
      }

      toast.success(
        validation.mode === "duplicate"
          ? "Duplikat erfolgreich entfernt."
          : "Buchungen erfolgreich zusammengeführt."
      )
      onDecided()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler.")
    } finally {
      setIsSubmitting(false)
    }
  }, [validation, onDecided, onOpenChange])

  const isDuplicateMode = validation.ok && validation.mode === "duplicate"
  const mergePdf =
    validation.ok && validation.mode === "merge" ? validation.pdf : null
  const mergePsd2 =
    validation.ok && validation.mode === "merge" ? validation.psd2 : null
  const dupBestaetigt =
    validation.ok && validation.mode === "duplicate"
      ? validation.bestaetigt
      : null
  const dupDuplikat =
    validation.ok && validation.mode === "duplicate" ? validation.duplikat : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            {isDuplicateMode
              ? "PSD2-Duplikat entfernen"
              : "Buchungen manuell abgleichen"}
          </DialogTitle>
          <DialogDescription>
            {isDuplicateMode
              ? "Eine der ausgewählten Buchungen ist bereits abgeglichen — die andere ist ein PSD2-Duplikat (gleicher Hash), das entstand, bevor PSD2-Hashes beim Merge persistiert wurden. Der bestätigte Eintrag bleibt unverändert; das Duplikat wird gelöscht."
              : "Du hast zwei Buchungen ausgewählt, die du als denselben Umsatz bestätigen möchtest. Der PDF-Eintrag bleibt als verbindliche Quelle erhalten, der PSD2-Eintrag wird mit ihm zusammengeführt und anschließend gelöscht."}
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

        {mergePdf && mergePsd2 && (
          <div className="grid gap-4 md:grid-cols-2">
            <EintragCard
              titel="PDF-Eintrag (bleibt erhalten)"
              badgeColor="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
              transaction={mergePdf}
            />
            <EintragCard
              titel="PSD2-Eintrag (wird zusammengeführt)"
              badgeColor="bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300"
              transaction={mergePsd2}
            />
          </div>
        )}

        {dupBestaetigt && dupDuplikat && (
          <div className="grid gap-4 md:grid-cols-2">
            <EintragCard
              titel="Bestätigter Eintrag (bleibt erhalten)"
              badgeColor="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
              transaction={dupBestaetigt}
            />
            <EintragCard
              titel="PSD2-Duplikat (wird gelöscht)"
              badgeColor="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
              transaction={dupDuplikat}
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
              {isSubmitting
                ? isDuplicateMode
                  ? "Duplikat wird entfernt…"
                  : "Wird zusammengeführt…"
                : isDuplicateMode
                ? "Duplikat entfernen"
                : "Als identisch bestätigen"}
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
