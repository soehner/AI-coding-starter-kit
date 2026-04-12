"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { useDebounce } from "@/hooks/use-debounce"
import { KpiCards } from "@/components/kpi-cards"
import { TransactionFilterBar } from "@/components/transaction-filter-bar"
import { TransactionTable } from "@/components/transaction-table"
import { KassenbuchExportButton } from "@/components/kassenbuch-export-button"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { toast } from "sonner"
import type {
  TransactionSummary,
  Transaction,
  EditableTransactionField,
} from "@/lib/types"

export default function DashboardPage() {
  const { profile, isLoading: authLoading, error: authError, isAdmin, hasPermission } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Seafile-Status
  const [seafileConfigured, setSeafileConfigured] = useState(false)

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
    })
  }, [year, month, debouncedSearch, page, sortBy, sortDir, updateUrl])

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

  // Summary laden
  useEffect(() => {
    if (authLoading) return

    const fetchSummary = async () => {
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
        setSummaryError(
          err instanceof Error ? err.message : "Unbekannter Fehler"
        )
      } finally {
        setSummaryLoading(false)
      }
    }

    fetchSummary()
  }, [year, month, debouncedSearch, authLoading])

  // Transaktionen laden
  useEffect(() => {
    if (authLoading) return

    const fetchTransactions = async () => {
      setTableLoading(true)
      setTableError(null)

      try {
        const params = new URLSearchParams()
        if (year !== "all") params.set("year", year)
        if (month !== "all") params.set("month", month)
        if (debouncedSearch) params.set("search", debouncedSearch)
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
    }

    fetchTransactions()
  }, [year, month, debouncedSearch, page, sortBy, sortDir, authLoading])

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

  // PROJ-9: Handler für Beleg-Upload - aktualisiert document_ref lokal
  const handleDocumentUploaded = useCallback(
    (transactionId: string, documentRef: string) => {
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === transactionId ? { ...t, document_ref: documentRef } : t
        )
      )
      toast.success("Beleg hochgeladen")
    },
    []
  )

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex-1">
          <TransactionFilterBar
            availableYears={summary?.availableYears ?? []}
            selectedYear={year}
            selectedMonth={month}
            searchValue={search}
            onYearChange={handleYearChange}
            onMonthChange={handleMonthChange}
            onSearchChange={handleSearchChange}
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
        onSort={handleSort}
        onPageChange={handlePageChange}
        onUpdateTransaction={handleUpdateTransaction}
        onDocumentUploaded={handleDocumentUploaded}
      />
    </div>
  )
}
