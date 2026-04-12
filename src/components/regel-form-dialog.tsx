"use client"

import { useEffect, useState } from "react"
import { AlertCircle, Loader2 } from "lucide-react"
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
import { useCategories } from "@/hooks/use-categories"
import {
  createCategorizationRule,
  updateCategorizationRule,
} from "@/hooks/use-categorization-rules"
import type {
  AmountDirection,
  AmountRangeCondition,
  CategorizationRule,
  CategorizationRuleCondition,
  CategorizationRuleType,
  CounterpartContainsCondition,
  MonthQuarterCondition,
  TextContainsCondition,
} from "@/lib/types"

interface RegelFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Falls gesetzt: Bearbeitungsmodus */
  rule?: CategorizationRule | null
  onSaved?: () => void
}

const RULE_TYPE_LABELS: Record<CategorizationRuleType, string> = {
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

type MonthQuarterMode = "months" | "quarters"

export function RegelFormDialog({
  open,
  onOpenChange,
  rule,
  onSaved,
}: RegelFormDialogProps) {
  const categories = useCategories()

  const [name, setName] = useState("")
  const [ruleType, setRuleType] =
    useState<CategorizationRuleType>("text_contains")
  const [categoryId, setCategoryId] = useState<string>("")
  const [isActive, setIsActive] = useState(true)

  // Typ-spezifische Felder
  const [term, setTerm] = useState("")
  const [amountMin, setAmountMin] = useState("")
  const [amountMax, setAmountMax] = useState("")
  const [amountDirection, setAmountDirection] =
    useState<AmountDirection>("both")
  const [mqMode, setMqMode] = useState<MonthQuarterMode>("months")
  const [selectedMonths, setSelectedMonths] = useState<number[]>([])
  const [selectedQuarters, setSelectedQuarters] = useState<number[]>([])

  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const isEdit = !!rule

  // Beim Öffnen Formular befüllen/zurücksetzen
  useEffect(() => {
    if (!open) return
    setError(null)

    if (rule) {
      setName(rule.name)
      setRuleType(rule.rule_type)
      setCategoryId(rule.category_id)
      setIsActive(rule.is_active)

      switch (rule.rule_type) {
        case "text_contains":
        case "counterpart_contains": {
          const cond = rule.condition as TextContainsCondition
          setTerm(cond.term ?? "")
          break
        }
        case "amount_range": {
          const cond = rule.condition as AmountRangeCondition
          setAmountMin(
            cond.min !== undefined
              ? cond.min.toString().replace(".", ",")
              : ""
          )
          setAmountMax(
            cond.max !== undefined
              ? cond.max.toString().replace(".", ",")
              : ""
          )
          setAmountDirection(cond.direction ?? "both")
          break
        }
        case "month_quarter": {
          const cond = rule.condition as MonthQuarterCondition
          if (cond.months && cond.months.length > 0) {
            setMqMode("months")
            setSelectedMonths(cond.months)
            setSelectedQuarters([])
          } else if (cond.quarters && cond.quarters.length > 0) {
            setMqMode("quarters")
            setSelectedQuarters(cond.quarters)
            setSelectedMonths([])
          }
          break
        }
      }
    } else {
      setName("")
      setRuleType("text_contains")
      setCategoryId(categories[0]?.id ?? "")
      setIsActive(true)
      setTerm("")
      setAmountMin("")
      setAmountMax("")
      setAmountDirection("both")
      setMqMode("months")
      setSelectedMonths([])
      setSelectedQuarters([])
    }
  }, [open, rule, categories])

  function toggleMonth(month: number) {
    setSelectedMonths((prev) =>
      prev.includes(month) ? prev.filter((m) => m !== month) : [...prev, month]
    )
  }

  function toggleQuarter(q: number) {
    setSelectedQuarters((prev) =>
      prev.includes(q) ? prev.filter((x) => x !== q) : [...prev, q]
    )
  }

  function buildCondition(): CategorizationRuleCondition | null {
    switch (ruleType) {
      case "text_contains":
      case "counterpart_contains": {
        const trimmed = term.trim()
        if (!trimmed) {
          setError("Bitte einen Suchbegriff eingeben.")
          return null
        }
        return { term: trimmed } satisfies
          | TextContainsCondition
          | CounterpartContainsCondition
      }
      case "amount_range": {
        const min = parseFloat(amountMin.replace(",", "."))
        const max = parseFloat(amountMax.replace(",", "."))
        if (isNaN(min) || isNaN(max)) {
          setError("Von- und Bis-Betrag müssen gültige Zahlen sein.")
          return null
        }
        if (min > max) {
          setError("Der Von-Betrag darf nicht größer als der Bis-Betrag sein.")
          return null
        }
        return {
          min,
          max,
          direction: amountDirection,
        } satisfies AmountRangeCondition
      }
      case "month_quarter": {
        if (mqMode === "months") {
          if (selectedMonths.length === 0) {
            setError("Bitte mindestens einen Monat auswählen.")
            return null
          }
          return {
            months: [...selectedMonths].sort((a, b) => a - b),
          } satisfies MonthQuarterCondition
        } else {
          if (selectedQuarters.length === 0) {
            setError("Bitte mindestens ein Quartal auswählen.")
            return null
          }
          return {
            quarters: [...selectedQuarters].sort((a, b) => a - b),
          } satisfies MonthQuarterCondition
        }
      }
    }
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

    const condition = buildCondition()
    if (!condition) return

    setIsSaving(true)
    try {
      if (isEdit && rule) {
        await updateCategorizationRule(rule.id, {
          name: name.trim(),
          category_id: categoryId,
          is_active: isActive,
          condition,
        })
      } else {
        await createCategorizationRule({
          name: name.trim(),
          rule_type: ruleType,
          category_id: categoryId,
          is_active: isActive,
          condition,
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Regel bearbeiten" : "Neue Regel anlegen"}
          </DialogTitle>
          <DialogDescription>
            Definiere eine Bedingung, die beim Import automatisch eine Kategorie
            zuweist. Mehrere passende Regeln greifen gleichzeitig.
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

          <div className="space-y-1.5">
            <Label htmlFor="rule-type">Regeltyp</Label>
            <Select
              value={ruleType}
              onValueChange={(v) => setRuleType(v as CategorizationRuleType)}
              disabled={isSaving || isEdit}
            >
              <SelectTrigger id="rule-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  Object.keys(RULE_TYPE_LABELS) as CategorizationRuleType[]
                ).map((t) => (
                  <SelectItem key={t} value={t}>
                    {RULE_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isEdit && (
              <p className="text-xs text-muted-foreground">
                Der Regeltyp kann nach dem Anlegen nicht mehr geändert werden.
              </p>
            )}
          </div>

          {/* Typ-spezifische Felder */}
          {(ruleType === "text_contains" ||
            ruleType === "counterpart_contains") && (
            <div className="space-y-1.5">
              <Label htmlFor="rule-term">
                {ruleType === "text_contains"
                  ? "Suchbegriff im Buchungstext"
                  : "Suchbegriff im Auftraggeber/Empfänger"}
              </Label>
              <Input
                id="rule-term"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="z. B. SEPA oder Max Mustermann"
                maxLength={200}
                disabled={isSaving}
              />
              <p className="text-xs text-muted-foreground">
                Groß-/Kleinschreibung wird ignoriert.
              </p>
            </div>
          )}

          {ruleType === "amount_range" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="amount-min">Von (€)</Label>
                  <Input
                    id="amount-min"
                    inputMode="decimal"
                    value={amountMin}
                    onChange={(e) => setAmountMin(e.target.value)}
                    placeholder="10,00"
                    disabled={isSaving}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="amount-max">Bis (€)</Label>
                  <Input
                    id="amount-max"
                    inputMode="decimal"
                    value={amountMax}
                    onChange={(e) => setAmountMax(e.target.value)}
                    placeholder="20,00"
                    disabled={isSaving}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="amount-direction">Richtung</Label>
                <Select
                  value={amountDirection}
                  onValueChange={(v) =>
                    setAmountDirection(v as AmountDirection)
                  }
                  disabled={isSaving}
                >
                  <SelectTrigger id="amount-direction">
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
                Beträge werden als absolute Werte verglichen. „Eingang“ meint
                positive, „Ausgang“ negative Buchungen.
              </p>
            </div>
          )}

          {ruleType === "month_quarter" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={mqMode === "months" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMqMode("months")}
                  disabled={isSaving}
                >
                  Monate
                </Button>
                <Button
                  type="button"
                  variant={mqMode === "quarters" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMqMode("quarters")}
                  disabled={isSaving}
                >
                  Quartale
                </Button>
              </div>

              {mqMode === "months" ? (
                <div
                  className="grid grid-cols-3 gap-2"
                  role="group"
                  aria-label="Monate auswählen"
                >
                  {MONTH_NAMES.map((label, idx) => {
                    const month = idx + 1
                    const checked = selectedMonths.includes(month)
                    return (
                      <label
                        key={month}
                        className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm hover:bg-accent"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleMonth(month)}
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
                    const checked = selectedQuarters.includes(q)
                    return (
                      <label
                        key={q}
                        className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm hover:bg-accent"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleQuarter(q)}
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
                Noch keine Kategorien angelegt. Lege zuerst im Tab „Kategorien“
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
