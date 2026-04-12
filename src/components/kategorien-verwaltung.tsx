"use client"

import { useState } from "react"
import { Plus, Pencil, Trash2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import {
  useCategories,
  useCategoriesStatus,
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/hooks/use-categories"
import { CATEGORY_COLOR_PALETTE } from "@/lib/category-colors"
import { CategoryBadge } from "@/components/category-badge"
import type { Category } from "@/lib/types"

type CategoryWithCount = Category & { transaction_count?: number }

export function KategorienVerwaltung() {
  const categories = useCategories()
  const { isLoading, error: loadError } = useCategoriesStatus()

  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [newColor, setNewColor] = useState<string>(CATEGORY_COLOR_PALETTE[0].value)

  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editColor, setEditColor] = useState<string>(CATEGORY_COLOR_PALETTE[0].value)

  const [deleteTarget, setDeleteTarget] = useState<CategoryWithCount | null>(null)
  const [affectedCount, setAffectedCount] = useState(0)

  const [error, setError] = useState<string | null>(loadError)
  const [isPending, setIsPending] = useState(false)

  function resetCreateForm() {
    setIsCreating(false)
    setNewName("")
    setNewColor(CATEGORY_COLOR_PALETTE[0].value)
    setError(null)
  }

  async function handleCreate() {
    setError(null)
    setIsPending(true)
    try {
      await createCategory(newName, newColor)
      resetCreateForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Anlegen")
    } finally {
      setIsPending(false)
    }
  }

  function startEdit(cat: Category) {
    setEditId(cat.id)
    setEditName(cat.name)
    setEditColor(cat.color)
    setError(null)
  }

  async function handleEditSave() {
    if (!editId) return
    setError(null)
    setIsPending(true)
    try {
      await updateCategory(editId, { name: editName, color: editColor })
      setEditId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern")
    } finally {
      setIsPending(false)
    }
  }

  function startDelete(cat: CategoryWithCount) {
    setDeleteTarget(cat)
    setAffectedCount(cat.transaction_count ?? 0)
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    setIsPending(true)
    try {
      await deleteCategory(deleteTarget.id)
      setDeleteTarget(null)
      setAffectedCount(0)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Löschen")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kategorien</CardTitle>
        <CardDescription>
          Verwalte die Kategorien, die du Bankbewegungen zuordnen kannst. Änderungen
          werden sofort gespeichert.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="divide-y rounded-md border">
          {isLoading && categories.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Kategorien werden geladen…
            </div>
          ) : categories.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Noch keine Kategorien angelegt.
            </div>
          ) : (
            categories.map((cat) => {
              const isEditing = editId === cat.id
              const count = (cat as CategoryWithCount).transaction_count ?? 0
              return (
                <div
                  key={cat.id}
                  className="flex items-center gap-3 p-3"
                >
                  {isEditing ? (
                    <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Name der Kategorie"
                        maxLength={100}
                        className="sm:max-w-xs"
                        aria-label="Kategoriename bearbeiten"
                        disabled={isPending}
                      />
                      <ColorPalette
                        selected={editColor}
                        onSelect={setEditColor}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-1 items-center gap-3">
                      <CategoryBadge category={cat} />
                      <span className="text-xs text-muted-foreground">
                        {count} Buchung{count === 1 ? "" : "en"}
                      </span>
                    </div>
                  )}

                  <div className="flex shrink-0 gap-1">
                    {isEditing ? (
                      <>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={handleEditSave}
                          disabled={isPending}
                        >
                          Speichern
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isPending}
                          onClick={() => {
                            setEditId(null)
                            setError(null)
                          }}
                        >
                          Abbrechen
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => startEdit(cat)}
                          aria-label={`Kategorie ${cat.name} bearbeiten`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => startDelete(cat)}
                          aria-label={`Kategorie ${cat.name} löschen`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {isCreating ? (
          <div className="space-y-3 rounded-md border border-dashed p-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-category-name">Name</Label>
              <Input
                id="new-category-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="z. B. Mitgliedsbeiträge"
                maxLength={100}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Farbe</Label>
              <ColorPalette selected={newColor} onSelect={setNewColor} />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={!newName.trim() || isPending}>
                <Plus className="mr-1.5 h-4 w-4" />
                Anlegen
              </Button>
              <Button variant="ghost" onClick={resetCreateForm} disabled={isPending}>
                Abbrechen
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={() => setIsCreating(true)}
            className="w-full sm:w-auto"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Neue Kategorie
          </Button>
        )}
      </CardContent>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
            setAffectedCount(0)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kategorie löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  Die Kategorie <strong>„{deleteTarget.name}"</strong> wird gelöscht.
                  {affectedCount > 0 ? (
                    <>
                      {" "}
                      Die Zuordnung wird bei <strong>{affectedCount}</strong>{" "}
                      Buchung{affectedCount === 1 ? "" : "en"} entfernt. Die Buchungen
                      selbst bleiben erhalten.
                    </>
                  ) : (
                    " Keine Buchung ist dieser Kategorie zugeordnet."
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

interface ColorPaletteProps {
  selected: string
  onSelect: (value: string) => void
}

function ColorPalette({ selected, onSelect }: ColorPaletteProps) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Farbe wählen">
      {CATEGORY_COLOR_PALETTE.map((c) => (
        <button
          key={c.value}
          type="button"
          role="radio"
          aria-checked={selected === c.value}
          aria-label={c.label}
          onClick={() => onSelect(c.value)}
          className={cn(
            "h-7 w-7 rounded-full border-2 transition-all",
            selected === c.value
              ? "border-foreground ring-2 ring-offset-1 ring-offset-background"
              : "border-border hover:scale-110"
          )}
          style={{ backgroundColor: c.value, borderColor: selected === c.value ? undefined : c.value }}
        />
      ))}
    </div>
  )
}

