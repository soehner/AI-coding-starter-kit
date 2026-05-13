# PROJ-17: Spendenquittung (Zuwendungsbestätigung)

## Status: Geplant
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
_Wird von /qa hinzugefügt_

## Deployment
_Wird von /deploy hinzugefügt_
