"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Loader2,
  Save,
} from "lucide-react"

interface OrganisationFormState {
  verein_name: string
  adresse_zeile1: string
  adresse_zeile2: string
  plz: string
  ort: string
  steuernummer: string
  finanzamt: string
  freistellungsbescheid_datum: string
  freistellungsbescheid_aktenzeichen: string
  satzungszweck: string
  unterzeichner_name: string
  letzter_veranlagungszeitraum: string
  vorstand1_name: string
  vorstand1_email: string
  vorstand2_name: string
  vorstand2_email: string
}

const LEER_FORM: OrganisationFormState = {
  verein_name: "",
  adresse_zeile1: "",
  adresse_zeile2: "",
  plz: "",
  ort: "",
  steuernummer: "",
  finanzamt: "",
  freistellungsbescheid_datum: "",
  freistellungsbescheid_aktenzeichen: "",
  satzungszweck: "",
  unterzeichner_name: "",
  letzter_veranlagungszeitraum: "",
  vorstand1_name: "",
  vorstand1_email: "",
  vorstand2_name: "",
  vorstand2_email: "",
}

const PFLICHTFELDER: (keyof OrganisationFormState)[] = [
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
]

/**
 * Prüft, ob das Bescheid-Datum älter als die angegebene Anzahl Jahre ist.
 * Wird für die proaktive Erinnerung im Formular verwendet (warnt ab 4 Jahren,
 * blockiert nicht).
 */
function bescheidAelterAls(datumIso: string, jahre: number): boolean {
  if (!datumIso) return false
  const bescheidDatum = new Date(datumIso)
  if (isNaN(bescheidDatum.getTime())) return false
  const grenze = new Date()
  grenze.setFullYear(grenze.getFullYear() - jahre)
  return bescheidDatum < grenze
}

/**
 * PROJ-17: Formular für die Organisationseinstellungen (Vereinsdaten),
 * die als Snapshot in jede ausgestellte Spendenquittung fließen.
 *
 * Pflichtfelder werden visuell hervorgehoben. Eine Warnung erscheint, wenn der
 * Freistellungsbescheid älter als 4 Jahre ist (5 Jahre = Ablauf gemäß § 63 AO).
 */
export function OrganisationEinstellungenForm() {
  const [form, setForm] = useState<OrganisationFormState>(LEER_FORM)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const fetchSettings = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/admin/settings")
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Einstellungen konnten nicht geladen werden.")
        return
      }

      const org = data.organisation ?? {}
      setForm({
        verein_name: org.verein_name ?? "",
        adresse_zeile1: org.adresse_zeile1 ?? "",
        adresse_zeile2: org.adresse_zeile2 ?? "",
        plz: org.plz ?? "",
        ort: org.ort ?? "",
        steuernummer: org.steuernummer ?? "",
        finanzamt: org.finanzamt ?? "",
        freistellungsbescheid_datum: org.freistellungsbescheid_datum ?? "",
        freistellungsbescheid_aktenzeichen:
          org.freistellungsbescheid_aktenzeichen ?? "",
        satzungszweck: org.satzungszweck ?? "",
        unterzeichner_name: org.unterzeichner_name ?? "",
        letzter_veranlagungszeitraum: org.letzter_veranlagungszeitraum ?? "",
        vorstand1_name: org.vorstand1_name ?? "",
        vorstand1_email: org.vorstand1_email ?? "",
        vorstand2_name: org.vorstand2_name ?? "",
        vorstand2_email: org.vorstand2_email ?? "",
      })
    } catch {
      setError("Netzwerkfehler beim Laden der Einstellungen.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  function updateField<K extends keyof OrganisationFormState>(
    key: K,
    value: OrganisationFormState[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSuccess(null)
  }

  async function handleSave() {
    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organisation: {
            verein_name: form.verein_name.trim(),
            adresse_zeile1: form.adresse_zeile1.trim(),
            adresse_zeile2: form.adresse_zeile2.trim(),
            plz: form.plz.trim(),
            ort: form.ort.trim(),
            steuernummer: form.steuernummer.trim(),
            finanzamt: form.finanzamt.trim(),
            freistellungsbescheid_datum: form.freistellungsbescheid_datum,
            freistellungsbescheid_aktenzeichen:
              form.freistellungsbescheid_aktenzeichen.trim(),
            satzungszweck: form.satzungszweck.trim(),
            unterzeichner_name: form.unterzeichner_name.trim(),
            letzter_veranlagungszeitraum:
              form.letzter_veranlagungszeitraum.trim(),
            vorstand1_name: form.vorstand1_name.trim(),
            vorstand1_email: form.vorstand1_email.trim(),
            vorstand2_name: form.vorstand2_name.trim(),
            vorstand2_email: form.vorstand2_email.trim(),
          },
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(
          data.error || "Einstellungen konnten nicht gespeichert werden."
        )
        return
      }

      setSuccess("Organisationseinstellungen erfolgreich gespeichert.")
    } catch {
      setError("Netzwerkfehler beim Speichern der Einstellungen.")
    } finally {
      setIsSaving(false)
    }
  }

  // Vollständigkeit ermitteln (für Badge im Header und Hinweis)
  const fehlendeFelder = PFLICHTFELDER.filter(
    (key) => !form[key] || form[key].trim() === ""
  )
  const istVollstaendig = fehlendeFelder.length === 0
  const bescheidWarnung = bescheidAelterAls(
    form.freistellungsbescheid_datum,
    4
  )

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-32" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" aria-hidden="true" />
          Organisation &amp; Freistellungsbescheid
          {istVollstaendig ? (
            <Badge
              variant="default"
              className="bg-green-600 hover:bg-green-700"
            >
              Vollständig
            </Badge>
          ) : (
            <Badge variant="secondary">
              {fehlendeFelder.length}{" "}
              {fehlendeFelder.length === 1
                ? "Pflichtfeld fehlt"
                : "Pflichtfelder fehlen"}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Diese Vereinsdaten erscheinen auf jeder ausgestellten
          Zuwendungsbestätigung. Sie müssen vollständig ausgefüllt sein,
          bevor eine Spendenquittung erstellt werden kann.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {bescheidWarnung && (
          <Alert variant="default" className="border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Der Freistellungsbescheid ist älter als 4 Jahre. Gemäß § 63
              Abs. 5 AO gilt er nur 5 Jahre. Bitte einen neuen Bescheid beim
              Finanzamt anfordern, damit Spendenquittungen weiterhin gültig
              ausgestellt werden können.
            </AlertDescription>
          </Alert>
        )}

        {/* Vereinsdaten */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">
            Verein
          </h3>

          <div className="space-y-2">
            <Label htmlFor="org-name">
              Vereinsname <span className="text-destructive">*</span>
            </Label>
            <Input
              id="org-name"
              value={form.verein_name}
              onChange={(e) => updateField("verein_name", e.target.value)}
              maxLength={200}
              placeholder="z. B. CBS-Mannheim Förderverein e. V."
              aria-required="true"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="org-adresse1">
                Adresse, Zeile 1 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="org-adresse1"
                value={form.adresse_zeile1}
                onChange={(e) => updateField("adresse_zeile1", e.target.value)}
                maxLength={200}
                placeholder="Straße und Hausnummer"
                aria-required="true"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-adresse2">Adresse, Zeile 2</Label>
              <Input
                id="org-adresse2"
                value={form.adresse_zeile2}
                onChange={(e) => updateField("adresse_zeile2", e.target.value)}
                maxLength={200}
                placeholder="z. B. c/o oder Postfach (optional)"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
            <div className="space-y-2">
              <Label htmlFor="org-plz">
                PLZ <span className="text-destructive">*</span>
              </Label>
              <Input
                id="org-plz"
                value={form.plz}
                onChange={(e) => updateField("plz", e.target.value)}
                maxLength={10}
                placeholder="68xxx"
                aria-required="true"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-ort">
                Ort <span className="text-destructive">*</span>
              </Label>
              <Input
                id="org-ort"
                value={form.ort}
                onChange={(e) => updateField("ort", e.target.value)}
                maxLength={100}
                placeholder="Mannheim"
                aria-required="true"
              />
            </div>
          </div>
        </div>

        {/* Finanzamt / Steuer */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">
            Finanzamt &amp; Steuer
          </h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="org-steuernummer">
                Steuernummer <span className="text-destructive">*</span>
              </Label>
              <Input
                id="org-steuernummer"
                value={form.steuernummer}
                onChange={(e) => updateField("steuernummer", e.target.value)}
                maxLength={50}
                placeholder="z. B. 38161/12345"
                aria-required="true"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-finanzamt">
                Finanzamt <span className="text-destructive">*</span>
              </Label>
              <Input
                id="org-finanzamt"
                value={form.finanzamt}
                onChange={(e) => updateField("finanzamt", e.target.value)}
                maxLength={200}
                placeholder="z. B. Finanzamt Mannheim-Stadt"
                aria-required="true"
              />
            </div>
          </div>
        </div>

        {/* Freistellungsbescheid */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">
            Freistellungsbescheid
          </h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="org-bescheid-datum">
                Bescheid-Datum <span className="text-destructive">*</span>
              </Label>
              <Input
                id="org-bescheid-datum"
                type="date"
                value={form.freistellungsbescheid_datum}
                onChange={(e) =>
                  updateField("freistellungsbescheid_datum", e.target.value)
                }
                aria-required="true"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-bescheid-az">
                Aktenzeichen <span className="text-destructive">*</span>
              </Label>
              <Input
                id="org-bescheid-az"
                value={form.freistellungsbescheid_aktenzeichen}
                onChange={(e) =>
                  updateField(
                    "freistellungsbescheid_aktenzeichen",
                    e.target.value
                  )
                }
                maxLength={100}
                placeholder="z. B. StNr. 38161/12345"
                aria-required="true"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="org-veranlagung">
              Letzter Veranlagungszeitraum{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="org-veranlagung"
              value={form.letzter_veranlagungszeitraum}
              onChange={(e) =>
                updateField("letzter_veranlagungszeitraum", e.target.value)
              }
              maxLength={100}
              placeholder="z. B. 2022 - 2024"
              aria-required="true"
            />
            <p className="text-xs text-muted-foreground">
              Wird auf der Quittung im Wortlaut des Freistellungsbescheids
              genannt (z.&nbsp;B. &bdquo;letzter Veranlagungszeitraum 2022 -
              2024&ldquo;).
            </p>
          </div>
        </div>

        {/* Satzung / Unterzeichner */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">
            Satzung &amp; Unterzeichner
          </h3>

          <div className="space-y-2">
            <Label htmlFor="org-satzungszweck">
              Satzungsmäßiger Förderzweck (Kurzform){" "}
              <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="org-satzungszweck"
              value={form.satzungszweck}
              onChange={(e) => updateField("satzungszweck", e.target.value)}
              maxLength={500}
              rows={2}
              placeholder='z. B. "der Bildung und Erziehung" oder "der Erziehung an der Carl-Benz-Schule Mannheim"'
              aria-required="true"
            />
            <p className="text-xs text-muted-foreground">
              <strong>Wichtig:</strong> Bitte nur den Förderzweck in Kurzform
              eingeben – kein vollständiger Satz. Der Wert wird auf der
              Quittung direkt nach dem Wort &bdquo;Förderung&ldquo; eingesetzt
              (z.&nbsp;B. &bdquo;Wir sind wegen Förderung <em>der Bildung und
              Erziehung</em> nach dem Freistellungsbescheid &hellip;&ldquo;).
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="org-unterzeichner">
              Unterzeichner-Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="org-unterzeichner"
              value={form.unterzeichner_name}
              onChange={(e) =>
                updateField("unterzeichner_name", e.target.value)
              }
              maxLength={200}
              placeholder="z. B. OStD i. R. Werner Burkhardt"
              aria-required="true"
            />
            <p className="text-xs text-muted-foreground">
              Erscheint auf der Quittung als &bdquo;gez. [Name]&ldquo;
              (elektronisch ausgestellt, gültig ohne handschriftliche
              Unterschrift).
            </p>
          </div>
        </div>

        {/* Vorstandsdaten – optional, für CC-Versand */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">
              Vorstand (für CC-Versand der Spendenquittungen)
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Optional. Wenn hinterlegt, kann beim E-Mail-Versand einer
              Quittung eine Kopie an den 1. und/oder 2. Vorsitzenden gesendet
              werden.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="org-vorstand1-name">1. Vorsitzender (Name)</Label>
              <Input
                id="org-vorstand1-name"
                value={form.vorstand1_name}
                onChange={(e) => updateField("vorstand1_name", e.target.value)}
                maxLength={200}
                placeholder="Vor- und Nachname"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-vorstand1-email">
                1. Vorsitzender (E-Mail)
              </Label>
              <Input
                id="org-vorstand1-email"
                type="email"
                value={form.vorstand1_email}
                onChange={(e) =>
                  updateField("vorstand1_email", e.target.value)
                }
                maxLength={200}
                placeholder="vorsitzender@example.de"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="org-vorstand2-name">2. Vorsitzender (Name)</Label>
              <Input
                id="org-vorstand2-name"
                value={form.vorstand2_name}
                onChange={(e) => updateField("vorstand2_name", e.target.value)}
                maxLength={200}
                placeholder="Vor- und Nachname"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-vorstand2-email">
                2. Vorsitzender (E-Mail)
              </Label>
              <Input
                id="org-vorstand2-email"
                type="email"
                value={form.vorstand2_email}
                onChange={(e) =>
                  updateField("vorstand2_email", e.target.value)
                }
                maxLength={200}
                placeholder="stellvertreter@example.de"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            aria-label="Organisationseinstellungen speichern"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Speichern
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
