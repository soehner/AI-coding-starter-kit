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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, FileText, Loader2, Save } from "lucide-react"
import { toast } from "sonner"
import type { Spendenquittung } from "@/lib/types"

interface SpendenquittungBearbeitenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Quittung, die bearbeitet werden soll (null = Dialog geschlossen). */
  quittung: Spendenquittung | null
  /** Wird nach erfolgreichem Speichern aufgerufen, damit die Tabelle aktualisiert. */
  onSaved?: (updated: Spendenquittung) => void
}

interface FormState {
  betrag: string
  spende_datum: string
  quittung_datum: string
  zweck: string
}

function formatBetragInput(value: number): string {
  return value.toFixed(2).replace(".", ",")
}

function parseBetragInput(raw: string): number | null {
  const trimmed = raw.trim().replace(/\s/g, "").replace(",", ".")
  if (!trimmed) return null
  const num = Number(trimmed)
  if (!Number.isFinite(num) || num <= 0) return null
  return num
}

/**
 * PROJ-17: Dialog zum Bearbeiten einer bestehenden Spendenquittung.
 *
 * Änderbar: Betrag, Spende-Datum, Ausstellungsdatum, Förderzweck.
 * Beim Speichern wird das PDF serverseitig neu erzeugt und im Storage
 * ersetzt; der ursprüngliche `verein_snapshot` bleibt unverändert.
 *
 * Spender und Buchungsbezug sind hier bewusst nicht änderbar – bei
 * solchen Änderungen sollte eine neue Quittung ausgestellt werden.
 */
export function SpendenquittungBearbeitenDialog({
  open,
  onOpenChange,
  quittung,
  onSaved,
}: SpendenquittungBearbeitenDialogProps) {
  const [form, setForm] = useState<FormState>({
    betrag: "",
    spende_datum: "",
    quittung_datum: "",
    zweck: "",
  })
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Formular aus Quittung füllen, wenn Dialog geöffnet wird
  useEffect(() => {
    if (open && quittung) {
      setForm({
        betrag: formatBetragInput(Number(quittung.betrag)),
        spende_datum: quittung.spende_datum,
        quittung_datum: quittung.quittung_datum,
        zweck: quittung.zweck,
      })
      setError(null)
    }
  }, [open, quittung])

  const handleSave = async () => {
    if (!quittung) return

    const betragNum = parseBetragInput(form.betrag)
    if (betragNum === null) {
      setError("Betrag muss eine positive Zahl sein.")
      return
    }
    if (!form.spende_datum || !form.quittung_datum) {
      setError("Spende-Datum und Ausstellungsdatum sind Pflichtfelder.")
      return
    }
    if (!form.zweck.trim()) {
      setError("Förderzweck darf nicht leer sein.")
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const payload: Record<string, unknown> = {}
      if (betragNum !== Number(quittung.betrag)) payload.betrag = betragNum
      if (form.spende_datum !== quittung.spende_datum)
        payload.spende_datum = form.spende_datum
      if (form.quittung_datum !== quittung.quittung_datum)
        payload.quittung_datum = form.quittung_datum
      if (form.zweck.trim() !== quittung.zweck)
        payload.zweck = form.zweck.trim()

      if (Object.keys(payload).length === 0) {
        toast.info("Keine Änderungen erkannt.")
        onOpenChange(false)
        return
      }

      const res = await fetch(`/api/admin/spendenquittungen/${quittung.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || "Quittung konnte nicht aktualisiert werden.")
        return
      }

      toast.success(
        `Quittung ${quittung.quittung_nummer} aktualisiert. PDF wurde neu erzeugt.`
      )
      onSaved?.(data.spendenquittung)
      onOpenChange(false)
    } catch {
      setError("Netzwerkfehler beim Speichern.")
    } finally {
      setIsSaving(false)
    }
  }

  if (!quittung) return null

  const versendetWarnung = !!quittung.email_versendet_am

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !isSaving) onOpenChange(false)
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" aria-hidden="true" />
            Quittung bearbeiten
          </DialogTitle>
          <DialogDescription>
            {quittung.quittung_nummer} — beim Speichern wird das PDF neu erzeugt.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {versendetWarnung && (
            <Alert
              variant="default"
              className="border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
            >
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Diese Quittung wurde bereits per E-Mail versendet. Der Empfänger
                hat die alte Version. Versende die neue Fassung ggf. erneut.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-betrag">
                Betrag (EUR) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-betrag"
                inputMode="decimal"
                value={form.betrag}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, betrag: e.target.value }))
                }
                placeholder="0,00"
                disabled={isSaving}
                aria-required="true"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-spende-datum">
                Datum der Zuwendung <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-spende-datum"
                type="date"
                value={form.spende_datum}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, spende_datum: e.target.value }))
                }
                disabled={isSaving}
                aria-required="true"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-quittung-datum">
              Ausstellungsdatum <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-quittung-datum"
              type="date"
              value={form.quittung_datum}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, quittung_datum: e.target.value }))
              }
              disabled={isSaving}
              aria-required="true"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-zweck">
              Förderzweck <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="edit-zweck"
              value={form.zweck}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, zweck: e.target.value }))
              }
              maxLength={500}
              rows={3}
              placeholder='z. B. "der Bildung und Erziehung"'
              disabled={isSaving}
              aria-required="true"
            />
            <p className="text-xs text-muted-foreground">
              Wird auf der Quittung in beide Pflichtsätze eingesetzt
              (&bdquo;Wir sind wegen Förderung &hellip;&ldquo;, &bdquo;Es wird
              bestätigt, dass die Zuwendung nur zur Förderung &hellip; verwendet
              wird&ldquo;).
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            Hinweis: Spender und Buchungsbezug bleiben unverändert. Bei
            solchen Änderungen bitte die alte Quittung löschen und eine neue
            ausstellen.
          </p>
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
            Speichern & PDF neu erzeugen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
