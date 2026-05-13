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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Loader2, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"
import type { Spender } from "@/lib/types"

interface SpenderBearbeitenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  spender: Spender | null
  onSaved?: (spender: Spender) => void
  /** Wird aufgerufen, wenn der Spender erfolgreich gelöscht wurde. */
  onDeleted?: (spenderId: string) => void
}

interface FormState {
  name: string
  strasse: string
  plz: string
  ort: string
  email: string
  iban: string
}

const EMPTY: FormState = {
  name: "",
  strasse: "",
  plz: "",
  ort: "",
  email: "",
  iban: "",
}

/**
 * PROJ-17: Dialog zum Bearbeiten eines Spender-Datensatzes.
 * Wird aus der Quittungs-Historie oder Spender-Übersicht geöffnet.
 */
export function SpenderBearbeitenDialog({
  open,
  onOpenChange,
  spender,
  onSaved,
  onDeleted,
}: SpenderBearbeitenDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (!open || !spender) return
    setForm({
      name: spender.name ?? "",
      strasse: spender.strasse ?? "",
      plz: spender.plz ?? "",
      ort: spender.ort ?? "",
      email: spender.email ?? "",
      iban: spender.iban ?? "",
    })
    setError(null)
    setShowDeleteConfirm(false)
  }, [open, spender])

  const handleDelete = async () => {
    if (!spender) return
    setIsDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/spender/${spender.id}`, {
        method: "DELETE",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        // 409 = Spender hat noch Quittungen
        setError(
          data.error ||
            "Spender konnte nicht gelöscht werden."
        )
        setShowDeleteConfirm(false)
        return
      }
      toast.success(`Spender „${spender.name}" wurde gelöscht.`)
      onDeleted?.(spender.id)
      onOpenChange(false)
    } catch {
      setError("Netzwerkfehler beim Löschen.")
      setShowDeleteConfirm(false)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleSave = async () => {
    if (!spender) return
    if (!form.name.trim()) {
      setError("Name darf nicht leer sein.")
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/admin/spender/${spender.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          strasse: form.strasse.trim() || null,
          plz: form.plz.trim() || null,
          ort: form.ort.trim() || null,
          email: form.email.trim() || null,
          iban: form.iban.trim() || null,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error || "Spender konnte nicht gespeichert werden.")
        return
      }

      toast.success("Spenderdaten gespeichert.")
      onSaved?.(data.spender as Spender)
      onOpenChange(false)
    } catch {
      setError("Netzwerkfehler beim Speichern.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Spenderdaten bearbeiten</DialogTitle>
          <DialogDescription>
            Adresse oder E-Mail des Spenders aktualisieren. Bereits ausgestellte
            Quittungen bleiben unverändert (sie enthalten einen Snapshot der
            Daten zum Ausstellungszeitpunkt).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="spender-edit-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="spender-edit-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              maxLength={200}
              aria-required="true"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="spender-edit-strasse">Straße</Label>
            <Input
              id="spender-edit-strasse"
              value={form.strasse}
              onChange={(e) => setForm({ ...form, strasse: e.target.value })}
              maxLength={200}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
            <div className="space-y-2">
              <Label htmlFor="spender-edit-plz">PLZ</Label>
              <Input
                id="spender-edit-plz"
                value={form.plz}
                onChange={(e) => setForm({ ...form, plz: e.target.value })}
                maxLength={10}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="spender-edit-ort">Ort</Label>
              <Input
                id="spender-edit-ort"
                value={form.ort}
                onChange={(e) => setForm({ ...form, ort: e.target.value })}
                maxLength={100}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="spender-edit-email">E-Mail</Label>
            <Input
              id="spender-edit-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="spender-edit-iban">IBAN</Label>
            <Input
              id="spender-edit-iban"
              value={form.iban}
              onChange={(e) => setForm({ ...form, iban: e.target.value })}
              maxLength={34}
            />
          </div>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isSaving || isDeleting || !spender}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Spender löschen
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving || isDeleting}
            >
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={isSaving || isDeleting}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Speichern
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      {/* Löschen-Bestätigung */}
      <AlertDialog
        open={showDeleteConfirm}
        onOpenChange={(o) => {
          if (!o && !isDeleting) setShowDeleteConfirm(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Spender wirklich löschen?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Der Spender{" "}
                  <span className="font-medium">
                    &bdquo;{spender?.name}&ldquo;
                  </span>{" "}
                  wird unwiderruflich aus der Datenbank entfernt (DSGVO-Recht
                  auf Vergessenwerden).
                </p>
                <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                  <strong>Hinweis:</strong> Spender mit bereits ausgestellten
                  Quittungen können nicht gelöscht werden. Lösche zuerst alle
                  Quittungen dieses Spenders aus der Historie, dann ist das
                  Löschen möglich.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Endgültig löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
