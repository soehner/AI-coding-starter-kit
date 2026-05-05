import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import {
  BookOpen,
  ShieldCheck,
  Users,
  FileUp,
  Tags,
  FileSpreadsheet,
  CheckSquare,
  ClipboardList,
  KeyRound,
  Cloud,
  Settings,
  Eye,
  HelpCircle,
  Lock,
  ArrowLeft,
  Wand2,
  FolderTree,
  Landmark,
  Trash2,
  ListChecks,
  History,
  AlertTriangle,
} from "lucide-react"

export const metadata: Metadata = {
  title: "Handbuch – CBS-Finanz",
  description:
    "Ausführliches Benutzerhandbuch für Administratoren und Betrachter der CBS-Finanz Anwendung.",
}

type Section = {
  id: string
  title: string
  icon: React.ComponentType<{ className?: string }>
}

const adminSections: Section[] = [
  { id: "admin-ueberblick", title: "Überblick", icon: BookOpen },
  { id: "admin-benutzer", title: "Benutzerverwaltung & Einladungen", icon: Users },
  { id: "admin-berechtigungen", title: "Rollen & Berechtigungen", icon: ShieldCheck },
  { id: "admin-import", title: "Kontoauszug importieren", icon: FileUp },
  { id: "admin-psd2", title: "Direkter Bankabruf (PSD2)", icon: Landmark },
  { id: "admin-historie", title: "Kontoauszug-Historie", icon: History },
  { id: "admin-bearbeiten", title: "Bewegungen bearbeiten", icon: FileSpreadsheet },
  { id: "admin-bulk", title: "Mehrfachaktionen & Löschen", icon: ListChecks },
  { id: "admin-export", title: "Kassenbuch-Export", icon: FileSpreadsheet },
  { id: "admin-kategorien", title: "Kategorien verwalten", icon: Tags },
  { id: "admin-regeln", title: "Automatische Regeln", icon: Wand2 },
  { id: "admin-zugriff", title: "Kategoriebasierter Zugriff", icon: FolderTree },
  { id: "admin-genehmigungen", title: "Genehmigungen (Vereinsanträge)", icon: CheckSquare },
  { id: "admin-kostenuebernahmen", title: "Kostenübernahme-Anträge", icon: ClipboardList },
  { id: "admin-seafile", title: "Seafile-Integration", icon: Cloud },
  { id: "admin-einstellungen", title: "Einstellungen & API-Token", icon: Settings },
]

const viewerSections: Section[] = [
  { id: "viewer-ueberblick", title: "Überblick", icon: BookOpen },
  { id: "viewer-anmeldung", title: "Anmeldung & Profil", icon: KeyRound },
  { id: "viewer-dashboard", title: "Dashboard lesen", icon: Eye },
  { id: "viewer-filter", title: "Filtern, Suchen & Sortieren", icon: Eye },
  { id: "viewer-kategorien", title: "Kategorien verstehen", icon: Tags },
  { id: "viewer-abstimmung", title: "Als Vorstand abstimmen", icon: CheckSquare },
  { id: "viewer-antrag", title: "Kostenübernahme beantragen", icon: ClipboardList },
]

const commonSections: Section[] = [
  { id: "sicherheit", title: "Sicherheit & 2FA", icon: Lock },
  { id: "faq", title: "FAQ & Hilfe", icon: HelpCircle },
]

function SectionHeading({
  id,
  icon: Icon,
  children,
}: {
  id: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <h3
      id={id}
      className="mt-10 flex scroll-mt-24 items-center gap-3 border-b border-primary/10 pb-2 text-xl font-semibold text-foreground"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-secondary ring-1 ring-primary/20">
        <Icon className="h-5 w-5 text-primary" />
      </span>
      {children}
    </h3>
  )
}

function TocGroup({
  title,
  sections,
  accent,
}: {
  title: string
  sections: Section[]
  accent: "primary" | "muted"
}) {
  return (
    <div className="space-y-2">
      <p
        className={`text-xs font-semibold uppercase tracking-wider ${
          accent === "primary" ? "text-primary" : "text-muted-foreground"
        }`}
      >
        {title}
      </p>
      <ul className="space-y-1">
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <s.icon className="h-4 w-4 shrink-0" />
              <span>{s.title}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function HandbuchPage() {
  return (
    <div className="min-h-screen bg-brand-soft">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-primary/10 bg-background/95 shadow-sm shadow-primary/5 backdrop-blur">
        <div className="container flex h-16 items-center justify-between gap-2 px-4 md:px-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 text-lg font-semibold transition-opacity hover:opacity-80"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-secondary ring-1 ring-primary/20">
              <Image
                src="/icon.png"
                alt=""
                width={32}
                height={32}
                className="h-7 w-7 object-contain"
              />
            </div>
            <span className="bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
              CBS-Finanz
            </span>
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-md border border-primary/20 bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" />
            Zurück zur Anwendung
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-primary/10 bg-brand-gradient text-white">
        <div className="container px-4 py-16 md:px-6 md:py-20">
          <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-white/80">
            <BookOpen className="h-4 w-4" />
            Benutzerhandbuch
          </div>
          <h1 className="mt-3 text-3xl font-bold md:text-5xl">
            Alles über CBS-Finanz
          </h1>
          <p className="mt-4 max-w-2xl text-base text-white/85 md:text-lg">
            Das offizielle Handbuch für den CBS-Mannheim Förderverein – mit
            getrennten Abschnitten für Administratoren (Kassenwart) und
            Betrachter (Vorstand, Prüfer).
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#admin"
              className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-primary shadow-sm transition-colors hover:bg-white/90"
            >
              <ShieldCheck className="h-4 w-4" />
              Für Administratoren
            </a>
            <a
              href="#viewer"
              className="inline-flex items-center gap-2 rounded-md border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/20"
            >
              <Eye className="h-4 w-4" />
              Für Betrachter
            </a>
          </div>
        </div>
      </section>

      {/* Layout: Sidebar + Content */}
      <div className="container px-4 py-10 md:px-6 md:py-12">
        <div className="grid gap-10 lg:grid-cols-[260px_1fr]">
          {/* TOC */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <nav className="space-y-6 rounded-xl border border-primary/10 bg-card/70 p-5 shadow-sm backdrop-blur">
              <TocGroup
                title="Für Administratoren"
                sections={adminSections}
                accent="primary"
              />
              <div className="h-px bg-border" />
              <TocGroup
                title="Für Betrachter"
                sections={viewerSections}
                accent="primary"
              />
              <div className="h-px bg-border" />
              <TocGroup
                title="Allgemein"
                sections={commonSections}
                accent="muted"
              />
            </nav>
          </aside>

          {/* Content */}
          <main className="min-w-0 space-y-16">
            {/* Einführung */}
            <section id="einfuehrung">
              <div className="rounded-xl border border-primary/10 bg-card p-6 shadow-sm md:p-8">
                <h2 className="flex items-center gap-3 text-2xl font-bold md:text-3xl">
                  <BookOpen className="h-7 w-7 text-primary" />
                  Willkommen bei CBS-Finanz
                </h2>
                <p className="mt-4 text-muted-foreground">
                  CBS-Finanz digitalisiert die Kassenbuchführung des
                  CBS-Mannheim Fördervereins. Kontoauszüge der Badischen
                  Beamtenbank werden als PDF hochgeladen, von einer KI geparst
                  und in einer sicheren Datenbank gespeichert. Vorstand und
                  Prüfer können den aktuellen Finanzstand jederzeit einsehen –
                  ohne dass der Kassenwart erst manuell Excel-Listen verschicken
                  muss.
                </p>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-primary/10 bg-accent/40 p-4">
                    <div className="flex items-center gap-2 font-semibold text-foreground">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      Administrator
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Der Kassenwart importiert Kontoauszüge, bearbeitet
                      Einträge, verwaltet Benutzer und exportiert das
                      Kassenbuch.
                    </p>
                  </div>
                  <div className="rounded-lg border border-primary/10 bg-accent/40 p-4">
                    <div className="flex items-center gap-2 font-semibold text-foreground">
                      <Eye className="h-4 w-4 text-primary" />
                      Betrachter
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Vorstandsmitglieder und Prüfer haben Lesezugriff,
                      stellen Anträge auf Kostenübernahme und sehen die für sie
                      freigegebenen Kategorien.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* ADMIN */}
            <section id="admin" className="scroll-mt-24">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
                  <ShieldCheck className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                    Teil 1
                  </p>
                  <h2 className="text-2xl font-bold md:text-3xl">
                    Handbuch für Administratoren
                  </h2>
                </div>
              </div>
              <p className="mt-4 text-muted-foreground">
                Dieser Abschnitt richtet sich an den Kassenwart und alle
                weiteren Administratoren. Er deckt alle Aufgaben ab – vom
                Benutzer anlegen bis zum Kassenbuch-Export.
              </p>

              <SectionHeading id="admin-ueberblick" icon={BookOpen}>
                Überblick &amp; tägliche Aufgaben
              </SectionHeading>
              <div className="mt-4 space-y-4 text-muted-foreground">
                <p>
                  Als Administrator sehen Sie im Dashboard alle Bankbewegungen,
                  Kennzahlen und die Kontoauszug-Historie. Ein typischer Ablauf
                  pro Kontoauszug:
                </p>
                <ol className="ml-6 list-decimal space-y-2">
                  <li>Neuen Kontoauszug als PDF hochladen.</li>
                  <li>KI-Parsing kontrollieren und bei Bedarf korrigieren.</li>
                  <li>
                    Buchungen kategorisieren (manuell oder über automatische
                    Regeln).
                  </li>
                  <li>Bemerkungen und Belege hinzufügen.</li>
                  <li>Bei Bedarf Kassenbuch als Excel exportieren.</li>
                </ol>
              </div>

              <SectionHeading id="admin-benutzer" icon={Users}>
                Benutzerverwaltung &amp; Einladungen
              </SectionHeading>
              <div className="mt-4 space-y-4 text-muted-foreground">
                <p>
                  Die Benutzerverwaltung finden Sie im Admin-Menü unter{" "}
                  <em>Benutzerverwaltung</em> (Pfad{" "}
                  <code>/dashboard/admin/users</code>). Die Liste zeigt alle
                  eingeladenen Personen mit Rolle, optionalen Zusatzrollen,
                  Feature-Berechtigungen und Kategoriezugriff.
                </p>
                <ul className="ml-6 list-disc space-y-2">
                  <li>
                    <strong>Benutzer einladen:</strong> Klick auf
                    &bdquo;Benutzer einladen&ldquo;, E-Mail und Rolle
                    (Administrator/Betrachter) wählen. Die Einladung wird per
                    Resend verschickt. Der Empfänger legt über den Link ein
                    eigenes Passwort fest und landet anschließend direkt im
                    Dashboard.
                  </li>
                  <li>
                    <strong>Rolle ändern:</strong> Über das Aktionsmenü eines
                    Benutzers lässt sich die Rolle nachträglich anpassen.
                  </li>
                  <li>
                    <strong>
                      Zusatzrollen &bdquo;Vorstand&ldquo; und &bdquo;2.
                      Vorstand&ldquo;:
                    </strong>{" "}
                    Zwei zusätzliche Häkchen pro Benutzer. Vorstände werden
                    automatisch als Abstimmungsberechtigte in das
                    Kostenübernahme-Antragssystem eingebunden und erhalten bei
                    neuen Anträgen einen Entscheidungs-Link per E-Mail.
                  </li>
                  <li>
                    <strong>Feature-Berechtigungen:</strong> Pro Benutzer
                    können einzelne Funktionen zusätzlich freigegeben werden
                    – insbesondere für Betrachter: Buchungen bearbeiten,
                    Excel-Export, Kontoauszug-Import.
                  </li>
                  <li>
                    <strong>Kategoriezugriff:</strong> Aufklapp-Panel pro
                    Betrachter mit Mehrfachauswahl, welche Kategorien
                    sichtbar sein sollen (siehe Abschnitt{" "}
                    &bdquo;Kategoriebasierter Zugriff&ldquo;).
                  </li>
                  <li>
                    <strong>Benutzer entfernen:</strong> Deaktiviert den Zugang
                    vollständig. Der letzte verbleibende Administrator ist
                    gegen versehentliches Löschen geschützt.
                  </li>
                </ul>
                <div className="rounded-lg border-l-4 border-primary bg-accent/40 p-4 text-sm">
                  <strong className="text-foreground">Hinweis:</strong>{" "}
                  Einladungs-Links sind 24 Stunden gültig. Wenn ein
                  eingeladener Benutzer direkt auf der Login-Maske landet,
                  ist der Link oft bereits abgelaufen oder wurde vorab von
                  einem Mail-Scanner geöffnet – einfach eine neue Einladung
                  auslösen.
                </div>
              </div>

              <SectionHeading id="admin-berechtigungen" icon={ShieldCheck}>
                Rollen &amp; granulare Berechtigungen
              </SectionHeading>
              <div className="mt-4 space-y-4 text-muted-foreground">
                <p>Es gibt zwei Grundrollen:</p>
                <ul className="ml-6 list-disc space-y-2">
                  <li>
                    <strong>Administrator:</strong> Vollzugriff auf alle
                    Funktionen inkl. Benutzerverwaltung, Import, Export,
                    Kategorien, Regeln und Einstellungen.
                  </li>
                  <li>
                    <strong>Betrachter:</strong> Lesezugriff auf das Dashboard.
                    Kein Import, kein Export, keine Bearbeitung.
                  </li>
                </ul>
                <p>
                  Zusätzlich lassen sich pro Benutzer einzelne Rechte
                  freischalten oder entziehen, etwa
                  <em> Kontoauszug importieren</em> oder{" "}
                  <em>Genehmigungen verwalten</em>.
                </p>
              </div>

              <SectionHeading id="admin-import" icon={FileUp}>
                Kontoauszug importieren (KI-Parsing)
              </SectionHeading>
              <div className="mt-4 space-y-4 text-muted-foreground">
                <p>
                  Über <em>Kontoauszug importieren</em> im Header laden Sie
                  eine PDF-Datei der Badischen Beamtenbank hoch. Eine KI
                  (OpenAI Vision oder Anthropic Claude, je nach Einstellung)
                  extrahiert automatisch alle Buchungen.
                </p>
                <ol className="ml-6 list-decimal space-y-2">
                  <li>PDF per Drag &amp; Drop oder Dateiauswahl hochladen.</li>
                  <li>
                    Vorschau der erkannten Buchungen prüfen – Datum, Betrag,
                    Verwendungszweck, Gegenkonto.
                  </li>
                  <li>Fehlerhafte Zeilen direkt in der Vorschau korrigieren.</li>
                  <li>Mit &bdquo;Importieren&ldquo; endgültig speichern.</li>
                </ol>
                <div className="rounded-lg border-l-4 border-primary bg-accent/40 p-4 text-sm">
                  <strong className="text-foreground">
                    Voraussetzung:
                  </strong>{" "}
                  Ein gültiger API-Token (OpenAI oder Anthropic) muss in den{" "}
                  <em>Einstellungen</em> hinterlegt sein. Ohne Token ist der
                  Import nicht möglich.
                </div>
                <p>
                  Mehrere Kontoauszüge können nacheinander importiert werden.
                  Doppelte Buchungen werden erkannt und nicht erneut angelegt.
                </p>
              </div>

              <SectionHeading id="admin-psd2" icon={Landmark}>
                Direkter Bankabruf (PSD2)
              </SectionHeading>
              <div className="mt-4 space-y-4 text-muted-foreground">
                <p>
                  Alternativ zum PDF-Import ruft CBS-Finanz die Buchungen
                  täglich automatisch direkt vom Bankkonto ab – über die
                  PSD2-Schnittstelle des Anbieters Enable Banking. PDF-Import
                  und PSD2-Abruf ergänzen sich: Das PDF bleibt bei Konflikten
                  die verbindliche Quelle.
                </p>
                <ul className="ml-6 list-disc space-y-2">
                  <li>
                    <strong>Bankzugang verbinden:</strong>{" "}
                    <em>Einstellungen → Bankzugang</em> → Button{" "}
                    <em>Verbinden</em>. Sie werden einmalig zur
                    SecureGo-plus-Authentifizierung der Badischen Beamtenbank
                    geleitet und stimmen dem PSD2-Abruf zu.
                  </li>
                  <li>
                    <strong>Automatischer Tagesabruf:</strong> Ab sofort
                    werden neue Buchungen jede Nacht (ca. 06:00 Uhr)
                    abgerufen und erscheinen im Dashboard mit einem gelben
                    Badge <em>PSD2</em>.
                  </li>
                  <li>
                    <strong>Manueller Abruf:</strong> In der
                    Bankzugang-Karte gibt es einen Button{" "}
                    <em>Jetzt abrufen</em>, der den Sync sofort auslöst.
                  </li>
                  <li>
                    <strong>Bankzugang trennen:</strong> Über den
                    Trennen-Button in derselben Karte – mit Bestätigungs-Dialog.
                  </li>
                </ul>
                <div className="rounded-lg border-l-4 border-primary bg-accent/40 p-4 text-sm">
                  <strong className="text-foreground">
                    Abgleich mit PDF-Import:
                  </strong>{" "}
                  Wenn dieselbe Buchung später per PDF importiert wird,
                  vergleicht die App Datum (±1 Tag), Betrag und IBAN. Bei
                  einem Treffer erscheint ein Vorschlag-Dialog
                  <em> &bdquo;Als identisch bestätigen&ldquo;</em> oder{" "}
                  <em>&bdquo;Separate Einträge&ldquo;</em>. Bei Abweichungen
                  erscheint
                  ein rotes Konflikt-Badge mit Vergleichstabelle – das PDF
                  gewinnt.
                </div>
                <div className="rounded-lg border-l-4 border-destructive bg-destructive/5 p-4 text-sm">
                  <strong className="text-foreground">
                    Zustimmung läuft ab:
                  </strong>{" "}
                  Die Bank-Zustimmung ist nach PSD2-Vorgabe maximal 180 Tage
                  gültig. 7 Tage vor Ablauf erhalten Sie eine Erinnerung per
                  E-Mail und sehen ein Banner im Dashboard. Danach einfach
                  erneut verbinden.
                </div>
              </div>

              <SectionHeading id="admin-historie" icon={History}>
                Kontoauszug-Historie
              </SectionHeading>
              <div className="mt-4 space-y-4 text-muted-foreground">
                <p>
                  Auf der Import-Seite (
                  <code>/dashboard/admin/import</code>) zeigt ein unterer
                  Bereich alle bisher importierten PDF-Auszüge mit Datum,
                  Anzahl Buchungen und Herkunft. So behalten Sie den
                  Überblick, welche Zeiträume bereits erfasst sind, und
                  erkennen schnell Lücken.
                </p>
              </div>

              <SectionHeading id="admin-bearbeiten" icon={FileSpreadsheet}>
                Bewegungen bearbeiten &amp; Bemerkungen
              </SectionHeading>
              <div className="mt-4 space-y-4 text-muted-foreground">
                <p>
                  Jede Bewegung in der Tabelle lässt sich direkt bearbeiten –
                  entweder inline per Klick auf ein Feld oder über das
                  Aktions-Dropdown am Zeilenende.
                </p>
                <ul className="ml-6 list-disc space-y-2">
                  <li>
                    <strong>Bemerkung / interne Notiz</strong> – mehrzeilig,
                    bis zu 1000 Zeichen mit Zeichenzähler.
                  </li>
                  <li>
                    <strong>Kategorie</strong> – Mehrfachauswahl aus der
                    angelegten Kategorieliste.
                  </li>
                  <li>
                    <strong>Belegverknüpfung</strong> – Link oder Upload zum
                    Seafile-Beleg, bis zu 5 Dateien pro Buchung.
                  </li>
                  <li>
                    <strong>Kontoauszug-Referenz</strong> – freie
                    Zuordnungsnummer, falls abweichend.
                  </li>
                </ul>
                <div className="rounded-lg border-l-4 border-primary bg-accent/40 p-4 text-sm">
                  <strong className="text-foreground">Schreibgeschützt:</strong>{" "}
                  Datum, Betrag, Saldo und Verwendungszweck stammen
                  verbindlich von der Bank und können nicht geändert
                  werden. So bleibt die Kassenbuchführung revisionssicher.
                </div>
              </div>

              <SectionHeading id="admin-bulk" icon={ListChecks}>
                Mehrfachaktionen &amp; Löschen
              </SectionHeading>
              <div className="mt-4 space-y-4 text-muted-foreground">
                <p>
                  Jede Zeile in der Bewegungstabelle hat links eine Checkbox.
                  Sobald eine oder mehrere Zeilen markiert sind, erscheint
                  oberhalb der Tabelle eine Aktionsleiste mit
                  Mehrfachaktionen:
                </p>
                <ul className="ml-6 list-disc space-y-2">
                  <li>
                    <strong>Kategorie zuweisen/entfernen:</strong> Dialog mit
                    Mehrfachauswahl – Kategorien werden zu allen markierten
                    Buchungen hinzugefügt oder entfernt.
                  </li>
                  <li>
                    <strong>Bulk-Löschen:</strong> Markierte Buchungen werden
                    nach einer Sicherheitsabfrage dauerhaft entfernt. Nur
                    sinnvoll bei Fehlimporten oder Dubletten.
                  </li>
                  <li>
                    <strong>Einzelne Buchung löschen:</strong> Im
                    Aktions-Dropdown einer Zeile. Wenn Sie die letzte
                    Buchung der letzten Seite löschen, springt die Tabelle
                    automatisch auf die vorherige Seite zurück.
                  </li>
                </ul>
                <div className="rounded-lg border-l-4 border-destructive bg-destructive/5 p-4 text-sm">
                  <strong className="text-foreground">
                    <AlertTriangle className="mr-1 inline h-4 w-4" />
                    Löschen ist endgültig.
                  </strong>{" "}
                  Gelöschte Buchungen lassen sich nicht wiederherstellen.
                  Wurden sie per PSD2 oder PDF abgerufen, erscheinen sie
                  beim nächsten Sync bzw. Re-Import wieder.
                </div>
              </div>

              <SectionHeading id="admin-export" icon={FileSpreadsheet}>
                Kassenbuch als Excel exportieren
              </SectionHeading>
              <div className="mt-4 space-y-4 text-muted-foreground">
                <p>
                  Über den Button <em>Kassenbuch exportieren</em> erzeugen Sie
                  eine Excel-Datei mit allen Buchungen im aktuell gefilterten
                  Zeitraum. Die Datei entspricht dem bisher manuell geführten
                  Kassenbuch und enthält Summen, Kategorien und Bemerkungen.
                </p>
              </div>

              <SectionHeading id="admin-kategorien" icon={Tags}>
                Kategorien verwalten
              </SectionHeading>
              <div className="mt-4 space-y-4 text-muted-foreground">
                <p>
                  Kategorien helfen beim Gruppieren von Einnahmen und Ausgaben
                  (z.B. <em>Mitgliedsbeiträge</em>, <em>Veranstaltungen</em>,{" "}
                  <em>Schulmaterial</em>). Sie finden die Kategorieverwaltung
                  in den Einstellungen.
                </p>
                <ul className="ml-6 list-disc space-y-2">
                  <li>Neue Kategorie anlegen mit Name und Farbe.</li>
                  <li>Kategorie umbenennen oder archivieren.</li>
                  <li>
                    Eine Bewegung kann mehrere Kategorien gleichzeitig tragen.
                  </li>
                </ul>
              </div>

              <SectionHeading id="admin-regeln" icon={Wand2}>
                Automatische Kategorisierungsregeln
              </SectionHeading>
              <div className="mt-4 space-y-4 text-muted-foreground">
                <p>
                  Damit nicht jede Buchung manuell kategorisiert werden muss,
                  gibt es Regeln. Eine Regel prüft Felder der Buchung und
                  setzt automatisch eine oder mehrere Kategorien –
                  angewendet bei jedem PDF-Import und bei jedem
                  PSD2-Abruf.
                </p>
                <p>
                  Regeln können <strong>einfach</strong> (eine Bedingung) oder{" "}
                  <strong>zusammengesetzt</strong> (bis zu zehn Bedingungen
                  mit UND/ODER-Verknüpfung) sein – zum Beispiel:{" "}
                  <em>
                    &bdquo;Verwendungszweck enthält
                    &lsquo;Mitgliedsbeitrag&rsquo; UND Betrag &gt; 0&ldquo;
                  </em>
                  .
                </p>
                <p>
                  Unterstützte Bedingungs-Felder: Buchungstext /
                  Verwendungszweck, Auftraggeber (Gegenkonto), Betrag (größer
                  als, kleiner als, gleich) und Monat.
                </p>
                <ul className="ml-6 list-disc space-y-2">
                  <li>
                    <strong>Regel anlegen:</strong>{" "}
                    <em>Einstellungen → Regeln → Neue Regel</em>.
                  </li>
                  <li>
                    <strong>Regel aktivieren/deaktivieren:</strong> Per
                    Toggle-Schalter in der Regelübersicht, ohne sie zu
                    löschen.
                  </li>
                  <li>
                    <strong>Rückwirkend anwenden:</strong> Button{" "}
                    <em>Jetzt anwenden</em> – wahlweise nur auf
                    unkategorisierte Buchungen oder auf alle. Ein
                    Fortschrittsbalken zeigt den Stand.
                  </li>
                  <li>
                    <strong>Manuelle Bulk-Zuweisung:</strong> Siehe
                    Abschnitt &bdquo;Mehrfachaktionen &amp; Löschen&ldquo; –
                    unabhängig von Regeln.
                  </li>
                </ul>
              </div>

              <SectionHeading id="admin-zugriff" icon={FolderTree}>
                Kategoriebasierter Zugriff für Betrachter
              </SectionHeading>
              <div className="mt-4 space-y-4 text-muted-foreground">
                <p>
                  Nicht jeder Betrachter soll alle Buchungen sehen. Über den
                  kategoriebasierten Zugriff können Sie pro Betrachter
                  festlegen, welche Kategorien sichtbar sind.
                </p>
                <p>
                  In der Benutzerverwaltung öffnet ein Klick auf{" "}
                  <em>Kategoriezugriff</em> ein Panel, in dem Sie Kategorien
                  zuweisen oder entziehen. Bewegungen ohne zugewiesene
                  Kategorie sind standardmäßig nur für Administratoren
                  sichtbar.
                </p>
              </div>

              <SectionHeading id="admin-genehmigungen" icon={CheckSquare}>
                Genehmigungssystem für Vereinsanträge
              </SectionHeading>
              <div className="mt-4 space-y-4 text-muted-foreground">
                <p>
                  Vereinsanträge (z.B. Kosten für eine Veranstaltung) werden
                  über <em>Genehmigungen</em> im Dashboard verwaltet (Pfad{" "}
                  <code>/dashboard/admin/genehmigungen</code>). Jeder
                  eingeloggte Administrator oder Vorstand kann einen Antrag
                  einreichen – mit Beleg-Upload, Bemerkung und Auswahl der
                  Abstimmungsberechtigten.
                </p>
                <ul className="ml-6 list-disc space-y-2">
                  <li>
                    <strong>Neuen Antrag stellen:</strong> Button{" "}
                    <em>Neuer Antrag</em>, Formular ausfüllen, Belege
                    anhängen, abstimmende Rollen wählen (Vorstand / 2.
                    Vorstand, UND- oder ODER-Verknüpfung).
                  </li>
                  <li>
                    <strong>Status-Filter:</strong> Offen, Genehmigt,
                    Abgelehnt – mit Detailseite pro Antrag und
                    Abstimmungs&shy;verlauf.
                  </li>
                  <li>
                    <strong>Entscheidung per E-Mail:</strong> Alle
                    eingetragenen Vorstände erhalten einen personalisierten
                    Entscheidungs-Link und können ohne Login direkt aus der
                    E-Mail heraus zustimmen oder ablehnen. Das spart einen
                    Extra-Login.
                  </li>
                  <li>
                    <strong>Erneut einreichen:</strong> Abgelehnte Anträge
                    können überarbeitet und erneut zur Abstimmung gestellt
                    werden.
                  </li>
                </ul>
                <div className="rounded-lg border-l-4 border-primary bg-accent/40 p-4 text-sm">
                  <strong className="text-foreground">Mehrheitsprinzip:</strong>{" "}
                  Je nach Auswahl beim Antrag gilt entweder UND (alle
                  genannten Rollen müssen zustimmen) oder ODER (eine
                  Zustimmung genügt). Antragsteller erhalten nach
                  Abschluss eine E-Mail mit dem Gesamtergebnis.
                </div>
              </div>

              <SectionHeading id="admin-kostenuebernahmen" icon={ClipboardList}>
                Anträge auf Kostenübernahme
              </SectionHeading>
              <div className="mt-4 space-y-4 text-muted-foreground">
                <p>
                  Über <em>Kostenübernahmen</em> (Pfad{" "}
                  <code>/dashboard/admin/kostenuebernahmen</code>) verwalten
                  Sie eingehende Anträge aus dem öffentlichen Formular. Das
                  Formular ist ohne Login unter{" "}
                  <code>/antrag/kostenuebernahme</code> erreichbar und kann
                  als iFrame in die Vereins-Website eingebettet werden.
                </p>
                <p>
                  Pro Antrag sehen Sie Vorname, Nachname, E-Mail, Betrag,
                  Verwendungszweck und optional angehängte Belege. Bei
                  Einreichung werden Kassenwart und Vorstand automatisch per
                  E-Mail informiert. Die Abstimmung erfolgt – wie bei
                  Vereinsanträgen – über personalisierte Entscheidungs-Links.
                  Antragsteller erhalten das Ergebnis per E-Mail inklusive
                  der Abstimmungsübersicht.
                </p>
                <div className="rounded-lg border-l-4 border-primary bg-accent/40 p-4 text-sm">
                  <strong className="text-foreground">
                    Wer stimmt ab?
                  </strong>{" "}
                  Standardmäßig sind die Benutzer mit Zusatzrolle
                  &bdquo;Vorstand&ldquo; und &bdquo;2. Vorstand&ldquo;
                  abstimmungsberechtigt. Welche Rollen bei
                  einem Antrag zustimmen müssen, lässt sich unter{" "}
                  <em>Einstellungen → Antrag-Genehmiger</em> festlegen.
                </div>
              </div>

              <SectionHeading id="admin-seafile" icon={Cloud}>
                Seafile-Integration für Belege
              </SectionHeading>
              <div className="mt-4 space-y-4 text-muted-foreground">
                <p>
                  Belege werden nicht in der Anwendung selbst gespeichert,
                  sondern im Seafile-Server des Vereins. CBS-Finanz erzeugt
                  pro Bewegung einen Link auf den Beleg.
                </p>
                <p>
                  In den Einstellungen hinterlegen Sie Seafile-URL, Token und
                  Zielordner. Danach können Sie in jeder Bewegung mit einem
                  Klick einen Beleg hochladen – die Datei landet in Seafile,
                  der Link in der Datenbank.
                </p>
              </div>

              <SectionHeading id="admin-einstellungen" icon={Settings}>
                Einstellungen &amp; API-Token
              </SectionHeading>
              <div className="mt-4 space-y-4 text-muted-foreground">
                <p>
                  Die Einstellungsseite (
                  <code>/dashboard/einstellungen</code>) ist in Tabs
                  gegliedert. Administratoren sehen zusätzliche Tabs, die
                  für Betrachter ausgeblendet sind:
                </p>
                <ul className="ml-6 list-disc space-y-2">
                  <li>
                    <strong>Integration</strong> (Admin) – KI-Anbieter
                    (OpenAI oder Anthropic Claude) und Seafile konfigurieren.
                  </li>
                  <li>
                    <strong>Bankzugang</strong> (Admin) – PSD2-Verbindung zur
                    Badischen Beamtenbank verwalten (verbinden, abrufen,
                    trennen).
                  </li>
                  <li>
                    <strong>Kategorien</strong> (Admin) – Kategorien anlegen,
                    umbenennen, farblich markieren.
                  </li>
                  <li>
                    <strong>Regeln</strong> (Admin) – Automatische
                    Kategorisierungsregeln (siehe oben).
                  </li>
                  <li>
                    <strong>Antrag-Genehmiger</strong> (Admin) – festlegen,
                    welche Rollen bei Kostenübernahme-Anträgen abstimmen
                    müssen.
                  </li>
                  <li>
                    <strong>Sicherheit</strong> (alle) –
                    Zwei-Faktor-Authentifizierung aktivieren/deaktivieren.
                  </li>
                  <li>
                    <strong>Passwort</strong> (alle) – eigenes Passwort
                    ändern.
                  </li>
                </ul>
                <p>
                  Der API-Token (OpenAI oder Anthropic) wird im Tab{" "}
                  <em>Integration</em> hinterlegt. Er wird verschlüsselt in
                  der Datenbank gespeichert und ist nur für Administratoren
                  lesbar.
                </p>
                <div className="rounded-lg border-l-4 border-destructive bg-destructive/5 p-4 text-sm">
                  <strong className="text-foreground">Wichtig:</strong> Ohne
                  gültigen API-Token funktioniert der Kontoauszug-Import
                  nicht. Prüfen Sie regelmäßig Ihr Guthaben beim gewählten
                  Anbieter.
                </div>
              </div>
            </section>

            {/* VIEWER */}
            <section id="viewer" className="scroll-mt-24">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
                  <Eye className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                    Teil 2
                  </p>
                  <h2 className="text-2xl font-bold md:text-3xl">
                    Handbuch für Betrachter
                  </h2>
                </div>
              </div>
              <p className="mt-4 text-muted-foreground">
                Dieser Abschnitt richtet sich an Vorstandsmitglieder, Prüfer
                und alle Personen mit Lesezugriff auf CBS-Finanz.
              </p>

              <SectionHeading id="viewer-ueberblick" icon={BookOpen}>
                Überblick
              </SectionHeading>
              <div className="mt-4 space-y-4 text-muted-foreground">
                <p>
                  Als Betrachter haben Sie jederzeit Einblick in den aktuellen
                  Finanzstand des Fördervereins, ohne den Kassenwart
                  kontaktieren zu müssen. Sie sehen Bewegungen, Kategorien und
                  Kennzahlen – abhängig von den Ihnen zugewiesenen Kategorien.
                </p>
              </div>

              <SectionHeading id="viewer-anmeldung" icon={KeyRound}>
                Anmeldung &amp; Profil
              </SectionHeading>
              <div className="mt-4 space-y-4 text-muted-foreground">
                <ol className="ml-6 list-decimal space-y-2">
                  <li>
                    Sie erhalten eine Einladungs-E-Mail vom Kassenwart mit
                    einem Link zum Thema &bdquo;Willkommen beim
                    CBS-Finanz-Portal&ldquo;.
                  </li>
                  <li>
                    Über den Button <em>Einladung annehmen</em> legen Sie
                    Ihr persönliches Passwort fest (mindestens 8 Zeichen).
                    Danach sind Sie direkt angemeldet und landen im
                    Dashboard.
                  </li>
                  <li>
                    Bei jedem weiteren Login nutzen Sie E-Mail + Passwort –
                    optional zusätzlich mit 2FA-Code aus Ihrer
                    Authenticator-App (siehe Abschnitt Sicherheit).
                  </li>
                  <li>
                    <strong>Passwort vergessen?</strong> Auf der
                    Login-Seite auf <em>Passwort vergessen</em> klicken. Sie
                    erhalten eine E-Mail mit einem Zurücksetzen-Link.
                  </li>
                </ol>
                <p>
                  Ihr Profil erreichen Sie über den Avatar-Button oben rechts.
                  Dort finden Sie die Einstellungen mit den Tabs{" "}
                  <em>Sicherheit</em> (2FA) und <em>Passwort</em>, sowie den
                  Link zum Handbuch und die Logout-Funktion.
                </p>
              </div>

              <SectionHeading id="viewer-dashboard" icon={Eye}>
                Dashboard lesen
              </SectionHeading>
              <div className="mt-4 space-y-4 text-muted-foreground">
                <p>
                  Das Dashboard zeigt oben Kennzahlen (Kontostand, Summe
                  Einnahmen und Ausgaben im gewählten Zeitraum) und
                  darunter die Bewegungstabelle. Jede Zeile entspricht
                  einer Banktransaktion mit Datum, Buchungstext, Betrag,
                  Saldo und Kategorie.
                </p>
                <p>
                  Die Tabelle zeigt 50 Einträge pro Seite. Mit den
                  Seitennummern am unteren Rand navigieren Sie durch
                  ältere Bewegungen. Sortierung erfolgt standardmäßig nach
                  Datum absteigend – ein Klick auf eine Spaltenüberschrift
                  ändert die Sortierung.
                </p>
                <p>
                  <strong>Quell-Badges</strong> am Zeilenende zeigen, woher
                  die Buchung stammt und ob sie bereits bestätigt ist:
                </p>
                <ul className="ml-6 list-disc space-y-2">
                  <li>
                    <strong>Blau: PDF</strong> – per Kontoauszug-Import
                    erfasst.
                  </li>
                  <li>
                    <strong>Gelb: PSD2</strong> – per Direktabruf aus der
                    Bank erfasst.
                  </li>
                  <li>
                    <strong>Grün: Bestätigt</strong> – PSD2- und PDF-Eintrag
                    wurden als identisch bestätigt.
                  </li>
                  <li>
                    <strong>Orange: Vorschlag</strong> – App hat einen
                    möglichen Doppeleintrag erkannt und fragt nach.
                  </li>
                  <li>
                    <strong>Rot: Konflikt</strong> – PDF- und PSD2-Daten
                    weichen voneinander ab; der Kassenwart muss prüfen.
                  </li>
                </ul>
                <div className="rounded-lg border-l-4 border-primary bg-accent/40 p-4 text-sm">
                  Sehen Sie nur einen Teil der Buchungen? Dann sind Ihnen nur
                  bestimmte Kategorien zugewiesen, und oben im Dashboard
                  erscheint ein entsprechender Hinweis. Wenden Sie sich an
                  den Kassenwart, wenn Sie weitere Kategorien einsehen
                  möchten.
                </div>
              </div>

              <SectionHeading id="viewer-filter" icon={Eye}>
                Filtern, Suchen &amp; Sortieren
              </SectionHeading>
              <div className="mt-4 space-y-4 text-muted-foreground">
                <p>
                  Über die Filterleiste oberhalb der Tabelle schränken Sie
                  die Ansicht ein. Alle Filter wirken zusammen und auch auf
                  den Excel-Export:
                </p>
                <ul className="ml-6 list-disc space-y-2">
                  <li>
                    <strong>Jahr / Monat</strong> – Zeitraumauswahl
                  </li>
                  <li>
                    <strong>Kategorie</strong> – Mehrfachauswahl aus allen
                    Ihnen sichtbaren Kategorien
                  </li>
                  <li>
                    <strong>Freitextsuche</strong> – durchsucht Buchungstext
                    und Bemerkung
                  </li>
                  <li>
                    <strong>Einnahmen / Ausgaben</strong> – Umschalter, der
                    die Tabelle auf Ein- oder Ausgänge reduziert
                  </li>
                  <li>
                    <strong>Sortierung</strong> – Klick auf eine
                    Spaltenüberschrift (Datum, Betrag, Buchungstext) ändert
                    die Reihenfolge
                  </li>
                </ul>
              </div>

              <SectionHeading id="viewer-kategorien" icon={Tags}>
                Kategorien verstehen
              </SectionHeading>
              <div className="mt-4 space-y-4 text-muted-foreground">
                <p>
                  Kategorien sind farbige Etiketten, die jede Buchung einem
                  Bereich zuordnen – etwa <em>Mitgliedsbeiträge</em> oder{" "}
                  <em>Schulausflüge</em>. Sie helfen dabei, auf einen Blick
                  zu erkennen, wofür Geld geflossen ist. Eine Buchung kann
                  mehrere Kategorien tragen.
                </p>
              </div>

              <SectionHeading id="viewer-abstimmung" icon={CheckSquare}>
                Als Vorstand abstimmen
              </SectionHeading>
              <div className="mt-4 space-y-4 text-muted-foreground">
                <p>
                  Wenn Sie die Zusatzrolle <em>Vorstand</em> oder{" "}
                  <em>2. Vorstand</em> besitzen, erhalten Sie bei jedem
                  neuen Kostenübernahme- oder Vereinsantrag eine E-Mail mit
                  einem persönlichen Entscheidungs-Link.
                </p>
                <ol className="ml-6 list-decimal space-y-2">
                  <li>
                    Klick auf <em>Antrag ansehen</em> öffnet eine
                    öffentliche Seite mit Antragsdetails und Belegen – ohne
                    dass Sie sich einloggen müssen.
                  </li>
                  <li>
                    Sie wählen <em>Genehmigen</em> oder <em>Ablehnen</em>{" "}
                    und können optional einen Kommentar hinterlassen.
                  </li>
                  <li>
                    Sobald die erforderliche Mehrheit erreicht ist (je nach
                    UND-/ODER-Regel), wird das Ergebnis an alle
                    Beteiligten verschickt.
                  </li>
                </ol>
                <p>
                  Alle offenen Anträge sehen Sie auch im Dashboard unter{" "}
                  <em>Genehmigungen</em>, sofern Sie dort einen Zugang
                  haben.
                </p>
              </div>

              <SectionHeading id="viewer-antrag" icon={ClipboardList}>
                Kostenübernahme beantragen
              </SectionHeading>
              <div className="mt-4 space-y-4 text-muted-foreground">
                <p>
                  Möchten Sie selbst eine Kostenübernahme durch den
                  Förderverein beantragen, nutzen Sie das öffentliche
                  Formular unter <code>/antrag/kostenuebernahme</code>
                  (auch als iFrame auf der Vereins-Website eingebettet).
                  Sie brauchen dafür keinen Login.
                </p>
                <p>
                  Erforderlich sind Vorname, Nachname, E-Mail-Adresse,
                  Betrag und ein Verwendungszweck. Belege können optional
                  hochgeladen werden. Nach dem Absenden erhalten Kassenwart
                  und Vorstand automatisch eine Benachrichtigung und
                  stimmen über den Antrag ab. Sie erhalten das Ergebnis
                  per E-Mail inklusive Abstimmungsübersicht.
                </p>
              </div>
            </section>

            {/* SICHERHEIT */}
            <section id="sicherheit" className="scroll-mt-24">
              <div className="rounded-xl border border-primary/10 bg-card p-6 shadow-sm md:p-8">
                <h2 className="flex items-center gap-3 text-2xl font-bold md:text-3xl">
                  <Lock className="h-7 w-7 text-primary" />
                  Sicherheit &amp; Zwei-Faktor-Authentifizierung
                </h2>
                <div className="mt-6 space-y-4 text-muted-foreground">
                  <p>
                    CBS-Finanz verwaltet sensible Finanzdaten. Deshalb gelten
                    einige Sicherheitsregeln für alle Benutzer:
                  </p>
                  <ul className="ml-6 list-disc space-y-2">
                    <li>
                      <strong>Starke Passwörter:</strong> Mindestens 8
                      Zeichen, Mischung aus Buchstaben, Zahlen und
                      Sonderzeichen. Passwort ändern unter{" "}
                      <em>Einstellungen → Passwort</em>.
                    </li>
                    <li>
                      <strong>2FA aktivieren:</strong> Unter{" "}
                      <em>Einstellungen → Sicherheit</em> richten Sie die
                      Zwei-Faktor-Authentifizierung ein. Scannen Sie den
                      QR-Code mit einer Authenticator-App (Google
                      Authenticator, Authy, Microsoft Authenticator oder
                      1Password) und bestätigen Sie mit einem 6-stelligen
                      Code. Dringend empfohlen für alle Administratoren.
                    </li>
                    <li>
                      <strong>Backup-Codes aufbewahren:</strong> Bei der
                      2FA-Aktivierung erhalten Sie 10 einmalig verwendbare
                      Backup-Codes. Drucken oder speichern Sie diese
                      sicher ab – Sie brauchen sie, falls Ihr Handy
                      verloren geht.
                    </li>
                    <li>
                      <strong>2FA deaktivieren:</strong> Nur nach erneuter
                      Passwort-Eingabe möglich – das schützt vor
                      ungewollter Umgehung.
                    </li>
                    <li>
                      <strong>Keine Passwörter teilen:</strong> Jeder
                      Benutzer hat einen eigenen Zugang.
                    </li>
                    <li>
                      <strong>Abmelden:</strong> Nach der Arbeit am besten
                      abmelden – besonders auf fremden Geräten.
                    </li>
                  </ul>
                  <p>
                    Bei Verdacht auf Missbrauch (unbekannter Login,
                    unerwartete E-Mail) sofort den Kassenwart informieren
                    und das Passwort zurücksetzen.
                  </p>
                </div>
              </div>
            </section>

            {/* FAQ */}
            <section id="faq" className="scroll-mt-24">
              <div className="rounded-xl border border-primary/10 bg-card p-6 shadow-sm md:p-8">
                <h2 className="flex items-center gap-3 text-2xl font-bold md:text-3xl">
                  <HelpCircle className="h-7 w-7 text-primary" />
                  FAQ &amp; Hilfe
                </h2>
                <div className="mt-6 space-y-6">
                  <div>
                    <h3 className="font-semibold text-foreground">
                      Ich habe mein Passwort vergessen. Was tun?
                    </h3>
                    <p className="mt-1 text-muted-foreground">
                      Auf der Login-Seite auf <em>Passwort vergessen</em>{" "}
                      klicken. Sie erhalten eine E-Mail mit einem
                      Zurücksetzen-Link.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">
                      Der PDF-Import schlägt fehl. Warum?
                    </h3>
                    <p className="mt-1 text-muted-foreground">
                      Häufigste Ursachen: kein gültiger API-Token in den
                      Einstellungen, PDF ist verschlüsselt, oder das PDF
                      stammt nicht von der Badischen Beamtenbank. Prüfen Sie
                      den Token und laden Sie ggf. die Original-PDF erneut von
                      der Bank herunter.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">
                      Warum sehe ich als Betrachter manche Buchungen nicht?
                    </h3>
                    <p className="mt-1 text-muted-foreground">
                      Sie sehen nur Buchungen mit Kategorien, die Ihnen der
                      Administrator zugewiesen hat. Bei Fragen bitte an den
                      Kassenwart wenden.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">
                      Ich sehe ein rotes &bdquo;Konflikt&ldquo;-Badge an
                      einer Buchung. Was tun?
                    </h3>
                    <p className="mt-1 text-muted-foreground">
                      Das bedeutet, dass die PSD2-Daten der Bank und die
                      PDF-Importdaten voneinander abweichen (z.B.
                      unterschiedlicher Betrag oder Buchungstext). Klicken
                      Sie auf das Badge, um die Vergleichstabelle zu sehen.
                      Im Zweifel gilt das PDF als verbindliche Quelle.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">
                      Der automatische PSD2-Abruf hat gestern nichts geliefert.
                    </h3>
                    <p className="mt-1 text-muted-foreground">
                      Entweder gab es an dem Tag keine Buchungen, oder die
                      Bank-Zustimmung ist abgelaufen (max. 180 Tage).
                      Prüfen Sie in <em>Einstellungen → Bankzugang</em> den
                      Status; bei abgelaufener Zustimmung genügt ein Klick
                      auf <em>Erneut verbinden</em>.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">
                      Ich habe eine Buchung versehentlich gelöscht.
                    </h3>
                    <p className="mt-1 text-muted-foreground">
                      Gelöschte Buchungen können nicht wiederhergestellt
                      werden. Wenn die Buchung per PSD2 aus der Bank kam,
                      taucht sie beim nächsten Abruf wieder auf. Bei
                      PDF-Importen importieren Sie den betroffenen
                      Kontoauszug erneut.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">
                      Kann ich die Anwendung mobil benutzen?
                    </h3>
                    <p className="mt-1 text-muted-foreground">
                      Ja, CBS-Finanz ist responsiv und funktioniert auf
                      Smartphone, Tablet und Desktop. Eine eigene App gibt
                      es nicht – die Web-Oberfläche reicht.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">
                      An wen wende ich mich bei technischen Problemen?
                    </h3>
                    <p className="mt-1 text-muted-foreground">
                      Bei technischen Problemen zuerst den Kassenwart
                      kontaktieren. Dieser leitet bei Bedarf an den Entwickler
                      weiter.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-primary/10 pt-8 text-center text-sm text-muted-foreground">
              <p>
                CBS-Finanz &middot; Handbuch &middot; CBS-Mannheim Förderverein
              </p>
              <p className="mt-1">
                Stand: {new Date().toLocaleDateString("de-DE")}
              </p>
            </footer>
          </main>
        </div>
      </div>
    </div>
  )
}
