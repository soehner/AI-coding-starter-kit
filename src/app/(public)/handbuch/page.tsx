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
  { id: "admin-bearbeiten", title: "Bewegungen bearbeiten", icon: FileSpreadsheet },
  { id: "admin-export", title: "Kassenbuch-Export", icon: FileSpreadsheet },
  { id: "admin-kategorien", title: "Kategorien verwalten", icon: Tags },
  { id: "admin-regeln", title: "Automatische Regeln", icon: Wand2 },
  { id: "admin-zugriff", title: "Kategoriebasierter Zugriff", icon: FolderTree },
  { id: "admin-genehmigungen", title: "Genehmigungen", icon: CheckSquare },
  { id: "admin-kostenuebernahmen", title: "Kostenübernahme-Anträge", icon: ClipboardList },
  { id: "admin-seafile", title: "Seafile-Integration", icon: Cloud },
  { id: "admin-einstellungen", title: "API-Einstellungen", icon: Settings },
]

const viewerSections: Section[] = [
  { id: "viewer-ueberblick", title: "Überblick", icon: BookOpen },
  { id: "viewer-anmeldung", title: "Anmeldung & Profil", icon: KeyRound },
  { id: "viewer-dashboard", title: "Dashboard lesen", icon: Eye },
  { id: "viewer-filter", title: "Filtern & Suchen", icon: Eye },
  { id: "viewer-kategorien", title: "Kategorien verstehen", icon: Tags },
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
                  Die Benutzerverwaltung erreichen Sie über das Avatar-Menü
                  oben rechts unter <em>Benutzerverwaltung</em>. Hier sehen
                  Sie alle eingeladenen Personen mit Rolle, Status und
                  Berechtigungen.
                </p>
                <ul className="ml-6 list-disc space-y-2">
                  <li>
                    <strong>Benutzer einladen:</strong> Klick auf
                    &bdquo;Benutzer einladen&ldquo;, E-Mail und Rolle
                    (Administrator/Betrachter) wählen. Die Einladung wird per
                    Resend verschickt.
                  </li>
                  <li>
                    <strong>Rolle ändern:</strong> Über das Aktionsmenü eines
                    Benutzers lässt sich die Rolle nachträglich anpassen.
                  </li>
                  <li>
                    <strong>Berechtigungen:</strong> Pro Benutzer können
                    einzelne Funktionen zusätzlich freigegeben oder entzogen
                    werden (z.B. Import erlauben für Nicht-Admins).
                  </li>
                  <li>
                    <strong>Benutzer entfernen:</strong> Deaktiviert den Zugang
                    vollständig. Wiederherstellung erfolgt über eine neue
                    Einladung.
                  </li>
                </ul>
                <div className="rounded-lg border-l-4 border-primary bg-accent/40 p-4 text-sm">
                  <strong className="text-foreground">Hinweis:</strong>{" "}
                  Eingeladene Benutzer erhalten einen Link zum Festlegen des
                  Passworts. Der Link ist zeitlich begrenzt gültig.
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

              <SectionHeading id="admin-bearbeiten" icon={FileSpreadsheet}>
                Bewegungen bearbeiten &amp; Bemerkungen
              </SectionHeading>
              <div className="mt-4 space-y-4 text-muted-foreground">
                <p>
                  Jede Bewegung in der Tabelle lässt sich inline bearbeiten:
                  einfach auf ein Feld klicken. Bearbeitbar sind u.a.:
                </p>
                <ul className="ml-6 list-disc space-y-2">
                  <li>Bemerkung / interne Notiz</li>
                  <li>Kategorie (Auswahl aus Kategorieliste)</li>
                  <li>Belegverknüpfung (Seafile-Link)</li>
                </ul>
                <p>
                  Die Originalwerte aus dem Kontoauszug (Datum, Betrag,
                  Verwendungszweck) bleiben als Referenz erhalten.
                </p>
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
                  gibt es Regeln. Eine Regel prüft Felder wie{" "}
                  <em>Verwendungszweck</em> oder <em>Gegenkonto</em> und setzt
                  automatisch eine oder mehrere Kategorien.
                </p>
                <p>
                  Regeln können <strong>einfach</strong> (eine Bedingung) oder{" "}
                  <strong>zusammengesetzt</strong> (mehrere Bedingungen mit
                  UND/ODER) sein – z.B.
                  <em>
                    {" "}
                    &bdquo;Verwendungszweck enthält &lsquo;Mitgliedsbeitrag&rsquo; UND
                    Betrag &gt; 0&ldquo;
                  </em>
                  .
                </p>
                <ul className="ml-6 list-disc space-y-2">
                  <li>
                    <strong>Regel anlegen:</strong> Einstellungen →
                    Kategorisierungsregeln → Neue Regel.
                  </li>
                  <li>
                    <strong>Auf bestehende Daten anwenden:</strong> Im
                    Regel-Dialog lässt sich die Regel rückwirkend auf alle
                    passenden Bewegungen anwenden.
                  </li>
                  <li>
                    <strong>Bulk-Kategorisierung:</strong> Mehrere markierte
                    Bewegungen können gemeinsam einer Kategorie zugewiesen
                    werden.
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
                  Über den Menüpunkt <em>Genehmigungen</em> sehen Sie alle
                  offenen Vereinsanträge. Jeder Antrag hat einen Status
                  (offen/genehmigt/abgelehnt) und kann mit einem Kommentar
                  entschieden werden. Antragsteller werden automatisch per
                  E-Mail informiert.
                </p>
              </div>

              <SectionHeading id="admin-kostenuebernahmen" icon={ClipboardList}>
                Anträge auf Kostenübernahme
              </SectionHeading>
              <div className="mt-4 space-y-4 text-muted-foreground">
                <p>
                  Über <em>Anträge auf Kostenübernahme</em> verwalten Sie
                  eingehende Anträge aus dem öffentlichen Formular. Das
                  Formular kann als iFrame in die Vereins-Website eingebettet
                  werden – jeder Antrag landet direkt in der Anwendung.
                </p>
                <p>
                  Pro Antrag sehen Sie Antragsteller, Betrag, Verwendungszweck
                  und optional angehängte Belege. Nach Prüfung setzen Sie den
                  Status auf genehmigt oder abgelehnt.
                </p>
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
                API-Einstellungen (OpenAI / Claude)
              </SectionHeading>
              <div className="mt-4 space-y-4 text-muted-foreground">
                <p>
                  Unter <em>Einstellungen</em> konfigurieren Sie den KI-Anbieter
                  für das PDF-Parsing. Wählen Sie zwischen OpenAI (Vision) und
                  Anthropic Claude und hinterlegen Sie den entsprechenden API-
                  Token. Der Token wird verschlüsselt in der Datenbank
                  gespeichert und ist nur für Administratoren lesbar.
                </p>
                <div className="rounded-lg border-l-4 border-destructive bg-destructive/5 p-4 text-sm">
                  <strong className="text-foreground">Wichtig:</strong> Ohne
                  gültigen Token funktioniert der Kontoauszug-Import nicht.
                  Prüfen Sie regelmäßig Ihr Guthaben beim gewählten Anbieter.
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
                    einem Link.
                  </li>
                  <li>
                    Über den Link setzen Sie Ihr persönliches Passwort.
                  </li>
                  <li>
                    Bei jedem weiteren Login nutzen Sie E-Mail + Passwort (und
                    optional 2FA, siehe Sicherheit).
                  </li>
                </ol>
                <p>
                  Ihr Profil erreichen Sie über den Avatar-Button oben rechts.
                  Dort finden Sie Einstellungen, Passwort ändern und das
                  Handbuch.
                </p>
              </div>

              <SectionHeading id="viewer-dashboard" icon={Eye}>
                Dashboard lesen
              </SectionHeading>
              <div className="mt-4 space-y-4 text-muted-foreground">
                <p>
                  Das Dashboard zeigt oben Kennzahlen (Kontostand, Einnahmen,
                  Ausgaben) und darunter die Bewegungstabelle. Jede Zeile
                  entspricht einer Banktransaktion mit Datum, Verwendungszweck,
                  Betrag und Kategorie.
                </p>
                <div className="rounded-lg border-l-4 border-primary bg-accent/40 p-4 text-sm">
                  Sehen Sie nur einen Teil der Buchungen? Dann sind Ihnen nur
                  bestimmte Kategorien zugewiesen. Wenden Sie sich an den
                  Kassenwart, wenn Sie weitere Kategorien einsehen möchten.
                </div>
              </div>

              <SectionHeading id="viewer-filter" icon={Eye}>
                Filtern &amp; Suchen
              </SectionHeading>
              <div className="mt-4 space-y-4 text-muted-foreground">
                <p>
                  Über die Filterleiste oberhalb der Tabelle schränken Sie die
                  Ansicht ein:
                </p>
                <ul className="ml-6 list-disc space-y-2">
                  <li>Zeitraum (von / bis)</li>
                  <li>Kategorie</li>
                  <li>Freitextsuche im Verwendungszweck</li>
                  <li>Nur Einnahmen oder nur Ausgaben</li>
                </ul>
              </div>

              <SectionHeading id="viewer-kategorien" icon={Tags}>
                Kategorien verstehen
              </SectionHeading>
              <div className="mt-4 space-y-4 text-muted-foreground">
                <p>
                  Kategorien sind farbige Etiketten, die jede Buchung einem
                  Bereich zuordnen – etwa <em>Mitgliedsbeiträge</em> oder{" "}
                  <em>Schulausflüge</em>. Sie helfen dabei, auf einen Blick zu
                  erkennen, wofür Geld geflossen ist.
                </p>
              </div>

              <SectionHeading id="viewer-antrag" icon={ClipboardList}>
                Kostenübernahme beantragen
              </SectionHeading>
              <div className="mt-4 space-y-4 text-muted-foreground">
                <p>
                  Möchten Sie eine Kostenübernahme durch den Förderverein
                  beantragen, nutzen Sie das öffentliche Formular (Link auf der
                  Vereinsseite). Nach dem Absenden erhält der Kassenwart eine
                  Benachrichtigung. Sobald der Antrag bearbeitet ist, werden
                  Sie per E-Mail über die Entscheidung informiert.
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
                      <strong>Starke Passwörter:</strong> Mindestens 8 Zeichen,
                      Mischung aus Buchstaben, Zahlen und Sonderzeichen.
                    </li>
                    <li>
                      <strong>2FA aktivieren:</strong> Unter{" "}
                      <em>Einstellungen → Sicherheit</em> können Sie die
                      Zwei-Faktor-Authentifizierung per Authenticator-App
                      einrichten. Dringend empfohlen für alle Administratoren.
                    </li>
                    <li>
                      <strong>Keine Passwörter teilen:</strong> Jeder Benutzer
                      hat einen eigenen Zugang.
                    </li>
                    <li>
                      <strong>Abmelden:</strong> Nach der Arbeit am besten
                      abmelden – besonders auf fremden Geräten.
                    </li>
                  </ul>
                  <p>
                    Bei Verdacht auf Missbrauch (unbekannter Login,
                    unerwartete E-Mail) sofort den Kassenwart informieren und
                    das Passwort zurücksetzen.
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
                      Kann ich die Anwendung mobil benutzen?
                    </h3>
                    <p className="mt-1 text-muted-foreground">
                      Ja, CBS-Finanz ist responsiv und funktioniert auf
                      Smartphone, Tablet und Desktop. Eine eigene App gibt es
                      nicht – die Web-Oberfläche reicht.
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
