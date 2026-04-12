"use client"

import { useEffect, useState } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Loader2, Save } from "lucide-react"
import type { Transaction, TransactionUpdateFields } from "@/lib/types"

interface EditTransactionDialogProps {
  transaction: Transaction | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (id: string, updates: TransactionUpdateFields) => Promise<void>
}

type BookingType = "einnahme" | "ausgabe"

interface FormState {
  booking_date: string
  value_date: string
  description: string
  bookingType: BookingType
  amountAbs: string
  balance_after: string
  category: string
  note: string
}

/**
 * Wandelt einen Zahl-String mit deutschem oder englischem Dezimaltrenner
 * in eine Number um. Gibt null zurück, wenn ungültig.
 */
function parseAmountInput(raw: string): number | null {
  const trimmed = raw.trim().replace(/\s/g, "").replace(",", ".")
  if (trimmed.length === 0) return null
  const num = Number(trimmed)
  if (!Number.isFinite(num)) return null
  return num
}

function toFormState(tx: Transaction): FormState {
  const amount = Number(tx.amount)
  return {
    booking_date: tx.booking_date ?? "",
    value_date: tx.value_date ?? "",
    description: tx.description ?? "",
    bookingType: amount >= 0 ? "einnahme" : "ausgabe",
    amountAbs: Math.abs(amount).toFixed(2).replace(".", ","),
    balance_after: Number(tx.balance_after).toFixed(2).replace(".", ","),
    category: tx.category ?? "",
    note: tx.note ?? "",
  }
}

export function EditTransactionDialog({
  transaction,
  open,
  onOpenChange,
  onSave,
}: EditTransactionDialogProps) {
  const [form, setForm] = useState<FormState | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Formular neu befüllen, sobald sich die Transaktion ändert
  useEffect(() => {
    if (transaction && open) {
      setForm(toFormState(transaction))
      setError(null)
    }
    if (!open) {
      setForm(null)
      setError(null)
    }
  }, [transaction, open])

  if (!form || !transaction) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent />
      </Dialog>
    )
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  async function handleSave() {
    if (!form || !transaction) return
    setError(null)

    // Beträge parsen und validieren
    const amountAbs = parseAmountInput(form.amountAbs)
    if (amountAbs === null || amountAbs < 0) {
      setError("Bitte einen gültigen Betrag eingeben.")
      return
    }
    const balance = parseAmountInput(form.balance_after)
    if (balance === null) {
      setError("Bitte einen gültigen Saldo eingeben.")
      return
    }

    if (!form.description.trim()) {
      setError("Der Buchungstext darf nicht leer sein.")
      return
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.booking_date)) {
      setError("Bitte ein gültiges Buchungsdatum wählen.")
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.value_date)) {
      setError("Bitte ein gültiges Wertstellungsdatum wählen.")
      return
    }

    const signedAmount = form.bookingType === "einnahme" ? amountAbs : -amountAbs

    const updates: TransactionUpdateFields = {
      booking_date: form.booking_date,
      value_date: form.value_date,
      description: form.description.trim(),
      amount: signedAmount,
      balance_after: balance,
      category: form.category.trim() ? form.category.trim() : null,
      note: form.note.trim() ? form.note.trim() : null,
    }

    setIsSaving(true)
    try {
      await onSave(transaction.id, updates)
      onOpenChange(false)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Fehler beim Speichern der Buchung."
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Buchung bearbeiten</DialogTitle>
          <DialogDescription>
            Korrigiere Datum, Text, Betrag oder Saldo dieser Buchung. Änderungen
            werden sofort gespeichert.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Datumsfelder */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="booking_date">Buchungsdatum</Label>
              <Input
                id="booking_date"
                type="date"
                value={form.booking_date}
                onChange={(e) => updateField("booking_date", e.target.value)}
                disabled={isSaving}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="value_date">Wertstellung</Label>
              <Input
                id="value_date"
                type="date"
                value={form.value_date}
                onChange={(e) => updateField("value_date", e.target.value)}
                disabled={isSaving}
              />
            </div>
          </div>

          {/* Buchungstext */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Buchungstext</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              rows={3}
              maxLength={500}
              disabled={isSaving}
              placeholder="z. B. Mitgliedsbeitrag 2026"
            />
          </div>

          {/* Einnahme / Ausgabe + Betrag */}
          <div className="space-y-2">
            <Label>Art der Buchung</Label>
            <RadioGroup
              value={form.bookingType}
              onValueChange={(v) => updateField("bookingType", v as BookingType)}
              className="flex gap-4"
              disabled={isSaving}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="einnahme" id="einnahme" />
                <Label htmlFor="einnahme" className="cursor-pointer font-normal">
                  Einnahme (Haben)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="ausgabe" id="ausgabe" />
                <Label htmlFor="ausgabe" className="cursor-pointer font-normal">
                  Ausgabe (Soll)
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Betrag (€)</Label>
              <Input
                id="amount"
                type="text"
                inputMode="decimal"
                value={form.amountAbs}
                onChange={(e) => updateField("amountAbs", e.target.value)}
                disabled={isSaving}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="balance">Saldo nach Buchung (€)</Label>
              <Input
                id="balance"
                type="text"
                inputMode="decimal"
                value={form.balance_after}
                onChange={(e) => updateField("balance_after", e.target.value)}
                disabled={isSaving}
                placeholder="0,00"
              />
            </div>
          </div>

          {/* Kategorie */}
          <div className="space-y-1.5">
            <Label htmlFor="category">Kategorie (optional)</Label>
            <Input
              id="category"
              type="text"
              value={form.category}
              onChange={(e) => updateField("category", e.target.value)}
              maxLength={100}
              disabled={isSaving}
              placeholder="z. B. Spenden, Mitgliedsbeitrag, Miete"
            />
          </div>

          {/* Bemerkung */}
          <div className="space-y-1.5">
            <Label htmlFor="note">Bemerkung (optional)</Label>
            <Textarea
              id="note"
              value={form.note}
              onChange={(e) => updateField("note", e.target.value)}
              rows={2}
              maxLength={1000}
              disabled={isSaving}
              placeholder="Interne Notiz zur Buchung"
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
