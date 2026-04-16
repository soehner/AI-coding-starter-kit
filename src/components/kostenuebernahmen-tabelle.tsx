"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  MailWarning,
  Inbox,
  Paperclip,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"
import {
  updateAntragSchema,
  type UpdateAntragInput,
} from "@/lib/validations/antrag"
import type { Antrag, AntragStatus, AntragEmailStatus } from "@/lib/types"

interface KostenuebernahmenTabelleProps {
  antraege: Antrag[]
  isLoading: boolean
  error: string | null
  /** Wenn true, werden Edit/Delete-Aktionen angezeigt (nur Admin). */
  canEdit?: boolean
  /** Wird nach erfolgreichem Edit/Delete aufgerufen, um die Liste neu zu laden. */
  onAntraegeChanged?: () => void
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function StatusBadge({ status }: { status: AntragStatus }) {
  switch (status) {
    case "offen":
      return (
        <Badge variant="outline" className="gap-1">
          <Clock className="h-3 w-3" aria-hidden="true" />
          Offen
        </Badge>
      )
    case "genehmigt":
      return (
        <Badge className="gap-1 bg-green-600 hover:bg-green-700">
          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
          Genehmigt
        </Badge>
      )
    case "abgelehnt":
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" aria-hidden="true" />
          Abgelehnt
        </Badge>
      )
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function EmailStatusBadge({ status }: { status: AntragEmailStatus }) {
  switch (status) {
    case "gesendet":
      return (
        <Badge variant="outline" className="text-green-600">
          Gesendet
        </Badge>
      )
    case "fehlgeschlagen":
      return (
        <Badge variant="destructive" className="gap-1">
          <MailWarning className="h-3 w-3" aria-hidden="true" />
          Fehler
        </Badge>
      )
    case "ausstehend":
      return <Badge variant="secondary">Ausstehend</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function VoteCountSummary({
  entscheidungen,
}: {
  entscheidungen: Antrag["antrag_entscheidungen"]
}) {
  if (!entscheidungen || entscheidungen.length === 0) {
    return <span className="text-xs text-muted-foreground">–</span>
  }
  const yes = entscheidungen.filter((e) => e.decision === "genehmigt").length
  const no = entscheidungen.filter((e) => e.decision === "abgelehnt").length
  return (
    <div className="flex flex-wrap gap-1">
      <Badge className="gap-1 bg-green-600 text-xs hover:bg-green-700">
        <CheckCircle2 className="h-3 w-3" /> {yes}
      </Badge>
      <Badge variant="destructive" className="gap-1 text-xs">
        <XCircle className="h-3 w-3" /> {no}
      </Badge>
    </div>
  )
}

interface AntragRowProps {
  antrag: Antrag
  isExpanded: boolean
  onToggle: () => void
  canEdit: boolean
  onEdit: () => void
  onDelete: () => void
}

function AntragRow({
  antrag,
  isExpanded,
  onToggle,
  canEdit,
  onEdit,
  onDelete,
}: AntragRowProps) {
  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/40"
        onClick={onToggle}
      >
        <TableCell className="w-8">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          )}
          <span className="sr-only">
            {isExpanded ? "Details ausblenden" : "Details einblenden"}
          </span>
        </TableCell>
        <TableCell className="whitespace-nowrap text-xs md:text-sm">
          {formatDate(antrag.created_at)}
        </TableCell>
        <TableCell className="text-xs font-medium md:text-sm">
          {antrag.applicant_first_name} {antrag.applicant_last_name}
        </TableCell>
        <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
          {antrag.applicant_email}
        </TableCell>
        <TableCell className="whitespace-nowrap text-right font-mono text-xs md:text-sm">
          {formatCents(antrag.amount_cents)} EUR
        </TableCell>
        <TableCell
          className="hidden max-w-[200px] truncate text-sm lg:table-cell"
          title={antrag.purpose}
        >
          {antrag.purpose}
        </TableCell>
        <TableCell className="hidden lg:table-cell">
          {antrag.antrag_dokumente.length > 0 ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Paperclip className="h-3 w-3" />
              {antrag.antrag_dokumente.length}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">–</span>
          )}
        </TableCell>
        <TableCell>
          <StatusBadge status={antrag.status} />
        </TableCell>
        <TableCell className="hidden xl:table-cell">
          <VoteCountSummary entscheidungen={antrag.antrag_entscheidungen} />
        </TableCell>
        <TableCell className="hidden md:table-cell">
          <EmailStatusBadge status={antrag.email_status} />
        </TableCell>
      </TableRow>

      {isExpanded && (
        <TableRow className="bg-muted/20">
          <TableCell colSpan={10} className="p-0">
            <div className="space-y-4 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                    Antragsteller
                  </h4>
                  <p className="text-sm font-medium">
                    {antrag.applicant_first_name} {antrag.applicant_last_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {antrag.applicant_email}
                  </p>
                </div>
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                    Verwendungszweck
                  </h4>
                  <p className="whitespace-pre-wrap text-sm">{antrag.purpose}</p>
                </div>
              </div>

              {antrag.antrag_dokumente.length > 0 && (
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                    {antrag.antrag_dokumente.length > 1 ? "Anhänge" : "Anhang"}
                  </h4>
                  <ul className="space-y-1">
                    {antrag.antrag_dokumente.map((d) => (
                      <li key={d.id}>
                        <a
                          href={d.document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-primary underline underline-offset-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {d.document_name}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                  Stimmen
                </h4>
                {antrag.antrag_entscheidungen.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Bisher hat noch niemand abgestimmt.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {antrag.antrag_entscheidungen
                      .slice()
                      .sort(
                        (a, b) =>
                          new Date(a.decided_at).getTime() -
                          new Date(b.decided_at).getTime()
                      )
                      .map((e) => (
                        <li
                          key={e.id}
                          className="rounded-md border bg-background p-3 text-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium">
                              {e.approver_email}
                            </span>
                            <Badge
                              variant={
                                e.decision === "genehmigt"
                                  ? "default"
                                  : "destructive"
                              }
                              className={
                                e.decision === "genehmigt"
                                  ? "bg-green-600 hover:bg-green-700"
                                  : ""
                              }
                            >
                              {e.decision === "genehmigt" ? "Genehmigt" : "Abgelehnt"}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDateTime(e.decided_at)}
                          </p>
                          {e.comment && (
                            <p className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-2 text-xs">
                              {e.comment}
                            </p>
                          )}
                        </li>
                      ))}
                  </ul>
                )}
              </div>

              {canEdit && (
                <div className="flex items-center justify-end gap-2 border-t pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      onEdit()
                    }}
                  >
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    Bearbeiten
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete()
                    }}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Löschen
                  </Button>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

function EditAntragDialog({
  antrag,
  open,
  onOpenChange,
  onSaved,
}: {
  antrag: Antrag | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<UpdateAntragInput>({
    resolver: zodResolver(updateAntragSchema),
    values: antrag
      ? {
          firstName: antrag.applicant_first_name,
          lastName: antrag.applicant_last_name,
          email: antrag.applicant_email,
          amount: antrag.amount_cents / 100,
          purpose: antrag.purpose,
        }
      : {
          firstName: "",
          lastName: "",
          email: "",
          amount: 0,
          purpose: "",
        },
  })

  async function onSubmit(values: UpdateAntragInput) {
    if (!antrag) return
    setIsSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/antraege/${antrag.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || "Antrag konnte nicht gespeichert werden.")
        return
      }
      toast.success("Antrag aktualisiert.")
      onSaved()
      onOpenChange(false)
    } catch {
      setError("Netzwerkfehler.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Antrag bearbeiten</DialogTitle>
          <DialogDescription>
            Stammdaten des Antrags ändern. Status, Stimmen und Anhänge bleiben
            unverändert.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vorname</FormLabel>
                    <FormControl>
                      <Input disabled={isSaving} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nachname</FormLabel>
                    <FormControl>
                      <Input disabled={isSaving} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-Mail-Adresse</FormLabel>
                  <FormControl>
                    <Input type="email" disabled={isSaving} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Betrag (in Euro)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      disabled={isSaving}
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="purpose"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Verwendungszweck</FormLabel>
                  <FormControl>
                    <Textarea rows={4} disabled={isSaving} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Speichern
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteAntragDialog({
  antrag,
  open,
  onOpenChange,
  onDeleted,
}: {
  antrag: Antrag | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}) {
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleDelete() {
    if (!antrag) return
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/antraege/${antrag.id}`, {
        method: "DELETE",
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data.error || "Antrag konnte nicht gelöscht werden.")
        return
      }
      toast.success("Antrag gelöscht.")
      onDeleted()
      onOpenChange(false)
    } catch {
      toast.error("Netzwerkfehler beim Löschen.")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Antrag löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            {antrag && (
              <>
                Der Antrag von{" "}
                <strong>
                  {antrag.applicant_first_name} {antrag.applicant_last_name}
                </strong>{" "}
                über{" "}
                <strong>{formatCents(antrag.amount_cents)} EUR</strong> wird
                inklusive aller Stimmen und Anhang-Verweise unwiderruflich
                gelöscht. Hochgeladene Dateien in Seafile bleiben erhalten.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Endgültig löschen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function KostenuebernahmenTabelle({
  antraege,
  isLoading,
  error,
  canEdit = false,
  onAntraegeChanged,
}: KostenuebernahmenTabelleProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editAntrag, setEditAntrag] = useState<Antrag | null>(null)
  const [deleteAntrag, setDeleteAntrag] = useState<Antrag | null>(null)

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (antraege.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed p-12">
        <Inbox className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <div className="text-center">
          <p className="text-sm font-medium">
            Keine Kostenübernahme-Anträge vorhanden
          </p>
          <p className="text-xs text-muted-foreground">
            Sobald Anträge über das öffentliche Formular eingereicht werden,
            erscheinen sie hier.
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-md border">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead className="text-xs md:text-sm">Datum</TableHead>
              <TableHead className="text-xs md:text-sm">Antragsteller</TableHead>
              <TableHead className="hidden md:table-cell">E-Mail</TableHead>
              <TableHead className="text-right text-xs md:text-sm">Betrag</TableHead>
              <TableHead className="hidden lg:table-cell">Verwendungszweck</TableHead>
              <TableHead className="hidden lg:table-cell">Anhänge</TableHead>
              <TableHead className="text-xs md:text-sm">Status</TableHead>
              <TableHead className="hidden xl:table-cell">Stimmen</TableHead>
              <TableHead className="hidden md:table-cell">E-Mail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {antraege.map((antrag) => (
              <AntragRow
                key={antrag.id}
                antrag={antrag}
                isExpanded={expandedId === antrag.id}
                onToggle={() =>
                  setExpandedId((prev) => (prev === antrag.id ? null : antrag.id))
                }
                canEdit={canEdit}
                onEdit={() => setEditAntrag(antrag)}
                onDelete={() => setDeleteAntrag(antrag)}
              />
            ))}
          </TableBody>
        </Table>
        </div>
      </div>

      <EditAntragDialog
        antrag={editAntrag}
        open={editAntrag !== null}
        onOpenChange={(open) => {
          if (!open) setEditAntrag(null)
        }}
        onSaved={() => onAntraegeChanged?.()}
      />

      <DeleteAntragDialog
        antrag={deleteAntrag}
        open={deleteAntrag !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteAntrag(null)
        }}
        onDeleted={() => onAntraegeChanged?.()}
      />
    </>
  )
}
