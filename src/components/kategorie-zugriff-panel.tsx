"use client"

import { useEffect, useState, useCallback } from "react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { CategoryMultiSelect } from "@/components/category-multi-select"
import { useCategories } from "@/hooks/use-categories"
import { Loader2, AlertCircle, Info, Check } from "lucide-react"

/**
 * PROJ-14: Panel zur Konfiguration der Kategorie-Einschränkung eines
 * Betrachters. Wird im Aufklapp-Bereich der Benutzerverwaltung unterhalb
 * der Feature-Berechtigungen angezeigt.
 *
 * Datenvertrag (Backend):
 *   GET  /api/admin/users/:id/category-access
 *        → { unrestricted: boolean, category_ids: string[], role: string }
 *   PUT  /api/admin/users/:id/category-access
 *        Body: { unrestricted: boolean, category_ids: string[] }
 *
 * Logik: "unrestricted = true"  → keine Einschränkung (alle Kategorien sichtbar,
 *                                 Standard bei leerem Eintrag in der Tabelle).
 *        "unrestricted = false" → nur die in `category_ids` aufgeführten
 *                                 Kategorien sind für den Betrachter sichtbar.
 */

interface KategorieZugriffPanelProps {
  userId: string
  userEmail: string
}

interface CategoryAccessState {
  restricted: boolean
  categoryIds: string[]
}

export function KategorieZugriffPanel({
  userId,
  userEmail,
}: KategorieZugriffPanelProps) {
  const allCategories = useCategories()

  const [initialState, setInitialState] = useState<CategoryAccessState | null>(
    null
  )
  const [restricted, setRestricted] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)

  const loadAccess = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}/category-access`, {
        credentials: "include",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(
          data.error || "Kategorie-Zugriff konnte nicht geladen werden."
        )
      }
      const data = (await res.json()) as {
        unrestricted?: boolean
        category_ids?: string[]
      }
      const next: CategoryAccessState = {
        restricted: data.unrestricted === false,
        categoryIds: Array.isArray(data.category_ids) ? data.category_ids : [],
      }
      setInitialState(next)
      setRestricted(next.restricted)
      setSelectedIds(next.categoryIds)
    } catch (err) {
      setLoadError(
        err instanceof Error
          ? err.message
          : "Kategorie-Zugriff konnte nicht geladen werden."
      )
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    loadAccess()
  }, [loadAccess])

  const isDirty =
    !!initialState &&
    (initialState.restricted !== restricted ||
      initialState.categoryIds.length !== selectedIds.length ||
      initialState.categoryIds.some((id) => !selectedIds.includes(id)))

  // Validierung: "Eingeschränkt" mit leerer Liste ist erlaubt, bedeutet aber
  // "keine Buchungen sichtbar". Wir warnen nur hinweisend.
  const hasEmptyRestriction = restricted && selectedIds.length === 0

  async function handleSave() {
    setIsSaving(true)
    setSaveError(null)
    setJustSaved(false)
    try {
      const res = await fetch(`/api/admin/users/${userId}/category-access`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unrestricted: !restricted,
          category_ids: restricted ? selectedIds : [],
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(
          data.error || "Kategorie-Zugriff konnte nicht gespeichert werden."
        )
      }
      setInitialState({
        restricted,
        categoryIds: restricted ? [...selectedIds] : [],
      })
      setJustSaved(true)
      // „Gespeichert"-Hinweis kurz anzeigen
      setTimeout(() => setJustSaved(false), 2500)
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : "Kategorie-Zugriff konnte nicht gespeichert werden."
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4 px-4 py-3">
      <Separator />

      <div>
        <h4 className="text-sm font-medium">Kategorie-Zugriff</h4>
        <p className="text-xs text-muted-foreground">
          Beschränkt die sichtbaren Buchungen für {userEmail} auf ausgewählte
          Kategorien. Gilt nur für Betrachter – Administratoren sehen immer
          alle Buchungen.
        </p>
      </div>

      {loadError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-3/4" />
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <Label
                htmlFor={`cat-access-toggle-${userId}`}
                className="text-sm font-normal"
              >
                Eingeschränkter Zugriff
              </Label>
              <p className="text-xs text-muted-foreground">
                {restricted
                  ? "Nur ausgewählte Kategorien sind sichtbar."
                  : "Alle Kategorien sind sichtbar (Standard)."}
              </p>
            </div>
            <Switch
              id={`cat-access-toggle-${userId}`}
              checked={restricted}
              onCheckedChange={(checked) => {
                setRestricted(checked)
                setJustSaved(false)
                setSaveError(null)
              }}
              disabled={isSaving}
              aria-label={`Kategorie-Einschränkung für ${userEmail} ${
                restricted ? "deaktivieren" : "aktivieren"
              }`}
            />
          </div>

          {restricted && (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">
                Erlaubte Kategorien
              </Label>
              <CategoryMultiSelect
                allCategories={allCategories}
                selectedIds={selectedIds}
                onChange={(next) => {
                  setSelectedIds(next)
                  setJustSaved(false)
                  setSaveError(null)
                }}
                disabled={isSaving}
                placeholder="Kategorien auswählen…"
              />
              {hasEmptyRestriction && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Ohne ausgewählte Kategorien sieht {userEmail} keine
                    Buchungen.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {saveError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-end gap-2">
            {justSaved && !isDirty && (
              <span
                className="flex items-center gap-1 text-xs text-muted-foreground"
                aria-live="polite"
              >
                <Check className="h-3.5 w-3.5 text-green-600" aria-hidden="true" />
                Gespeichert
              </span>
            )}
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !isDirty}
            >
              {isSaving && (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              Speichern
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
