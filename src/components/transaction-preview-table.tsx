"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertCircle,
  AlertTriangle,
  Check,
  Loader2,
  Pencil,
  Save,
  Trash2,
  Undo2,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ParsedStatementResult, ParsedTransaction } from "@/lib/types"

interface TransactionPreviewTableProps {
  result: ParsedStatementResult
  onConfirm: (transactions: ParsedTransaction[]) => Promise<void>
  onCancel: () => void
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount)
}

function formatDate(dateString: string): string {
  try {
    const [year, month, day] = dateString.split("-")
    return `${day}.${month}.${year}`
  } catch {
    return dateString
  }
}

export function TransactionPreviewTable({
  result,
  onConfirm,
  onCancel,
}: TransactionPreviewTableProps) {
  const [transactions, setTransactions] = useState<ParsedTransaction[]>(
    result.transactions.map((t) => ({ ...t, isRemoved: false }))
  )
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<{
    description: string
    amount: string
  }>({ description: "", amount: "" })
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeTransactions = transactions.filter((t) => !t.isRemoved)
  const duplicateCount = activeTransactions.filter((t) => t.isDuplicate).length

  const startEdit = useCallback((tx: ParsedTransaction) => {
    setEditingId(tx.id)
    setEditValues({
      description: tx.description,
      amount: tx.amount.toString(),
    })
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setEditValues({ description: "", amount: "" })
  }, [])

  const saveEdit = useCallback(
    (id: string) => {
      const parsedAmount = parseFloat(editValues.amount.replace(",", "."))
      if (isNaN(parsedAmount)) {
        return
      }

      setTransactions((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, description: editValues.description, amount: parsedAmount }
            : t
        )
      )
      setEditingId(null)
    },
    [editValues]
  )

  const toggleRemove = useCallback((id: string) => {
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, isRemoved: !t.isRemoved } : t
      )
    )
  }, [])

  async function handleConfirm() {
    setIsSaving(true)
    setError(null)

    try {
      await onConfirm(activeTransactions)
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
    <Card>
      <CardHeader>
        <CardTitle>Vorschau: Erkannte Buchungen</CardTitle>
        <CardDescription>
          Kontoauszug {result.statement_number} vom{" "}
          {formatDate(result.statement_date)}
        </CardDescription>

        {/* Zusammenfassung */}
        <div className="mt-3 flex flex-wrap gap-3">
          <Badge variant="secondary">
            {activeTransactions.length} Buchungen
          </Badge>
          <Badge variant="secondary">
            Anfangssaldo: {formatCurrency(result.start_balance)}
          </Badge>
          <Badge variant="secondary">
            Endsaldo: {formatCurrency(result.end_balance)}
          </Badge>
          {duplicateCount > 0 && (
            <Badge variant="outline" className="border-orange-400 text-orange-600">
              <AlertTriangle className="mr-1 h-3 w-3" />
              {duplicateCount} moegliche Duplikate
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {activeTransactions.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Alle Buchungen wurden entfernt. Bitte mindestens eine Buchung
              beibehalten oder den Vorgang abbrechen.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Datum</TableHead>
                  <TableHead className="w-[100px] hidden sm:table-cell">
                    Wertstellung
                  </TableHead>
                  <TableHead>Buchungstext</TableHead>
                  <TableHead className="w-[120px] text-right">Betrag</TableHead>
                  <TableHead className="w-[120px] text-right hidden md:table-cell">
                    Saldo
                  </TableHead>
                  <TableHead className="w-[100px] text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => {
                  if (tx.isRemoved) {
                    return (
                      <TableRow
                        key={tx.id}
                        className="opacity-40 line-through"
                      >
                        <TableCell colSpan={5} className="text-muted-foreground">
                          {formatDate(tx.booking_date)} - {tx.description} -{" "}
                          {formatCurrency(tx.amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleRemove(tx.id)}
                            aria-label="Buchung wiederherstellen"
                          >
                            <Undo2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  }

                  const isEditing = editingId === tx.id

                  return (
                    <TableRow
                      key={tx.id}
                      className={cn(
                        tx.isDuplicate &&
                          "bg-orange-50 dark:bg-orange-950/20"
                      )}
                    >
                      <TableCell className="font-mono text-sm">
                        {formatDate(tx.booking_date)}
                      </TableCell>
                      <TableCell className="font-mono text-sm hidden sm:table-cell">
                        {formatDate(tx.value_date)}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={editValues.description}
                            onChange={(e) =>
                              setEditValues((prev) => ({
                                ...prev,
                                description: e.target.value,
                              }))
                            }
                            className="h-8"
                            aria-label="Buchungstext bearbeiten"
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-sm line-clamp-2">
                              {tx.description}
                            </span>
                            {tx.isDuplicate && (
                              <Badge
                                variant="outline"
                                className="shrink-0 border-orange-400 text-orange-600 text-xs"
                              >
                                Duplikat?
                              </Badge>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {isEditing ? (
                          <Input
                            value={editValues.amount}
                            onChange={(e) =>
                              setEditValues((prev) => ({
                                ...prev,
                                amount: e.target.value,
                              }))
                            }
                            className="h-8 text-right"
                            aria-label="Betrag bearbeiten"
                          />
                        ) : (
                          <span
                            className={cn(
                              "text-sm font-medium",
                              tx.amount >= 0
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            )}
                          >
                            {formatCurrency(tx.amount)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm hidden md:table-cell">
                        {formatCurrency(tx.balance_after)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {isEditing ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => saveEdit(tx.id)}
                                aria-label="Änderungen speichern"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={cancelEdit}
                                aria-label="Bearbeitung abbrechen"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => startEdit(tx)}
                                aria-label="Buchung bearbeiten"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => toggleRemove(tx.id)}
                                className="text-destructive hover:text-destructive"
                                aria-label="Buchung entfernen"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-col gap-3 sm:flex-row sm:justify-end">
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
          disabled={isSaving || activeTransactions.length === 0}
          aria-label="Buchungen speichern"
        >
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {activeTransactions.length} Buchungen speichern
        </Button>
      </CardFooter>
    </Card>
  )
}
