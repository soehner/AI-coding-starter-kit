"use client"

import { useEffect, useState } from "react"
import { AlertCircle, Loader2, Plus, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useCategories } from "@/hooks/use-categories"
import {
  createCategorizationRule,
  updateCategorizationRule,
} from "@/hooks/use-categorization-rules"
import type {
  AmountDirection,
  AmountRangeCriterion,
  CategorizationRule,
  CounterpartContainsCriterion,
  CriterionType,
  MonthQuarterCriterion,
  RuleCombinator,
  RuleCriterion,
  TextContainsCriterion,
} from "@/lib/types"

interface RegelFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Falls gesetzt: Bearbeitungsmodus */
  rule?: CategorizationRule | null
  onSaved?: () => void
}

const CRITERION_TYPE_LABELS: Record<CriterionType, string> = {
  text_contains: "Buchungstext enthält",
  counterpart_contains: "Auftraggeber/Empfänger enthält",
  amount_range: "Betrag im Bereich",
  month_quarter: "Buchungsmonat/-quartal",
}

const MONTH_NAMES = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
]

const MAX_CRITERIA = 10

/**
 * PROJ-15: Editierbare Form eines einzelnen Kriteriums im UI. Hält
 * ALLE Eingabefelder, auch wenn nur eines davon je nach Typ sichtbar
 * ist. Beim Typ-Wechsel bleiben andere Felder erhalten, werden beim
 * Serialisieren aber ignoriert.
 */
interface CriterionDraft {
  /** Rein UI-seitige Kennung für React-keys. Nicht persistiert. */
  uid: string
  type: CriterionType
  term: string
  amountMin: string
  amountMax: string
  amountDirection: AmountDirection
  mqMode: "months" | "quarters"
  selectedMonths: number[]
  selectedQuarters: number[]
}

function newDraftUid(): string {
  return Math.random().toString(36).slice(2, 10)
}

function emptyDraft(): CriterionDraft {
  return {
    uid: newDraftUid(),
    type: "text_contains",
    term: "",
    amountMin: "",
    amountMax: "",
    amountDirection: "both",
    mqMode: "months",
    selectedMonths: [],
    selectedQuarters: [],
  }
}

function draftFromCriterion(c: RuleCriterion): CriterionDraft {
  const base = emptyDraft()
  base.type = c.type
  switch (c.type) {
    case "text_contains":
    case "counterpart_contains":
      base.term = c.term ?? ""
      break
    case "amount_range":
      base.amountMin =
        c.min !== undefined ? c.min.toString().replace(".", ",") : ""
      base.amountMax =
        c.max !== undefined ? c.max.toString().replace(".", ",") : ""
      base.amountDirection = c.direction ?? "both"
      break
    case "month_quarter":
      if (c.months && c.months.length > 0) {
        base.mqMode = "months"
        base.selectedMonths = [...c.months]
      } else if (c.quarters && c.quarters.length > 0) {
        base.mqMode = "quarters"
        base.selectedQuarters = [...c.quarters]
      }
      break
  }
  return base
}

/**
 * Serialisiert einen Draft in ein API-Kriterium. Liefert einen String
 * mit der Fehlermeldung, wenn die Eingabe ungültig ist, sonst das
 * typisierte Kriterium.
 */
function serializeDraft(
  draft: CriterionDraft,
  index: number
): { criterion: RuleCriterion } | { error: string } {
  const prefix = `Kriterium ${index + 1}: `
  switch (draft.type) {
    case "text_contains":
    case "counterpart_contains": {
      const trimmed = draft.term.trim()
      if (!trimmed) {
        return { error: prefix + "Bitte einen Suchbegriff eingeben." }
      }
      const criterion =
        draft.type === "text_contains"
          ? ({ type: "text_contains", term: trimmed } satisfies TextContainsCriterion)
          : ({
              type: "counterpart_contains",
              term: trimmed,
            } satisfies CounterpartContainsCriterion)
      return { criterion }
    }
    case "amount_range": {
      const min = parseFloat(draft.amountMin.replace(",", "."))
      const max = parseFloat(draft.amountMax.replace(",", "."))
      if (isNaN(min) || isNaN(max)) {
        return {
          error: prefix + "Von- und Bis-Betrag müssen gültige Zahlen sein.",
        }
      }
      if (min > max) {
        return {
          error:
            prefix +
            "Der Von-Betrag darf nicht größer als der Bis-Betrag sein.",
        }
      }
      return {
        criterion: {
          type: "amount_range",
          min,
          max,
          direction: draft.amountDirection,
        } satisfies AmountRangeCriterion,
      }
    }
    case "month_quarter": {
      if (draft.mqMode === "months") {
        if (draft.selectedMonths.length === 0) {
          return { error: prefix + "Bitte mindestens einen Monat auswählen." }
        }
        return {
          criterion: {
            type: "month_quarter",
            months: [...draft.selectedMonths].sort((a, b) => a - b),
          } satisfies MonthQuarterCriterion,
        }
      }
      if (draft.selectedQuarters.length === 0) {
        return { error: prefix + "Bitte mindestens ein Quartal auswählen." }
      }
      return {
        criterion: {
          type: "month_quarter",
          quarters: [...draft.selectedQuarters].sort((a, b) => a - b),
        } satisfies MonthQuarterCriterion,
      }
    }
  }
}

export function RegelFormDialog({
  open,
  onOpenChange,
  rule,
  onSaved,
}: RegelFormDialogProps) {
  const categories = useCategories()

  const [name, setName] = useState("")
  const [combinator, setCombinator] = useState<RuleCombinator>("AND")
  const [criteria, setCriteria] = useState<CriterionDraft[]>([emptyDraft()])
  const [categoryId, setCategoryId] = useState<string>("")
  const [isActive, setIsActive] = useState(true)

  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const isEdit = !!rule

  // Beim Öffnen Formular befüllen/zurücksetzen
  useEffect(() => {
    if (!open) return
    setError(null)

    if (rule) {
      setName(rule.name)
      setCombinator(rule.condition?.combinator ?? "AND")
      const existingCriteria = rule.condition?.criteria ?? []
      setCriteria(
        existingCriteria.length > 0
          ? existingCriteria.map(draftFromCriterion)
          : [emptyDraft()]
      )
      setCategoryId(rule.category_id)
      setIsActive(rule.is_active)
    } else {
      setName("")
      setCombinator("AND")
      setCriteria([emptyDraft()])
      setCategoryId(categories[0]?.id ?? "")
      setIsActive(true)
    }
  }, [open, rule, categories])

  function updateDraft(uid: string, patch: Partial<CriterionDraft>) {
    setCriteria((prev) =>
      prev.map((d) => (d.uid === uid ? { ...d, ...patch } : d))
    )
  }

  function toggleMonth(uid: string, month: number) {
    setCriteria((prev) =>
      prev.map((d) => {
        if (d.uid !== uid) return d
        const selected = d.selectedMonths.includes(month)
          ? d.selectedMonths.filter((m) => m !== month)
          : [...d.selectedMonths, month]
        return { ...d, selectedMonths: selected }
      })
    )
  }

  function toggleQuarter(uid: string, q: number) {
    setCriteria((prev) =>
      prev.map((d) => {
        if (d.uid !== uid) return d
        const selected = d.selectedQuarters.includes(q)
          ? d.selectedQuarters.filter((x) => x !== q)
          : [...d.selectedQuarters, q]
        return { ...d, selectedQuarters: selected }
      })
    )
  }

  function addCriterion() {
    if (criteria.length >= MAX_CRITERIA) return
    setCriteria((prev) => [...prev, emptyDraft()])
  }

  function removeCriterion(uid: string) {
    setCriteria((prev) =>
      prev.length <= 1 ? prev : prev.filter((d) => d.uid !== uid)
    )
  }

  async function handleSave() {
    setError(null)

    if (!name.trim()) {
      setError("Bitte einen Regelnamen eingeben.")
      return
    }
    if (!categoryId) {
      setError("Bitte eine Ziel-Kategorie wählen.")
      return
    }
    if (criteria.length === 0) {
      setError("Mindestens ein Kriterium ist erforderlich.")
      return
    }

    const serialized: RuleCriterion[] = []
    for (let i = 0; i < criteria.length; i++) {
      const result = serializeDraft(criteria[i], i)
      if ("error" in result) {
        setError(result.error)
        return
      }
      serialized.push(result.criterion)
    }

    setIsSaving(true)
    try {
      if (isEdit && rule) {
        await updateCategorizationRule(rule.id, {
          name: name.trim(),
          category_id: categoryId,
          is_active: isActive,
          combinator,
          criteria: serialized,
        })
      } else {
        await createCategorizationRule({
          name: name.trim(),
          category_id: categoryId,
          is_active: isActive,
          combinator,
          criteria: serialized,
        })
      }
      onSaved?.()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Regel bearbeiten" : "Neue Regel anlegen"}
          </DialogTitle>
          <DialogDescription>
            Definiere eine oder mehrere Bedingungen. Mehrere Kriterien lassen
            sich per UND (alle müssen zutreffen) oder ODER (eines reicht)
            verknüpfen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="rule-name">Regelname</Label>
            <Input
              id="rule-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z. B. Mitgliedsbeitrag 15 €"
              maxLength={120}
              disabled={isSaving}
            />
          </div>

          {/* Kriterien */}
          <div className="space-y-3 rounded-md border p-3">
            <div className="flex flex-col gap-3">
              <Label className="text-sm font-medium">Kriterien</Label>
              {criteria.length > 1 && (
                <RadioGroup
                  value={combinator}
                  onValueChange={(v) => setCombinator(v as RuleCombinator)}
                  disabled={isSaving}
                  className="flex flex-col gap-1.5 sm:flex-row sm:gap-4"
                >
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <RadioGroupItem
                      value="AND"
                      id="combinator-and"
                      aria-label="Alle Kriterien müssen zutreffen"
                    />
                    <span>Alle Kriterien müssen zutreffen (UND)</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <RadioGroupItem
                      value="OR"
                      id="combinator-or"
                      aria-label="Mindestens ein Kriterium trifft zu"
                    />
                    <span>Mindestens ein Kriterium trifft zu (ODER)</span>
                  </label>
                </RadioGroup>
              )}
            </div>

            <div className="space-y-3">
              {criteria.map((draft, idx) => (
                <CriterionRow
                  key={draft.uid}
                  draft={draft}
                  index={idx}
                  canDelete={criteria.length > 1}
                  isSaving={isSaving}
                  onChange={(patch) => updateDraft(draft.uid, patch)}
                  onToggleMonth={(m) => toggleMonth(draft.uid, m)}
                  onToggleQuarter={(q) => toggleQuarter(draft.uid, q)}
                  onRemove={() => removeCriterion(draft.uid)}
                />
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addCriterion}
              disabled={isSaving || criteria.length >= MAX_CRITERIA}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Kriterium hinzufügen
            </Button>
            {criteria.length >= MAX_CRITERIA && (
              <p className="text-xs text-muted-foreground">
                Maximal {MAX_CRITERIA} Kriterien pro Regel.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rule-category">Ziel-Kategorie</Label>
            <Select
              value={categoryId}
              onValueChange={setCategoryId}
              disabled={isSaving || categories.length === 0}
            >
              <SelectTrigger id="rule-category">
                <SelectValue placeholder="Kategorie wählen…" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: cat.color }}
                        aria-hidden="true"
                      />
                      {cat.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {categories.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Noch keine Kategorien angelegt. Lege zuerst im Tab „Kategorien&ldquo;
                eine Kategorie an.
              </p>
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={isActive}
              onCheckedChange={(v) => setIsActive(v === true)}
              disabled={isSaving}
              aria-label="Regel aktiv"
            />
            <span>Regel ist aktiv</span>
          </label>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Abbrechen
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Speichern" : "Regel anlegen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// CriterionRow — Eingabefelder für ein einzelnes Kriterium
// ---------------------------------------------------------------------------

interface CriterionRowProps {
  draft: CriterionDraft
  index: number
  canDelete: boolean
  isSaving: boolean
  onChange: (patch: Partial<CriterionDraft>) => void
  onToggleMonth: (month: number) => void
  onToggleQuarter: (q: number) => void
  onRemove: () => void
}

function CriterionRow({
  draft,
  index,
  canDelete,
  isSaving,
  onChange,
  onToggleMonth,
  onToggleQuarter,
  onRemove,
}: CriterionRowProps) {
  return (
    <div className="space-y-3 rounded-md border border-dashed p-3">
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor={`criterion-type-${draft.uid}`} className="text-xs">
            Kriterium {index + 1}
          </Label>
          <Select
            value={draft.type}
            onValueChange={(v) => onChange({ type: v as CriterionType })}
            disabled={isSaving}
          >
            <SelectTrigger id={`criterion-type-${draft.uid}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(CRITERION_TYPE_LABELS) as CriterionType[]).map(
                (t) => (
                  <SelectItem key={t} value={t}>
                    {CRITERION_TYPE_LABELS[t]}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="mt-6 h-8 w-8 shrink-0 text-destructive hover:text-destructive"
          onClick={onRemove}
          disabled={isSaving || !canDelete}
          aria-label={`Kriterium ${index + 1} entfernen`}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {(draft.type === "text_contains" ||
        draft.type === "counterpart_contains") && (
        <div className="space-y-1.5">
          <Label htmlFor={`criterion-term-${draft.uid}`}>
            {draft.type === "text_contains"
              ? "Suchbegriff im Buchungstext"
              : "Suchbegriff im Auftraggeber/Empfänger"}
          </Label>
          <Input
            id={`criterion-term-${draft.uid}`}
            value={draft.term}
            onChange={(e) => onChange({ term: e.target.value })}
            placeholder="z. B. SEPA oder Max Mustermann"
            maxLength={200}
            disabled={isSaving}
          />
          <p className="text-xs text-muted-foreground">
            Groß-/Kleinschreibung wird ignoriert.
          </p>
        </div>
      )}

      {draft.type === "amount_range" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`criterion-min-${draft.uid}`}>Von (€)</Label>
              <Input
                id={`criterion-min-${draft.uid}`}
                inputMode="decimal"
                value={draft.amountMin}
                onChange={(e) => onChange({ amountMin: e.target.value })}
                placeholder="10,00"
                disabled={isSaving}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`criterion-max-${draft.uid}`}>Bis (€)</Label>
              <Input
                id={`criterion-max-${draft.uid}`}
                inputMode="decimal"
                value={draft.amountMax}
                onChange={(e) => onChange({ amountMax: e.target.value })}
                placeholder="20,00"
                disabled={isSaving}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`criterion-direction-${draft.uid}`}>Richtung</Label>
            <Select
              value={draft.amountDirection}
              onValueChange={(v) =>
                onChange({ amountDirection: v as AmountDirection })
              }
              disabled={isSaving}
            >
              <SelectTrigger id={`criterion-direction-${draft.uid}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="both">Eingang und Ausgang</SelectItem>
                <SelectItem value="in">Nur Eingang (positiv)</SelectItem>
                <SelectItem value="out">Nur Ausgang (negativ)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Beträge werden als absolute Werte verglichen. „Eingang&ldquo; meint
            positive, „Ausgang&ldquo; negative Buchungen.
          </p>
        </div>
      )}

      {draft.type === "month_quarter" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={draft.mqMode === "months" ? "default" : "outline"}
              size="sm"
              onClick={() =>
                onChange({ mqMode: "months", selectedQuarters: [] })
              }
              disabled={isSaving}
            >
              Monate
            </Button>
            <Button
              type="button"
              variant={draft.mqMode === "quarters" ? "default" : "outline"}
              size="sm"
              onClick={() =>
                onChange({ mqMode: "quarters", selectedMonths: [] })
              }
              disabled={isSaving}
            >
              Quartale
            </Button>
          </div>

          {draft.mqMode === "months" ? (
            <div
              className="grid grid-cols-3 gap-2"
              role="group"
              aria-label="Monate auswählen"
            >
              {MONTH_NAMES.map((label, idx) => {
                const month = idx + 1
                const checked = draft.selectedMonths.includes(month)
                return (
                  <label
                    key={month}
                    className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => onToggleMonth(month)}
                      disabled={isSaving}
                      aria-label={label}
                    />
                    <span>{label}</span>
                  </label>
                )
              })}
            </div>
          ) : (
            <div
              className="grid grid-cols-2 gap-2"
              role="group"
              aria-label="Quartale auswählen"
            >
              {[1, 2, 3, 4].map((q) => {
                const checked = draft.selectedQuarters.includes(q)
                return (
                  <label
                    key={q}
                    className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => onToggleQuarter(q)}
                      disabled={isSaving}
                      aria-label={`Quartal ${q}`}
                    />
                    <span>Q{q}</span>
                  </label>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
