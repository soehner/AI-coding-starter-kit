"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  AlertCircle,
  Check,
  Loader2,
  Plus,
  Search,
  Sparkles,
  User,
} from "lucide-react"
import { useDebounce } from "@/hooks/use-debounce"
import type { Spender, SpenderVorschlag } from "@/lib/types"

interface SpenderAuswahlComboboxProps {
  /** Vorgeschlagener Name aus der Buchung (counterpart) – wird als initiale Suche genutzt. */
  initialSuche?: string
  /** IBAN aus der Buchung – wird für IBAN-Match an /suggest übergeben. */
  initialIban?: string | null
  /** Aktuell ausgewählter Spender (oder null für „neuer Spender"). */
  selectedSpender: Spender | null
  /** Wird aufgerufen, wenn ein bestehender Spender ausgewählt wird. */
  onSelectSpender: (spender: Spender) => void
  /** Wird aufgerufen, wenn der Benutzer „Neuen Spender anlegen" wählt. */
  onCreateNew: (vorbefuellung: { name: string }) => void
}

/**
 * PROJ-17: Spender-Suche mit Fuzzy-Match-Vorschlägen aus der Buchung.
 *
 * Beim ersten Öffnen werden Vorschläge per /api/admin/spender/suggest
 * geladen (basierend auf counterpart-Name und IBAN). Der Benutzer kann
 * außerdem in der Spender-Datenbank suchen oder einen neuen Spender
 * anlegen.
 */
export function SpenderAuswahlCombobox({
  initialSuche = "",
  initialIban = null,
  selectedSpender,
  onSelectSpender,
  onCreateNew,
}: SpenderAuswahlComboboxProps) {
  const [suche, setSuche] = useState(initialSuche)
  const debouncedSuche = useDebounce(suche, 250)
  const [vorschlaege, setVorschlaege] = useState<SpenderVorschlag[]>([])
  const [suchergebnisse, setSuchergebnisse] = useState<Spender[]>([])
  const [isLoadingVorschlaege, setIsLoadingVorschlaege] = useState(false)
  const [isLoadingSuche, setIsLoadingSuche] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Beim Mount: Fuzzy-Vorschläge laden
  const loadVorschlaege = useCallback(async () => {
    if (!initialSuche && !initialIban) {
      setVorschlaege([])
      return
    }
    setIsLoadingVorschlaege(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (initialSuche) params.set("name", initialSuche)
      if (initialIban) params.set("iban", initialIban)
      const res = await fetch(`/api/admin/spender/suggest?${params}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || "Vorschläge konnten nicht geladen werden.")
        return
      }
      const data = await res.json()
      setVorschlaege(data.vorschlaege ?? [])
    } catch {
      setError("Netzwerkfehler beim Laden der Vorschläge.")
    } finally {
      setIsLoadingVorschlaege(false)
    }
  }, [initialSuche, initialIban])

  useEffect(() => {
    loadVorschlaege()
  }, [loadVorschlaege])

  // Volltext-Suche bei Eingabe
  useEffect(() => {
    const trimmed = debouncedSuche.trim()
    if (trimmed.length < 2) {
      setSuchergebnisse([])
      return
    }
    let aborted = false
    const run = async () => {
      setIsLoadingSuche(true)
      try {
        const res = await fetch(
          `/api/admin/spender?suche=${encodeURIComponent(trimmed)}`
        )
        if (!res.ok) return
        const data = await res.json()
        if (!aborted) {
          setSuchergebnisse(data.spender ?? [])
        }
      } catch {
        // still ausschalten – Vorschläge bleiben sichtbar
      } finally {
        if (!aborted) setIsLoadingSuche(false)
      }
    }
    run()
    return () => {
      aborted = true
    }
  }, [debouncedSuche])

  // IDs der Vorschläge, damit sie in der Volltext-Liste nicht doppelt erscheinen
  const vorschlagIds = useMemo(
    () => new Set(vorschlaege.map((v) => v.id)),
    [vorschlaege]
  )

  const sichtbareSuchergebnisse = suchergebnisse.filter(
    (s) => !vorschlagIds.has(s.id)
  )

  const handleNewClick = () => {
    onCreateNew({ name: suche.trim() || initialSuche || "" })
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Suchfeld + Neuer Spender */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            placeholder="Spender suchen (Name, E-Mail, Ort)..."
            className="pl-9"
            aria-label="Spender in der Datenbank suchen"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleNewClick}
          aria-label="Neuen Spender anlegen"
        >
          <Plus className="mr-2 h-4 w-4" />
          Neuer Spender
        </Button>
      </div>

      {/* Vorschläge aus Fuzzy-Match */}
      {vorschlaege.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Vorschläge aus der Buchung</span>
          </div>
          <ScrollArea className="max-h-[180px]">
            <ul className="space-y-2" aria-label="Vorgeschlagene Spender">
              {vorschlaege.map((v) => (
                <SpenderListItem
                  key={v.id}
                  spender={v}
                  similarity={v.similarity}
                  isSelected={selectedSpender?.id === v.id}
                  onSelect={() => onSelectSpender(v)}
                />
              ))}
            </ul>
          </ScrollArea>
        </div>
      )}

      {isLoadingVorschlaege && vorschlaege.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Vorschläge werden geladen...
        </div>
      )}

      {/* Volltext-Suchergebnisse */}
      {debouncedSuche.trim().length >= 2 && (
        <>
          {(vorschlaege.length > 0 || isLoadingVorschlaege) && <Separator />}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Search className="h-3.5 w-3.5" />
              <span>Suchergebnisse</span>
            </div>
            {isLoadingSuche ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Wird gesucht...
              </div>
            ) : sichtbareSuchergebnisse.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine passenden Spender gefunden. Über &bdquo;Neuer
                Spender&ldquo; kann ein neuer Datensatz angelegt werden.
              </p>
            ) : (
              <ScrollArea className="max-h-[240px]">
                <ul className="space-y-2" aria-label="Suchergebnisse">
                  {sichtbareSuchergebnisse.map((s) => (
                    <SpenderListItem
                      key={s.id}
                      spender={s}
                      isSelected={selectedSpender?.id === s.id}
                      onSelect={() => onSelectSpender(s)}
                    />
                  ))}
                </ul>
              </ScrollArea>
            )}
          </div>
        </>
      )}

      {/* Leerer Zustand */}
      {vorschlaege.length === 0 &&
        !isLoadingVorschlaege &&
        debouncedSuche.trim().length < 2 && (
          <div className="rounded-md border border-dashed p-6 text-center">
            <User className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Kein passender Spender</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Mindestens 2 Zeichen eingeben, um in der Spender-Datenbank zu
              suchen — oder einen neuen Spender anlegen.
            </p>
          </div>
        )}
    </div>
  )
}

function SpenderListItem({
  spender,
  similarity,
  isSelected,
  onSelect,
}: {
  spender: Spender
  similarity?: number
  isSelected: boolean
  onSelect: () => void
}) {
  const adresseTeile = [spender.strasse, spender.plz, spender.ort].filter(
    Boolean
  )
  const adresse = adresseTeile.join(", ")

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={isSelected}
        className={`flex w-full items-start gap-3 rounded-md border p-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          isSelected
            ? "border-primary bg-primary/5"
            : "border-border"
        }`}
      >
        <div className="mt-0.5">
          {isSelected ? (
            <Check
              className="h-4 w-4 text-primary"
              aria-label="Ausgewählt"
            />
          ) : (
            <User className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{spender.name}</span>
            {similarity !== undefined && (
              <Badge
                variant={similarity >= 0.95 ? "default" : "secondary"}
                className="text-[10px]"
              >
                {similarity >= 0.95
                  ? "IBAN-Treffer"
                  : `${Math.round(similarity * 100)} % Übereinstimmung`}
              </Badge>
            )}
          </div>
          {adresse && (
            <p className="text-xs text-muted-foreground">{adresse}</p>
          )}
          {spender.email && (
            <p className="text-xs text-muted-foreground">{spender.email}</p>
          )}
        </div>
      </button>
    </li>
  )
}
