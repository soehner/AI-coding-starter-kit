# PROJ-4: Bankbewegungen-Übersicht (Dashboard)

## Status: In Review
**Erstellt:** 2026-04-10
**Zuletzt aktualisiert:** 2026-04-10

## Abhängigkeiten
- Benötigt: PROJ-1 (Authentifizierung)
- Benötigt: PROJ-3 (Kontoauszug-Import) – Daten müssen in der DB existieren

## User Stories
- Als Benutzer möchte ich alle Bankbewegungen in einer übersichtlichen Tabelle sehen, damit ich den Finanzüberblick habe.
- Als Benutzer möchte ich die Ansicht nach Jahr filtern, damit ich die Buchungen eines bestimmten Jahres sehe (wie das bisherige Kassenbuch-Excel).
- Als Benutzer möchte ich Einnahmen und Ausgaben farblich unterscheiden, damit ich auf einen Blick erkenne, ob es sich um ein Plus oder Minus handelt.
- Als Benutzer möchte ich den aktuellen Saldo oben sehen, damit ich immer den aktuellen Kontostand kenne.
- Als Benutzer möchte ich die Tabelle nach Datum, Betrag oder Buchungstext sortieren können.
- Als Benutzer möchte ich nach Buchungstext suchen können, damit ich schnell bestimmte Transaktionen finde.
- Als Benutzer möchte ich Summen für Einnahmen und Ausgaben des gewählten Zeitraums sehen.

## Akzeptanzkriterien
- [ ] Tabelle zeigt: Datum, Buchungstext, Einnahme (grün), Ausgabe (rot), Saldo
- [ ] Jahr-Filter (Dropdown) zeigt nur Jahre, für die Daten vorhanden sind
- [ ] Monat-Filter (optional) zur weiteren Einschränkung
- [ ] Suchfeld filtert nach Buchungstext (live/debounced)
- [ ] Aktueller Kontostand als Kennzahl oben auf der Seite
- [ ] Summe Einnahmen und Summe Ausgaben im gewählten Zeitraum als Kennzahlen
- [ ] Tabelle ist paginiert (50 Einträge pro Seite) oder per Endlos-Scroll
- [ ] Spalten nach Datum (Standard: neueste zuerst), Betrag, Text sortierbar
- [ ] Leerer Zustand: Hinweistext wenn keine Buchungen vorhanden
- [ ] Layout orientiert sich am bestehenden Kassenbuch (Spalten: Datum, Buchungstext, Einnahme, Ausgabe, Saldo, Bemerkung, Beleg-Ref, Kontoauszug-Ref)
- [ ] Responsive: auf Mobilgeräten scrollbare Tabelle oder kompaktere Ansicht

## Kassenbuch-Spalten (aus Excel abgeleitet)
Die Übersicht soll dieselbe Struktur haben wie das Excel-Kassenbuch:

| Datum | Buchungstext | Einnahmen (brutto) | Ausgaben (brutto) | Saldo | Bemerkung | Belege | Kontoauszug |
|-------|-------------|-------------------|------------------|-------|-----------|--------|-------------|

## Randfälle
- Was passiert, wenn keine Daten für ein ausgewähltes Jahr vorhanden sind? → "Keine Buchungen gefunden" Hinweis
- Was passiert bei sehr vielen Buchungen (>1000)? → Pagination greift
- Was passiert bei gleichem Datum für mehrere Buchungen? → Sekundärsortierung nach ID
- Was passiert bei der Suche mit Sonderzeichen? → Sanitierung, kein SQL-Injection-Risiko

## Technische Anforderungen
- Server-seitige Paginierung über Supabase `.range()`
- Debounced Search (300ms) um API-Anfragen zu reduzieren
- URL-Parameter für Filter/Sortierung (Deeplink-fähig, z. B. `?year=2025&sort=date`)
- Aggregationen (Summen) als separate Supabase-Queries oder Views

---
<!-- Abschnitte unten werden von nachfolgenden Skills hinzugefügt -->

## Technisches Design (Solution Architect)

### Ausgangslage
Kein neues Datenbankschema erforderlich. Alle Daten liegen bereits in `transactions` und `bank_statements` (aus PROJ-3).

### Komponentenstruktur

```
Dashboard-Seite (/dashboard)
+-- KPI-Leiste (3 Kennzahlen nebeneinander)
|   +-- Karte: Aktueller Kontostand
|   +-- Karte: Summe Einnahmen (gewählter Zeitraum)
|   +-- Karte: Summe Ausgaben (gewählter Zeitraum)
|
+-- Filter-Leiste
|   +-- Jahr-Dropdown (nur Jahre mit Daten)
|   +-- Monat-Dropdown (optional, "Alle Monate")
|   +-- Suchfeld (Buchungstext, 300ms debounced)
|
+-- Buchungs-Tabelle
|   +-- Tabellenkopf (klickbar zum Sortieren)
|   |   Datum | Buchungstext | Einnahme | Ausgabe | Saldo | Bemerkung | Beleg | Kontoauszug
|   +-- Tabellenzeilen (Einnahmen grün, Ausgaben rot)
|   +-- Leerer Zustand ("Keine Buchungen gefunden")
|   +-- Lade-Zustand (Skeleton-Zeilen)
|
+-- Pagination-Leiste (50 Einträge pro Seite)
```

### Neue Dateien

| Datei | Typ | Zweck |
|-------|-----|-------|
| `src/app/dashboard/page.tsx` | Änderung | Hauptseite wird zur Kassenbuch-Übersicht |
| `src/components/kpi-cards.tsx` | Neu | Die 3 Kennzahl-Karten oben |
| `src/components/transaction-filter-bar.tsx` | Neu | Jahr/Monat/Suche-Steuerung |
| `src/components/transaction-table.tsx` | Neu | Die sortierbare, paginierte Tabelle |
| `src/app/api/transactions/route.ts` | Neu | Buchungsliste mit Filter/Sort/Pagination |
| `src/app/api/transactions/summary/route.ts` | Neu | Aggregierte Summen (Einnahmen, Ausgaben, Saldo) |

### Datenfluss

```
URL-Parameter (?year=2025&sort=date&page=1)
    ↓
/api/transactions/summary  →  KPI-Karten (Saldo, Summen, verfügbare Jahre)
/api/transactions           →  Tabelle (gefiltert, sortiert, paginiert, 50/Seite)
```

### Technische Entscheidungen

| Entscheidung | Begründung |
|---|---|
| URL-Parameter für Filter | Deeplink-fähig – Links bleiben beim Teilen funktionsfähig |
| Server-seitige Paginierung | Skaliert bei >1000 Buchungen ohne Performanceprobleme |
| Separate API für Aggregationen | Summen/Saldo unabhängig von Tabellenansicht ladbar |
| Debounced Suche (300ms) | Reduziert API-Anfragen während der Eingabe |
| Natives `useSearchParams` (Next.js) | Kein zusätzliches Paket nötig |
| Alle shadcn/ui-Komponenten vorhanden | Table, Card, Select, Input, Badge, Skeleton, Pagination – bereits installiert |

## QA-Testergebnisse (Re-Test)

**Ersttest:** 2026-04-10
**Re-Test:** 2026-04-10
**App-URL:** http://localhost:3000
**Tester:** QA-Ingenieur (KI)
**Build-Status:** Erfolgreich (npm run build ohne Fehler)

### Re-Test-Anlass
BUG-4, BUG-5 und BUG-6 aus dem Ersttest wurden behoben. Dieser Re-Test verifiziert die Fixes und prueft auf Regressionen.

### Status der Akzeptanzkriterien

#### AK-1: Tabelle zeigt Datum, Buchungstext, Einnahme (gruen), Ausgabe (rot), Saldo
- [x] Spalten korrekt implementiert: Datum, Buchungstext, Einnahme, Ausgabe, Saldo, Bemerkung, Auszug
- [x] Einnahmen werden gruen (text-green-600) dargestellt
- [x] Ausgaben werden rot (text-red-600) dargestellt
- [x] Saldo wird pro Zeile angezeigt (balance_after)

#### AK-2: Jahr-Filter (Dropdown) zeigt nur Jahre mit vorhandenen Daten
- [x] Dropdown implementiert mit dynamischen Jahren aus /api/transactions/summary
- [x] "Alle Jahre" als Standard-Option vorhanden
- [x] Seitenzahl wird beim Filterwechsel auf 1 zurueckgesetzt
- [x] Jahre werden per RPC-Funktion get_available_years() effizient geladen (BUG-5 Fix verifiziert)

#### AK-3: Monat-Filter zur weiteren Einschraenkung
- [x] Monat-Dropdown mit allen 12 Monaten + "Alle Monate" implementiert
- [ ] BUG-1 (offen): Monat-Filter funktioniert in der Tabellen-Query nur MIT ausgewaehltem Jahr. In route.ts Zeile 101: `if (month && year)` - Monat wird ignoriert wenn "Alle Jahre" gewaehlt ist. Die RPC-Funktion get_transaction_sums() filtert hingegen korrekt nach Monat auch ohne Jahr - es gibt also eine Inkonsistenz zwischen KPI-Karten und Tabelle.

#### AK-4: Suchfeld filtert nach Buchungstext (live/debounced)
- [x] Suchfeld mit 300ms Debounce implementiert (use-debounce.ts Hook)
- [x] Suche mit Icon (Lupe) und Placeholder "Buchungstext suchen..."
- [x] Seitenzahl wird bei Suche auf 1 zurueckgesetzt

#### AK-5: Aktueller Kontostand als Kennzahl oben
- [x] KPI-Karte "Aktueller Kontostand" mit Wallet-Icon implementiert
- [x] Waehrungsformatierung korrekt (de-DE, EUR)
- [x] Negativer Kontostand wird rot (text-destructive) dargestellt
- [x] Kontostand zeigt immer den globalen aktuellen Stand (nicht filterbezogen) - konzeptionell korrekt

#### AK-6: Summe Einnahmen und Ausgaben im gewaehlten Zeitraum als Kennzahlen
- [x] KPI-Karte "Einnahmen (Zeitraum)" mit TrendingUp-Icon (gruen) implementiert
- [x] KPI-Karte "Ausgaben (Zeitraum)" mit TrendingDown-Icon (rot) implementiert
- [x] Summen werden per SQL-Aggregation berechnet (RPC get_transaction_sums, BUG-6 Fix verifiziert)
- [x] Summen aendern sich korrekt je nach Filter (Jahr/Monat/Suche)

#### AK-7: Tabelle ist paginiert (50 Eintraege pro Seite)
- [x] PAGE_SIZE = 50 implementiert
- [x] Server-seitige Paginierung mit .range()
- [x] Pagination-Leiste mit Seitenzahlen und Vor/Zurueck
- [x] "Seite X von Y" Anzeige vorhanden

#### AK-8: Spalten sortierbar (Datum, Betrag, Text)
- [x] Datum sortierbar (Standard: neueste zuerst)
- [x] Buchungstext sortierbar
- [x] Betrag sortierbar (Einnahme-Spalte sortiert nach amount)
- [x] Sort-Icons zeigen Richtung an (ArrowUp/ArrowDown/ArrowUpDown)
- [x] Sekundaersortierung bei gleichem Datum (created_at)

#### AK-9: Leerer Zustand mit Hinweistext
- [x] "Keine Buchungen gefunden. Passen Sie die Filter an oder importieren Sie Kontoauszuege." implementiert

#### AK-10: Layout orientiert sich am Kassenbuch (8 Spalten)
- [x] Spalten: Datum, Buchungstext, Einnahme, Ausgabe, Saldo, Bemerkung, Auszug (7 von 8)
- [ ] BUG-2 (offen): "Beleg"-Spalte fehlt. Erst mit PROJ-9 (Seafile-Integration) relevant - akzeptabel.

#### AK-11: Responsive - auf Mobilgeraeten scrollbare Tabelle
- [x] overflow-x-auto auf Tabellen-Container implementiert
- [x] Bemerkung-Spalte wird unter lg versteckt (hidden lg:table-cell)
- [x] Auszug-Spalte wird unter xl versteckt (hidden xl:table-cell)
- [x] Filter-Leiste stapelt sich auf Mobil (flex-col auf sm)
- [x] Skeleton-Ladezustand mit 8 Zeilen implementiert
- [x] KPI-Karten: 1 Spalte mobil, 2 Spalten Tablet, 3 Spalten Desktop (sm:grid-cols-2 lg:grid-cols-3)

### Status der Randfaelle

#### RF-1: Keine Daten fuer ausgewaehltes Jahr
- [x] Leerer-Zustand-Hinweis wird korrekt angezeigt

#### RF-2: Viele Buchungen (>1000)
- [x] Server-seitige Paginierung greift korrekt (50 pro Seite)
- [x] generatePageNumbers() zeigt Ellipsen bei vielen Seiten (mehr als 7 Seiten)

#### RF-3: Gleiches Datum fuer mehrere Buchungen
- [x] Sekundaersortierung nach created_at implementiert (route.ts Zeile 119)

#### RF-4: Sonderzeichen in der Suche
- [x] Supabase ilike verwendet parametrisierte Queries - kein SQL-Injection-Risiko
- [x] Suche in RPC-Funktion ebenfalls parametrisiert (Zeile 34 in 004_dashboard_aggregations.sql)
- [ ] BUG-3 (offen): Wildcard-Zeichen % und _ werden weder in route.ts noch in der RPC-Funktion escaped

### Sicherheitsaudit-Ergebnisse

- [x] Authentifizierung: Beide API-Endpunkte pruefen auth.getUser() - unauthentifizierter Zugriff gibt 401 zurueck
- [x] Autorisierung: RLS-Policies auf transactions und bank_statements - Admins und Viewer duerfen lesen
- [x] Zod-Validierung: Alle Query-Parameter werden mit Zod-Schema validiert (BUG-4 Fix verifiziert)
  - year: Regex /^\d{4}$/ (vierstellige Zahl)
  - month: Regex /^([1-9]|1[0-2])$/ (1-12)
  - search: max 200 Zeichen
  - page: Regex /^\d+$/ (positive Zahl)
  - sort: Enum ["booking_date", "amount", "description"]
  - dir: Enum ["asc", "desc"]
- [x] SQL-Injection (Sort-Feld/Richtung): Durch Zod-Enum validiert
- [x] SQL-Injection (Year/Month): Supabase parametrisierte Queries + Zod-Regex
- [x] SQL-Injection (Search): Supabase ilike verwendet parametrisierte Queries
- [x] RPC-Funktionen: SECURITY INVOKER - RLS-Policies greifen auch bei RPC-Aufrufen
- [x] Effiziente Aggregation: get_available_years() und get_transaction_sums() per SQL (BUG-5, BUG-6 Fixes verifiziert)
- [x] Rate Limiting: Nicht implementiert, aber allgemeines App-Problem (nicht PROJ-4-spezifisch)
- [x] Keine Secrets in Browser/Netzwerk exponiert
- [x] RLS auf allen Tabellen aktiviert (transactions, bank_statements, app_settings)
- [x] Fehlermeldungen geben keine internen Details preis (catch-Block loggt nur serverseitig)

### Behobene Bugs (verifiziert)

#### BUG-4: Keine Zod-Validierung auf API-Eingaben - BEHOBEN
- Zod-Schema `transactionsQuerySchema` in route.ts (Zeile 7-34) implementiert
- Zod-Schema `summaryQuerySchema` in summary/route.ts (Zeile 5-18) implementiert
- Ungueltige Parameter geben 400 Bad Request mit verstaendlicher Fehlermeldung zurueck

#### BUG-5: Summary-API laedt alle Buchungsdaten fuer Jahr-Extraktion - BEHOBEN
- RPC-Funktion `get_available_years()` in Migration 004 implementiert
- Verwendet SELECT DISTINCT EXTRACT(YEAR FROM booking_date)
- summary/route.ts Zeile 54-56: supabase.rpc("get_available_years")

#### BUG-6: Summary-API summiert Betraege clientseitig statt per SQL - BEHOBEN
- RPC-Funktion `get_transaction_sums()` in Migration 004 implementiert
- Verwendet SQL SUM() mit CASE-Ausdruecken
- summary/route.ts Zeile 87-92: supabase.rpc("get_transaction_sums", {...})

### Verbleibende Bugs

#### BUG-1: Monat-Filter ohne Jahr-Filter wirkungslos (Tabellen-Query)
- **Schweregrad:** Mittel
- **Status:** Offen (teilweise behoben - RPC-Funktion filtert korrekt, aber Tabellen-Query nicht)
- **Reproduktionsschritte:**
  1. Gehe zu /dashboard
  2. Lasse "Alle Jahre" im Jahr-Dropdown
  3. Waehle einen Monat (z.B. "Juni")
  4. Erwartet: Nur Buchungen aus Juni (aller Jahre) in Tabelle UND KPI-Karten
  5. Tatsaechlich: KPI-Karten zeigen korrekt gefilterte Summen, aber Tabelle zeigt ALLE Buchungen
- **Ursache:** In route.ts Zeile 101: `if (month && year)` - Monat wird nur angewendet wenn auch Jahr gesetzt ist. Die RPC-Funktion get_transaction_sums() hat diesen Fehler nicht (p_month wird unabhaengig von p_year gefiltert).
- **Prioritaet:** Vor Deployment beheben (Inkonsistenz zwischen KPI und Tabelle verwirrt Benutzer)

#### BUG-2: Beleg-Spalte fehlt in der Tabelle
- **Schweregrad:** Niedrig
- **Status:** Offen (beabsichtigt, erst mit PROJ-9 relevant)
- **Prioritaet:** Waere schoen (erst mit PROJ-9 relevant)

#### BUG-3: Wildcard-Zeichen in Suche nicht escaped
- **Schweregrad:** Niedrig
- **Status:** Offen
- **Reproduktionsschritte:**
  1. Gib "%" oder "_" in das Suchfeld ein
  2. Erwartet: Nur Buchungen mit dem Literal-Zeichen werden gefunden
  3. Tatsaechlich: % liefert alle Ergebnisse, _ matcht beliebige Einzelzeichen
- **Betroffene Stellen:** route.ts Zeile 109 und RPC-Funktion get_transaction_sums() Zeile 34 in Migration 004
- **Prioritaet:** Waere schoen

#### BUG-7: URL-Parameter-Synchronisation - redundanter Code
- **Schweregrad:** Niedrig
- **Status:** Offen (kein funktionaler Bug, nur Code-Qualitaet)
- **Ursache:** In page.tsx updateUrl() (Zeile 53-59): Standardwerte werden doppelt geprueft - im aeusseren if-Block und nochmals in den inneren if-Blocks. Redundanter aber harmloser Code.
- **Prioritaet:** Waere schoen (Code-Qualitaet)

#### BUG-8 (NEU): Accessibility - Pagination-Links verwenden href="#"
- **Schweregrad:** Niedrig
- **Reproduktionsschritte:**
  1. Oeffne die Dashboard-Seite mit Buchungen
  2. Klicke auf einen Pagination-Link
  3. Beobachte: Die URL springt kurz zu "#" bevor preventDefault greift
- **Ursache:** PaginationPrevious/PaginationNext/PaginationLink verwenden `href="#"` mit `onClick={(e) => e.preventDefault()}`. Bei langsamem JavaScript kann das Fragment "#" in die URL gelangen.
- **Prioritaet:** Waere schoen

### Regressionstests

- [x] PROJ-1 (Authentifizierung): Login/Logout funktioniert, Dashboard nur mit Auth erreichbar
- [x] PROJ-2 (Benutzerverwaltung): Admin-Bereich /dashboard/admin/users weiterhin erreichbar
- [x] PROJ-3 (Kontoauszug-Import): Import-Seite /dashboard/admin/import weiterhin erreichbar
- [x] Build: `npm run build` erfolgreich ohne Fehler oder Warnungen
- [x] Keine visuellen Regressionen bei gemeinsam genutzten Komponenten (app-header.tsx)

### Zusammenfassung
- **Akzeptanzkriterien:** 9/11 bestanden (AK-3 teilweise, AK-10 teilweise)
- **Behobene Bugs:** 3 (BUG-4, BUG-5, BUG-6 - alle verifiziert)
- **Verbleibende Bugs:** 5 gesamt (0 kritisch, 0 hoch, 1 mittel, 4 niedrig)
  - 1x Mittel: BUG-1 (Monat-Filter Inkonsistenz zwischen KPI und Tabelle)
  - 4x Niedrig: BUG-2, BUG-3, BUG-7, BUG-8
- **Sicherheit:** Bestanden - Zod-Validierung, RLS, parametrisierte Queries, SECURITY INVOKER RPC
- **Produktionsreif:** BEDINGT JA
- **Empfehlung:** BUG-1 (Mittel) sollte vor Deployment behoben werden - einfacher Fix: `if (month && year)` zu `if (month)` aendern und Monat-Filter unabhaengig vom Jahr anwenden. Alle Niedrig-Bugs sind akzeptabel fuer MVP.

## Deployment

**Deployt:** 2026-04-10
**Produktions-URL:** https://cbs-finanz.vercel.app
**Git-Tag:** v1.4.0-PROJ-4
**Plattform:** Vercel (Washington, D.C. – iad1)

**Deployment-Checkliste:**
- [x] `npm run lint` bestanden
- [x] `npm run build` erfolgreich
- [x] Migration 003 (Import-Tabellen) auf Supabase angewendet
- [x] Migration 004 (Aggregations-RPCs) auf Supabase angewendet
- [x] Code committed und zu GitHub gepusht
- [x] Vercel Production-Build erfolgreich
- [x] Produktions-URL erreichbar: https://cbs-finanz.vercel.app
- [x] Git-Tag v1.4.0-PROJ-4 erstellt und gepusht
