"use client"

import { useMemo, useState } from "react"
import {
  AlertCircle,
  AlertTriangle,
  GripVertical,
  Pencil,
  Play,
  Plus,
  Trash2,
} from "lucide-react"
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
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
import {
  useCategorizationRules,
  useCategorizationRulesStatus,
  deleteCategorizationRule,
  reorderCategorizationRules,
  updateCategorizationRule,
  patchCategorizationRuleLocal,
} from "@/hooks/use-categorization-rules"
import { useCategories } from "@/hooks/use-categories"
import { RegelFormDialog } from "@/components/regel-form-dialog"
import { RegelnAnwendenDialog } from "@/components/regeln-anwenden-dialog"
import { CategoryBadge } from "@/components/category-badge"
import type {
  CategorizationRule,
  RuleCriterion,
} from "@/lib/types"

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mär",
  "Apr",
  "Mai",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dez",
]

const CRITERION_TYPE_SHORT: Record<RuleCriterion["type"], string> = {
  text_contains: "Buchungstext",
  counterpart_contains: "Auftraggeber",
  amount_range: "Betrag",
  month_quarter: "Monat/Quartal",
}

function formatCriterion(criterion: RuleCriterion): string {
  switch (criterion.type) {
    case "text_contains":
      return `Buchungstext enthält „${criterion.term}"`
    case "counterpart_contains":
      return `Auftraggeber enthält „${criterion.term}"`
    case "amount_range": {
      const dir =
        criterion.direction === "in"
          ? "Eingang"
          : criterion.direction === "out"
            ? "Ausgang"
            : "Ein-/Ausgang"
      const fmt = (n: number) =>
        new Intl.NumberFormat("de-DE", {
          style: "currency",
          currency: "EUR",
        }).format(n)
      return `Betrag ${fmt(criterion.min)} – ${fmt(criterion.max)} (${dir})`
    }
    case "month_quarter":
      if (criterion.months && criterion.months.length > 0) {
        return `Monat: ${criterion.months.map((m) => MONTH_SHORT[m - 1]).join(", ")}`
      }
      if (criterion.quarters && criterion.quarters.length > 0) {
        return `Quartal: ${criterion.quarters.map((q) => `Q${q}`).join(", ")}`
      }
      return "Monat/Quartal (leer)"
  }
}

/**
 * PROJ-15: Formatiert die zusammengesetzte Bedingung einer Regel als
 * lesbarer Einzeiler. Bei mehreren Kriterien wird der Verknüpfungs-
 * operator zwischen die Beschreibungen gesetzt.
 */
function formatRuleCondition(rule: CategorizationRule): string {
  const criteria = rule.condition?.criteria ?? []
  if (criteria.length === 0) return "(keine Kriterien)"
  if (criteria.length === 1) return formatCriterion(criteria[0])
  const separator = rule.condition?.combinator === "OR" ? " ODER " : " UND "
  return criteria.map(formatCriterion).join(separator)
}

export function KategorisierungsregelnListe() {
  const rules = useCategorizationRules()
  const { isLoading, error: loadError } = useCategorizationRulesStatus()
  const categories = useCategories()

  const [formOpen, setFormOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<CategorizationRule | null>(
    null
  )
  const [applyOpen, setApplyOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CategorizationRule | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  const categoriesById = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c]))
    return map
  }, [categories])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const displayError = error ?? loadError

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = rules.findIndex((r) => r.id === active.id)
    const newIndex = rules.findIndex((r) => r.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(rules, oldIndex, newIndex)
    const ids = reordered.map((r) => r.id)
    try {
      setError(null)
      await reorderCategorizationRules(ids)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Fehler beim Speichern der Reihenfolge"
      )
    }
  }

  async function handleToggleActive(rule: CategorizationRule, next: boolean) {
    setError(null)
    // BUG-008: Optimistisches Update — der Switch springt sofort um.
    // Bei einem Fehler wird der lokale Store auf den alten Wert
    // zurückgerollt, sodass die UI den tatsächlichen Serverzustand zeigt.
    const previous = rule.is_active
    patchCategorizationRuleLocal(rule.id, { is_active: next })
    try {
      await updateCategorizationRule(rule.id, { is_active: next })
    } catch (err) {
      patchCategorizationRuleLocal(rule.id, { is_active: previous })
      setError(
        err instanceof Error ? err.message : "Fehler beim Umschalten"
      )
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    setIsPending(true)
    setError(null)
    try {
      await deleteCategorizationRule(deleteTarget.id)
      setDeleteTarget(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Löschen")
    } finally {
      setIsPending(false)
    }
  }

  function handleEdit(rule: CategorizationRule) {
    setEditingRule(rule)
    setFormOpen(true)
  }

  function handleCreate() {
    setEditingRule(null)
    setFormOpen(true)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Kategorisierungsregeln</CardTitle>
            <CardDescription>
              Automatische Kategorien beim Import. Mehrere passende Regeln
              greifen gleichzeitig. Die Reihenfolge ist rein kosmetisch.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setApplyOpen(true)}
            disabled={rules.length === 0}
            className="shrink-0"
          >
            <Play className="mr-1.5 h-4 w-4" />
            Regeln jetzt anwenden
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {displayError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{displayError}</AlertDescription>
          </Alert>
        )}

        {isLoading && rules.length === 0 ? (
          <div className="rounded-md border p-4 text-center text-sm text-muted-foreground">
            Regeln werden geladen…
          </div>
        ) : rules.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Noch keine Regeln angelegt. Lege deine erste Regel an, um
            Buchungen beim Import automatisch zu kategorisieren.
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={rules.map((r) => r.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="divide-y rounded-md border">
                {rules.map((rule) => (
                  <SortableRuleRow
                    key={rule.id}
                    rule={rule}
                    categoryName={
                      categoriesById.get(rule.category_id)?.name ?? null
                    }
                    categoryColor={
                      categoriesById.get(rule.category_id)?.color ?? "#64748b"
                    }
                    onToggle={(next) => handleToggleActive(rule, next)}
                    onEdit={() => handleEdit(rule)}
                    onDelete={() => setDeleteTarget(rule)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}

        <Button
          variant="outline"
          onClick={handleCreate}
          disabled={categories.length === 0}
          className="w-full sm:w-auto"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Neue Regel
        </Button>
        {categories.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Lege zuerst im Tab „Kategorien“ mindestens eine Kategorie an, bevor
            du Regeln erstellst.
          </p>
        )}
      </CardContent>

      <RegelFormDialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o)
          if (!o) setEditingRule(null)
        }}
        rule={editingRule}
      />

      <RegelnAnwendenDialog open={applyOpen} onOpenChange={setApplyOpen} />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !isPending) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regel löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  Die Regel <strong>„{deleteTarget.name}“</strong> wird
                  gelöscht. Bestehende Kategorie-Zuordnungen von Buchungen
                  bleiben erhalten.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isPending}
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

interface SortableRuleRowProps {
  rule: CategorizationRule
  categoryName: string | null
  categoryColor: string
  onToggle: (next: boolean) => void
  onEdit: () => void
  onDelete: () => void
}

function SortableRuleRow({
  rule,
  categoryName,
  categoryColor,
  onToggle,
  onEdit,
  onDelete,
}: SortableRuleRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: rule.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 bg-background p-3"
    >
      <button
        type="button"
        className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-accent active:cursor-grabbing"
        aria-label={`Regel ${rule.name} verschieben`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium">{rule.name}</span>
          {(rule.condition?.criteria?.length ?? 0) > 1 ? (
            <Badge variant="secondary" className="text-xs">
              {rule.condition?.combinator === "OR" ? "ODER" : "UND"}
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">
              {CRITERION_TYPE_SHORT[
                rule.condition?.criteria?.[0]?.type ?? "text_contains"
              ]}
            </Badge>
          )}
          {rule.is_invalid && (
            <Badge
              variant="outline"
              className="border-orange-400 text-orange-600 text-xs"
            >
              <AlertTriangle className="mr-1 h-3 w-3" />
              ungültig
            </Badge>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">{formatRuleCondition(rule)}</span>
          <span aria-hidden="true">→</span>
          {categoryName ? (
            <CategoryBadge
              category={{
                id: rule.category_id,
                name: categoryName,
                color: categoryColor,
                created_at: "",
              }}
            />
          ) : (
            <Badge variant="outline" className="text-xs">
              Kategorie gelöscht
            </Badge>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Switch
          checked={rule.is_active}
          onCheckedChange={onToggle}
          aria-label={`Regel ${rule.name} ${
            rule.is_active ? "deaktivieren" : "aktivieren"
          }`}
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={onEdit}
          aria-label={`Regel ${rule.name} bearbeiten`}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={onDelete}
          aria-label={`Regel ${rule.name} löschen`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </li>
  )
}
