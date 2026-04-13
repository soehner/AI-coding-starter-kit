"use client"

import { useState, useCallback } from "react"
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  AlertCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileText,
  Upload,
  ExternalLink,
  Paperclip,
  Pencil,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { InlineEditField } from "@/components/inline-edit-field"
import { InlineCategoryEdit } from "@/components/inline-category-edit"
import { BelegUploadDialog } from "@/components/beleg-upload-dialog"
import { EditTransactionDialog } from "@/components/edit-transaction-dialog"
import { CategoryBadge } from "@/components/category-badge"
import { TransactionQuelleBadge } from "@/components/transaction-quelle-badge"
import { isValidSeafileLink } from "@/lib/seafile-link"
import type {
  Transaction,
  Category,
  EditableTransactionField,
  TransactionUpdateFields,
} from "@/lib/types"

interface TransactionTableProps {
  transactions: Transaction[]
  isLoading: boolean
  error: string | null
  page: number
  totalPages: number
  sortBy: string
  sortDir: string
  canEdit: boolean
  seafileConfigured?: boolean
  selectedIds: Set<string>
  onSort: (field: string) => void
  onPageChange: (page: number) => void
  onToggleSelect: (id: string) => void
  onToggleSelectAllOnPage: (ids: string[], select: boolean) => void
  onUpdateTransaction?: (id: string, field: EditableTransactionField, value: string) => Promise<void>
  onUpdateTransactionMulti?: (id: string, updates: TransactionUpdateFields) => Promise<void>
  onUpdateCategories?: (id: string, categoryIds: string[]) => Promise<void>
  onDocumentUploaded?: (transactionId: string, documentRef: string) => void
  /** PROJ-16: Wird aufgerufen, wenn der Benutzer auf ein Status-Badge klickt. */
  onAbgleichOpen?: (transaction: Transaction) => void
  allCategories?: Category[]
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

function SkeletonRows({ showCheckbox }: { showCheckbox: boolean }) {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableRow key={i}>
          {showCheckbox && <TableCell><Skeleton className="h-4 w-4" /></TableCell>}
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-48" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
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
  seafileConfigured = false,
  selectedIds,
  onSort,
  onPageChange,
  onToggleSelect,
  onToggleSelectAllOnPage,
  onUpdateTransaction,
  onUpdateTransactionMulti,
  onUpdateCategories,
  onDocumentUploaded,
  onAbgleichOpen,
  allCategories = [],
}: TransactionTableProps) {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [uploadTransaction, setUploadTransaction] = useState<Transaction | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null)

  const showSelectionColumn = canEdit

  const visibleIds = transactions.map((t) => t.id)
  const selectedOnPage = visibleIds.filter((id) => selectedIds.has(id)).length
  const headerCheckboxState: boolean | "indeterminate" =
    selectedOnPage === 0
      ? false
      : selectedOnPage === visibleIds.length
        ? true
        : "indeterminate"

  const handleOpenUploadDialog = useCallback((transaction: Transaction) => {
    setUploadTransaction(transaction)
    setUploadDialogOpen(true)
  }, [])

  const handleOpenEditDialog = useCallback((transaction: Transaction) => {
    setEditTransaction(transaction)
    setEditDialogOpen(true)
  }, [])

  const handleEditSave = useCallback(
    async (id: string, updates: TransactionUpdateFields) => {
      if (!onUpdateTransactionMulti) {
        throw new Error("Bearbeitung ist nicht verfügbar.")
      }
      await onUpdateTransactionMulti(id, updates)
    },
    [onUpdateTransactionMulti]
  )

  const handleUploadComplete = useCallback(
    (documentRef: string) => {
      if (uploadTransaction && onDocumentUploaded) {
        onDocumentUploaded(uploadTransaction.id, documentRef)
      }
    },
    [uploadTransaction, onDocumentUploaded]
  )

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
                {showSelectionColumn && (
                  <TableHead className="w-[44px]">
                    <Checkbox
                      checked={headerCheckboxState}
                      onCheckedChange={(value) =>
                        onToggleSelectAllOnPage(visibleIds, value === true)
                      }
                      aria-label="Alle Buchungen auf dieser Seite auswählen"
                    />
                  </TableHead>
                )}
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
                <TableHead className="w-[110px]">Quelle</TableHead>
                <TableHead className="w-[180px]">Kategorien</TableHead>
                <TableHead className="hidden w-[180px] lg:table-cell">Bemerkung</TableHead>
                <TableHead className="hidden w-[120px] xl:table-cell">Beleg</TableHead>
                <TableHead className="hidden w-[100px] xl:table-cell">
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" aria-hidden="true" />
                    Auszug
                  </span>
                </TableHead>
                {canEdit && (
                  <TableHead className="w-[60px] text-right">Aktion</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <SkeletonRows showCheckbox={showSelectionColumn} />
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={(showSelectionColumn ? 1 : 0) + (canEdit ? 11 : 10)}
                    className="h-32 text-center text-muted-foreground"
                  >
                    Keine Buchungen gefunden. Passen Sie die Filter an oder importieren Sie Kontoauszüge.
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((t) => {
                  const amount = Number(t.amount)
                  const isIncome = amount > 0
                  const isSelected = selectedIds.has(t.id)
                  const txCategories: Category[] = t.categories ?? []

                  return (
                    <TableRow key={t.id} data-state={isSelected ? "selected" : undefined}>
                      {showSelectionColumn && (
                        <TableCell className="w-[44px]">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => onToggleSelect(t.id)}
                            aria-label={`Buchung vom ${formatDate(t.booking_date)} auswählen`}
                          />
                        </TableCell>
                      )}
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

                      {/* PROJ-16: Herkunft/Abgleich-Status */}
                      <TableCell className="whitespace-nowrap">
                        <TransactionQuelleBadge
                          transaction={t}
                          onClick={
                            onAbgleichOpen &&
                            (t.status === "vorschlag" || t.status === "konflikt")
                              ? () => onAbgleichOpen(t)
                              : undefined
                          }
                        />
                      </TableCell>

                      {/* Kategorien - PROJ-12 (inline editierbar) */}
                      <TableCell className="max-w-[180px]">
                        {onUpdateCategories ? (
                          <InlineCategoryEdit
                            transactionId={t.id}
                            categories={txCategories}
                            allCategories={allCategories}
                            canEdit={canEdit}
                            onSave={onUpdateCategories}
                          />
                        ) : txCategories.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {txCategories.map((cat) => (
                              <CategoryBadge key={cat.id} category={cat} />
                            ))}
                          </div>
                        )}
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

                      {/* Beleg - Upload/Anschauen */}
                      <TableCell className="hidden max-w-[120px] xl:table-cell">
                        <TooltipProvider>
                          <div className="flex items-center gap-1">
                            {isValidSeafileLink(t.document_ref) ? (
                              <>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <a
                                      href={t.document_ref}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      aria-label="Beleg anschauen"
                                      className="inline-flex"
                                    >
                                      <Badge
                                        variant="secondary"
                                        className="cursor-pointer gap-1 hover:bg-secondary/80"
                                      >
                                        <Paperclip className="h-3 w-3" />
                                        Beleg
                                        <ExternalLink className="h-3 w-3" />
                                      </Badge>
                                    </a>
                                  </TooltipTrigger>
                                  <TooltipContent>Beleg in Seafile öffnen</TooltipContent>
                                </Tooltip>
                                {canEdit && seafileConfigured && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => handleOpenUploadDialog(t)}
                                        aria-label="Beleg ersetzen"
                                      >
                                        <Upload className="h-3 w-3" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Beleg ersetzen</TooltipContent>
                                  </Tooltip>
                                )}
                              </>
                            ) : canEdit && seafileConfigured ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                                    onClick={() => handleOpenUploadDialog(t)}
                                    aria-label="Beleg hochladen"
                                  >
                                    <Upload className="h-3 w-3" />
                                    Hochladen
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Beleg zu Seafile hochladen</TooltipContent>
                              </Tooltip>
                            ) : !seafileConfigured && canEdit ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-xs text-muted-foreground">
                                    —
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Bitte Seafile in den Einstellungen konfigurieren
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            )}
                          </div>
                        </TooltipProvider>
                      </TableCell>

                      {/* Kontoauszug-Referenz */}
                      <TableCell className="hidden max-w-[120px] xl:table-cell">
                        {isValidSeafileLink(t.bank_statements?.file_path) ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <a
                                  href={t.bank_statements!.file_path!}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label="Kontoauszug anschauen"
                                  className="inline-flex"
                                >
                                  <Badge
                                    variant="outline"
                                    className="cursor-pointer gap-1 hover:bg-muted"
                                  >
                                    <FileText className="h-3 w-3" />
                                    {t.bank_statements?.statement_number || t.statement_ref || "PDF"}
                                    <ExternalLink className="h-3 w-3" />
                                  </Badge>
                                </a>
                              </TooltipTrigger>
                              <TooltipContent>Kontoauszug in Seafile öffnen</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : t.bank_statements?.statement_number ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="gap-1 opacity-60">
                                  <FileText className="h-3 w-3" />
                                  {t.bank_statements.statement_number}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                Kontoauszug-Datei nicht in Seafile verfügbar
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <InlineEditField
                            value={t.statement_ref || ""}
                            onSave={(val) => handleFieldSave(t.id, "statement_ref", val)}
                            canEdit={canEdit}
                            maxLength={255}
                            label="Kontoauszug-Referenz"
                            placeholder="Auszug-Ref."
                          />
                        )}
                      </TableCell>

                      {/* Aktion — Edit-Dialog öffnen */}
                      {canEdit && (
                        <TableCell className="text-right">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleOpenEditDialog(t)}
                                  aria-label={`Buchung vom ${formatDate(t.booking_date)} bearbeiten`}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Buchung bearbeiten</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                      )}
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

      {/* Beleg-Upload-Dialog */}
      {uploadTransaction && (
        <BelegUploadDialog
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          transactionId={uploadTransaction.id}
          transactionDescription={uploadTransaction.description}
          hasExistingDocument={!!uploadTransaction.document_ref}
          onUploadComplete={handleUploadComplete}
        />
      )}

      {/* Buchung-Bearbeiten-Dialog */}
      <EditTransactionDialog
        transaction={editTransaction}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={handleEditSave}
      />
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
