# PROJ-17: Spendenquittung (Zuwendungsbestätigung)

## Status: In Bearbeitung
**Erstellt:** 2026-05-13
**Zuletzt aktualisiert:** 2026-05-13

## Abhängigkeiten
- Benötigt: PROJ-1 (Authentifizierung) – nur Administratoren dürfen Quittungen ausstellen
- Benötigt: PROJ-4 (Bankbewegungen-Dashboard) – Buchungsauswahl als Einstiegspunkt
- Benötigt: PROJ-5 (Eintragsbearbeitung) – liefert Transaktionsdaten (Betrag, Datum, Gegenseite)

---

## Überblick

Aus einer ausgewählten Bankbuchung heraus kann der Kassenwart eine steuerlich anerkannte **Zuwendungsbestätigung nach amtlichem BMF-Muster** (§ 10b EStG) erstellen, als PDF exportieren und direkt per E-Mail an den Spender versenden. Eine Spender-Datenbank merkt sich Spenderdaten für spätere Quittungen. Eine Quittungs-Historie protokolliert alle ausgestellten Bestätigungen.

---

## Rechtliche Rahmenbedingungen

### Amtliches Muster (Pflicht)
Gemäß § 50 Abs. 1 EStDV und BMF-Schreiben vom 07.11.2013 muss das amtlich vorgeschriebene Muster verwendet werden. Wortlaut und Umfang dürfen **nicht verändert** werden. Werbung und Danksagungen sind auf der Vorderseite unzulässig.

### Pflichtfelder auf der Quittung
| Feld | Herkunft |
|------|----------|
| Name & Anschrift des Vereins | Organisationseinstellungen |
| Steuernummer | Organisationseinstellungen |
| Finanzamt | Organisationseinstellungen |
| Freistellungsbescheid-Datum | Organisationseinstellungen |
| Freistellungsbescheid-Aktenzeichen | Organisationseinstellungen |
| Satzungsmäßiger Zweck | Organisationseinstellungen |
| Unterzeichner (Name) | Organisationseinstellungen |
| Name & Anschrift des Spenders | Spender-Datenbank / manuelle Eingabe |
| Betrag in Ziffern | Buchung (amount) |
| Betrag in Buchstaben | Automatisch generiert |
| Datum der Zuwendung | Buchung (booking_date) |
| Quittungs-Nummer | Automatisch vergeben (SQ-JJJJ-NNNN) |
| Ausstellungsdatum | Aktuelles Datum |
| Haftungshinweis (§ 10b Abs. 4 EStG) | Fest im Template |
| 5-Jahres-Hinweis (§ 63 Abs. 5 AO) | Fest im Template |

---

## Teilbereiche

Das Feature umfasst vier eng verbundene Teilbereiche:

1. **Organisationseinstellungen** – Vereinsdaten für alle Quittungen
2. **Spender-Datenbank** – Wiederverwendbare Spenderadressen
3. **Quittungs-Erstellung** – Formular, PDF-Generierung, E-Mail-Versand
4. **Quittungs-Historie** – Übersicht aller ausgestellten Quittungen

---

## User Stories

### Organisationseinstellungen
- Als Administrator möchte ich die Vereinsdaten (Name, Adresse, Steuernummer, Finanzamt, Freistellungsbescheid) einmalig in den Einstellungen hinterlegen, damit sie automatisch auf jeder Quittung erscheinen.
- Als Administrator möchte ich den Unterzeichnernamen (Vorsitzender/Kassenwart) in den Einstellungen festlegen, damit die Quittung rechtskonform unterschrieben aussieht.
- Als Administrator möchte ich eine Warnung erhalten, wenn der Freistellungsbescheid älter als 5 Jahre ist, damit ich ihn rechtzeitig erneuern lasse.

### Spender-Datenbank
- Als Administrator möchte ich beim Erstellen einer Quittung die Spenderdaten (Name, Adresse, E-Mail) erfassen und speichern, damit ich sie bei der nächsten Quittung für denselben Spender nicht erneut eingeben muss.
- Als Administrator möchte ich einen bekannten Spender anhand des Kontoinhaber-Namens aus der Buchung automatisch vorgeschlagen bekommen, damit die Dateneingabe schneller geht.
- Als Administrator möchte ich gespeicherte Spenderdaten bearbeiten können, falls sich Adresse oder E-Mail geändert hat.

### Quittungs-Erstellung
- Als Administrator möchte ich bei einer Buchung auf „Spendenquittung erstellen" klicken, damit ein vorausgefülltes Formular mit Buchungsdaten (Betrag, Datum, Gegenseite) öffnet.
- Als Administrator möchte ich fehlende Angaben (Spenderadresse, Zweck) im Formular ergänzen können, bevor die Quittung generiert wird.
- Als Administrator möchte ich die fertige Quittung als PDF im amtlichen BMF-Muster herunterladen können, damit ich sie archivieren kann.
- Als Administrator möchte ich die Quittung direkt per E-Mail an den Spender versenden können, damit ich keine separaten Schritte außerhalb der App brauche.
- Als Administrator möchte ich vor dem Versenden eine Vorschau der Quittung sehen, damit ich Fehler vor der Zustellung erkenne.

### Quittungs-Historie
- Als Administrator möchte ich alle ausgestellten Quittungen in einer Übersichtsliste sehen, damit ich den Überblick über ausgestellte Bestätigungen behalte.
- Als Administrator möchte ich jede Quittung erneut als PDF herunterladen können, damit ich Duplikate bei Verlust ausstellen kann.
- Als Administrator möchte ich sehen, ob und wann eine Quittung per E-Mail versendet wurde, damit ich den Versandstatus nachvollziehen kann.
- Als Administrator möchte ich Quittungen nach Jahr und Spender filtern können, damit ich zum Jahresende alle Belege zusammenstellen kann.
- Als Betrachter möchte ich die Quittungs-Historie einsehen können (nur lesen), damit der Vorstand den Überblick hat.

---

## Akzeptanzkriterien

### Organisationseinstellungen
- [ ] Einstellungsseite enthält Abschnitt „Organisation & Freistellungsbescheid"
- [ ] Felder: Vereinsname, Adresszeile 1, Adresszeile 2, PLZ, Ort, Steuernummer, Finanzamt, Bescheid-Datum (Datumspicker), Bescheid-Aktenzeichen, Satzungsmäßiger Zweck (Freitext), Unterzeichner-Name, letzter Veranlagungszeitraum
- [ ] Validierung: Alle Pflichtfelder müssen ausgefüllt sein, bevor eine Quittung erstellt werden kann
- [ ] Warnung sichtbar, wenn Bescheid-Datum älter als 4 Jahre (proaktive Erinnerung, nicht blockierend)
- [ ] Nur Administratoren können Organisationseinstellungen ändern

### Spender-Datenbank
- [ ] Spender-Datensatz enthält: Vollständiger Name, Straße, PLZ, Ort, E-Mail (optional), IBAN (optional, schreibgeschützt aus Buchung)
- [ ] Beim Öffnen des Quittungsformulars wird der `counterpart`-Name aus der Buchung mit vorhandenen Spendern verglichen (Fuzzy-Match) und passende Einträge als Vorschläge angezeigt
- [ ] Neuen Spender anlegen und mit der Quittung verknüpfen möglich
- [ ] Gespeicherte Spenderdaten werden beim Erstellen zukünftiger Quittungen für dieselbe IBAN/denselben Namen automatisch vorausgefüllt

### Quittungs-Erstellung
- [ ] Schaltfläche „Spendenquittung erstellen" in der Transaktionszeile (Kontextmenü) und im Transaktionsdetail sichtbar (nur für Administratoren)
- [ ] Formular füllt automatisch vor: Betrag (aus `amount`), Datum (aus `booking_date`), Spendername (aus `counterpart`)
- [ ] Formular zeigt an, welche Felder noch manuell ausgefüllt werden müssen (Pflichtfelder hervorgehoben)
- [ ] Betrag in Buchstaben wird serverseitig aus dem Zahl-Betrag generiert (kein manuelles Eintippen)
- [ ] Quittungs-Nummer wird automatisch vergeben: `SQ-JJJJ-NNNN` (fortlaufend pro Jahr, Lücken erlaubt)
- [ ] PDF-Vorschau öffnet sich im Dialog vor dem Herunterladen/Versenden
- [ ] Generiertes PDF entspricht dem amtlichen BMF-Muster (Muster 1 – Geldspende an inländische Körperschaft)
- [ ] PDF enthält alle Pflichtfelder (siehe Tabelle oben) und beide gesetzlichen Pflichthinweise
- [ ] PDF wird in Supabase Storage gespeichert und mit der Quittung verknüpft
- [ ] Quittung wird in der Datenbank gespeichert, bevor die E-Mail versendet wird
- [ ] E-Mail-Versand via Resend mit PDF als Anhang; Betreff und Text vorausgefüllt, aber editierbar
- [ ] Nach Versand wird `email_versendet_am` und `email_empfaenger` protokolliert
- [ ] Jede Buchung kann mehrere Quittungen haben (Stornierung + Neuausstellung möglich)

### Quittungs-Historie
- [ ] Separate Seite/Tab „Spendenquittungen" im Admin-Bereich
- [ ] Tabellenansicht mit: Quittungs-Nr., Spendername, Betrag, Spende-Datum, Ausstellungsdatum, E-Mail-Status (versendet / nicht versendet), Verknüpfung zur Buchung
- [ ] Filter: Jahr, Spendername (Freitext), Versandstatus
- [ ] Jede Quittung kann erneut als PDF heruntergeladen werden
- [ ] „E-Mail erneut senden"-Funktion für verlorene Quittungen
- [ ] Verlinkung: Klick auf Quittung öffnet zugehörige Buchung im Dashboard
- [ ] Betrachter können die Historie lesen, aber keine Quittungen erstellen oder herunterladen

---

## Randfälle

- **Organisationseinstellungen fehlen:** Beim Klick auf „Spendenquittung erstellen" erscheint ein Hinweis, dass zuerst die Organisationseinstellungen ausgefüllt werden müssen, mit direktem Link zur Einstellungsseite.
- **Buchung hat negativen Betrag (Ausgabe):** Schaltfläche „Spendenquittung erstellen" wird für Abbuchungen/Ausgaben **nicht** angezeigt – nur für positive Eingänge (amount > 0).
- **Buchung ist eine PSD2-Transaktion im Status `nur_psd2`:** Quittung kann trotzdem erstellt werden, da der Buchungseingang belegt ist.
- **Spenderbetrag überschreitet 300 €:** Keine besondere Einschränkung – das amtliche Muster ist für alle Beträge gültig.
- **E-Mail-Versand schlägt fehl:** Quittung ist bereits in der Datenbank gespeichert und als PDF vorhanden; Fehlermeldung mit Hinweis auf „E-Mail erneut senden" in der Historie.
- **Buchung wird nachträglich gelöscht:** Quittung bleibt in der Datenbank erhalten (historisches Dokument), Verknüpfung zur Buchung wird als `[gelöscht]` angezeigt.
- **Freistellungsbescheid abgelaufen (> 5 Jahre):** Warnung im Formular, aber kein Blockieren – Kassenwart kann trotzdem quittieren.
- **Gleiche Buchung, mehrere Quittungen:** Zweite Quittung für dieselbe Buchung löst Warnhinweis aus: „Für diese Buchung wurde bereits eine Quittung ausgestellt (SQ-JJJJ-NNNN)."
- **Spendername enthält Sonderzeichen/Umlaute:** PDF-Generierung muss Umlaute korrekt darstellen (UTF-8, keine Ersetzungen).
- **Sehr langer Vereinsname oder Spendername:** Layout des PDFs muss Zeilenumbrüche sauber handhaben.
- **E-Mail-Adresse des Spenders nicht bekannt:** E-Mail-Versand-Schritt überspringbar; Quittung kann trotzdem als PDF heruntergeladen werden.

---

## Technische Anforderungen

- **PDF-Generierung:** Serverseitig (API-Route), z. B. via `@react-pdf/renderer` oder `puppeteer` – kein clientseitiges PDF
- **Betrag in Worten:** Deutsche Zahlwörter (z. B. 1.234,56 € → „Eintausendzweihundertvierunddreißig Euro und 56 Cent")
- **E-Mail:** Via bestehendes Resend-Setup (wie PROJ-2, PROJ-10); PDF als Base64-Anhang
- **Speicherung:** PDFs in Supabase Storage, Bucket `spendenquittungen` (private, nur Admins)
- **RLS:** Quittungen und Spenderdaten nur für eingeloggte Benutzer lesbar; Erstellen/Ändern nur für Admins
- **Quittungs-Nummer:** Serverseitig vergeben, Race-Condition-sicher (Datenbanksequenz oder Lock)
- **Sicherheit:** Spenderpersonaldaten (Name, Adresse) unterliegen DSGVO – Löschfunktion für Spenderdaten vorsehen
- **Performance:** PDF-Generierung < 3 Sekunden; E-Mail-Versand asynchron (kein blockierender Request)

---

## Neue Datenbankstrukturen

### Tabelle `spender`
| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | uuid PK | |
| `name` | text NOT NULL | Vollständiger Name |
| `strasse` | text | |
| `plz` | text | |
| `ort` | text | |
| `email` | text | Optional |
| `iban` | text | Optional, aus Buchung übernommen |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### Tabelle `spendenquittungen`
| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | uuid PK | |
| `quittung_nummer` | text UNIQUE | z. B. „SQ-2026-0001" |
| `transaction_id` | uuid FK → transactions | Nullable |
| `spender_id` | uuid FK → spender | |
| `betrag` | numeric NOT NULL | |
| `spende_datum` | date NOT NULL | |
| `quittung_datum` | date NOT NULL | Ausstellungsdatum |
| `zweck` | text | Satzungsmäßiger Zweck (Snapshot) |
| `verein_snapshot` | jsonb | Vereinsdaten zum Ausstellungszeitpunkt |
| `pdf_path` | text | Supabase Storage Pfad |
| `email_versendet_am` | timestamptz | Nullable |
| `email_empfaenger` | text | Nullable |
| `erstellt_von` | uuid FK → user_profiles | |
| `created_at` | timestamptz | |

### Erweiterung `app_settings` (oder neue Tabelle `organisation_einstellungen`)
Felder: `verein_name`, `adresse_zeile1`, `adresse_zeile2`, `plz`, `ort`, `steuernummer`, `finanzamt`, `freistellungsbescheid_datum`, `freistellungsbescheid_aktenzeichen`, `satzungszweck`, `unterzeichner_name`, `letzter_veranlagungszeitraum`

---

## Out of Scope
- Sachspenden (nur Geldspenden aus Buchungen)
- Sammelbestätigungen (Jahresquittungen für viele Kleinspenden)
- Mitgliedsbeitragsquittungen
- Digitale Signatur / qualifizierte elektronische Signatur
- Automatisches Erkennen von Spenden (keine Kategorisierungsregel)

---

## Technisches Design (Solution Architect)

### Überblick

Das Feature besteht aus vier Bausteinen, die aufeinander aufbauen:

```
① Organisationseinstellungen  →  ② Spender-Datenbank
         ↓                              ↓
         └──────────→  ③ Quittungs-Erstellung  ←──────── Buchung
                               ↓
                       ④ Quittungs-Historie
```

Die Buchung liefert Betrag, Datum und Gegenpartei. Die Organisationseinstellungen liefern die Vereinsdaten. Zusammen ergibt das eine vollständige, amtlich konforme Quittung.

---

### A) Komponentenstruktur (UI-Baum)

```
Dashboard
│
├── Einstellungen (bestehend: /dashboard/einstellungen)
│   └── Neuer Tab „Organisation"
│       └── organisation-einstellungen-form  [NEU]
│           (Vereinsname, Adresse, Steuernr., Finanzamt,
│            Freistellungsbescheid, Unterzeichner)
│
├── Transaktions-Dashboard (bestehend)
│   └── transaction-table (bestehend)
│       └── Kontextmenü ← neuer Eintrag „Spendenquittung erstellen"
│                          (nur sichtbar bei amount > 0, nur für Admins)
│
├── Spendenquittungen [NEU: /dashboard/spendenquittungen]
│   ├── Filter-Leiste (Jahr, Spendername, Versandstatus)
│   └── spendenquittungen-tabelle  [NEU]
│       (Nr., Spendername, Betrag, Datum, E-Mail-Status, Buchungs-Link)
│       └── Zeilen-Aktionen: PDF herunterladen | E-Mail erneut senden
│
└── Dialoge (werden von transaction-table geöffnet)
    │
    ├── spendenquittung-erstellen-dialog  [NEU]
    │   ├── Schritt 1 – Spender
    │   │   └── spender-auswahl-combobox  [NEU]
    │   │       (Suche in Datenbank, Vorschlag basierend auf
    │   │        counterpart-Name, „Neuen Spender anlegen"-Option)
    │   ├── Schritt 2 – Quittungsdaten
    │   │   (Betrag/Datum vorausgefüllt, Zweck editierbar,
    │   │    Ausstellungsdatum heute, Pflichtfelder markiert)
    │   └── Schritt 3 – Vorschau & Abschluss
    │       ├── PDF-Vorschau (eingebettetes iFrame)
    │       ├── [PDF herunterladen]-Button
    │       └── [Per E-Mail senden]-Bereich
    │           (Empfänger-Adresse, Betreff und Text vorausgefüllt,
    │            editierbar)
    │
    └── spender-bearbeiten-dialog  [NEU]
        (Name, Straße, PLZ, Ort, E-Mail – separat aufrufbar aus Historie)
```

---

### B) Datenhaltung

**Drei neue Datenbankstrukturen:**

**1. Organisationseinstellungen**
Kein neues Schema nötig – die bestehende `app_settings`-Tabelle (Key-Value-Speicher) wird um ~12 neue Schlüssel erweitert. Beispiele: `org_verein_name`, `org_steuernummer`, `org_freistellungsbescheid_datum` usw.
→ Vorteil: Passt nahtlos ins bestehende Settings-System; keine neue Migration für eine eigene Tabelle.

**2. Spender-Datenbank (neue Tabelle `spender`)**
Speichert wiederverwendbare Spenderdaten: Name, Adresse (Straße, PLZ, Ort), E-Mail, IBAN. Die IBAN wird beim ersten Erstellen aus der Buchung übernommen und dient als Erkennungsmerkmal für zukünftige Buchungen desselben Spenders.

**3. Quittungs-Archiv (neue Tabelle `spendenquittungen`)**
Jede ausgestellte Quittung wird unveränderlich gespeichert. Enthält:
- Referenz zur Buchung (nullable – für den Fall, dass die Buchung gelöscht wird)
- Referenz zum Spender
- Betrag, Daten (Spende + Ausstellung)
- `verein_snapshot` (JSON-Abbild der Vereinsdaten zum Ausstellungszeitpunkt – so bleibt die Quittung korrekt, auch wenn die Einstellungen später geändert werden)
- Pfad zur PDF-Datei in Supabase Storage
- E-Mail-Versandstatus (Zeitstempel + Empfänger-Adresse)
- Quittungs-Nummer (`SQ-JJJJ-NNNN`)

**Supabase Storage:**
Neuer privater Bucket `spendenquittungen` – Zugriff nur für eingeloggte Admins über signierte URLs (zeitlich begrenzt, kein öffentlicher Zugriff).

---

### C) API-Routen (neue Endpunkte)

```
/api/admin/spendenquittungen/
   GET   → Liste aller Quittungen (mit Filterung)
   POST  → Quittung erstellen + PDF generieren + in Storage ablegen

/api/admin/spendenquittungen/[id]/
   GET   → Einzelne Quittung inkl. signierter PDF-Download-URL

/api/admin/spendenquittungen/[id]/email/
   POST  → Quittung per E-Mail (erneut) versenden

/api/admin/spender/
   GET   → Spenderliste (mit Volltextsuche)
   POST  → Neuen Spender anlegen

/api/admin/spender/[id]/
   PATCH  → Spenderdaten bearbeiten
   DELETE → Spender löschen (DSGVO-Recht auf Vergessenwerden)

/api/admin/settings (bestehend)
   → Wird um Organisations-Keys erweitert (kein neuer Endpunkt nötig)
```

---

### D) PDF-Generierung: Technische Entscheidung

**Gewählte Bibliothek: `@react-pdf/renderer`**

| Option | Bewertung |
|--------|-----------|
| `@react-pdf/renderer` | ✅ Serverseitig in Next.js App Router nutzbar, kein Browser nötig, gute Umlaut-Unterstützung, schlankes Bundle (~500 KB) |
| `puppeteer` / `playwright` | ❌ Headless Browser zu groß für Vercel (>50 MB), langsam, komplexes Setup |
| `pdfkit` | ⚠️ Low-Level, viel manuelles Layout, kein React-Rendering |

`@react-pdf/renderer` erlaubt es, das amtliche BMF-Muster als React-Komponente zu definieren – mit fixen Texten, die rechtlich nicht veränderbar sind, und variablen Platzhaltern für die Pflichtfelder. Das PDF wird serverseitig in der API-Route erzeugt, nie im Browser.

**Betrag in Worten:** Eigene, kleine Hilfsfunktion in `src/lib/betrag-in-worten.ts` – keine externe Bibliothek nötig, da nur EUR-Beträge im deutschen Format benötigt werden.

---

### E) E-Mail-Versand

Verwendet das bestehende **Resend**-Setup (wie PROJ-2 Einladungen, PROJ-10 Genehmigungen). Das PDF wird als Base64-kodierter Anhang mitgeschickt. Betreff und Text sind vorausgefüllt, aber im Dialog editierbar. Der Versand läuft in der API-Route synchron, da Resend sehr schnell antwortet (<500 ms).

---

### F) Spender-Erkennung (Fuzzy-Match)

Beim Öffnen des Erstellungs-Dialogs wird der `counterpart`-Name der Buchung serverseitig mit allen gespeicherten Spendern verglichen. Verwendet **PostgreSQL `similarity()`** (pg_trgm-Extension), die in Supabase bereits aktiviert ist. Ähnlichkeit ≥ 0,4 → Vorschlag anzeigen. Der Benutzer wählt den richtigen Spender aus oder legt einen neuen an.

---

### G) Zugriffssteuerung (RLS)

| Tabelle | Lesen | Schreiben/Löschen |
|---------|-------|-------------------|
| `spender` | Admin | Admin |
| `spendenquittungen` | Admin + Betrachter (Lesezugriff) | Nur Admin |
| Storage `spendenquittungen` | Nur Admin (signierte URLs) | Nur Admin |
| `app_settings` (org_*) | Admin | Admin |

---

### H) Abhängigkeiten (neue Pakete)

| Paket | Zweck |
|-------|-------|
| `@react-pdf/renderer` | Serverseitige PDF-Generierung im amtlichen BMF-Layout |

Alle anderen benötigten Bausteine (Resend, Supabase, shadcn/ui, Zod, react-hook-form) sind bereits installiert.

---

### I) Umsetzungsreihenfolge

1. **Datenbank** – Migrationen für `spender`, `spendenquittungen`, Supabase Storage Bucket, RLS-Policies
2. **Organisationseinstellungen** – Settings-API erweitern + neuer Tab in Einstellungsseite
3. **Spender-API** – CRUD-Endpunkte + Fuzzy-Match-Suche
4. **PDF-Template** – Amtliches BMF-Muster als `@react-pdf/renderer`-Komponente
5. **Quittungs-API** – Erstellen, Speichern, E-Mail-Versand
6. **UI-Dialog** – 3-Schritt-Erstellungsdialog + Einbindung in transaction-table
7. **Historien-Seite** – Neue Admin-Seite mit Tabelle und Filtern

## QA-Testergebnisse

**Getestet:** 2026-05-13
**Testart:** Statischer Code-Review (kein Browser-Test)
**Tester:** QA-Ingenieur (KI, Red-Team-Perspektive)
**Build-Status:** `npx tsc --noEmit` sauber, `npm run lint` sauber, `npm run build` sauber (laut Aussage)

### Status der Akzeptanzkriterien

#### Organisationseinstellungen

- [x] **Abschnitt „Organisation & Freistellungsbescheid"** vorhanden — `src/components/organisation-einstellungen-form.tsx:241`, neuer Tab in `src/app/dashboard/einstellungen/page.tsx`.
- [x] **Alle Pflichtfelder vorhanden** — `verein_name`, `adresse_zeile1`, `adresse_zeile2`, `plz`, `ort`, `steuernummer`, `finanzamt`, `freistellungsbescheid_datum` (Datumspicker), `freistellungsbescheid_aktenzeichen`, `satzungszweck` (Textarea), `unterzeichner_name`, `letzter_veranlagungszeitraum`. Plus optionale Vorstand-Felder für CC.
- [x] **Validierung Pflichtfelder vor Quittungserstellung** — Server prüft per `findFehlendeOrganisationsfelder()` in `src/app/api/admin/spendenquittungen/route.ts:194-204`; UI blockiert per `orgFehlt`-State im Dialog (`spendenquittung-erstellen-dialog.tsx:520-530`).
- [x] **Warnung wenn Bescheid > 4 Jahre** — `bescheidAelterAls(4)` in `organisation-einstellungen-form.tsx:214` zeigt Alert (amber), nicht blockierend.
- [x] **Nur Administratoren ändern Organisation** — `requireAdmin()` in `src/app/api/admin/settings/route.ts:92`. Tab nur für Admins sichtbar (`einstellungen/page.tsx:170`).

#### Spender-Datenbank

- [x] **Spender-Datensatz vollständig** — Tabelle `spender` (Migration 027) mit allen geforderten Spalten.
- [x] **Fuzzy-Match auf `counterpart`** — `/api/admin/spender/suggest` nutzt pg_trgm `similarity()` ≥ 0.4 via RPC `spender_fuzzy_suche` (Migration 028) + Fallback auf `ilike`.
- [x] **Neuer Spender + Verknüpfung mit Quittung** — `spender_neu`-Branch im Create-Endpoint (`spendenquittungen/route.ts:231-264`).
- [x] **Vorbefüllung bei wiederkehrendem Spender (IBAN)** — IBAN-Lookup hat Priorität 1 in `suggest/route.ts:48-64`.

#### Quittungs-Erstellung

- [x] **„Spendenquittung erstellen"-Eintrag im Kontextmenü** — `transaction-table.tsx` Diff: nur bei `canCreateSpendenquittung && isIncome` (`amount > 0`).
- [x] **Formular füllt automatisch vor** — `useEffect` in `spendenquittung-erstellen-dialog.tsx:150-178` übernimmt Betrag, Datum, Counterpart-Name, IBAN aus Transaction.
- [x] **Pflichtfelder hervorgehoben** — `<span className="text-destructive">*</span>` neben jedem Pflichtlabel, `aria-required="true"`.
- [x] **Betrag in Worten serverseitig** — `betragInWorten()` (`lib/betrag-in-worten.ts`) wird ausschließlich im PDF-Renderer `spendenquittung-pdf.tsx:251` aufgerufen, kein Client-Input.
- [x] **Quittungs-Nummer race-condition-sicher** — RPC `next_spendenquittung_nummer` mit `SECURITY DEFINER` + UNIQUE-Constraint auf `quittung_nummer` (Migration 027:74-116). ACHTUNG: Bei sehr hoher Parallelität könnten zwei Aufrufe gleichzeitig `MAX+1` ermitteln; der `UNIQUE`-Constraint fängt das im Insert ab, aber der API-Endpunkt hat keine Retry-Logik (siehe BUG-5).
- [x] **PDF-Vorschau vor Download/Versand** — Schritt 3 zeigt `<object data={pdfUrl}>` mit Same-Origin-Proxy `/api/admin/spendenquittungen/[id]/pdf` (`spendenquittung-erstellen-dialog.tsx:867-885`).
- [x] **PDF entspricht BMF-Muster** — Wortlaut Pflichthinweise nach § 10b Abs. 4 EStG / § 63 Abs. 5 AO korrekt (`spendenquittung-pdf.tsx:172-182`). „gez. + elektronisch ausgestellt"-Vermerk vorhanden. Eine Seite, A4.
- [x] **Pflichtfelder im PDF** — Alle Felder aus der Tabelle (Verein, Adresse, Steuer-Nr., Finanzamt, Bescheid-Datum, Aktenzeichen über Freistellungs-Hinweis, Spender, Betrag in Ziffern + Worten, Datum, Quittungs-Nr., Ausstellungsdatum, Haftungs- und 10-Jahres-Hinweis) sind enthalten.
- [x] **PDF in Storage gespeichert** — `pdfPfad = ${jahr}/${quittungNummer}.pdf`, Bucket `spendenquittungen` privat (`spendenquittungen/route.ts:326-342`).
- [x] **Quittung in DB vor E-Mail** — Insert vor `defaultEmailVorlage`; E-Mail-Endpoint ist separat (`/email`-Subroute), wird erst durch Frontend nach erfolgreichem Create getriggert.
- [x] **Resend mit PDF-Anhang** — `spendenquittung-email.ts:83-89` schickt Base64-Anhang. Betreff + Text editierbar.
- [x] **`email_versendet_am` und `email_empfaenger` protokolliert** — `email/route.ts:137-144`.
- [x] **Mehrere Quittungen pro Buchung** — FK `transaction_id` ohne UNIQUE, ON DELETE SET NULL. Es gibt jedoch **keinen Warnhinweis** beim Erstellen einer zweiten Quittung für dieselbe Buchung (siehe BUG-2).

#### Quittungs-Historie

- [x] **Separate Admin-Seite** — `/dashboard/spendenquittungen` mit Link in `app-header.tsx`.
- [x] **Tabellenansicht mit allen Spalten** — `spendenquittungen-tabelle.tsx:307-323`: Nr., Spender, Betrag, Spende-Datum, Ausgestellt, E-Mail-Status, Buchung, Aktionen.
- [x] **Filter Jahr / Spendername / Versandstatus** — `spendenquittungen/page.tsx:236-318`, URL-synchronisiert.
- [x] **PDF erneut herunterladen** — Per Same-Origin-Endpunkt `/api/admin/spendenquittungen/[id]/pdf?download=1`.
- [x] **„E-Mail erneut senden"-Funktion** — Eigener Dialog (`spendenquittungen-tabelle.tsx:649-783`).
- [⚠️] **Verlinkung Buchung im Dashboard** — Link nutzt `/dashboard?search=<quittung_nummer>`, aber Dashboard-Suche filtert auf `description` (`/api/transactions/route.ts:351-353`). Eine Quittungs-Nr. wie `SQ-2026-0001` taucht in keiner Description auf → Ergebnisliste ist immer leer. **Bug**, siehe BUG-1.
- [x] **Betrachter: nur Lesen** — RLS lässt SELECT für `auth.uid() IS NOT NULL`, alle Schreibrouten via `requireAdmin()`. Im UI: `canEdit={isAdmin}` blendet Bearbeiten/Löschen/E-Mail aus. Lesezugriff im PDF-Endpunkt korrekt umgesetzt.

### Status der Randfälle

- [x] **Organisationseinstellungen fehlen** — Server gibt 400 mit `fehlende_felder`-Liste; UI zeigt destruktiven Alert mit Link zu den Einstellungen. `useEffect` prüft schon beim Öffnen des Dialogs.
- [x] **Negativer Betrag (Ausgabe)** — Menüeintrag ist mit `isIncome` (amount > 0) geschützt. CHECK-Constraint `betrag > 0` in DB.
- [x] **PSD2-Transaktion (`nur_psd2`)** — Keine Status-Prüfung im UI; PSD2-Transaktionen mit positivem Betrag erlauben die Quittung. Spec-konform.
- [x] **Spendenbetrag > 300 €** — Keine besondere Einschränkung, alle Beträge bis 1.000.000 EUR erlaubt (`spendenquittungCreateSchema.betrag.max`).
- [x] **E-Mail-Versand schlägt fehl** — Quittung bereits in DB + Storage; 502-Fehler im API, „E-Mail erneut senden" funktioniert.
- [x] **Buchung gelöscht** — FK `ON DELETE SET NULL`, UI zeigt „[gelöscht]" (`spendenquittungen-tabelle.tsx:481-483`).
- [x] **Bescheid > 5 Jahre** — Warnung im Form ab 4 Jahre, Quittungserstellung wird nicht blockiert.
- [❌] **Mehrere Quittungen für dieselbe Buchung** — Spec fordert einen Warnhinweis „Für diese Buchung wurde bereits eine Quittung ausgestellt (SQ-JJJJ-NNNN)." — **kein Code, kein Hinweis**. Siehe BUG-2.
- [x] **Sonderzeichen/Umlaute im Spendernamen** — Helvetica im `@react-pdf/renderer` unterstützt Standard-Latin-1; Umlaute funktionieren. Kein Encoding-Hack (kein ae/oe/ue).
- [⚠️] **Sehr langer Vereins-/Spendername** — `@react-pdf/renderer` bricht Text automatisch um, aber bei extrem langen Strings (>200 Zeichen) könnte die Spender-Adresszeile horizontal überlaufen. Kein expliziter Wrap-Schutz im Style. Niedriges Risiko (DB-Limit 200 Zeichen).
- [x] **E-Mail-Adresse unbekannt** — Schritt 3 erlaubt Schließen ohne Versand; Hinweis: „Quittung wurde bereits gespeichert und kann später aus der Historie versendet werden."

### Sicherheitsaudit-Ergebnisse (Red-Team-Perspektive)

- [x] **Authentifizierung** — Alle Endpunkte prüfen Auth: `/api/admin/spender/*` via `requireAdmin()`. `/api/admin/spendenquittungen/POST|PATCH|DELETE|email` via `requireAdmin()`. `/api/admin/spendenquittungen/GET` und `/[id]/GET` und `/[id]/pdf` prüfen Auth manuell, da Viewer Lesezugriff haben dürfen.
- [x] **Autorisierung (Schreibzugriff)** — Viewer können keine Quittungen erstellen, ändern oder löschen. POST/PATCH/DELETE/email sind hinter `requireAdmin()`. Bestätigt durch manuelles Tracing aller Endpunkte.
- [x] **Zod-Validierung aller Inputs** — `spenderSchema`, `spenderUpdateSchema`, `spendenquittungCreateSchema`, `spendenquittungUpdateSchema`, `spendenquittungEmailSchema`, `spendenquittungListQuerySchema`, `organisationSettingsSchema`. Alle Endpunkte verwenden `.safeParse()` und brechen mit 400 bei ungültigem Input ab.
- [x] **Storage-URLs signiert** — `createSignedUrl(..., 5 * 60)` (5 Min TTL) in `[id]/route.ts:81-83`. Alternativ Same-Origin-Proxy mit Cache-Control `no-store`. Der Proxy umgeht zwar die signed-URL-Logik, ist aber auth-pflichtig — akzeptabel.
- [x] **Storage-Bucket privat** — `public: false` (Migration 027:200) plus RLS-Policies, die Reads nur für `is_admin()` erlauben.
- [x] **RLS auf Tabellen** — `spender` (alles admin-only), `spendenquittungen` (SELECT für eingeloggte, write admin-only). Korrekt.
- [⚠️] **IDOR-Möglichkeit (BUG-3)** — RLS auf `spendenquittungen` erlaubt SELECT für **jeden** eingeloggten Benutzer. Damit kann auch ein eingeschränkter Viewer mit der UUID einer Quittung sowohl Metadaten als auch das PDF abrufen (PROJ-14-Kategoriefilter greift hier nicht). Spec sagt „Betrachter können die Historie lesen" — explizit gewünscht. Aber: Betrachter, die nur eingeschränkten Kategorienzugriff haben, sehen trotzdem **alle** Spender-Namen, -Beträge und PDFs. Das ist eine **Datenschutz-/DSGVO-Frage**, da Spender DSGVO-sensibel sind. Niedrig-Mittel.
- [x] **XSS in E-Mail-Inhalten** — `escapeHtml()` in `spendenquittung-email.ts:32-39` escaped `&<>"'`. `\n` wird zu `<br>`. Korrekt.
- [⚠️] **PostgREST `.or()`-Injection (BUG-4)** — In `spender/route.ts:30-32` wird `suche` mit `replace(/[%_]/g, "\\$&")` sanitisiert, aber **Kommas, Klammern und Sonderzeichen** der PostgREST-Filter-Syntax werden NICHT escaped. Ein Suchstring `",email.is.null,(` könnte die Filter-Logik verändern. Niedrig (Admin-only, kein Auth-Bypass), aber Code-Hygiene.
- [x] **Rate-Limiting E-Mail-Versand** — 30 E-Mails / Stunde / Admin in `email/route.ts:14-16`. `isRateLimited` ist DB-basiert (`src/lib/rate-limit.ts`, korrekt für Vercel).
- [x] **Rate-Limiting auf `requireAdmin()`** — 20 Anfragen / Min / IP global, In-Memory in `admin-auth.ts`. Nicht ideal für Serverless, aber bestehende Lösung — kein Regression-Schaden.
- [x] **DSGVO – Recht auf Vergessenwerden** — `DELETE /api/admin/spender/[id]` löscht Spender, wenn keine Quittungen mehr existieren (409 sonst). UI weist auf das vor. Korrekt umgesetzt.
- [⚠️] **DSGVO – Spender-Daten in Snapshot** — Beim Löschen eines Spenders bleiben dessen Daten im `verein_snapshot` der Quittungen erhalten. Allerdings enthält `verein_snapshot` nur Vereinsdaten, nicht Spenderdaten. **Spendername bleibt aber in `spender.name` indirekt referenziert über `ON DELETE RESTRICT`** — Spender kann erst gelöscht werden, wenn alle Quittungen gelöscht sind. Pragmatisch korrekt; eine echte Pseudonymisierungs-Funktion fehlt aber.
- [x] **Keine Secrets im Code** — `RESEND_API_KEY`, `RESEND_FROM_EMAIL` aus Env.
- [x] **CC ≠ Empfänger** — `spendenquittung-email.ts:66-68` filtert CC-Adressen, die mit Empfänger übereinstimmen (case-insensitive). Korrekt, kein Spam-Loop.
- [x] **CSRF** — Alle mutierenden Endpunkte sind cookie-basiert auth + erwarten JSON-Body; durch SameSite-Cookies (Supabase-Defaults) und JSON-only-Akzeptanz ausreichend abgesichert.

### Regressions-Audit (geänderte bestehende Dateien)

- **`src/components/transaction-table.tsx`** — Nur additive Änderung: neuer optionaler Prop `onSpendenquittungErstellen` + `canCreateSpendenquittung`, neuer DropdownMenuItem hinter Feature-Flag. Keine Auswirkung auf bestehende Funktionalität.
- **`src/app/api/admin/settings/route.ts`** — Wird um Organisations-Branch erweitert. Bestehende KI- und Seafile-Branches unverändert. Risiko: Reihenfolge `isOrganisationRequest` ist letztes `if` — wenn ein Body sowohl `organisation` als auch `seafile_url` enthält, würde nur Seafile gespeichert. In der Praxis aber kommt nur ein Bereich pro Request, daher unkritisch.
- **`src/app/dashboard/einstellungen/page.tsx`** — Neuer Tab „Organisation" für Admins, valid-tabs-Liste erweitert. Keine Regression.
- **`src/app/dashboard/page.tsx`** — Neuer State + Dialog-Einbindung; Übergabe an `transaction-table`. Saubere Erweiterung.
- **`src/components/app-header.tsx`** — Neuer Nav-Link für alle eingeloggten Benutzer. Korrekt — auch Viewer dürfen die Seite sehen.
- **`src/lib/types.ts`** — Nur additive Interfaces. Keine Brechung.

### Gefundene Bugs

#### BUG-1: Verlinkung von Quittung zur Buchung im Dashboard funktioniert nicht
- **Schweregrad:** Mittel
- **Datei/Zeile:** `src/components/spendenquittungen-tabelle.tsx:467`
- **Beschreibung:** Der Link `<Link href="/dashboard?search=${quittung_nummer}">` führt zu Dashboard mit Suchparameter `search=SQ-2026-0001`. Das Dashboard filtert aber per `query.ilike("description", ...)` (`/api/transactions/route.ts:352`) — die Quittungs-Nummer steht **nicht** im Beschreibungstext einer Buchung, sondern nur in der `spendenquittungen`-Tabelle. Ergebnis: Klick öffnet eine leere Dashboard-Ansicht.
- **Reproduktionsschritte:**
  1. Quittung erstellen.
  2. In `/dashboard/spendenquittungen` auf den Buchungs-Link in der Spalte „Buchung" klicken.
  3. Erwartet: Die zugehörige Buchung wird hervorgehoben/gefiltert.
  4. Tatsächlich: Dashboard zeigt leere Tabelle.
- **Empfohlene Korrektur:** Entweder
  (a) eigenen Query-Parameter `?transaction=<id>` einführen, der die einzelne Buchung anzeigt, oder
  (b) Such-Backend so erweitern, dass es auch in verknüpften `spendenquittungen.quittung_nummer` matcht (RPC).
- **Priorität:** Im nächsten Sprint beheben (kein Datenschutz-Problem, aber sichtbarer UX-Fehler).

#### BUG-2: Kein Warnhinweis bei zweiter Quittung für dieselbe Buchung
- **Schweregrad:** Mittel
- **Datei/Zeile:** `src/app/api/admin/spendenquittungen/route.ts:165-401` (POST), `src/components/spendenquittung-erstellen-dialog.tsx`
- **Beschreibung:** Die Spezifikation fordert explizit: „Zweite Quittung für dieselbe Buchung löst Warnhinweis aus: ‚Für diese Buchung wurde bereits eine Quittung ausgestellt (SQ-JJJJ-NNNN).'" Es existiert weder ein serverseitiger Check noch ein UI-Hinweis. Der Kassenwart kann versehentlich Doppel-Quittungen ausstellen.
- **Reproduktionsschritte:**
  1. Für Buchung X eine Quittung erstellen (z. B. SQ-2026-0001).
  2. Für dieselbe Buchung X erneut „Spendenquittung erstellen" klicken.
  3. Erwartet: Warnung mit Verweis auf SQ-2026-0001 (nicht blockierend).
  4. Tatsächlich: Quittung wird kommentarlos ausgestellt.
- **Empfohlene Korrektur:** Im POST-Endpunkt vor dem Erstellen prüfen, ob `transaction_id` bereits eine Quittung hat, und im 201-Response oder im Dialog (vor Schritt 2) eine Info-Meldung zurückgeben. Alternativ vor Schritt 2 eine GET-Anfrage `/api/admin/spendenquittungen?transaction_id=…`.
- **Priorität:** Vor Deployment beheben — höheres Risiko von Doppel-Bestätigungen mit steuerlichen Folgen.

#### BUG-3: Viewer sehen alle Spender-Personendaten ohne Kategorie-Filter
- **Schweregrad:** Niedrig-Mittel (Datenschutz)
- **Datei/Zeile:** Migration `027_proj17_spendenquittung.sql:157-159`
- **Beschreibung:** RLS-Policy `Eingeloggte koennen Spendenquittungen lesen USING (auth.uid() IS NOT NULL)` erlaubt jedem eingeloggten Benutzer den Lesezugriff. PROJ-14 (Kategoriebasierter Zugriff) wird hier nicht angewandt. Damit sehen auch eingeschränkte Viewer alle Spender-Namen, Adressen (über JOIN auf `spender`), Beträge, IBANs und sogar das PDF. Spec sagt „Betrachter können die Historie lesen" — das ist gewünscht, aber DSGVO-mäßig sollte man prüfen, ob das gewollt ist, da Spender-Daten zu den sensibleren Vereinsdaten zählen.
- **Reproduktionsschritte:**
  1. Viewer-Account anlegen (kategoriebasierter Zugriff auf z. B. nur „Mitgliedsbeiträge").
  2. `/dashboard/spendenquittungen` aufrufen.
  3. Erwartet: ggf. nur Quittungen aus erlaubten Kategorien, oder anonymisierte Liste.
  4. Tatsächlich: vollständige Liste aller Spender mit Namen, Adressen, IBANs, Beträgen.
- **Empfohlene Korrektur:** Mit Auftraggeber klären, ob das gewünscht ist. Falls nicht: RLS-Policy auf `spender` und `spendenquittungen` so anpassen, dass Viewer nur Quittungen aus erlaubten Kategorien sehen.
- **Priorität:** Wäre schön (Klärungsbedarf mit Stakeholder; Spec ist nicht eindeutig).

#### BUG-4: PostgREST `.or()`-Filter nicht vollständig escaped
- **Schweregrad:** Niedrig
- **Datei/Zeile:** `src/app/api/admin/spender/route.ts:27-32`
- **Beschreibung:** `replace(/[%_]/g, "\\$&")` schützt nur vor SQL-LIKE-Wildcards. Die PostgREST-Filter-Syntax `.or("name.ilike.%X%,email.ilike.%X%")` interpretiert Kommas und Klammern als Separator. Ein Suchstring wie `"abc,role.eq.admin"` oder `")"`könnte den Filter umfunktionieren. Da `requireAdmin()` aktiv ist und nur Admins suchen, kein Auth-Bypass — aber Code-Hygiene und Robustheit.
- **Reproduktionsschritte:** Admin gibt im Spender-Suche-Feld eine Zeichenkette mit Komma ein. Anfrage bricht oder filtert falsch.
- **Empfohlene Korrektur:** Suchstring zusätzlich gegen `,()` filtern oder PostgREST-Quoting (Doublequotes um den Wert) verwenden.
- **Priorität:** Im nächsten Sprint beheben.

#### BUG-5: Quittungs-Nummer-RPC ohne Retry/Lock
- **Schweregrad:** Niedrig
- **Datei/Zeile:** Migration `027_proj17_spendenquittung.sql:84-116`, `src/app/api/admin/spendenquittungen/route.ts:266-277`
- **Beschreibung:** Die RPC `next_spendenquittung_nummer` ermittelt `MAX(...) + 1` per SELECT, ohne explizites Locking (`FOR UPDATE` oder Advisory Lock). Bei zwei gleichzeitigen Aufrufen können beide dasselbe Resultat erhalten. Der UNIQUE-Constraint auf `quittung_nummer` fängt das im INSERT ab, der API-Endpunkt hat aber **keine Retry-Logik** → eine der zwei Anfragen schlägt mit „PDF konnte nicht gespeichert werden / Quittung konnte nicht gespeichert werden" fehl, und das PDF des Verlierers ist bereits im Storage (kein Cleanup vor INSERT-Fehler — Cleanup gibt es nur danach).
- **Auswirkung:** Sehr selten (Einzelnutzer-Anwendung), aber im Fehlerfall verbleibt eine verwaiste PDF-Datei.
- **Empfohlene Korrektur:** In der RPC `pg_advisory_xact_lock(hashtext('spendenquittung_nummer_' || v_year))` voranstellen, oder im API-Endpunkt einen Retry bei UNIQUE-Violation (Code `23505`) einbauen.
- **Priorität:** Wäre schön (extrem unwahrscheinlich, Einzelnutzer-Setup).

#### BUG-6: Validation `spender_neu.iban` ohne Format-Prüfung
- **Schweregrad:** Niedrig
- **Datei/Zeile:** `src/lib/validations/spendenquittung.ts:44-47`, `src/lib/validations/spender.ts:38-42`
- **Beschreibung:** IBAN wird nur auf max. 34 Zeichen geprüft, nicht auf gültiges IBAN-Format (Länderprüfung, Prüfziffer). Ein Admin könnte „ABC123" als IBAN eingeben.
- **Empfohlene Korrektur:** Optional: Regex `/^[A-Z]{2}\d{2}[A-Z0-9]+$/` plus Mod-97-Prüfung. Da der Eintrag durch Admin manuell erfolgt, niedrige Priorität.
- **Priorität:** Wäre schön.

#### BUG-7: PDF-Pfad enthält `quittung_nummer` ohne Path-Encoding
- **Schweregrad:** Niedrig
- **Datei/Zeile:** `src/app/api/admin/spendenquittungen/route.ts:328`
- **Beschreibung:** `pdfPfad = ${jahr}/${quittungNummer}.pdf` wird aus DB-RPC-Output gebildet. Da die RPC den Pfad erzeugt und der CHECK-Constraint `^SQ-\d{4}-\d{4,}$` greift, ist das aktuell sicher. Code-Robustheit: Eine zusätzliche Validierung der Form `quittungNummer` im API-Endpunkt nach dem RPC-Call wäre defensiver.
- **Priorität:** Wäre schön (aktuell kein konkretes Sicherheitsproblem).

### Zusammenfassung

- **Akzeptanzkriterien:** 28/29 bestanden, 1 teilweise (Buchungs-Link BUG-1)
- **Randfälle:** 9/11 bestanden, 1 nicht behandelt (BUG-2 Doppel-Quittung), 1 teilweise (sehr lange Namen)
- **Gefundene Bugs:** 7 gesamt
  - 0 kritisch
  - 2 mittel (BUG-1, BUG-2)
  - 1 niedrig-mittel (BUG-3 DSGVO/Stakeholder-Klärung)
  - 4 niedrig (BUG-4, BUG-5, BUG-6, BUG-7)
- **Sicherheit:** Grundsätzlich solide. Auth/Authz korrekt, Zod-Validierung überall, Rate-Limit auf E-Mail, RLS aktiviert, keine Secrets im Code, XSS in E-Mails escaped, signierte URLs mit kurzem TTL.
- **Regression:** Keine negativen Auswirkungen auf bestehende Features. Alle Änderungen an `transaction-table.tsx`, `settings/route.ts`, `app-header.tsx` sind additive.
- **Produktionsreif:** **JA mit Vorbehalt** — BUG-2 (Doppel-Quittungs-Warnung) sollte vor Live-Gang gefixt werden, da steuerlich relevant. BUG-1 (Buchungs-Link) ist UX-Bug und kann im nächsten Sprint behoben werden. Alle anderen sind „nice to have".
- **Empfehlung:** **Vor Deployment: BUG-2 fixen.** Danach Go für Production. BUG-3 mit Auftraggeber klären — sind Spender-Daten für Viewer (auch eingeschränkte) bewusst freigegeben?

### Bug-Behebungen (Nachgeführt 2026-05-13)

Alle 7 Bugs aus dem ersten QA-Audit wurden behoben. Build (TypeScript + ESLint + `npm run build`) läuft sauber.

| Bug | Fix |
|-----|-----|
| **BUG-1** | Buchungs-Link in der Quittungs-Historie nutzt jetzt `/dashboard?transaction=<id>` statt der Volltext-Suche. Neuer Query-Parameter `transaction` in `transactionsQuerySchema` und im Dashboard-State; bei aktivem Filter erscheint ein Hinweis-Banner mit „Filter entfernen". |
| **BUG-2** | Beim Öffnen des Erstellungs-Dialogs prüft das Frontend per `GET /api/admin/spendenquittungen?transaction_id=<id>`, ob bereits Quittungen für die Buchung existieren. Falls ja, erscheint ein gelber Warnhinweis mit den vorhandenen Quittungs-Nummern. Listen-API hat dafür den neuen Filter `transaction_id` erhalten. |
| **BUG-3** | Migration 029: Neue RLS-Policy `Spendenquittungen-Lesezugriff respektiert PROJ-14` ersetzt die alte permissive Policy. Admins und uneingeschränkte Benutzer sehen weiterhin alles; eingeschränkte Betrachter sehen nur Quittungen, deren `transaction_id` mindestens einer ihrer erlaubten Kategorien zugeordnet ist. Quittungen ohne Buchungsbezug (`transaction_id IS NULL`) sind für eingeschränkte Betrachter unsichtbar. |
| **BUG-4** | PostgREST-`.or()`-Filter in `/api/admin/spender` filtert nun `(`, `)`, `,` und `*` aus dem Suchstring, zusätzlich zu den bestehenden LIKE-Wildcard-Escapes. |
| **BUG-5** | Migration 029: `next_spendenquittung_nummer()` setzt jetzt einen transaktionsweiten Advisory-Lock pro Jahr (`pg_advisory_xact_lock(hashtext('spendenquittung_nummer_' \|\| jahr))`). Parallele Aufrufe werden sequentiell verarbeitet, keine verwaisten PDF-Dateien mehr möglich. |
| **BUG-6** | Neuer IBAN-Validator `src/lib/validations/iban.ts` mit Format-Regex + Mod-97-Prüfung. Eingebunden in `spenderSchema.iban` und `spendenquittungCreateSchema.spender_neu.iban`. |
| **BUG-7** | Defensiv-Check nach RPC-Call: Falls die zurückgegebene Quittungs-Nummer nicht dem Pattern `^SQ-\d{4}-\d{4,}$` entspricht, wird mit HTTP 500 abgebrochen, bevor das PDF in Storage geschrieben wird. |

**Neuer Build-Status:** Lint sauber (0 Errors, 1 vorbestehende Warnung in `mfa-aktivierung-dialog.tsx`), TypeScript sauber, `npm run build` erfolgreich, neue Migration 029 erfolgreich in Supabase angewendet (Policy verifiziert).

**Produktionsreife nach Fixes: JA** — keine Mittel- oder Kritisch-Bugs mehr offen.

## Deployment
_Wird von /deploy hinzugefügt_
