"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
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
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  Loader2,
  Mail,
  Send,
} from "lucide-react"
import { toast } from "sonner"
import { SpenderAuswahlCombobox } from "@/components/spender-auswahl-combobox"
import type { Spender, Transaction, Spendenquittung } from "@/lib/types"

interface SpendenquittungErstellenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction: Transaction | null
  /** Wird nach erfolgreichem Erstellen aufgerufen (z. B. zur Aktualisierung der Historie). */
  onCreated?: (quittung: Spendenquittung) => void
}

type Schritt = 1 | 2 | 3

interface NeuerSpenderForm {
  name: string
  strasse: string
  plz: string
  ort: string
  email: string
  iban: string
}

interface QuittungsdatenForm {
  betrag: string
  spende_datum: string
  quittung_datum: string
  zweck: string
}

interface EmailForm {
  empfaenger: string
  betreff: string
  text: string
}

interface VorstandKontakt {
  name: string
  email: string
}

function formatBetrag(amount: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount)
}

function parseBetragInput(raw: string): number | null {
  const trimmed = raw.trim().replace(/\s/g, "").replace(",", ".")
  if (!trimmed) return null
  const num = Number(trimmed)
  if (!Number.isFinite(num) || num <= 0) return null
  return num
}

/**
 * PROJ-17: 3-Schritt-Dialog zum Erstellen einer Spendenquittung.
 *
 * Schritt 1: Spender auswählen oder neu anlegen
 * Schritt 2: Quittungsdaten (Betrag, Datum, Zweck) prüfen/ergänzen
 * Schritt 3: Quittung erstellen → PDF-Vorschau + Download + E-Mail-Versand
 */
export function SpendenquittungErstellenDialog({
  open,
  onOpenChange,
  transaction,
  onCreated,
}: SpendenquittungErstellenDialogProps) {
  const [schritt, setSchritt] = useState<Schritt>(1)
  const [error, setError] = useState<string | null>(null)
  const [orgFehlt, setOrgFehlt] = useState(false)
  /** BUG-2-Fix: Liste der bereits ausgestellten Quittungen für diese Buchung. */
  const [bestehendeQuittungen, setBestehendeQuittungen] = useState<
    { id: string; quittung_nummer: string; quittung_datum: string }[]
  >([])

  // Schritt 1: Spender
  const [selectedSpender, setSelectedSpender] = useState<Spender | null>(null)
  const [neuerSpenderModus, setNeuerSpenderModus] = useState(false)
  const [neuerSpender, setNeuerSpender] = useState<NeuerSpenderForm>({
    name: "",
    strasse: "",
    plz: "",
    ort: "",
    email: "",
    iban: "",
  })

  // Schritt 2: Quittungsdaten
  const [quittungsdaten, setQuittungsdaten] = useState<QuittungsdatenForm>({
    betrag: "",
    spende_datum: "",
    quittung_datum: "",
    zweck: "",
  })

  // Schritt 3: Ergebnis
  const [isCreating, setIsCreating] = useState(false)
  const [createdQuittung, setCreatedQuittung] = useState<Spendenquittung | null>(
    null
  )
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [emailForm, setEmailForm] = useState<EmailForm>({
    empfaenger: "",
    betreff: "",
    text: "",
  })
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  // Vorstand (optional, für CC-Versand)
  const [vorstandErster, setVorstandErster] = useState<VorstandKontakt | null>(
    null
  )
  const [vorstandZweiter, setVorstandZweiter] = useState<VorstandKontakt | null>(
    null
  )
  const [ccErster, setCcErster] = useState(false)
  const [ccZweiter, setCcZweiter] = useState(false)

  // Felder bei Öffnen zurücksetzen + initiale Werte aus Buchung übernehmen
  useEffect(() => {
    if (!open || !transaction) return

    setSchritt(1)
    setError(null)
    setOrgFehlt(false)
    setSelectedSpender(null)
    setNeuerSpenderModus(false)
    setNeuerSpender({
      name: transaction.counterpart ?? "",
      strasse: "",
      plz: "",
      ort: "",
      email: "",
      iban: transaction.iban_gegenseite ?? "",
    })
    setQuittungsdaten({
      betrag: Number(transaction.amount).toFixed(2).replace(".", ","),
      spende_datum: transaction.booking_date,
      quittung_datum: new Date().toISOString().split("T")[0],
      zweck: "",
    })
    setCreatedQuittung(null)
    setPdfUrl(null)
    setEmailForm({ empfaenger: "", betreff: "", text: "" })
    setEmailSent(false)
    setCcErster(false)
    setCcZweiter(false)
    setBestehendeQuittungen([])
  }, [open, transaction])

  // BUG-2-Fix: Beim Öffnen prüfen, ob für die Buchung bereits eine Quittung
  // ausgestellt wurde, und ggf. einen Warnhinweis anzeigen.
  useEffect(() => {
    if (!open || !transaction) return
    let aborted = false
    const ladeBestehende = async () => {
      try {
        const res = await fetch(
          `/api/admin/spendenquittungen?transaction_id=${encodeURIComponent(transaction.id)}`
        )
        if (!res.ok) return
        const data = await res.json()
        if (aborted) return
        const liste = (data.spendenquittungen ?? []) as Array<{
          id: string
          quittung_nummer: string
          quittung_datum: string
        }>
        setBestehendeQuittungen(liste)
      } catch {
        // Optional – Doppel-Prüfung darf den Dialog nicht blockieren.
      }
    }
    ladeBestehende()
    return () => {
      aborted = true
    }
  }, [open, transaction])

  // Beim Auswählen eines Spenders aus der Datenbank: Modus zurück auf "bestehend"
  const handleSelectSpender = useCallback((spender: Spender) => {
    setSelectedSpender(spender)
    setNeuerSpenderModus(false)
    // E-Mail-Adresse für Schritt 3 vorbereiten
    if (spender.email) {
      setEmailForm((prev) => ({ ...prev, empfaenger: spender.email ?? "" }))
    }
  }, [])

  const handleCreateNew = useCallback(
    (vorbefuellung: { name: string }) => {
      setSelectedSpender(null)
      setNeuerSpenderModus(true)
      setNeuerSpender((prev) => ({
        ...prev,
        name: vorbefuellung.name || prev.name,
      }))
    },
    []
  )

  // Vorab-Prüfung der Organisationseinstellungen beim Öffnen
  useEffect(() => {
    if (!open) return
    let aborted = false
    const checkOrg = async () => {
      try {
        const res = await fetch("/api/admin/settings")
        if (!res.ok) return
        const data = await res.json()
        const org = data.organisation ?? {}
        const PFLICHT = [
          "verein_name",
          "adresse_zeile1",
          "plz",
          "ort",
          "steuernummer",
          "finanzamt",
          "freistellungsbescheid_datum",
          "freistellungsbescheid_aktenzeichen",
          "satzungszweck",
          "unterzeichner_name",
          "letzter_veranlagungszeitraum",
        ] as const
        const fehlt = PFLICHT.some(
          (key) => !org[key] || String(org[key]).trim() === ""
        )
        if (!aborted) {
          setOrgFehlt(fehlt)
          // Vorstandskontakte vormerken (für CC-Versand)
          if (org.vorstand1_email) {
            setVorstandErster({
              name: org.vorstand1_name || "1. Vorsitzender",
              email: org.vorstand1_email,
            })
          } else {
            setVorstandErster(null)
          }
          if (org.vorstand2_email) {
            setVorstandZweiter({
              name: org.vorstand2_name || "2. Vorsitzender",
              email: org.vorstand2_email,
            })
          } else {
            setVorstandZweiter(null)
          }
          if (fehlt) {
            // Satzungszweck als Default für Schritt 2 vorbereiten – nur wenn vorhanden
            return
          }
          if (org.satzungszweck) {
            setQuittungsdaten((prev) =>
              prev.zweck ? prev : { ...prev, zweck: org.satzungszweck }
            )
          }
        }
      } catch {
        // ignorieren – Backend prüft beim Erstellen ohnehin
      }
    }
    checkOrg()
    return () => {
      aborted = true
    }
  }, [open])

  // Schritt-1-Validierung
  const schritt1Valid = useMemo(() => {
    if (neuerSpenderModus) {
      return neuerSpender.name.trim().length > 0
    }
    return selectedSpender !== null
  }, [neuerSpenderModus, neuerSpender.name, selectedSpender])

  // Schritt-2-Validierung
  const schritt2Valid = useMemo(() => {
    const betrag = parseBetragInput(quittungsdaten.betrag)
    return (
      betrag !== null &&
      quittungsdaten.spende_datum.length > 0 &&
      quittungsdaten.quittung_datum.length > 0 &&
      quittungsdaten.zweck.trim().length > 0
    )
  }, [quittungsdaten])

  const handleErstellen = async () => {
    if (!transaction) return
    const betrag = parseBetragInput(quittungsdaten.betrag)
    if (betrag === null) {
      setError("Betrag muss eine positive Zahl sein.")
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      const payload: Record<string, unknown> = {
        transaction_id: transaction.id,
        betrag,
        spende_datum: quittungsdaten.spende_datum,
        quittung_datum: quittungsdaten.quittung_datum,
        zweck: quittungsdaten.zweck.trim(),
      }

      if (neuerSpenderModus) {
        payload.spender_neu = {
          name: neuerSpender.name.trim(),
          strasse: neuerSpender.strasse.trim() || undefined,
          plz: neuerSpender.plz.trim() || undefined,
          ort: neuerSpender.ort.trim() || undefined,
          email: neuerSpender.email.trim() || undefined,
          iban: neuerSpender.iban.trim() || undefined,
        }
      } else if (selectedSpender) {
        payload.spender_id = selectedSpender.id
      }

      const res = await fetch("/api/admin/spendenquittungen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (data.fehlende_felder) {
          setOrgFehlt(true)
          setError(
            "Bitte erst die Organisationseinstellungen vollständig ausfüllen."
          )
        } else {
          setError(data.error || "Quittung konnte nicht erstellt werden.")
        }
        return
      }

      const quittung: Spendenquittung = data.spendenquittung
      setCreatedQuittung(quittung)

      // E-Mail-Vorlage vom Server übernehmen
      if (data.email_vorlage) {
        // Empfänger: aus Spender falls vorhanden, sonst aus Form
        const empf =
          (neuerSpenderModus ? neuerSpender.email : selectedSpender?.email) ??
          ""
        setEmailForm({
          empfaenger: empf,
          betreff: data.email_vorlage.betreff ?? "",
          text: data.email_vorlage.text ?? "",
        })
      }

      // PDF-Vorschau-URL setzen (App-eigener Proxy-Endpunkt, Same-Origin)
      setPdfUrl(`/api/admin/spendenquittungen/${quittung.id}/pdf`)

      setSchritt(3)
      onCreated?.(quittung)
      toast.success(`Quittung ${quittung.quittung_nummer} erstellt.`)
    } catch {
      setError("Netzwerkfehler beim Erstellen der Quittung.")
    } finally {
      setIsCreating(false)
    }
  }

  const handleEmailSenden = async () => {
    if (!createdQuittung) return
    if (!emailForm.empfaenger.trim()) {
      toast.error("Bitte eine Empfänger-E-Mail eingeben.")
      return
    }
    setIsSendingEmail(true)
    try {
      const cc: string[] = []
      if (ccErster && vorstandErster?.email) cc.push(vorstandErster.email)
      if (ccZweiter && vorstandZweiter?.email) cc.push(vorstandZweiter.email)

      const res = await fetch(
        `/api/admin/spendenquittungen/${createdQuittung.id}/email`,
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
        toast.error(data.error || "E-Mail-Versand fehlgeschlagen.")
        return
      }
      setEmailSent(true)
      const ccInfo =
        cc.length > 0 ? ` (Kopie an ${cc.length} weitere Empfänger)` : ""
      toast.success(
        data.warning
          ? `${data.warning}`
          : `E-Mail an ${emailForm.empfaenger.trim()} versendet${ccInfo}.`
      )
    } catch {
      toast.error("Netzwerkfehler beim E-Mail-Versand.")
    } finally {
      setIsSendingEmail(false)
    }
  }

  if (!transaction) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden p-0">
        <div className="flex h-full max-h-[90vh] flex-col">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="flex items-center gap-2">
              Spendenquittung erstellen
              <Badge variant="outline">Schritt {schritt} von 3</Badge>
            </DialogTitle>
            <DialogDescription>
              Buchung vom{" "}
              {new Date(transaction.booking_date).toLocaleDateString("de-DE")}{" "}
              über {formatBetrag(Number(transaction.amount))}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 overflow-auto px-6 py-4">
            <div className="space-y-4">
              {orgFehlt && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="space-y-2">
                    <p>
                      Vor der ersten Spendenquittung müssen die
                      Organisationseinstellungen (Vereinsdaten,
                      Freistellungsbescheid) vollständig ausgefüllt sein.
                    </p>
                    <Button asChild size="sm" variant="outline">
                      <Link href="/dashboard/einstellungen?tab=organisation">
                        Zu den Einstellungen
                      </Link>
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {/* BUG-2-Fix: Warnung bei bereits ausgestellten Quittungen für diese Buchung */}
              {schritt < 3 && bestehendeQuittungen.length > 0 && (
                <Alert
                  variant="default"
                  className="border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
                >
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <span className="font-medium">
                      Für diese Buchung wurde bereits eine Quittung ausgestellt:
                    </span>{" "}
                    {bestehendeQuittungen
                      .map((q) => q.quittung_nummer)
                      .join(", ")}
                    . Eine zweite Quittung über denselben Betrag könnte als
                    Doppelausstellung gewertet werden. Bitte zuerst prüfen, ob
                    eine Stornierung der alten Quittung sinnvoll ist.
                  </AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {schritt === 1 && (
                <Schritt1Spender
                  transaction={transaction}
                  selectedSpender={selectedSpender}
                  onSelectSpender={handleSelectSpender}
                  neuerSpenderModus={neuerSpenderModus}
                  neuerSpender={neuerSpender}
                  onChangeNeuerSpender={setNeuerSpender}
                  onCreateNew={handleCreateNew}
                />
              )}

              {schritt === 2 && (
                <Schritt2Quittungsdaten
                  daten={quittungsdaten}
                  onChange={setQuittungsdaten}
                  spenderName={
                    neuerSpenderModus
                      ? neuerSpender.name
                      : selectedSpender?.name ?? ""
                  }
                />
              )}

              {schritt === 3 && createdQuittung && (
                <Schritt3Vorschau
                  quittung={createdQuittung}
                  pdfUrl={pdfUrl}
                  emailForm={emailForm}
                  onChangeEmail={setEmailForm}
                  isSendingEmail={isSendingEmail}
                  emailSent={emailSent}
                  onEmailSenden={handleEmailSenden}
                  vorstandErster={vorstandErster}
                  vorstandZweiter={vorstandZweiter}
                  ccErster={ccErster}
                  onCcErsterChange={setCcErster}
                  ccZweiter={ccZweiter}
                  onCcZweiterChange={setCcZweiter}
                />
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="border-t bg-muted/30 px-6 py-4">
            {schritt < 3 ? (
              <div className="flex w-full items-center justify-between gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (schritt === 1) {
                      onOpenChange(false)
                    } else {
                      setSchritt((schritt - 1) as Schritt)
                    }
                  }}
                  disabled={isCreating}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {schritt === 1 ? "Abbrechen" : "Zurück"}
                </Button>
                {schritt === 1 ? (
                  <Button
                    onClick={() => setSchritt(2)}
                    disabled={!schritt1Valid || orgFehlt}
                  >
                    Weiter
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleErstellen}
                    disabled={!schritt2Valid || isCreating || orgFehlt}
                  >
                    {isCreating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                    )}
                    Quittung erstellen
                  </Button>
                )}
              </div>
            ) : (
              <Button onClick={() => onOpenChange(false)} className="ml-auto">
                Schließen
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Schritt 1: Spender auswählen oder neu anlegen
// ============================================================

interface Schritt1SpenderProps {
  transaction: Transaction
  selectedSpender: Spender | null
  onSelectSpender: (spender: Spender) => void
  neuerSpenderModus: boolean
  neuerSpender: NeuerSpenderForm
  onChangeNeuerSpender: (form: NeuerSpenderForm) => void
  onCreateNew: (vorbefuellung: { name: string }) => void
}

function Schritt1Spender({
  transaction,
  selectedSpender,
  onSelectSpender,
  neuerSpenderModus,
  neuerSpender,
  onChangeNeuerSpender,
  onCreateNew,
}: Schritt1SpenderProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-sm font-medium">Spender auswählen</h3>
        <p className="text-sm text-muted-foreground">
          Bekannten Spender aus der Datenbank wählen oder einen neuen anlegen.
          Vorschläge basieren auf{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            {transaction.counterpart ?? "—"}
          </code>{" "}
          aus der Buchung.
        </p>
      </div>

      <SpenderAuswahlCombobox
        initialSuche={transaction.counterpart ?? ""}
        initialIban={transaction.iban_gegenseite ?? null}
        selectedSpender={selectedSpender}
        onSelectSpender={onSelectSpender}
        onCreateNew={onCreateNew}
      />

      {/* Form für neuen Spender */}
      {neuerSpenderModus && (
        <>
          <Separator />
          <div className="space-y-4 rounded-md border border-primary/30 bg-primary/5 p-4">
            <h4 className="text-sm font-medium">Neuen Spender anlegen</h4>

            <div className="space-y-2">
              <Label htmlFor="neu-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="neu-name"
                value={neuerSpender.name}
                onChange={(e) =>
                  onChangeNeuerSpender({ ...neuerSpender, name: e.target.value })
                }
                maxLength={200}
                placeholder="Vor- und Nachname"
                aria-required="true"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="neu-strasse">Straße</Label>
              <Input
                id="neu-strasse"
                value={neuerSpender.strasse}
                onChange={(e) =>
                  onChangeNeuerSpender({
                    ...neuerSpender,
                    strasse: e.target.value,
                  })
                }
                maxLength={200}
                placeholder="Straße und Hausnummer"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
              <div className="space-y-2">
                <Label htmlFor="neu-plz">PLZ</Label>
                <Input
                  id="neu-plz"
                  value={neuerSpender.plz}
                  onChange={(e) =>
                    onChangeNeuerSpender({
                      ...neuerSpender,
                      plz: e.target.value,
                    })
                  }
                  maxLength={10}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="neu-ort">Ort</Label>
                <Input
                  id="neu-ort"
                  value={neuerSpender.ort}
                  onChange={(e) =>
                    onChangeNeuerSpender({
                      ...neuerSpender,
                      ort: e.target.value,
                    })
                  }
                  maxLength={100}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="neu-email">E-Mail</Label>
                <Input
                  id="neu-email"
                  type="email"
                  value={neuerSpender.email}
                  onChange={(e) =>
                    onChangeNeuerSpender({
                      ...neuerSpender,
                      email: e.target.value,
                    })
                  }
                  maxLength={200}
                  placeholder="spender@example.de"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="neu-iban">IBAN</Label>
                <Input
                  id="neu-iban"
                  value={neuerSpender.iban}
                  onChange={(e) =>
                    onChangeNeuerSpender({
                      ...neuerSpender,
                      iban: e.target.value,
                    })
                  }
                  maxLength={34}
                  placeholder="aus der Buchung"
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Pflichtfeld: nur Name. Adresse und E-Mail werden empfohlen, damit
              die Quittung vollständig ist und per E-Mail versendet werden kann.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

// ============================================================
// Schritt 2: Quittungsdaten prüfen/ergänzen
// ============================================================

interface Schritt2QuittungsdatenProps {
  daten: QuittungsdatenForm
  onChange: (daten: QuittungsdatenForm) => void
  spenderName: string
}

function Schritt2Quittungsdaten({
  daten,
  onChange,
  spenderName,
}: Schritt2QuittungsdatenProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-2 text-sm font-medium">Quittungsdaten prüfen</h3>
        <p className="text-sm text-muted-foreground">
          Felder mit{" "}
          <span className="text-destructive">*</span> sind Pflicht. Betrag und
          Spende-Datum sind aus der Buchung vorausgefüllt.
        </p>
      </div>

      <div className="rounded-md border bg-muted/30 p-3 text-sm">
        <span className="font-medium">Spender: </span>
        {spenderName || <span className="text-muted-foreground">—</span>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="quittung-betrag">
            Betrag (EUR) <span className="text-destructive">*</span>
          </Label>
          <Input
            id="quittung-betrag"
            inputMode="decimal"
            value={daten.betrag}
            onChange={(e) => onChange({ ...daten, betrag: e.target.value })}
            placeholder="0,00"
            aria-required="true"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quittung-spende-datum">
            Datum der Zuwendung <span className="text-destructive">*</span>
          </Label>
          <Input
            id="quittung-spende-datum"
            type="date"
            value={daten.spende_datum}
            onChange={(e) =>
              onChange({ ...daten, spende_datum: e.target.value })
            }
            aria-required="true"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="quittung-datum">
          Ausstellungsdatum <span className="text-destructive">*</span>
        </Label>
        <Input
          id="quittung-datum"
          type="date"
          value={daten.quittung_datum}
          onChange={(e) =>
            onChange({ ...daten, quittung_datum: e.target.value })
          }
          aria-required="true"
        />
        <p className="text-xs text-muted-foreground">
          Datum, an dem die Quittung ausgestellt wird (Standard: heute).
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="quittung-zweck">
          Satzungsmäßiger Zweck <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="quittung-zweck"
          value={daten.zweck}
          onChange={(e) => onChange({ ...daten, zweck: e.target.value })}
          maxLength={500}
          rows={3}
          placeholder="z. B. Förderung der Bildung und Erziehung"
          aria-required="true"
        />
        <p className="text-xs text-muted-foreground">
          Wird aus den Organisationseinstellungen vorausgefüllt — kann für
          diese Quittung angepasst werden.
        </p>
      </div>
    </div>
  )
}

// ============================================================
// Schritt 3: Vorschau, Download und E-Mail-Versand
// ============================================================

interface Schritt3VorschauProps {
  quittung: Spendenquittung
  pdfUrl: string | null
  emailForm: EmailForm
  onChangeEmail: (form: EmailForm) => void
  isSendingEmail: boolean
  emailSent: boolean
  onEmailSenden: () => void
  vorstandErster: VorstandKontakt | null
  vorstandZweiter: VorstandKontakt | null
  ccErster: boolean
  onCcErsterChange: (value: boolean) => void
  ccZweiter: boolean
  onCcZweiterChange: (value: boolean) => void
}

function Schritt3Vorschau({
  quittung,
  pdfUrl,
  emailForm,
  onChangeEmail,
  isSendingEmail,
  emailSent,
  onEmailSenden,
  vorstandErster,
  vorstandZweiter,
  ccErster,
  onCcErsterChange,
  ccZweiter,
  onCcZweiterChange,
}: Schritt3VorschauProps) {
  return (
    <div className="space-y-6">
      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertDescription>
          <span className="font-medium">
            Quittung {quittung.quittung_nummer} erstellt.
          </span>{" "}
          Sie ist im Archiv gespeichert und kann jederzeit erneut
          heruntergeladen werden.
        </AlertDescription>
      </Alert>

      {/* PDF-Vorschau (Same-Origin-Proxy: zuverlässige iframe-Einbettung) */}
      <div className="space-y-2">
        <Label>PDF-Vorschau</Label>
        {pdfUrl ? (
          <div className="overflow-hidden rounded-md border">
            <object
              data={pdfUrl}
              type="application/pdf"
              aria-label={`Vorschau Quittung ${quittung.quittung_nummer}`}
              className="h-[420px] w-full"
            >
              <div className="flex h-[420px] flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
                <p>
                  Dein Browser kann die PDF-Vorschau hier nicht direkt
                  einbetten. Du kannst das PDF in einem neuen Tab öffnen.
                </p>
                <Button asChild variant="outline" size="sm">
                  <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                    PDF in neuem Tab öffnen
                  </a>
                </Button>
              </div>
            </object>
          </div>
        ) : (
          <div className="flex h-[200px] items-center justify-center rounded-md border border-dashed">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Vorschau wird geladen...
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {pdfUrl && (
            <>
              <Button asChild variant="outline" size="sm">
                <a
                  href={`${pdfUrl}?download=1`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="mr-2 h-4 w-4" />
                  PDF herunterladen
                </a>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                  In neuem Tab öffnen
                </a>
              </Button>
            </>
          )}
        </div>
      </div>

      <Separator />

      {/* E-Mail-Versand */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4" />
          <h3 className="text-sm font-medium">Per E-Mail an Spender senden</h3>
          {emailSent && (
            <Badge
              variant="default"
              className="bg-green-600 hover:bg-green-700"
            >
              Versendet
            </Badge>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email-empfaenger">Empfänger-E-Mail</Label>
          <Input
            id="email-empfaenger"
            type="email"
            value={emailForm.empfaenger}
            onChange={(e) =>
              onChangeEmail({ ...emailForm, empfaenger: e.target.value })
            }
            placeholder="spender@example.de"
            disabled={emailSent}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email-betreff">Betreff</Label>
          <Input
            id="email-betreff"
            value={emailForm.betreff}
            onChange={(e) =>
              onChangeEmail({ ...emailForm, betreff: e.target.value })
            }
            maxLength={200}
            disabled={emailSent}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email-text">Nachricht</Label>
          <Textarea
            id="email-text"
            value={emailForm.text}
            onChange={(e) =>
              onChangeEmail({ ...emailForm, text: e.target.value })
            }
            maxLength={5000}
            rows={6}
            disabled={emailSent}
          />
        </div>

        {/* CC an Vorstand */}
        {(vorstandErster || vorstandZweiter) && (
          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Kopie senden an
            </p>
            {vorstandErster && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="erstellen-cc-vorstand-1"
                  checked={ccErster}
                  onCheckedChange={(c) => onCcErsterChange(c === true)}
                  disabled={emailSent}
                />
                <Label
                  htmlFor="erstellen-cc-vorstand-1"
                  className="cursor-pointer text-sm font-normal"
                >
                  1. Vorsitzender ({vorstandErster.name}){" "}
                  <span className="text-xs text-muted-foreground">
                    — {vorstandErster.email}
                  </span>
                </Label>
              </div>
            )}
            {vorstandZweiter && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="erstellen-cc-vorstand-2"
                  checked={ccZweiter}
                  onCheckedChange={(c) => onCcZweiterChange(c === true)}
                  disabled={emailSent}
                />
                <Label
                  htmlFor="erstellen-cc-vorstand-2"
                  className="cursor-pointer text-sm font-normal"
                >
                  2. Vorsitzender ({vorstandZweiter.name}){" "}
                  <span className="text-xs text-muted-foreground">
                    — {vorstandZweiter.email}
                  </span>
                </Label>
              </div>
            )}
          </div>
        )}

        <Button
          onClick={onEmailSenden}
          disabled={
            isSendingEmail || emailSent || !emailForm.empfaenger.trim()
          }
          className="w-full sm:w-auto"
        >
          {isSendingEmail ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          {emailSent ? "Bereits versendet" : "E-Mail senden"}
        </Button>

        {!emailForm.empfaenger.trim() && !emailSent && (
          <p className="text-xs text-muted-foreground">
            Ohne E-Mail-Adresse: Quittung wurde bereits gespeichert und kann
            später aus der Historie versendet oder als PDF heruntergeladen
            werden.
          </p>
        )}
      </div>
    </div>
  )
}
