"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle2, Loader2, Save } from "lucide-react"
import { TransactionPreviewTable } from "@/components/transaction-preview-table"
import type { ParsedStatementResult, ParsedTransaction } from "@/lib/types"

export interface StatementConfirmation {
  result: ParsedStatementResult
  transactions: ParsedTransaction[]
}

interface MultiStatementPreviewProps {
  results: ParsedStatementResult[]
  /**
   * Speichert einen einzelnen Kontoauszug. Wird von der Multi-Preview
   * sequenziell für jeden noch nicht gespeicherten Auszug aufgerufen.
   * Wirft ein Error mit Klartext-Meldung bei Fehler.
   */
  onConfirmSingle: (confirmation: StatementConfirmation) => Promise<void>
  /** Wird aufgerufen, sobald alle Auszüge erfolgreich gespeichert wurden. */
  onAllSaved: (savedCount: number, transactionCount: number) => void
  onCancel: () => void
}

export function MultiStatementPreview({
  results,
  onConfirmSingle,
  onAllSaved,
  onCancel,
}: MultiStatementPreviewProps) {
  // Aktuelle Transaktionen pro Statement-Index (Ref → keine Re-Renders)
  const transactionsRef = useRef<Map<number, ParsedTransaction[]>>(
    new Map(results.map((r, i) => [i, r.transactions]))
  )

  const [savedIndices, setSavedIndices] = useState<Set<number>>(new Set())
  const [totalActive, setTotalActive] = useState(
    results.reduce((sum, r) => sum + r.transactions.length, 0)
  )
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [failedIndex, setFailedIndex] = useState<number | null>(null)

  function recomputeTotal(saved: Set<number>) {
    let total = 0
    transactionsRef.current.forEach((txs, idx) => {
      if (!saved.has(idx)) total += txs.length
    })
    setTotalActive(total)
  }

  function handleStatementChange(index: number, transactions: ParsedTransaction[]) {
    transactionsRef.current.set(index, transactions)
    recomputeTotal(savedIndices)
  }

  async function handleConfirm() {
    setIsSaving(true)
    setError(null)
    setFailedIndex(null)

    const saved = new Set(savedIndices)
    let savedTransactions = 0
    results.forEach((_, i) => {
      if (saved.has(i)) savedTransactions += transactionsRef.current.get(i)?.length ?? 0
    })

    try {
      for (let i = 0; i < results.length; i++) {
        if (saved.has(i)) continue

        const result = results[i]
        const transactions = transactionsRef.current.get(i) ?? []

        try {
          await onConfirmSingle({ result, transactions })
        } catch (err) {
          setFailedIndex(i)
          throw new Error(
            err instanceof Error
              ? `Kontoauszug ${result.statement_number}: ${err.message}`
              : `Kontoauszug ${result.statement_number}: Fehler beim Speichern.`
          )
        }

        saved.add(i)
        savedTransactions += transactions.length
        setSavedIndices(new Set(saved))
        recomputeTotal(saved)
      }

      // Alle durch — Parent informieren
      onAllSaved(saved.size, savedTransactions)
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

  const remainingCount = results.length - savedIndices.size

  return (
    <div className="space-y-6">
      {results.map((result, i) => {
        const isSaved = savedIndices.has(i)
        const isFailed = failedIndex === i
        return (
          <div
            key={`${result.statement_number}-${i}`}
            className={
              isSaved
                ? "pointer-events-none relative opacity-50"
                : isFailed
                  ? "ring-2 ring-destructive rounded-md"
                  : ""
            }
          >
            {isSaved && (
              <Badge
                variant="secondary"
                className="absolute right-4 top-4 z-10 gap-1 bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-100"
              >
                <CheckCircle2 className="h-3 w-3" />
                Gespeichert
              </Badge>
            )}
            <TransactionPreviewTable
              result={result}
              hideFooter
              onTransactionsChange={
                isSaved ? undefined : (txs) => handleStatementChange(i, txs)
              }
            />
          </div>
        )
      })}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          <strong className="text-foreground">{remainingCount}</strong> von{" "}
          <strong className="text-foreground">{results.length}</strong>{" "}
          {results.length === 1 ? "Kontoauszug" : "Kontoauszügen"} noch offen —
          insgesamt{" "}
          <strong className="text-foreground">{totalActive}</strong> Buchungen
          zum Speichern bereit.
          {savedIndices.size > 0 && (
            <span className="ml-2 text-green-700 dark:text-green-400">
              ({savedIndices.size} bereits gespeichert)
            </span>
          )}
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
            disabled={isSaving || totalActive === 0 || remainingCount === 0}
            aria-label="Alle offenen Buchungen speichern"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {savedIndices.size > 0 ? "Weiter" : "Alle"} {totalActive} Buchungen
            speichern
          </Button>
        </div>
      </div>
    </div>
  )
}
