"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, ArrowUpDown, ArrowUp, ArrowDown, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InlineEditField } from "@/components/inline-edit-field"
import type { Transaction, EditableTransactionField } from "@/lib/types"

interface TransactionTableProps {
  transactions: Transaction[]
  isLoading: boolean
  error: string | null
  page: number
  totalPages: number
  sortBy: string
  sortDir: string
  canEdit: boolean
  onSort: (field: string) => void
  onPageChange: (page: number) => void
  onUpdateTransaction?: (id: string, field: EditableTransactionField, value: string) => Promise<void>
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

function SortIcon({
  field,
  currentSort,
  currentDir,
}: {
  field: string
  currentSort: string
  currentDir: string
}) {
  if (currentSort !== field) {
    return <ArrowUpDown className="ml-1 inline h-3 w-3 text-muted-foreground" />
  }
  return currentDir === "asc" ? (
    <ArrowUp className="ml-1 inline h-3 w-3" />
  ) : (
    <ArrowDown className="ml-1 inline h-3 w-3" />
  )
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-48" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell className="hidden xl:table-cell"><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell className="hidden xl:table-cell"><Skeleton className="h-4 w-16" /></TableCell>
        </TableRow>
      ))}
    </>
  )
}

export function TransactionTable({
  transactions,
  isLoading,
  error,
  page,
  totalPages,
  sortBy,
  sortDir,
  canEdit,
  onSort,
  onPageChange,
  onUpdateTransaction,
}: TransactionTableProps) {
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  const handleFieldSave = async (
    transactionId: string,
    field: EditableTransactionField,
    newValue: string
  ) => {
    if (onUpdateTransaction) {
      await onUpdateTransaction(transactionId, field, newValue)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-3 h-8 font-medium"
                    onClick={() => onSort("booking_date")}
                    aria-label="Nach Datum sortieren"
                  >
                    Datum
                    <SortIcon field="booking_date" currentSort={sortBy} currentDir={sortDir} />
                  </Button>
                </TableHead>
                <TableHead className="min-w-[200px]">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-3 h-8 font-medium"
                    onClick={() => onSort("description")}
                    aria-label="Nach Buchungstext sortieren"
                  >
                    Buchungstext
                    <SortIcon field="description" currentSort={sortBy} currentDir={sortDir} />
                  </Button>
                </TableHead>
                <TableHead className="w-[120px] text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-mr-3 ml-auto h-8 font-medium"
                    onClick={() => onSort("amount")}
                    aria-label="Nach Betrag sortieren"
                  >
                    Einnahme
                    <SortIcon field="amount" currentSort={sortBy} currentDir={sortDir} />
                  </Button>
                </TableHead>
                <TableHead className="w-[120px] text-right">Ausgabe</TableHead>
                <TableHead className="w-[120px] text-right">Saldo</TableHead>
                <TableHead className="hidden w-[180px] lg:table-cell">Bemerkung</TableHead>
                <TableHead className="hidden w-[120px] xl:table-cell">Beleg-Ref.</TableHead>
                <TableHead className="hidden w-[100px] xl:table-cell">
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" aria-hidden="true" />
                    Auszug
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <SkeletonRows />
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-32 text-center text-muted-foreground"
                  >
                    Keine Buchungen gefunden. Passen Sie die Filter an oder importieren Sie Kontoauszüge.
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((t) => {
                  const amount = Number(t.amount)
                  const isIncome = amount > 0

                  return (
                    <TableRow key={t.id}>
                      {/* Datum - schreibgeschützt */}
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDate(t.booking_date)}
                      </TableCell>

                      {/* Buchungstext - editierbar */}
                      <TableCell className="max-w-[300px] text-sm">
                        <InlineEditField
                          value={t.description}
                          onSave={(val) => handleFieldSave(t.id, "description", val)}
                          canEdit={canEdit}
                          maxLength={500}
                          required
                          label="Buchungstext"
                          placeholder="Buchungstext eingeben"
                        />
                      </TableCell>

                      {/* Einnahme - schreibgeschützt */}
                      <TableCell className="whitespace-nowrap text-right text-sm">
                        {isIncome ? (
                          <span className="font-medium text-green-600">
                            {formatCurrency(amount)}
                          </span>
                        ) : null}
                      </TableCell>

                      {/* Ausgabe - schreibgeschützt */}
                      <TableCell className="whitespace-nowrap text-right text-sm">
                        {!isIncome ? (
                          <span className="font-medium text-red-600">
                            {formatCurrency(Math.abs(amount))}
                          </span>
                        ) : null}
                      </TableCell>

                      {/* Saldo - schreibgeschützt */}
                      <TableCell className="whitespace-nowrap text-right text-sm font-medium">
                        {formatCurrency(Number(t.balance_after))}
                      </TableCell>

                      {/* Bemerkung - editierbar (Textarea) */}
                      <TableCell className="hidden max-w-[180px] lg:table-cell">
                        <InlineEditField
                          value={t.note || ""}
                          onSave={(val) => handleFieldSave(t.id, "note", val)}
                          canEdit={canEdit}
                          multiline
                          maxLength={1000}
                          label="Bemerkung"
                          placeholder="Bemerkung hinzufügen"
                        />
                      </TableCell>

                      {/* Beleg-Referenz - editierbar */}
                      <TableCell className="hidden max-w-[120px] xl:table-cell">
                        <InlineEditField
                          value={t.document_ref || ""}
                          onSave={(val) => handleFieldSave(t.id, "document_ref", val)}
                          canEdit={canEdit}
                          maxLength={255}
                          label="Beleg-Referenz"
                          placeholder="Beleg-Ref."
                        />
                      </TableCell>

                      {/* Kontoauszug-Referenz - editierbar */}
                      <TableCell className="hidden max-w-[120px] xl:table-cell">
                        <InlineEditField
                          value={t.statement_ref || ""}
                          onSave={(val) => handleFieldSave(t.id, "statement_ref", val)}
                          canEdit={canEdit}
                          maxLength={255}
                          label="Kontoauszug-Referenz"
                          placeholder={t.bank_statements?.statement_number || "Auszug-Ref."}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && !isLoading && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Seite {page} von {totalPages}
          </p>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    if (page > 1) onPageChange(page - 1)
                  }}
                  aria-disabled={page <= 1}
                  className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                  aria-label="Vorherige Seite"
                />
              </PaginationItem>

              {generatePageNumbers(page, totalPages).map((p, idx) =>
                p === "..." ? (
                  <PaginationItem key={`ellipsis-${idx}`}>
                    <span className="px-2 text-muted-foreground">...</span>
                  </PaginationItem>
                ) : (
                  <PaginationItem key={p}>
                    <PaginationLink
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        onPageChange(p as number)
                      }}
                      isActive={page === p}
                      aria-label={`Seite ${p}`}
                    >
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                )
              )}

              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    if (page < totalPages) onPageChange(page + 1)
                  }}
                  aria-disabled={page >= totalPages}
                  className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
                  aria-label="Nächste Seite"
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  )
}

function generatePageNumbers(
  current: number,
  total: number
): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const pages: (number | "...")[] = [1]

  if (current > 3) {
    pages.push("...")
  }

  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  if (current < total - 2) {
    pages.push("...")
  }

  pages.push(total)

  return pages
}
