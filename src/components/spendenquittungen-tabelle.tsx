"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  AlertCircle,
  Download,
  ExternalLink,
  Loader2,
  Mail,
  MailCheck,
  Pencil,
  Send,
  Trash2,
  UserCog,
} from "lucide-react"
import { toast } from "sonner"
import type { Spendenquittung, Spender } from "@/lib/types"
import { SpendenquittungBearbeitenDialog } from "@/components/spendenquittung-bearbeiten-dialog"
import { SpenderBearbeitenDialog } from "@/components/spender-bearbeiten-dialog"

type QuittungSpender = Pick<
  Spender,
  "id" | "name" | "strasse" | "plz" | "ort" | "email" | "iban"
>

type QuittungMitSpender = Spendenquittung & {
  spender: QuittungSpender | null
}

interface VorstandKontakt {
  name: string
  email: string
}

interface SpendenquittungenTabelleProps {
  quittungen: QuittungMitSpender[]
  isLoading: boolean
  error: string | null
  page: number
  totalPages: number
  canEdit: boolean
  /** Optionale Vorstand-Kontakte für CC-Versand (1. + 2. Vorsitzender). */
  vorstand?: { erster: VorstandKontakt | null; zweiter: VorstandKontakt | null }
  onPageChange: (page: number) => void
  onReloadRow?: (id: string) => void
  /** Wird aufgerufen, wenn eine Zeile (z. B. nach Bearbeitung/Löschung) komplett neu geladen werden soll. */
  onReloadAll?: () => void
}

function formatBetrag(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function SpendenquittungenTabelle({
  quittungen,
  isLoading,
  error,
  page,
  totalPages,
  canEdit,
  vorstand,
  onPageChange,
  onReloadRow,
  onReloadAll,
}: SpendenquittungenTabelleProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [emailDialogQuittung, setEmailDialogQuittung] =
    useState<QuittungMitSpender | null>(null)
  const [emailForm, setEmailForm] = useState({
    empfaenger: "",
    betreff: "",
    text: "",
  })
  const [ccErster, setCcErster] = useState(false)
  const [ccZweiter, setCcZweiter] = useState(false)
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)

  // Bearbeiten- und Löschen-Dialoge
  const [bearbeitenQuittung, setBearbeitenQuittung] =
    useState<QuittungMitSpender | null>(null)
  const [loeschenQuittung, setLoeschenQuittung] =
    useState<QuittungMitSpender | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Spender-Bearbeiten-Dialog
  const [spenderBearbeiten, setSpenderBearbeiten] = useState<Spender | null>(
    null
  )

  const handleDownload = useCallback(async (id: string, nummer: string) => {
    setDownloadingId(id)
    try {
      // Direkter Download via App-eigenen PDF-Endpunkt → keine signierten URLs nötig
      window.open(
        `/api/admin/spendenquittungen/${id}/pdf?download=1`,
        "_blank",
        "noopener,noreferrer"
      )
      toast.success(`PDF ${nummer} geöffnet.`)
    } catch {
      toast.error("PDF konnte nicht geöffnet werden.")
    } finally {
      setDownloadingId(null)
    }
  }, [])

  const openEmailDialog = useCallback(
    (quittung: QuittungMitSpender) => {
      const verein = quittung.verein_snapshot
      const betragFormatiert = new Intl.NumberFormat("de-DE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number(quittung.betrag))
      const spendeDatumDe = formatDate(quittung.spende_datum)
      setEmailForm({
        empfaenger:
          quittung.email_empfaenger ?? quittung.spender?.email ?? "",
        betreff: `Ihre Zuwendungsbestätigung vom ${verein.verein_name}`,
        text:
          `Sehr geehrte Damen und Herren,\n\n` +
          `vielen Dank für Ihre Spende in Höhe von ${betragFormatiert} EUR ` +
          `vom ${spendeDatumDe}.\n\n` +
          `Im Anhang finden Sie Ihre Zuwendungsbestätigung ` +
          `(Quittungs-Nr. ${quittung.quittung_nummer}) zur Vorlage bei Ihrem ` +
          `Finanzamt.\n\n` +
          `Mit freundlichen Grüßen\n` +
          `${verein.verein_name}`,
      })
      setCcErster(false)
      setCcZweiter(false)
      setEmailError(null)
      setEmailDialogQuittung(quittung)
    },
    []
  )

  const handleEmailSenden = async () => {
    if (!emailDialogQuittung) return
    if (!emailForm.empfaenger.trim()) {
      setEmailError("Bitte eine Empfänger-E-Mail eingeben.")
      return
    }

    setIsSendingEmail(true)
    setEmailError(null)
    try {
      const cc: string[] = []
      if (ccErster && vorstand?.erster?.email) cc.push(vorstand.erster.email)
      if (ccZweiter && vorstand?.zweiter?.email)
        cc.push(vorstand.zweiter.email)

      const res = await fetch(
        `/api/admin/spendenquittungen/${emailDialogQuittung.id}/email`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            empfaenger: emailForm.empfaenger.trim(),
            betreff: emailForm.betreff.trim(),
            text: emailForm.text.trim(),
            cc: cc.length > 0 ? cc : undefined,
          }),
        }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setEmailError(data.error || "E-Mail-Versand fehlgeschlagen.")
        return
      }
      const ccInfo =
        cc.length > 0 ? ` (Kopie an ${cc.length} weitere Empfänger)` : ""
      toast.success(
        data.warning
          ? data.warning
          : `E-Mail an ${emailForm.empfaenger.trim()} versendet${ccInfo}.`
      )
      setEmailDialogQuittung(null)
      onReloadRow?.(emailDialogQuittung.id)
    } catch {
      setEmailError("Netzwerkfehler beim Versand.")
    } finally {
      setIsSendingEmail(false)
    }
  }

  useEffect(() => {
    if (!emailDialogQuittung) {
      setEmailForm({ empfaenger: "", betreff: "", text: "" })
      setEmailError(null)
      setCcErster(false)
      setCcZweiter(false)
    }
  }, [emailDialogQuittung])

  const handleDelete = async () => {
    if (!loeschenQuittung) return
    setIsDeleting(true)
    try {
      const res = await fetch(
        `/api/admin/spendenquittungen/${loeschenQuittung.id}`,
        { method: "DELETE" }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || "Quittung konnte nicht gelöscht werden.")
        return
      }
      toast.success(
        `Quittung ${loeschenQuittung.quittung_nummer} wurde gelöscht.`
      )
      setLoeschenQuittung(null)
      onReloadAll?.()
    } catch {
      toast.error("Netzwerkfehler beim Löschen.")
    } finally {
      setIsDeleting(false)
    }
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="md:w-[140px]">Quittungs-Nr.</TableHead>
                <TableHead className="md:min-w-[180px]">Spender</TableHead>
                <TableHead className="text-right md:w-[120px]">Betrag</TableHead>
                <TableHead className="hidden md:table-cell md:w-[110px]">
                  Spende-Datum
                </TableHead>
                <TableHead className="hidden md:table-cell md:w-[120px]">
                  Ausgestellt
                </TableHead>
                <TableHead className="md:w-[140px]">E-Mail-Status</TableHead>
                <TableHead className="hidden w-[100px] lg:table-cell">
                  Buchung
                </TableHead>
                <TableHead className="w-[160px] text-right md:w-[220px]">
                  Aktion
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-40" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto h-4 w-20" />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-24" />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto h-7 w-24" />
                    </TableCell>
                  </TableRow>
                ))
              ) : quittungen.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-32 text-center text-muted-foreground"
                  >
                    Noch keine Spendenquittungen ausgestellt. Quittungen können
                    aus der Dashboard-Tabelle heraus über das Aktionsmenü einer
                    Buchung erstellt werden.
                  </TableCell>
                </TableRow>
              ) : (
                quittungen.map((q) => {
                  const versendet = !!q.email_versendet_am
                  return (
                    <TableRow key={q.id}>
                      <TableCell className="whitespace-nowrap font-mono text-xs md:text-sm">
                        {q.quittung_nummer}
                      </TableCell>
                      <TableCell className="text-xs md:text-sm">
                        <div className="flex items-start gap-1.5">
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {q.spender?.name ?? "—"}
                            </span>
                            {q.spender?.email && (
                              <span className="text-xs text-muted-foreground">
                                {q.spender.email}
                              </span>
                            )}
                          </div>
                          {canEdit && q.spender && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                                    onClick={() =>
                                      setSpenderBearbeiten(
                                        q.spender as Spender
                                      )
                                    }
                                    aria-label="Spenderdaten bearbeiten"
                                  >
                                    <UserCog className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Spenderdaten bearbeiten
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-sm font-medium">
                        {formatBetrag(Number(q.betrag))}
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap text-xs md:table-cell md:text-sm">
                        {formatDate(q.spende_datum)}
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap text-xs md:table-cell md:text-sm">
                        {formatDate(q.quittung_datum)}
                      </TableCell>
                      <TableCell>
                        {versendet ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge
                                  variant="default"
                                  className="gap-1 bg-green-600 hover:bg-green-700"
                                >
                                  <MailCheck className="h-3 w-3" />
                                  Versendet
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-xs">
                                  {q.email_empfaenger && (
                                    <div>An: {q.email_empfaenger}</div>
                                  )}
                                  {q.email_versendet_am && (
                                    <div>
                                      Am: {formatDateTime(q.email_versendet_am)}
                                    </div>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <Mail className="h-3 w-3" />
                            Nicht versendet
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {q.transaction_id ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  asChild
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 gap-1 px-2 text-xs"
                                >
                                  <Link
                                    href={`/dashboard?transaction=${encodeURIComponent(q.transaction_id ?? "")}`}
                                    aria-label="Zur Buchung im Dashboard"
                                  >
                                    Buchung
                                    <ExternalLink className="h-3 w-3" />
                                  </Link>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Zur Buchung im Dashboard
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            [gelöscht]
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() =>
                                    handleDownload(q.id, q.quittung_nummer)
                                  }
                                  disabled={downloadingId === q.id}
                                  aria-label="PDF herunterladen"
                                >
                                  {downloadingId === q.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Download className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>PDF öffnen</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          {canEdit && (
                            <>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => openEmailDialog(q)}
                                      aria-label={
                                        versendet
                                          ? "E-Mail erneut senden"
                                          : "Per E-Mail senden"
                                      }
                                    >
                                      <Send className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {versendet
                                      ? "E-Mail erneut senden"
                                      : "Per E-Mail senden"}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => setBearbeitenQuittung(q)}
                                      aria-label="Quittung bearbeiten"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Quittung bearbeiten (PDF wird neu erzeugt)
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive hover:text-destructive"
                                      onClick={() => setLoeschenQuittung(q)}
                                      aria-label="Quittung löschen"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Quittung löschen
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && !isLoading && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Seite {page} von {totalPages}
          </p>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    if (page > 1) onPageChange(page - 1)
                  }}
                  aria-disabled={page <= 1}
                  className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                  aria-label="Vorherige Seite"
                />
              </PaginationItem>
              {generatePageNumbers(page, totalPages).map((p, idx) =>
                p === "..." ? (
                  <PaginationItem key={`ellipsis-${idx}`}>
                    <span className="px-2 text-muted-foreground">...</span>
                  </PaginationItem>
                ) : (
                  <PaginationItem key={p}>
                    <PaginationLink
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        onPageChange(p as number)
                      }}
                      isActive={page === p}
                      aria-label={`Seite ${p}`}
                    >
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                )
              )}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    if (page < totalPages) onPageChange(page + 1)
                  }}
                  aria-disabled={page >= totalPages}
                  className={
                    page >= totalPages ? "pointer-events-none opacity-50" : ""
                  }
                  aria-label="Nächste Seite"
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* E-Mail-Versand-Dialog */}
      <Dialog
        open={emailDialogQuittung !== null}
        onOpenChange={(open) => {
          if (!open && !isSendingEmail) setEmailDialogQuittung(null)
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {emailDialogQuittung?.email_versendet_am
                ? "E-Mail erneut senden"
                : "Quittung per E-Mail senden"}
            </DialogTitle>
            <DialogDescription>
              {emailDialogQuittung?.quittung_nummer} —{" "}
              {emailDialogQuittung &&
                formatBetrag(Number(emailDialogQuittung.betrag))}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {emailError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{emailError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="resend-empfaenger">Empfänger-E-Mail</Label>
              <Input
                id="resend-empfaenger"
                type="email"
                value={emailForm.empfaenger}
                onChange={(e) =>
                  setEmailForm({ ...emailForm, empfaenger: e.target.value })
                }
                placeholder="spender@example.de"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="resend-betreff">Betreff</Label>
              <Input
                id="resend-betreff"
                value={emailForm.betreff}
                onChange={(e) =>
                  setEmailForm({ ...emailForm, betreff: e.target.value })
                }
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="resend-text">Nachricht</Label>
              <Textarea
                id="resend-text"
                value={emailForm.text}
                onChange={(e) =>
                  setEmailForm({ ...emailForm, text: e.target.value })
                }
                rows={6}
                maxLength={5000}
              />
            </div>

            {/* CC-an-Vorstand */}
            {(vorstand?.erster?.email || vorstand?.zweiter?.email) && (
              <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Kopie senden an
                </p>
                {vorstand.erster?.email && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="cc-vorstand-1"
                      checked={ccErster}
                      onCheckedChange={(c) => setCcErster(c === true)}
                    />
                    <Label
                      htmlFor="cc-vorstand-1"
                      className="cursor-pointer text-sm font-normal"
                    >
                      1. Vorsitzender ({vorstand.erster.name || "—"}){" "}
                      <span className="text-xs text-muted-foreground">
                        — {vorstand.erster.email}
                      </span>
                    </Label>
                  </div>
                )}
                {vorstand.zweiter?.email && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="cc-vorstand-2"
                      checked={ccZweiter}
                      onCheckedChange={(c) => setCcZweiter(c === true)}
                    />
                    <Label
                      htmlFor="cc-vorstand-2"
                      className="cursor-pointer text-sm font-normal"
                    >
                      2. Vorsitzender ({vorstand.zweiter.name || "—"}){" "}
                      <span className="text-xs text-muted-foreground">
                        — {vorstand.zweiter.email}
                      </span>
                    </Label>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEmailDialogQuittung(null)}
              disabled={isSendingEmail}
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleEmailSenden}
              disabled={isSendingEmail || !emailForm.empfaenger.trim()}
            >
              {isSendingEmail ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Senden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bearbeiten-Dialog */}
      <SpendenquittungBearbeitenDialog
        open={bearbeitenQuittung !== null}
        onOpenChange={(open) => {
          if (!open) setBearbeitenQuittung(null)
        }}
        quittung={bearbeitenQuittung}
        onSaved={() => {
          setBearbeitenQuittung(null)
          onReloadAll?.()
        }}
      />

      {/* Spender-Bearbeiten-Dialog */}
      <SpenderBearbeitenDialog
        open={spenderBearbeiten !== null}
        onOpenChange={(open) => {
          if (!open) setSpenderBearbeiten(null)
        }}
        spender={spenderBearbeiten}
        onSaved={() => {
          setSpenderBearbeiten(null)
          onReloadAll?.()
        }}
        onDeleted={() => {
          setSpenderBearbeiten(null)
          onReloadAll?.()
        }}
      />

      {/* Löschen-Bestätigung */}
      <AlertDialog
        open={loeschenQuittung !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setLoeschenQuittung(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quittung wirklich löschen?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Die Quittung{" "}
                  <span className="font-mono font-medium">
                    {loeschenQuittung?.quittung_nummer}
                  </span>{" "}
                  über{" "}
                  <span className="font-medium">
                    {loeschenQuittung &&
                      formatBetrag(Number(loeschenQuittung.betrag))}
                  </span>{" "}
                  wird unwiderruflich gelöscht. Auch die PDF-Datei wird
                  entfernt.
                </p>
                {loeschenQuittung?.email_versendet_am && (
                  <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                    <strong>Achtung:</strong> Diese Quittung wurde bereits per
                    E-Mail versendet. Der Empfänger hat sie weiterhin.
                  </p>
                )}
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
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function generatePageNumbers(
  current: number,
  total: number
): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const pages: (number | "...")[] = [1]
  if (current > 3) pages.push("...")
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  for (let i = start; i <= end; i++) pages.push(i)
  if (current < total - 2) pages.push("...")
  pages.push(total)
  return pages
}
