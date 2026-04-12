"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Loader2, Save } from "lucide-react"
import { TransactionPreviewTable } from "@/components/transaction-preview-table"
import type { ParsedStatementResult, ParsedTransaction } from "@/lib/types"

export interface StatementConfirmation {
  result: ParsedStatementResult
  transactions: ParsedTransaction[]
}

interface MultiStatementPreviewProps {
  results: ParsedStatementResult[]
  onConfirmAll: (batch: StatementConfirmation[]) => Promise<void>
  onCancel: () => void
}

export function MultiStatementPreview({
  results,
  onConfirmAll,
  onCancel,
}: MultiStatementPreviewProps) {
  // Aktueller Stand der Transaktionen pro Statement-Index.
  // Als Ref gespeichert, damit Änderungen aus den Child-Komponenten keine
  // Re-Renders des gesamten Previews auslösen — die Summen werden in
  // einem separaten State gespiegelt.
  const transactionsRef = useRef<Map<number, ParsedTransaction[]>>(
    new Map(results.map((r, i) => [i, r.transactions]))
  )
  const [totalActive, setTotalActive] = useState(
    results.reduce((sum, r) => sum + r.transactions.length, 0)
  )
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function recomputeTotal() {
    let total = 0
    transactionsRef.current.forEach((txs) => {
      total += txs.length
    })
    setTotalActive(total)
  }

  function handleStatementChange(index: number, transactions: ParsedTransaction[]) {
    transactionsRef.current.set(index, transactions)
    recomputeTotal()
  }

  async function handleConfirm() {
    setIsSaving(true)
    setError(null)
    try {
      const batch: StatementConfirmation[] = results.map((result, i) => ({
        result,
        transactions: transactionsRef.current.get(i) ?? [],
      }))
      await onConfirmAll(batch)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Fehler beim Speichern der Buchungen."
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {results.map((result, i) => (
        <TransactionPreviewTable
          key={`${result.statement_number}-${i}`}
          result={result}
          hideFooter
          onTransactionsChange={(txs) => handleStatementChange(i, txs)}
        />
      ))}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          <strong className="text-foreground">{results.length}</strong>{" "}
          {results.length === 1 ? "Kontoauszug" : "Kontoauszüge"} mit insgesamt{" "}
          <strong className="text-foreground">{totalActive}</strong> Buchungen
          zum Speichern bereit.
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isSaving}
            aria-label="Import abbrechen"
          >
            Abbrechen
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isSaving || totalActive === 0}
            aria-label="Alle Buchungen speichern"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Alle {totalActive} Buchungen speichern
          </Button>
        </div>
      </div>
    </div>
  )
}
