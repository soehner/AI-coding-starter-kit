"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { KeyboardEvent } from "react"
import Link from "next/link"
import {
  AlertCircle,
  Loader2,
  Mail,
  Plus,
  Sparkles,
  X,
} from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type {
  AmountDirection,
  Ueberwachungsregel,
  UeberwachungsBedingung,
  UeberwachungsCriterion,
  UeberwachungsCriterionType,
  UeberwachungsMuster,
  UeberwachungsRegelTyp,
  UeberwachungsRegelVorschlag,
  RuleCombinator,
} from "@/lib/types"

/** Regel-Datensatz aus der API inkl. serverseitiger Klartext-Zusammenfassung. */
export type UeberwachungsregelMitZusammenfassung = Ueberwachungsregel & {
  zusammenfassung: string
}

interface UeberwachungsregelFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Falls gesetzt: Bearbeitungsmodus */
  regel?: UeberwachungsregelMitZusammenfassung | null
  onSaved?: () => void
}

const CRITERION_TYPE_LABELS: Record<UeberwachungsCriterionType, string> = {
  text_contains: "Verwendungszweck enthält",
  counterpart_contains: "Empfänger/Auftraggeber enthält",
  amount_range: "Betrag im Bereich",
  iban_equals: "IBAN der Gegenseite ist",
}

const MAX_CRITERIA = 10
const MAX_EMPFAENGER = 20

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function euro(n: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(n)
}

// ---------------------------------------------------------------------------
// Kriterium-Drafts (UI-Zustand)
// ---------------------------------------------------------------------------

interface CriterionDraft {
  uid: string
  type: UeberwachungsCriterionType
  term: string
  amountMin: string
  amountMax: string
  amountDirection: AmountDirection
  iban: string
}

function newUid(): string {
  return Math.random().toString(36).slice(2, 10)
}

function emptyDraft(): CriterionDraft {
  return {
    uid: newUid(),
    type: "amount_range",
    term: "",
    amountMin: "",
    amountMax: "",
    amountDirection: "out",
    iban: "",
  }
}

function draftFromCriterion(c: UeberwachungsCriterion): CriterionDraft {
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
    case "iban_equals":
      base.iban = c.iban ?? ""
      break
  }
  return base
}

function serializeDraft(
  draft: CriterionDraft,
  index: number
): { criterion: UeberwachungsCriterion } | { error: string } {
  const prefix = `Kriterium ${index + 1}: `
  switch (draft.type) {
    case "text_contains":
    case "counterpart_contains": {
      const trimmed = draft.term.trim()
      if (!trimmed) {
        return { error: prefix + "Bitte einen Suchbegriff eingeben." }
      }
      const criterion: UeberwachungsCriterion =
        draft.type === "text_contains"
          ? { type: "text_contains", term: trimmed }
          : { type: "counterpart_contains", term: trimmed }
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
            prefix + "Der Von-Betrag darf nicht größer als der Bis-Betrag sein.",
        }
      }
      return {
        criterion: {
          type: "amount_range",
          min,
          max,
          direction: draft.amountDirection,
        },
      }
    }
    case "iban_equals": {
      const iban = draft.iban.replace(/\s+/g, "").toUpperCase()
      if (!iban) {
        return { error: prefix + "Bitte eine IBAN eingeben." }
      }
      return { criterion: { type: "iban_equals", iban } }
    }
  }
}

// ---------------------------------------------------------------------------
// Klartext-Vorschau (clientseitig, spiegelt beschreibeUeberwachungsregel)
// ---------------------------------------------------------------------------

function beschreibeCriterion(c: UeberwachungsCriterion): string {
  switch (c.type) {
    case "text_contains":
      return `Verwendungszweck enthält „${c.term}“`
    case "counterpart_contains":
      return `Empfänger/Auftraggeber enthält „${c.term}“`
    case "amount_range": {
      const dir =
        c.direction === "in"
          ? "Eingang"
          : c.direction === "out"
            ? "Ausgang"
            : "Ein-/Ausgang"
      return `Betrag zwischen ${euro(c.min)} und ${euro(c.max)} (${dir})`
    }
    case "iban_equals":
      return `IBAN der Gegenseite ist ${c.iban}`
  }
}

function beschreibeBedingung(
  regelTyp: UeberwachungsRegelTyp,
  bedingung: UeberwachungsBedingung
): string {
  const criteria = bedingung.criteria ?? []
  const verknuepfung = bedingung.combinator === "OR" ? " oder " : " und "
  const kriterienText =
    criteria.length > 0
      ? criteria.map(beschreibeCriterion).join(verknuepfung)
      : "(keine Kriterien)"

  if (regelTyp === "muster" && bedingung.muster) {
    const { art, schwelle, zeitfenster_tage } = bedingung.muster
    const musterText =
      art === "anzahl"
        ? `mindestens ${schwelle}-mal innerhalb von ${zeitfenster_tage} Tagen`
        : `in Summe mehr als ${euro(schwelle)} innerhalb von ${zeitfenster_tage} Tagen`
    return `Benachrichtigung, wenn Buchungen (${kriterienText}) ${musterText} auftreten.`
  }

  return `Benachrichtigung, wenn eine Buchung folgende Bedingung erfüllt: ${kriterienText}.`
}

// ---------------------------------------------------------------------------
// Hauptkomponente
// ---------------------------------------------------------------------------

export function UeberwachungsregelFormDialog({
  open,
  onOpenChange,
  regel,
  onSaved,
}: UeberwachungsregelFormDialogProps) {
  const isEdit = !!regel

  const [name, setName] = useState("")
  const [regelTyp, setRegelTyp] = useState<UeberwachungsRegelTyp>("einzelbuchung")
  const [combinator, setCombinator] = useState<RuleCombinator>("AND")
  const [criteria, setCriteria] = useState<CriterionDraft[]>([emptyDraft()])
  const [musterArt, setMusterArt] = useState<"anzahl" | "summe">("anzahl")
  const [musterSchwelle, setMusterSchwelle] = useState("")
  const [musterZeitfenster, setMusterZeitfenster] = useState("30")
  const [empfaenger, setEmpfaenger] = useState<string[]>([])
  const [empfaengerInput, setEmpfaengerInput] = useState("")
  const [istAktiv, setIstAktiv] = useState(true)
  const [freitext, setFreitext] = useState("")

  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // KI-Übersetzung
  const [kiConfigured, setKiConfigured] = useState<boolean | null>(null)
  const [isTranslating, setIsTranslating] = useState(false)
  const [translateError, setTranslateError] = useState<string | null>(null)
  const [kiVorschlag, setKiVorschlag] =
    useState<UeberwachungsRegelVorschlag | null>(null)

  // Formular befüllen/zurücksetzen beim Öffnen
  useEffect(() => {
    if (!open) return
    setError(null)
    setTranslateError(null)
    setKiVorschlag(null)
    setEmpfaengerInput("")

    if (regel) {
      setName(regel.name)
      setRegelTyp(regel.regel_typ)
      setCombinator(regel.bedingung?.combinator ?? "AND")
      const existing = regel.bedingung?.criteria ?? []
      setCriteria(
        existing.length > 0 ? existing.map(draftFromCriterion) : [emptyDraft()]
      )
      const muster = regel.bedingung?.muster
      setMusterArt(muster?.art ?? "anzahl")
      setMusterSchwelle(
        muster?.schwelle != null
          ? muster.schwelle.toString().replace(".", ",")
          : ""
      )
      setMusterZeitfenster(
        muster?.zeitfenster_tage != null
          ? muster.zeitfenster_tage.toString()
          : "30"
      )
      setEmpfaenger(regel.empfaenger ?? [])
      setIstAktiv(regel.ist_aktiv)
      setFreitext(regel.freitext_original ?? "")
    } else {
      setName("")
      setRegelTyp("einzelbuchung")
      setCombinator("AND")
      setCriteria([emptyDraft()])
      setMusterArt("anzahl")
      setMusterSchwelle("")
      setMusterZeitfenster("30")
      setEmpfaenger([])
      setIstAktiv(true)
      setFreitext("")
    }
  }, [open, regel])

  // KI-Konfiguration prüfen (für Übersetzen-Button vs. Hinweisbanner)
  useEffect(() => {
    if (!open) return
    let aktiv = true
    setKiConfigured(null)
    ;(async () => {
      try {
        const res = await fetch("/api/admin/settings")
        if (!res.ok) {
          if (aktiv) setKiConfigured(false)
          return
        }
        const data = await res.json()
        if (aktiv) setKiConfigured(!!data.hasToken)
      } catch {
        if (aktiv) setKiConfigured(false)
      }
    })()
    return () => {
      aktiv = false
    }
  }, [open])

  const livePreview = useMemo(() => {
    const serialized: UeberwachungsCriterion[] = []
    for (let i = 0; i < criteria.length; i++) {
      const result = serializeDraft(criteria[i], i)
      if ("error" in result) return null
      serialized.push(result.criterion)
    }
    let muster: UeberwachungsMuster | undefined
    if (regelTyp === "muster") {
      const schwelle = parseFloat(musterSchwelle.replace(",", "."))
      const zeit = parseInt(musterZeitfenster, 10)
      if (isNaN(schwelle) || isNaN(zeit)) return null
      muster = { art: musterArt, schwelle, zeitfenster_tage: zeit }
    }
    return beschreibeBedingung(regelTyp, { combinator, criteria: serialized, muster })
  }, [
    criteria,
    combinator,
    regelTyp,
    musterArt,
    musterSchwelle,
    musterZeitfenster,
  ])

  function updateDraft(uid: string, patch: Partial<CriterionDraft>) {
    setCriteria((prev) =>
      prev.map((d) => (d.uid === uid ? { ...d, ...patch } : d))
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

  function addEmpfaenger() {
    const value = empfaengerInput.trim().toLowerCase()
    if (!value) return
    if (!EMAIL_REGEX.test(value)) {
      setError(`„${value}“ ist keine gültige E-Mail-Adresse.`)
      return
    }
    if (empfaenger.includes(value)) {
      setEmpfaengerInput("")
      return
    }
    if (empfaenger.length >= MAX_EMPFAENGER) {
      setError(`Maximal ${MAX_EMPFAENGER} Empfänger pro Regel.`)
      return
    }
    setError(null)
    setEmpfaenger((prev) => [...prev, value])
    setEmpfaengerInput("")
  }

  function removeEmpfaenger(email: string) {
    setEmpfaenger((prev) => prev.filter((e) => e !== email))
  }

  function handleEmpfaengerKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      addEmpfaenger()
    }
  }

  const applyVorschlag = useCallback((vorschlag: UeberwachungsRegelVorschlag) => {
    setRegelTyp(vorschlag.regel_typ)
    setCombinator(vorschlag.bedingung.combinator ?? "AND")
    const crit = vorschlag.bedingung.criteria ?? []
    setCriteria(crit.length > 0 ? crit.map(draftFromCriterion) : [emptyDraft()])
    if (vorschlag.bedingung.muster) {
      setMusterArt(vorschlag.bedingung.muster.art)
      setMusterSchwelle(
        vorschlag.bedingung.muster.schwelle.toString().replace(".", ",")
      )
      setMusterZeitfenster(
        vorschlag.bedingung.muster.zeitfenster_tage.toString()
      )
    }
    setName((prev) => prev.trim() || vorschlag.name_vorschlag)
  }, [])

  async function handleTranslate() {
    setTranslateError(null)
    setKiVorschlag(null)
    const text = freitext.trim()
    if (text.length < 5) {
      setTranslateError(
        "Bitte beschreibe die Regel in mindestens ein paar Worten."
      )
      return
    }
    setIsTranslating(true)
    try {
      const res = await fetch(
        "/api/admin/ueberwachungsregeln/uebersetzen",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ freitext: text }),
        }
      )
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        if (data?.code === "kein_ki_token") {
          setKiConfigured(false)
          return
        }
        setTranslateError(
          data?.error ?? "Die Regel konnte nicht übersetzt werden."
        )
        return
      }
      const vorschlag = data.vorschlag as UeberwachungsRegelVorschlag
      setKiVorschlag(vorschlag)
      applyVorschlag(vorschlag)
    } catch {
      setTranslateError(
        "Die Regel konnte nicht übersetzt werden. Bitte versuche es erneut."
      )
    } finally {
      setIsTranslating(false)
    }
  }

  async function handleSave() {
    setError(null)

    if (!name.trim()) {
      setError("Bitte einen Regelnamen eingeben.")
      return
    }
    if (criteria.length === 0) {
      setError("Mindestens ein Kriterium ist erforderlich.")
      return
    }

    const serialized: UeberwachungsCriterion[] = []
    for (let i = 0; i < criteria.length; i++) {
      const result = serializeDraft(criteria[i], i)
      if ("error" in result) {
        setError(result.error)
        return
      }
      serialized.push(result.criterion)
    }

    let muster: UeberwachungsMuster | undefined
    if (regelTyp === "muster") {
      const schwelle = parseFloat(musterSchwelle.replace(",", "."))
      const zeit = parseInt(musterZeitfenster, 10)
      if (isNaN(schwelle) || schwelle <= 0) {
        setError("Bitte einen gültigen Schwellwert für das Muster angeben.")
        return
      }
      if (isNaN(zeit) || zeit < 1 || zeit > 366) {
        setError("Das Zeitfenster muss zwischen 1 und 366 Tagen liegen.")
        return
      }
      muster = { art: musterArt, schwelle, zeitfenster_tage: zeit }
    }

    if (empfaenger.length === 0) {
      setError("Bitte mindestens einen E-Mail-Empfänger hinterlegen.")
      return
    }

    const bedingung = {
      regel_typ: regelTyp,
      combinator,
      criteria: serialized,
      ...(muster ? { muster } : {}),
    }

    const payload = {
      name: name.trim(),
      freitext_original: freitext.trim() || undefined,
      bedingung,
      empfaenger,
      ist_aktiv: istAktiv,
    }

    setIsSaving(true)
    try {
      const res = await fetch(
        isEdit
          ? `/api/admin/ueberwachungsregeln/${regel!.id}`
          : "/api/admin/ueberwachungsregeln",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      )
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error ?? "Fehler beim Speichern der Regel.")
        return
      }
      onSaved?.()
      onOpenChange(false)
    } catch {
      setError("Fehler beim Speichern der Regel. Bitte versuche es erneut.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? "Überwachungsregel bearbeiten"
              : "Neue Überwachungsregel"}
          </DialogTitle>
          <DialogDescription>
            Beschreibe in eigenen Worten, wann du benachrichtigt werden willst.
            Die KI übersetzt deinen Text in eine Regel, die du vor dem Speichern
            prüfen und anpassen kannst.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* --- KI-Freitext-Übersetzung --- */}
          <div className="space-y-2 rounded-md border p-3">
            <Label htmlFor="watch-freitext" className="text-sm font-medium">
              Regel in eigenen Worten
            </Label>
            <Textarea
              id="watch-freitext"
              value={freitext}
              onChange={(e) => setFreitext(e.target.value)}
              placeholder="z. B. Benachrichtige mich, wenn regelmäßig ein kleiner Betrag unter 100 € abgebucht wird."
              rows={3}
              maxLength={2000}
              disabled={isSaving || isTranslating}
            />

            {kiConfigured === false ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Kein KI-Anbieter konfiguriert. Hinterlege in den{" "}
                  <Link
                    href="/dashboard/einstellungen?tab=integration"
                    className="font-medium underline underline-offset-2"
                  >
                    Einstellungen
                  </Link>{" "}
                  einen KI-Anbieter und Token, um Regeln automatisch übersetzen
                  zu lassen. Du kannst die Regel unten auch manuell definieren.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleTranslate}
                  disabled={
                    isSaving || isTranslating || kiConfigured === null
                  }
                >
                  {isTranslating ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1.5 h-4 w-4" />
                  )}
                  {kiVorschlag ? "Erneut übersetzen" : "Regel übersetzen"}
                </Button>
                <span className="text-xs text-muted-foreground">
                  Optional – du kannst die Regel auch direkt unten anpassen.
                </span>
              </div>
            )}

            {translateError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{translateError}</AlertDescription>
              </Alert>
            )}
          </div>

          {/* --- Klartext-Vorschau --- */}
          {(kiVorschlag || livePreview) && (
            <div className="space-y-1.5 rounded-md border border-primary/40 bg-primary/5 p-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  Was diese Regel prüft
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {livePreview ?? kiVorschlag?.zusammenfassung}
              </p>
              {kiVorschlag && (
                <p className="text-xs text-muted-foreground">
                  Prüfe die Zusammenfassung. Passt etwas nicht, ändere den Text
                  und übersetze erneut oder korrigiere die Felder unten.
                </p>
              )}
            </div>
          )}

          {/* --- Name --- */}
          <div className="space-y-1.5">
            <Label htmlFor="watch-name">Regelname</Label>
            <Input
              id="watch-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z. B. Ungewöhnlich hohe Abbuchung"
              maxLength={120}
              disabled={isSaving}
            />
          </div>

          {/* --- Regeltyp --- */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Regeltyp</Label>
            <RadioGroup
              value={regelTyp}
              onValueChange={(v) => setRegelTyp(v as UeberwachungsRegelTyp)}
              disabled={isSaving}
              className="flex flex-col gap-2 sm:flex-row sm:gap-4"
            >
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <RadioGroupItem
                  value="einzelbuchung"
                  id="typ-einzel"
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">Einzelbuchung</span>
                  <span className="block text-xs text-muted-foreground">
                    Jede einzelne Buchung wird geprüft
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <RadioGroupItem value="muster" id="typ-muster" className="mt-0.5" />
                <span>
                  <span className="font-medium">Muster</span>
                  <span className="block text-xs text-muted-foreground">
                    Wiederkehrende Buchungen über ein Zeitfenster
                  </span>
                </span>
              </label>
            </RadioGroup>
          </div>

          {/* --- Kriterien --- */}
          <div className="space-y-3 rounded-md border p-3">
            <Label className="text-sm font-medium">Kriterien</Label>
            {criteria.length > 1 && (
              <RadioGroup
                value={combinator}
                onValueChange={(v) => setCombinator(v as RuleCombinator)}
                disabled={isSaving}
                className="flex flex-col gap-1.5 sm:flex-row sm:gap-4"
              >
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <RadioGroupItem value="AND" id="watch-combinator-and" />
                  <span>Alle Kriterien müssen zutreffen (UND)</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <RadioGroupItem value="OR" id="watch-combinator-or" />
                  <span>Mindestens ein Kriterium trifft zu (ODER)</span>
                </label>
              </RadioGroup>
            )}

            <div className="space-y-3">
              {criteria.map((draft, idx) => (
                <CriterionRow
                  key={draft.uid}
                  draft={draft}
                  index={idx}
                  canDelete={criteria.length > 1}
                  isSaving={isSaving}
                  onChange={(patch) => updateDraft(draft.uid, patch)}
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

          {/* --- Muster-Parameter --- */}
          {regelTyp === "muster" && (
            <div className="space-y-3 rounded-md border p-3">
              <Label className="text-sm font-medium">Muster-Parameter</Label>
              <div className="space-y-1.5">
                <Label htmlFor="muster-art" className="text-xs">
                  Art des Musters
                </Label>
                <Select
                  value={musterArt}
                  onValueChange={(v) => setMusterArt(v as "anzahl" | "summe")}
                  disabled={isSaving}
                >
                  <SelectTrigger id="muster-art">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="anzahl">
                      Anzahl (mindestens N-mal)
                    </SelectItem>
                    <SelectItem value="summe">
                      Summe (überschreitet Betrag)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="muster-schwelle" className="text-xs">
                    {musterArt === "anzahl"
                      ? "Anzahl (mindestens)"
                      : "Summe (€, mehr als)"}
                  </Label>
                  <Input
                    id="muster-schwelle"
                    inputMode="decimal"
                    value={musterSchwelle}
                    onChange={(e) => setMusterSchwelle(e.target.value)}
                    placeholder={musterArt === "anzahl" ? "3" : "500,00"}
                    disabled={isSaving}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="muster-zeit" className="text-xs">
                    Zeitfenster (Tage)
                  </Label>
                  <Input
                    id="muster-zeit"
                    inputMode="numeric"
                    value={musterZeitfenster}
                    onChange={(e) => setMusterZeitfenster(e.target.value)}
                    placeholder="30"
                    disabled={isSaving}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {musterArt === "anzahl"
                  ? "Alarm, wenn passende Buchungen mindestens so oft im Zeitfenster auftreten."
                  : "Alarm, wenn die Summe passender Buchungen den Betrag im Zeitfenster überschreitet."}
              </p>
            </div>
          )}

          {/* --- Empfänger --- */}
          <div className="space-y-2 rounded-md border p-3">
            <Label htmlFor="watch-empfaenger" className="text-sm font-medium">
              E-Mail-Empfänger
            </Label>
            <div className="flex gap-2">
              <Input
                id="watch-empfaenger"
                type="email"
                value={empfaengerInput}
                onChange={(e) => setEmpfaengerInput(e.target.value)}
                onKeyDown={handleEmpfaengerKeyDown}
                placeholder="name@beispiel.de"
                maxLength={200}
                disabled={isSaving || empfaenger.length >= MAX_EMPFAENGER}
              />
              <Button
                type="button"
                variant="outline"
                onClick={addEmpfaenger}
                disabled={isSaving || empfaenger.length >= MAX_EMPFAENGER}
              >
                <Plus className="h-4 w-4" />
                <span className="sr-only">Empfänger hinzufügen</span>
              </Button>
            </div>
            {empfaenger.length > 0 ? (
              <ul className="flex flex-wrap gap-2" aria-label="Empfänger">
                {empfaenger.map((email) => (
                  <li key={email}>
                    <Badge
                      variant="secondary"
                      className="gap-1.5 py-1 pl-2 pr-1 text-xs"
                    >
                      <Mail className="h-3 w-3" aria-hidden="true" />
                      <span className="max-w-[180px] truncate">{email}</span>
                      <button
                        type="button"
                        onClick={() => removeEmpfaenger(email)}
                        disabled={isSaving}
                        className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                        aria-label={`${email} entfernen`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                Noch keine Empfänger. Diese Adressen werden bei einem Treffer
                benachrichtigt.
              </p>
            )}
          </div>

          {/* --- Aktiv --- */}
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={istAktiv}
              onCheckedChange={(v) => setIstAktiv(v === true)}
              disabled={isSaving}
              aria-label="Regel aktiv"
            />
            <span>Regel ist aktiv (deaktivierte Regeln lösen keinen Alarm aus)</span>
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
// CriterionRow
// ---------------------------------------------------------------------------

interface CriterionRowProps {
  draft: CriterionDraft
  index: number
  canDelete: boolean
  isSaving: boolean
  onChange: (patch: Partial<CriterionDraft>) => void
  onRemove: () => void
}

function CriterionRow({
  draft,
  index,
  canDelete,
  isSaving,
  onChange,
  onRemove,
}: CriterionRowProps) {
  return (
    <div className="space-y-3 rounded-md border border-dashed p-3">
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor={`watch-criterion-type-${draft.uid}`} className="text-xs">
            Kriterium {index + 1}
          </Label>
          <Select
            value={draft.type}
            onValueChange={(v) =>
              onChange({ type: v as UeberwachungsCriterionType })
            }
            disabled={isSaving}
          >
            <SelectTrigger id={`watch-criterion-type-${draft.uid}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(
                Object.keys(CRITERION_TYPE_LABELS) as UeberwachungsCriterionType[]
              ).map((t) => (
                <SelectItem key={t} value={t}>
                  {CRITERION_TYPE_LABELS[t]}
                </SelectItem>
              ))}
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
          <Label htmlFor={`watch-criterion-term-${draft.uid}`}>
            {draft.type === "text_contains"
              ? "Suchbegriff im Verwendungszweck"
              : "Suchbegriff im Empfänger/Auftraggeber"}
          </Label>
          <Input
            id={`watch-criterion-term-${draft.uid}`}
            value={draft.term}
            onChange={(e) => onChange({ term: e.target.value })}
            placeholder="z. B. PayPal oder Max Mustermann"
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
              <Label htmlFor={`watch-criterion-min-${draft.uid}`}>Von (€)</Label>
              <Input
                id={`watch-criterion-min-${draft.uid}`}
                inputMode="decimal"
                value={draft.amountMin}
                onChange={(e) => onChange({ amountMin: e.target.value })}
                placeholder="0,00"
                disabled={isSaving}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`watch-criterion-max-${draft.uid}`}>Bis (€)</Label>
              <Input
                id={`watch-criterion-max-${draft.uid}`}
                inputMode="decimal"
                value={draft.amountMax}
                onChange={(e) => onChange({ amountMax: e.target.value })}
                placeholder="100,00"
                disabled={isSaving}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`watch-criterion-direction-${draft.uid}`}>
              Richtung
            </Label>
            <Select
              value={draft.amountDirection}
              onValueChange={(v) =>
                onChange({ amountDirection: v as AmountDirection })
              }
              disabled={isSaving}
            >
              <SelectTrigger id={`watch-criterion-direction-${draft.uid}`}>
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

      {draft.type === "iban_equals" && (
        <div className="space-y-1.5">
          <Label htmlFor={`watch-criterion-iban-${draft.uid}`}>
            IBAN der Gegenseite
          </Label>
          <Input
            id={`watch-criterion-iban-${draft.uid}`}
            value={draft.iban}
            onChange={(e) => onChange({ iban: e.target.value })}
            placeholder="DE00 0000 0000 0000 0000 00"
            maxLength={40}
            disabled={isSaving}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Leerzeichen werden automatisch entfernt.
          </p>
        </div>
      )}
    </div>
  )
}
