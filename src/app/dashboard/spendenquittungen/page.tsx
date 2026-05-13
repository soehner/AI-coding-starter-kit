"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { useDebounce } from "@/hooks/use-debounce"
import { SpendenquittungenTabelle } from "@/components/spendenquittungen-tabelle"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Receipt, Search, X } from "lucide-react"
import type { Spender, Spendenquittung } from "@/lib/types"

type QuittungSpender = Pick<
  Spender,
  "id" | "name" | "strasse" | "plz" | "ort" | "email" | "iban"
>

type QuittungMitSpender = Spendenquittung & {
  spender: QuittungSpender | null
}

type VersandFilter = "alle" | "versendet" | "nicht_versendet"

interface VorstandKontakt {
  name: string
  email: string
}

/**
 * PROJ-17: Quittungs-Historie für Spendenquittungen.
 *
 * Admins sehen alle Quittungen mit Filtern (Jahr, Spendername, Versandstatus)
 * und können PDFs erneut herunterladen oder E-Mails (erneut) versenden.
 * Betrachter haben Lese-Zugriff (Backend regelt das via RLS).
 */
export default function SpendenquittungenPage() {
  const { profile, isLoading: authLoading, error: authError, isAdmin } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [jahr, setJahr] = useState(searchParams.get("jahr") ?? "alle")
  const [spenderSuche, setSpenderSuche] = useState(
    searchParams.get("spender_suche") ?? ""
  )
  const [versandStatus, setVersandStatus] = useState<VersandFilter>(
    (searchParams.get("versand_status") as VersandFilter) ?? "alle"
  )
  const [page, setPage] = useState(
    parseInt(searchParams.get("page") || "1", 10)
  )
  const debouncedSpenderSuche = useDebounce(spenderSuche, 300)

  const [quittungen, setQuittungen] = useState<QuittungMitSpender[]>([])
  const [totalPages, setTotalPages] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [vorstand, setVorstand] = useState<{
    erster: VorstandKontakt | null
    zweiter: VorstandKontakt | null
  }>({ erster: null, zweiter: null })

  // Vorstandsdaten aus den Settings laden (für CC-Versand)
  useEffect(() => {
    let aborted = false
    const ladeVorstand = async () => {
      try {
        const res = await fetch("/api/admin/settings")
        if (!res.ok) return
        const data = await res.json()
        const org = data.organisation ?? {}
        if (aborted) return
        setVorstand({
          erster: org.vorstand1_email
            ? {
                name: org.vorstand1_name || "1. Vorsitzender",
                email: org.vorstand1_email,
              }
            : null,
          zweiter: org.vorstand2_email
            ? {
                name: org.vorstand2_name || "2. Vorsitzender",
                email: org.vorstand2_email,
              }
            : null,
        })
      } catch {
        // CC-Versand ist optional – fehlende Daten sind nicht kritisch.
      }
    }
    if (isAdmin) ladeVorstand()
    return () => {
      aborted = true
    }
  }, [isAdmin])

  // URL synchronisieren
  const updateUrl = useCallback(
    (params: Record<string, string>) => {
      const newParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value && value !== "alle" && value !== "1" && value !== "") {
          newParams.set(key, value)
        }
      })
      const queryString = newParams.toString()
      router.replace(
        `/dashboard/spendenquittungen${queryString ? `?${queryString}` : ""}`,
        { scroll: false }
      )
    },
    [router]
  )

  useEffect(() => {
    updateUrl({
      jahr,
      spender_suche: debouncedSpenderSuche,
      versand_status: versandStatus,
      page: page.toString(),
    })
  }, [jahr, debouncedSpenderSuche, versandStatus, page, updateUrl])

  // Jahre aus den vorhandenen Quittungen ableiten
  const verfuegbareJahre = useMemo(() => {
    const jahre = new Set<string>()
    const aktuellesJahr = new Date().getFullYear()
    // Letzte 5 Jahre + aktuelles Jahr als Default-Auswahl
    for (let i = 0; i < 5; i++) {
      jahre.add(String(aktuellesJahr - i))
    }
    quittungen.forEach((q) => {
      const y = q.spende_datum.slice(0, 4)
      if (y) jahre.add(y)
    })
    return Array.from(jahre).sort((a, b) => b.localeCompare(a))
  }, [quittungen])

  const loadQuittungen = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (jahr !== "alle") params.set("jahr", jahr)
      if (debouncedSpenderSuche.trim()) {
        params.set("spender_suche", debouncedSpenderSuche.trim())
      }
      if (versandStatus !== "alle") {
        params.set("versand_status", versandStatus)
      }
      params.set("page", page.toString())

      const res = await fetch(`/api/admin/spendenquittungen?${params}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || "Quittungen konnten nicht geladen werden.")
        return
      }
      const data = await res.json()
      setQuittungen(data.spendenquittungen ?? [])
      setTotalPages(data.totalPages ?? 0)
    } catch {
      setError("Netzwerkfehler beim Laden der Quittungen.")
    } finally {
      setIsLoading(false)
    }
  }, [jahr, debouncedSpenderSuche, versandStatus, page])

  useEffect(() => {
    if (authLoading) return
    loadQuittungen()
  }, [authLoading, loadQuittungen])

  const handleResetFilter = () => {
    setJahr("alle")
    setSpenderSuche("")
    setVersandStatus("alle")
    setPage(1)
  }

  const hasFilter =
    jahr !== "alle" || spenderSuche.trim().length > 0 || versandStatus !== "alle"

  if (authLoading) {
    return (
      <div className="container px-4 py-8 md:px-6">
        <Skeleton className="mb-6 h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (authError || !profile) {
    return (
      <div className="container px-4 py-8 md:px-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {authError || "Bitte erneut anmelden."}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container space-y-6 px-4 py-8 md:px-6">
      <div className="flex items-start gap-3">
        <Receipt
          className="mt-1 h-6 w-6 text-primary"
          aria-hidden="true"
        />
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Spendenquittungen
          </h2>
          <p className="text-sm text-muted-foreground">
            Übersicht aller ausgestellten Zuwendungsbestätigungen.
            {isAdmin
              ? " Quittungen können erneut heruntergeladen oder per E-Mail versendet werden."
              : " Lesezugriff für Vorstand und Betrachter."}
          </p>
        </div>
      </div>

      {/* Filter-Leiste */}
      <div className="rounded-md border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[160px_1fr_200px_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="filter-jahr" className="text-xs">
              Jahr
            </Label>
            <Select
              value={jahr}
              onValueChange={(v) => {
                setJahr(v)
                setPage(1)
              }}
            >
              <SelectTrigger id="filter-jahr" aria-label="Jahr filtern">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Jahre</SelectItem>
                {verfuegbareJahre.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="filter-spender" className="text-xs">
              Spendername
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="filter-spender"
                value={spenderSuche}
                onChange={(e) => {
                  setSpenderSuche(e.target.value)
                  setPage(1)
                }}
                placeholder="Nach Spendername suchen..."
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="filter-versand" className="text-xs">
              Versandstatus
            </Label>
            <Select
              value={versandStatus}
              onValueChange={(v) => {
                setVersandStatus(v as VersandFilter)
                setPage(1)
              }}
            >
              <SelectTrigger id="filter-versand" aria-label="Versandstatus filtern">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle</SelectItem>
                <SelectItem value="versendet">Versendet</SelectItem>
                <SelectItem value="nicht_versendet">Nicht versendet</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {hasFilter && (
            <div className="flex items-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFilter}
                aria-label="Filter zurücksetzen"
              >
                <X className="mr-1.5 h-3.5 w-3.5" />
                Zurücksetzen
              </Button>
            </div>
          )}
        </div>
      </div>

      <SpendenquittungenTabelle
        quittungen={quittungen}
        isLoading={isLoading}
        error={error}
        page={page}
        totalPages={totalPages}
        canEdit={isAdmin}
        vorstand={vorstand}
        onPageChange={setPage}
        onReloadRow={() => loadQuittungen()}
        onReloadAll={() => loadQuittungen()}
      />
    </div>
  )
}
