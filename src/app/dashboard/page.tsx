"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { useDebounce } from "@/hooks/use-debounce"
import { useCategories, setCategoriesForTransaction } from "@/hooks/use-categories"
import { KpiCards } from "@/components/kpi-cards"
import { TransactionFilterBar } from "@/components/transaction-filter-bar"
import { TransactionTable } from "@/components/transaction-table"
import { KassenbuchExportButton } from "@/components/kassenbuch-export-button"
import { BulkKategorisierungDialog } from "@/components/bulk-kategorisierung-dialog"
import { EingeschraenkteBetrachterBanner } from "@/components/eingeschraenkte-betrachter-banner"
import { Psd2ConsentBanner } from "@/components/psd2-consent-banner"
import { TransactionAbgleichDialog } from "@/components/transaction-abgleich-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertCircle, Tags, X } from "lucide-react"
import { toast } from "sonner"
import type {
  TransactionSummary,
  Transaction,
  TransactionDocument,
  Category,
  EditableTransactionField,
  TransactionUpdateFields,
} from "@/lib/types"

export default function DashboardPage() {
  const { profile, isLoading: authLoading, error: authError, isAdmin, hasPermission } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Seafile-Status
  const [seafileConfigured, setSeafileConfigured] = useState(false)

  // PROJ-14: Kategorie-Einschränkung des aktuellen Benutzers
  const [categoryAccess, setCategoryAccess] = useState<{
    restricted: boolean
    allowedCategories: Category[]
  } | null>(null)

  // Filter-State aus URL-Parametern initialisieren
  const [year, setYear] = useState(searchParams.get("year") || "all")
  const [month, setMonth] = useState(searchParams.get("month") || "all")
  const [search, setSearch] = useState(searchParams.get("search") || "")
  const [page, setPage] = useState(
    parseInt(searchParams.get("page") || "1", 10)
  )
  const [sortBy, setSortBy] = useState(
    searchParams.get("sort") || "booking_date"
  )
  const [sortDir, setSortDir] = useState(
    searchParams.get("dir") || "desc"
  )

  const debouncedSearch = useDebounce(search, 300)

  // PROJ-12: Kategorie-Filter, Auswahl, Bulk-Dialog
  const [categoryFilter, setCategoryFilter] = useState<string[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const allCategories = useCategories()

  // PROJ-16: Abgleich-Filter & Dialog
  const [onlyUnconfirmed, setOnlyUnconfirmed] = useState(
    searchParams.get("only_unconfirmed") === "true"
  )
  const [abgleichTransaction, setAbgleichTransaction] =
    useState<Transaction | null>(null)
  const [abgleichDialogOpen, setAbgleichDialogOpen] = useState(false)

  // Daten-State
  const [summary, setSummary] = useState<TransactionSummary | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [totalPages, setTotalPages] = useState(0)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [tableLoading, setTableLoading] = useState(true)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [tableError, setTableError] = useState<string | null>(null)

  // URL-Parameter synchronisieren
  const updateUrl = useCallback(
    (params: Record<string, string>) => {
      const newParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value && value !== "all" && value !== "booking_date" && value !== "desc" && value !== "1") {
          // Standardwerte nicht in URL schreiben
          if (key === "sort" && value === "booking_date") return
          if (key === "dir" && value === "desc") return
          if (key === "page" && value === "1") return
          newParams.set(key, value)
        }
      })
      const paramString = newParams.toString()
      router.replace(`/dashboard${paramString ? `?${paramString}` : ""}`, {
        scroll: false,
      })
    },
    [router]
  )

  // URL aktualisieren wenn sich Filter ändern
  useEffect(() => {
    updateUrl({
      year,
      month,
      search: debouncedSearch,
      page: page.toString(),
      sort: sortBy,
      dir: sortDir,
      only_unconfirmed: onlyUnconfirmed ? "true" : "",
    })
  }, [
    year,
    month,
    debouncedSearch,
    page,
    sortBy,
    sortDir,
    onlyUnconfirmed,
    updateUrl,
  ])

  // PROJ-14: Kategorie-Einschränkung des eingeloggten Benutzers laden
  // (nur für Betrachter relevant – Admins erhalten vom Backend restricted: false)
  useEffect(() => {
    if (authLoading || !profile) return
    if (isAdmin) {
      setCategoryAccess({ restricted: false, allowedCategories: [] })
      return
    }

    const loadAccess = async () => {
      try {
        const res = await fetch("/api/me/category-access", {
          credentials: "include",
        })
        if (!res.ok) {
          setCategoryAccess({ restricted: false, allowedCategories: [] })
          return
        }
        const data = await res.json()
        setCategoryAccess({
          restricted: !!data.restricted,
          allowedCategories: Array.isArray(data.allowedCategories)
            ? (data.allowedCategories as Category[])
            : [],
        })
      } catch {
        // Bei Fehlern keinen Banner anzeigen – Fallback: keine Einschränkung
        setCategoryAccess({ restricted: false, allowedCategories: [] })
      }
    }

    loadAccess()
  }, [authLoading, profile, isAdmin])

  // Seafile-Konfiguration prüfen (nur für Admins/Editoren)
  useEffect(() => {
    if (authLoading || !hasPermission("edit_transactions")) return

    const checkSeafile = async () => {
      try {
        const res = await fetch("/api/admin/settings")
        if (res.ok) {
          const data = await res.json()
          setSeafileConfigured(
            !!(data.seafile_url && data.hasSeafileToken && data.seafile_repo_id)
          )
        }
      } catch {
        // Seafile-Status bleibt false
      }
    }

    checkSeafile()
  }, [authLoading, hasPermission])

  // Summary-Fetcher als useCallback, damit er auch aus Event-Handlern
  // (Multi-Field-Edit) aufgerufen werden kann.
  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true)
    setSummaryError(null)

    try {
      const params = new URLSearchParams()
      if (year !== "all") params.set("year", year)
      if (month !== "all") params.set("month", month)
      if (debouncedSearch) params.set("search", debouncedSearch)

      const res = await fetch(`/api/transactions/summary?${params}`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Fehler beim Laden der Zusammenfassung")
      }
      const data: TransactionSummary = await res.json()
      setSummary(data)
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : "Unbekannter Fehler")
    } finally {
      setSummaryLoading(false)
    }
  }, [year, month, debouncedSearch])

  // Summary laden
  useEffect(() => {
    if (authLoading) return
    fetchSummary()
  }, [authLoading, fetchSummary])

  // Transaktionen laden – extrahiert als useCallback, damit es auch manuell
  // (z. B. nach einer Bulk-Kategorisierung) neu ausgelöst werden kann.
  const fetchTransactions = useCallback(async () => {
    setTableLoading(true)
    setTableError(null)

    try {
      const params = new URLSearchParams()
      if (year !== "all") params.set("year", year)
      if (month !== "all") params.set("month", month)
      if (debouncedSearch) params.set("search", debouncedSearch)
      if (categoryFilter.length > 0) {
        params.set("categories", categoryFilter.join(","))
      }
      if (onlyUnconfirmed) {
        params.set("only_unconfirmed", "true")
      }
      params.set("page", page.toString())
      params.set("sort", sortBy)
      params.set("dir", sortDir)

      const res = await fetch(`/api/transactions?${params}`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Fehler beim Laden der Buchungen")
      }
      const data = await res.json()
      setTransactions(data.transactions)
      setTotalPages(data.totalPages)
    } catch (err) {
      setTableError(
        err instanceof Error ? err.message : "Unbekannter Fehler"
      )
    } finally {
      setTableLoading(false)
    }
  }, [year, month, debouncedSearch, categoryFilter, onlyUnconfirmed, page, sortBy, sortDir])

  useEffect(() => {
    if (authLoading) return
    fetchTransactions()
  }, [authLoading, fetchTransactions])

  // PROJ-5: Optimistic Update für Inline-Bearbeitung
  const handleUpdateTransaction = useCallback(
    async (id: string, field: EditableTransactionField, value: string) => {
      // Alten Wert merken für Rollback
      const oldTransactions = [...transactions]
      const transactionIndex = transactions.findIndex((t) => t.id === id)
      if (transactionIndex === -1) return

      // Optimistic Update
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, [field]: value || null } : t
        )
      )

      try {
        const res = await fetch(`/api/transactions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || "Fehler beim Speichern")
        }

        // Erfolgreich - aktualisierte Daten vom Server übernehmen
        const updated: Transaction = await res.json()
        setTransactions((prev) =>
          prev.map((t) => (t.id === id ? updated : t))
        )

        toast.success("Gespeichert")
      } catch (err) {
        // Rollback auf alten Wert
        setTransactions(oldTransactions)

        const message =
          err instanceof Error ? err.message : "Fehler beim Speichern"
        toast.error(message)

        // Fehler weiterwerfen, damit InlineEditField im Bearbeitungsmodus bleibt
        throw err
      }
    },
    [transactions]
  )

  // Multi-Field-Update aus dem Bearbeiten-Dialog
  const handleUpdateTransactionMulti = useCallback(
    async (id: string, updates: TransactionUpdateFields) => {
      const res = await fetch(`/api/transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Fehler beim Speichern der Buchung")
      }

      const updated: Transaction = await res.json()
      setTransactions((prev) =>
        prev.map((t) => (t.id === id ? updated : t))
      )

      // Summen (Saldo, Einnahmen, Ausgaben) im Header nach Betragsänderung
      // aktualisieren
      fetchSummary()

      toast.success("Buchung gespeichert")
    },
    [fetchSummary]
  )

  // Inline-Kategorie-Update: setzt Kategorien einer Buchung direkt aus der
  // Tabellen-Zelle, optimistisch mit Rollback bei Fehlern.
  const handleUpdateCategories = useCallback(
    async (id: string, categoryIds: string[]) => {
      const previous = transactions.find((t) => t.id === id)?.categories ?? []

      const nextCategories: Category[] = categoryIds
        .map((cid) => allCategories.find((c) => c.id === cid))
        .filter((c): c is Category => c !== undefined)

      // Optimistic Update
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, categories: nextCategories } : t
        )
      )

      try {
        await setCategoriesForTransaction(id, categoryIds)
        toast.success("Kategorien gespeichert")
      } catch (err) {
        // Rollback
        setTransactions((prev) =>
          prev.map((t) => (t.id === id ? { ...t, categories: previous } : t))
        )
        toast.error(
          err instanceof Error ? err.message : "Fehler beim Speichern"
        )
        throw err
      }
    },
    [transactions, allCategories]
  )

  // Handler für Beleg-Änderungen - aktualisiert documents-Array lokal
  const handleDocumentsChanged = useCallback(
    (transactionId: string, documents: TransactionDocument[]) => {
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === transactionId ? { ...t, documents } : t
        )
      )
    },
    []
  )

  // PROJ-12: Selection-Handler
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAllOnPage = useCallback(
    (ids: string[], select: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (select) {
          ids.forEach((id) => next.add(id))
        } else {
          ids.forEach((id) => next.delete(id))
        }
        return next
      })
    },
    []
  )

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  // Filter-Handler
  const handleYearChange = (value: string) => {
    setYear(value)
    setPage(1)
  }

  const handleMonthChange = (value: string) => {
    setMonth(value)
    // Monat-Filter benötigt ein Jahr – automatisch das aktuellste wählen
    if (value !== "all" && year === "all" && summary?.availableYears?.[0]) {
      setYear(summary.availableYears[0])
    }
    setPage(1)
  }

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortBy(field)
      setSortDir(field === "booking_date" ? "desc" : "asc")
    }
    setPage(1)
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  // Auth-Ladezustand
  if (authLoading) {
    return (
      <div className="container px-4 py-8 md:px-6">
        <Skeleton className="mb-6 h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    )
  }

  // Auth-Fehler
  if (authError) {
    return (
      <div className="container px-4 py-8 md:px-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{authError}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container space-y-6 px-4 py-8 md:px-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Kassenbuch</h2>
        <p className="text-muted-foreground">
          Übersicht aller Bankbewegungen
          {profile?.email ? ` - ${profile.email}` : ""}
        </p>
      </div>

      {/* PROJ-16: Warnbanner bei bald ablaufender PSD2-Zustimmung (nur Admins) */}
      <Psd2ConsentBanner />

      {/* PROJ-14: Hinweisbanner für eingeschränkte Betrachter */}
      {categoryAccess?.restricted && (
        <EingeschraenkteBetrachterBanner
          allowedCategories={categoryAccess.allowedCategories}
        />
      )}

      {/* KPI-Karten */}
      {summaryError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{summaryError}</AlertDescription>
        </Alert>
      ) : (
        <KpiCards
          currentBalance={summary?.currentBalance ?? 0}
          totalIncome={summary?.totalIncome ?? 0}
          totalExpenses={summary?.totalExpenses ?? 0}
          isLoading={summaryLoading}
        />
      )}

      {/* Filter-Leiste + Export */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex-1">
          <TransactionFilterBar
            availableYears={summary?.availableYears ?? []}
            selectedYear={year}
            selectedMonth={month}
            searchValue={search}
            allCategories={allCategories}
            selectedCategoryFilter={categoryFilter}
            onlyUnconfirmed={onlyUnconfirmed}
            showUnconfirmedToggle
            onYearChange={handleYearChange}
            onMonthChange={handleMonthChange}
            onSearchChange={handleSearchChange}
            onCategoryFilterChange={(v) => {
              setCategoryFilter(v)
              setPage(1)
            }}
            onOnlyUnconfirmedChange={(value) => {
              setOnlyUnconfirmed(value)
              setPage(1)
            }}
          />
        </div>
        {hasPermission("export_excel") && (
          <KassenbuchExportButton
            year={year}
            month={month}
            search={debouncedSearch}
          />
        )}
      </div>

      {/* PROJ-12: Sticky Massenaktions-Leiste */}
      {hasPermission("edit_transactions") && selectedIds.size > 0 && (
        <div className="sticky top-16 z-20 flex flex-wrap items-center gap-3 rounded-md border border-primary/40 bg-primary/5 px-4 py-2 shadow-sm backdrop-blur">
          <span className="text-sm font-medium">
            {selectedIds.size} Buchung{selectedIds.size === 1 ? "" : "en"} ausgewählt
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setBulkDialogOpen(true)}>
              <Tags className="mr-1.5 h-4 w-4" />
              Kategorie zuweisen
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={clearSelection}
              aria-label="Auswahl aufheben"
            >
              <X className="mr-1.5 h-4 w-4" />
              Auswahl aufheben
            </Button>
          </div>
        </div>
      )}

      {/* Buchungs-Tabelle */}
      <TransactionTable
        transactions={transactions}
        isLoading={tableLoading}
        error={tableError}
        page={page}
        totalPages={totalPages}
        sortBy={sortBy}
        sortDir={sortDir}
        canEdit={hasPermission("edit_transactions")}
        seafileConfigured={seafileConfigured}
        selectedIds={selectedIds}
        onSort={handleSort}
        onPageChange={handlePageChange}
        onToggleSelect={toggleSelect}
        onToggleSelectAllOnPage={toggleSelectAllOnPage}
        onUpdateTransaction={handleUpdateTransaction}
        onUpdateTransactionMulti={handleUpdateTransactionMulti}
        onUpdateCategories={
          hasPermission("edit_transactions") ? handleUpdateCategories : undefined
        }
        onDocumentsChanged={handleDocumentsChanged}
        onAbgleichOpen={(tx) => {
          setAbgleichTransaction(tx)
          setAbgleichDialogOpen(true)
        }}
        allCategories={allCategories}
      />

      {/* PROJ-16: Abgleich-Dialog für Vorschläge/Konflikte */}
      <TransactionAbgleichDialog
        open={abgleichDialogOpen}
        onOpenChange={setAbgleichDialogOpen}
        transaction={abgleichTransaction}
        allTransactions={transactions}
        onDecided={() => {
          fetchTransactions()
          fetchSummary()
        }}
      />

      {/* PROJ-12: Bulk-Kategorisierung Dialog */}
      <BulkKategorisierungDialog
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        selectedTransactionIds={Array.from(selectedIds)}
        onDone={() => {
          clearSelection()
          // BUG-002 Fix: Tabelle nach Bulk-Aktion neu laden, damit die
          // aktualisierten Kategorie-Badges erscheinen.
          fetchTransactions()
        }}
      />
    </div>
  )
}
