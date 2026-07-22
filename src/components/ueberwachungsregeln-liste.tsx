"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertCircle, Mail, Pencil, Plus, Trash2 } from "lucide-react"
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
import { Skeleton } from "@/components/ui/skeleton"
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
  UeberwachungsregelFormDialog,
  type UeberwachungsregelMitZusammenfassung,
} from "@/components/ueberwachungsregel-form-dialog"

export function UeberwachungsregelnListe() {
  const [regeln, setRegeln] = useState<UeberwachungsregelMitZusammenfassung[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editingRegel, setEditingRegel] =
    useState<UeberwachungsregelMitZusammenfassung | null>(null)
  const [deleteTarget, setDeleteTarget] =
    useState<UeberwachungsregelMitZusammenfassung | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const ladeRegeln = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const res = await fetch("/api/admin/ueberwachungsregeln")
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setLoadError(data?.error ?? "Regeln konnten nicht geladen werden.")
        return
      }
      setRegeln(data.regeln ?? [])
    } catch {
      setLoadError("Regeln konnten nicht geladen werden.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    ladeRegeln()
  }, [ladeRegeln])

  async function handleToggleActive(
    regel: UeberwachungsregelMitZusammenfassung,
    next: boolean
  ) {
    setActionError(null)
    // Optimistisches Update
    setRegeln((prev) =>
      prev.map((r) => (r.id === regel.id ? { ...r, ist_aktiv: next } : r))
    )
    try {
      const res = await fetch(
        `/api/admin/ueberwachungsregeln/${regel.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ist_aktiv: next }),
        }
      )
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? "Fehler beim Umschalten.")
      }
    } catch (err) {
      // Rollback
      setRegeln((prev) =>
        prev.map((r) =>
          r.id === regel.id ? { ...r, ist_aktiv: !next } : r
        )
      )
      setActionError(
        err instanceof Error ? err.message : "Fehler beim Umschalten."
      )
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    setIsDeleting(true)
    setActionError(null)
    try {
      const res = await fetch(
        `/api/admin/ueberwachungsregeln/${deleteTarget.id}`,
        { method: "DELETE" }
      )
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? "Fehler beim Löschen.")
      }
      setRegeln((prev) => prev.filter((r) => r.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Fehler beim Löschen."
      )
    } finally {
      setIsDeleting(false)
    }
  }

  function handleEdit(regel: UeberwachungsregelMitZusammenfassung) {
    setEditingRegel(regel)
    setFormOpen(true)
  }

  function handleCreate() {
    setEditingRegel(null)
    setFormOpen(true)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Überwachungsregeln</CardTitle>
            <CardDescription>
              Werde per E-Mail benachrichtigt, wenn beim täglichen Bankabruf
              auffällige Buchungen auftreten. Beschreibe die Regel in eigenen
              Worten – die KI übersetzt sie in eine prüfbare Regel.
            </CardDescription>
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={handleCreate}
            className="shrink-0"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Neue Regel
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {(loadError || actionError) && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{loadError ?? actionError}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : regeln.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Noch keine Überwachungsregeln angelegt. Lege deine erste Regel an,
            um beim automatischen Bankabruf über auffällige Buchungen informiert
            zu werden.
          </div>
        ) : (
          <ul className="divide-y rounded-md border">
            {regeln.map((regel) => (
              <RegelRow
                key={regel.id}
                regel={regel}
                onToggle={(next) => handleToggleActive(regel, next)}
                onEdit={() => handleEdit(regel)}
                onDelete={() => setDeleteTarget(regel)}
              />
            ))}
          </ul>
        )}
      </CardContent>

      <UeberwachungsregelFormDialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o)
          if (!o) setEditingRegel(null)
        }}
        regel={editingRegel}
        onSaved={ladeRegeln}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Überwachungsregel löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  Die Regel <strong>„{deleteTarget.name}“</strong> wird
                  gelöscht. Bereits versendete Benachrichtigungen bleiben als
                  Historie erhalten.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
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

interface RegelRowProps {
  regel: UeberwachungsregelMitZusammenfassung
  onToggle: (next: boolean) => void
  onEdit: () => void
  onDelete: () => void
}

function RegelRow({ regel, onToggle, onEdit, onDelete }: RegelRowProps) {
  return (
    <li className="flex flex-col gap-3 bg-background p-3 sm:flex-row sm:items-start">
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{regel.name}</span>
          <Badge variant="secondary" className="text-xs">
            {regel.regel_typ === "muster" ? "Muster" : "Einzelbuchung"}
          </Badge>
          {!regel.ist_aktiv && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              inaktiv
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{regel.zusammenfassung}</p>
        {regel.empfaenger.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <Mail
              className="h-3 w-3 text-muted-foreground"
              aria-hidden="true"
            />
            {regel.empfaenger.map((email) => (
              <Badge key={email} variant="outline" className="text-xs">
                {email}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1 self-end sm:self-start">
        <Switch
          checked={regel.ist_aktiv}
          onCheckedChange={onToggle}
          aria-label={`Regel ${regel.name} ${
            regel.ist_aktiv ? "deaktivieren" : "aktivieren"
          }`}
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={onEdit}
          aria-label={`Regel ${regel.name} bearbeiten`}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={onDelete}
          aria-label={`Regel ${regel.name} löschen`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </li>
  )
}
