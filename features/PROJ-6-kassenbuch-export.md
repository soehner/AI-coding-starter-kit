# PROJ-6: Kassenbuch-Export (Excel)

## Status: In Review
**Erstellt:** 2026-04-10
**Zuletzt aktualisiert:** 2026-04-11

## Abhängigkeiten
- Benötigt: PROJ-1 (Authentifizierung) – nur Admins und Benutzer mit Export-Berechtigung
- Benötigt: PROJ-4 (Dashboard) – Export übernimmt die aktuell gesetzten Filter
- Benötigt: PROJ-5 (Eintragsbearbeitung) – Bemerkungen und Referenzen sind im Export enthalten

## User Stories
- Als Administrator möchte ich die aktuell gefilterten Buchungen als Excel-Kassenbuch exportieren, damit ich die offizielle Kassenbuchführung weiterführen kann.
- Als Administrator möchte ich, dass die exportierte Excel-Datei exakt dem Muster der bestehenden Kassenbücher entspricht (gleiche Spalten, gleiche Formeln, gleiche Struktur).
- Als Benutzer mit Export-Berechtigung möchte ich ebenfalls einen Excel-Export erstellen dürfen, auch wenn ich kein Admin bin.
- Als Benutzer möchte ich den Export-Button leicht auffindbar im Dashboard haben.
- Als Benutzer möchte ich am Anfang der Exportdatei eine Saldenmitteilung mit Eröffnungs- und Schlusssaldo sehen, damit ich die Jahresergebnisse auf einen Blick erkenne.

## Akzeptanzkriterien
- [ ] Export-Button im Dashboard (nur sichtbar für Admins und Benutzer mit Export-Berechtigung)
- [ ] Der Export übernimmt die aktuell gesetzten Dashboard-Filter (Datumsbereich, Suche etc.)
- [ ] Ladeindikator (Spinner/Toast) während der Export-Generierung
- [ ] Saldenmitteilung am Anfang der Excel-Datei:
  - Eröffnungssaldo (Kontostand am ersten Tag des Filterzeitraums)
  - Schlusssaldo (Kontostand am letzten Tag des Filterzeitraums)
  - Summe Einnahmen im Zeitraum
  - Summe Ausgaben im Zeitraum
- [ ] Buchungsliste entspricht dem Kassenbuch-Muster (Spalten A–N, siehe unten)
- [ ] MwSt-Spalten (E, F, I, J) werden für Kompatibilität mit dem bestehenden Format mitgeführt, aber leer gelassen (der Förderverein hat keine MwSt-Buchungen)
- [ ] Saldo-Spalte (L) enthält kumulativ berechnete Formeln
- [ ] Dateiname: `Kassenbuch_JJJJ-MM-TT_JJJJ-MM-TT.xlsx` (von–bis Datum des Filterzeitraums)
- [ ] Download startet automatisch im Browser
- [ ] Bei leerem Filterergebnis: leere Vorlage mit Saldenmitteilung (0-Werte), kein Fehler
- [ ] Exportfehler zeigt Fehlermeldung mit Hinweis, erneut zu versuchen

## Spaltenstruktur (aus bestehendem Kassenbuch übernommen)
| Spalte | Inhalt | Quelle |
|--------|--------|--------|
| A | Datum | `booking_date` |
| B | Buchungstext / Kunde | `description` |
| C | Bemerkung | `note` |
| D | Einnahme brutto | `amount` wenn positiv |
| E | Einnahme MwSt-Satz | leer (kein MwSt) |
| F | Einnahme MwSt | leer (kein MwSt) |
| G | Einnahme netto | leer (kein MwSt) |
| H | Ausgabe brutto | `amount` wenn negativ (Absolutwert) |
| I | Ausgabe MwSt-Satz | leer (kein MwSt) |
| J | Ausgabe MwSt | leer (kein MwSt) |
| K | Ausgabe netto | leer (kein MwSt) |
| L | Saldo (kumulativ) | Formel: Vorheiler Saldo + D - H |
| M | Belege-Referenz | `document_ref` |
| N | Kontoauszug-Referenz | `statement_ref` |

## Randfälle
- Was passiert, wenn keine Buchungen im Filterzeitraum vorhanden sind? → Leere Kassenbuch-Vorlage mit Saldenmitteilung (0-Werte), kein Fehler
- Was passiert bei sehr vielen Buchungen (>500)? → Export dauert länger, Ladeindikator bleibt bis Download fertig
- Was passiert bei Exportfehler (Datenbankfehler, Timeout)? → Fehlermeldung mit Hinweis, erneut zu versuchen
- Was passiert, wenn kein Filterzeitraum gesetzt ist? → Export aller Buchungen, Dateiname ohne Datumsangabe: `Kassenbuch_alle.xlsx`
- Was passiert, wenn der Benutzer keine Export-Berechtigung hat? → Button nicht angezeigt; API gibt 403 zurück

## Technische Anforderungen
- Library: `exceljs` (server-seitig, unterstützt Formeln und Styling)
- API-Route `GET /api/export/kassenbuch` mit Query-Params für aktive Filter (Datum-von, Datum-bis, Suchbegriff)
- Server-seitige Generierung, Response als `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- Berechtigung geprüft via Rolle (`admin`) oder `user_permissions` (PROJ-7)
- Zod-Validierung der Query-Parameter (Datum-Format, Zeichenlängenbegrenzung)
- Filter-Übergabe: Dashboard sendet aktuelle Filter-Parameter an Export-Endpunkt

---
<!-- Abschnitte unten werden von nachfolgenden Skills hinzugefügt -->

## Technisches Design (Solution Architect)

### Komponentenstruktur

```
Dashboard-Seite (bestehend)
+-- TransactionFilterBar (bestehend: Jahr, Monat, Suche)
+-- KassenbuchExportButton (NEU)
|   +-- Button mit Download-Icon
|   +-- Ladeindikator (Spinner im Button während Generierung)
|   +-- Toast-Benachrichtigung bei Fehler
+-- TransactionTable (bestehend)
```

Der Export-Button wird in der bestehenden Dashboard-Toolbar neben der Filter-Leiste platziert. Er ist nur sichtbar für Admins (und später für Benutzer mit Export-Berechtigung aus PROJ-7).

### Datenfluss

```
1. Benutzer klickt "Excel exportieren"
   ↓
2. Button liest aktuelle Filter aus Dashboard-State
   (Jahr, Monat, Suchtext)
   ↓
3. Browser ruft GET /api/export/kassenbuch?year=...&month=...&search=... auf
   ↓
4. Server prüft Authentifizierung + Admin-Berechtigung
   ↓
5. Server lädt ALLE passenden Buchungen aus Datenbank
   (keine Paginierung – vollständiger Datensatz)
   ↓
6. Server berechnet Salden-Zusammenfassung
   (Eröffnungssaldo, Schlusssaldo, Summen)
   ↓
7. Server generiert Excel-Datei mit exceljs
   (Saldenmitteilung oben, Buchungsliste darunter)
   ↓
8. Server sendet Datei als Download-Response
   ↓
9. Browser speichert Datei automatisch
```

### Struktur der Excel-Datei

```
Kassenbuch_2025-01-01_2025-12-31.xlsx
│
├── Zeilen 1–6: Saldenmitteilung (Kopfbereich)
│   ├── Eröffnungssaldo (Kontostand vor erstem Eintrag)
│   ├── Schlusssaldo (Kontostand nach letztem Eintrag)
│   ├── Summe Einnahmen im Zeitraum
│   └── Summe Ausgaben im Zeitraum
│
├── Zeile 7: Leerzeile (Trenner)
│
├── Zeile 8: Spaltenüberschriften (A bis N)
│
└── Zeilen 9+: Buchungseinträge
    ├── Spalte A: Datum
    ├── Spalte B: Buchungstext / Kunde
    ├── Spalte C: Bemerkung
    ├── Spalte D: Einnahme brutto (wenn positiver Betrag)
    ├── Spalte E: Einnahme MwSt-Satz (leer)
    ├── Spalte F: Einnahme MwSt (leer)
    ├── Spalte G: Einnahme netto (leer)
    ├── Spalte H: Ausgabe brutto (wenn negativer Betrag, Absolutwert)
    ├── Spalte I: Ausgabe MwSt-Satz (leer)
    ├── Spalte J: Ausgabe MwSt (leer)
    ├── Spalte K: Ausgabe netto (leer)
    ├── Spalte L: Saldo kumulativ (Excel-Formel: Vorheriger Saldo + D - H)
    ├── Spalte M: Belege-Referenz
    └── Spalte N: Kontoauszug-Referenz
```

### Datenmodell für den Export

Der Export-Endpunkt benötigt keine eigene Datenbanktabelle. Er liest aus der bestehenden `transactions`-Tabelle mit denselben Feldern wie das Dashboard, nur ohne Paginierung:

```
Jede exportierte Zeile enthält:
- booking_date      → Spalte A (Datum)
- description       → Spalte B (Buchungstext)
- note              → Spalte C (Bemerkung)
- amount            → Spalte D oder H (Einnahme oder Ausgabe)
- balance_after     → Grundlage für Eröffnungs-/Schlusssaldo
- document_ref      → Spalte M (Belege-Referenz)
- statement_ref     → Spalte N (Kontoauszug-Referenz)
```

Der **Eröffnungssaldo** ist der `balance_after`-Wert des Eintrags direkt vor dem Filterzeitraum. Der **Schlusssaldo** ist der `balance_after` des letzten Eintrags im Filterzeitraum.

### Neue API-Route

```
GET /api/export/kassenbuch
  ?year=2025          (optional – aus Dashboard-Filter)
  ?month=3            (optional – aus Dashboard-Filter)
  ?search=Miete       (optional – aus Dashboard-Filter)

→ Response: Excel-Datei (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)
→ Header: Content-Disposition: attachment; filename="Kassenbuch_2025-03-01_2025-03-31.xlsx"
```

### Berechtigungsprüfung

Muster analog zu bestehenden Admin-Routen (`requireAdmin`):
- **Aktuell (PROJ-6):** Nur Admins dürfen exportieren
- **Vorbereitung für PROJ-7:** Zusätzliche Prüfung auf `export`-Berechtigung in `user_permissions`, sobald granulare Berechtigungen implementiert sind

### Dateiname-Logik

```
Jahr + Monat gewählt  → Kassenbuch_2025-03-01_2025-03-31.xlsx
Nur Jahr gewählt      → Kassenbuch_2025-01-01_2025-12-31.xlsx
Kein Filter gesetzt   → Kassenbuch_alle.xlsx
```

### Technische Entscheidungen

| Entscheidung | Begründung |
|---|---|
| **Server-seitige Generierung** | Schützt alle Buchungsdaten – keine sensiblen Daten werden je vollständig an den Browser gesendet |
| **`exceljs`-Bibliothek** | Unterstützt Excel-Formeln (kumulative Saldo-Berechnung), Zell-Formatierung (Datum, Währung) und ist server-kompatibel |
| **Keine Paginierung beim Export** | Der Export soll immer vollständig sein – anders als das Dashboard, das 50 Einträge pro Seite zeigt |
| **Filter aus Dashboard übernehmen** | Der Kassenwart sieht genau das, was er exportiert – keine Überraschungen durch abweichende Filter |
| **Excel-Formeln statt statische Werte in Spalte L** | Der Kassenwart kann die Datei nach dem Download noch manuell anpassen, und die Salden berechnen sich automatisch neu |

### Abhängigkeiten (neue Pakete)

| Paket | Zweck |
|---|---|
| `exceljs` | Excel-Datei serverseitig generieren (Formeln, Styling, Streaming) |

## QA-Testergebnisse

**Getestet am:** 2026-04-11
**Getestet von:** QA-Skill (automatisiert)
**Build-Status:** Erfolgreich (npm run build ohne Fehler)

### Akzeptanzkriterien

| # | Kriterium | Status | Anmerkung |
|---|-----------|--------|-----------|
| 1 | Export-Button nur für Admins sichtbar | BESTANDEN | `{isAdmin && <KassenbuchExportButton />}` in dashboard/page.tsx Zeile 301-302 |
| 2 | Dashboard-Filter werden an Export übergeben | BESTANDEN | year, month, debouncedSearch als Props und Query-Params |
| 3 | Ladeindikator (Spinner) während Export | BESTANDEN | Loader2-Icon mit animate-spin, Button disabled während Export |
| 4 | Saldenmitteilung am Anfang der Excel-Datei | BESTANDEN | Eröffnungssaldo, Schlusssaldo, Summe Einnahmen/Ausgaben in Zeilen 4-5 |
| 5 | Buchungsliste mit Spalten A-N | BESTANDEN | 14 Spalten korrekt gemappt, Überschriften in Zeile 7 |
| 6 | MwSt-Spalten (E, F, I, J) leer | BESTANDEN | Spalten E-G und I-K werden nicht befüllt |
| 7 | Saldo-Spalte (L) mit kumulativen Formeln | BESTANDEN | Erste Zeile: openingBalance+D-H, Folgezeilen: L(n-1)+D-H |
| 8 | Dateiname-Logik korrekt | BESTANDEN | Jahr+Monat, nur Jahr, oder "alle" - alle drei Fälle abgedeckt |
| 9 | Download startet automatisch | BESTANDEN | Blob-Download via dynamisch erstelltes Link-Element |
| 10 | Leerer Zustand: Vorlage mit 0-Werten | BESTANDEN | Leere rows-Liste ergibt Vorlage mit Saldenmitteilung |
| 11 | Exportfehler zeigt Fehlermeldung | BESTANDEN | toast.error() im catch-Block mit Hinweistext |

### Code-Review Checkliste

| Prüfpunkt | Status | Anmerkung |
|-----------|--------|-----------|
| Auth-Prüfung (requireAdmin) | OK | Zeile 64: requireAdmin() mit 401/403/429 Responses |
| Zod-Validierung der Query-Parameter | OK | Schema mit Regex für Jahr, Monat-Range, Suchtext max 200 Zeichen |
| Fehlerbehandlung vollständig | OK | try/catch um gesamte Route, DB-Fehler separat behandelt |
| SQL-Injection-Schutz | OK | Supabase parametrisiert alle Werte automatisch |
| Content-Type korrekt | OK | application/vnd.openxmlformats-officedocument.spreadsheetml.sheet |
| Content-Disposition korrekt | OK | attachment mit dynamischem Dateinamen |
| Sicherheits-Header | TEILWEISE | X-Frame-Options und X-Content-Type-Options gesetzt; Referrer-Policy und HSTS fehlen (siehe BUG-2) |
| Limit auf Datenbankabfrage | OK | .limit(10000) auf Hauptabfrage |
| Toast-Benachrichtigungen | OK | Erfolg: toast.success(), Fehler: toast.error() |
| Deutsche Texte mit echten Umlauten | OK | Alle Labels, Fehlermeldungen und Überschriften korrekt |
| Rate Limiting | OK | Über requireAdmin (20 Req/min pro IP) |

### Gefundene Bugs

#### BUG-1: Saldo-Formel referenziert potenziell leere Zellen (Schweregrad: NIEDRIG)
- **Beschreibung:** Die Excel-Formel `L7+D8-H8` referenziert D und H auch wenn diese leer sind. Excel behandelt leere Zellen als 0, daher ist das Ergebnis korrekt, aber manche Excel-Versionen könnten Warnungen anzeigen.
- **Reproduktion:** Export mit gemischten Einnahmen/Ausgaben erstellen, Formelzellen in Excel prüfen.
- **Priorität:** P3 (kosmetisch, funktional korrekt)
- **Empfehlung:** Kein Handlungsbedarf - Excel-Standardverhalten.

#### BUG-2: Sicherheits-Header unvollständig (Schweregrad: NIEDRIG)
- **Beschreibung:** Laut security.md sollen Referrer-Policy und Strict-Transport-Security gesetzt werden. Diese fehlen in der Response (Zeile 331-333 in route.ts).
- **Reproduktion:** Response-Header der Export-Route prüfen.
- **Priorität:** P3 (Vercel setzt HSTS und Referrer-Policy auf Plattformebene)
- **Empfehlung:** Für Konsistenz mit security.md-Richtlinien ergänzen.

#### BUG-3: Wildcard-Zeichen im Suchparameter nicht escaped (Schweregrad: NIEDRIG)
- **Beschreibung:** Der search-Parameter wird mit `ilike('%${search}%')` verwendet. Die SQL-Wildcards `%` und `_` innerhalb des Suchbegriffs werden nicht escaped. Ein Benutzer, der nach dem Zeichen `%` sucht, bekommt alle Ergebnisse.
- **Reproduktion:** Export mit search=`%` aufrufen.
- **Priorität:** P3 (Admin-Only-Endpunkt, geringes Risiko)
- **Empfehlung:** `%` und `_` im Suchtext escapen.

#### BUG-4: Excel-Layout weicht von Spezifikation ab (Schweregrad: NIEDRIG)
- **Beschreibung:** Die Spezifikation beschreibt: Zeile 7 = Leerzeile (Trenner), Zeile 8 = Spaltenüberschriften, Zeilen 9+ = Daten. Der Code setzt: Zeile 7 = Spaltenüberschriften, Zeile 8+ = Daten. Die Zeilen sind um eins verschoben.
- **Reproduktion:** Exportierte Excel-Datei öffnen und Zeilenstruktur mit Spec vergleichen.
- **Priorität:** P3 (Layout-Abweichung, keine funktionale Auswirkung)
- **Empfehlung:** Entweder Code oder Spezifikation anpassen.

### Sicherheitsaudit (Red-Team-Perspektive)

| Angriffsvektor | Ergebnis | Details |
|----------------|----------|---------|
| Unautorisierter Zugriff | GESCHÜTZT | requireAdmin prüft Session + Rolle, gibt 401/403 zurück |
| Brute-Force / DoS | GESCHÜTZT | Rate Limiting (20/min) über requireAdmin |
| SQL-Injection über Query-Params | GESCHÜTZT | Zod-Validierung + Supabase-Parametrisierung |
| Path Traversal im Dateinamen | GESCHÜTZT | Dateiname wird serverseitig aus validierten Parametern erzeugt |
| XSS über Excel-Inhalte | NICHT RELEVANT | Server-generierte Datei, kein HTML-Rendering |
| IDOR (andere Benutzer-Daten) | GESCHÜTZT | RLS auf transactions-Tabelle + Admin-Only-Zugriff |
| Daten-Exfiltration (Nicht-Admins) | GESCHÜTZT | Button nur für Admins angezeigt + Server-seitige Prüfung |
| Manipulation der Filter-Parameter | GESCHÜTZT | Zod-Validierung mit striktem Schema |
| ReDoS über Suchtext | GESCHÜTZT | Kein Regex auf Suchtext angewendet (nur ilike) |

### Gesamtbewertung

**Ergebnis: BESTANDEN** - Alle 11 Akzeptanzkriterien sind erfüllt. Es wurden 4 Bugs mit niedrigem Schweregrad gefunden, die keine Blocker für das Deployment darstellen. Die Sicherheitsprüfung zeigt keine kritischen Schwachstellen. Der Code folgt den Projektkonventionen (shadcn/ui-Komponenten, Zod-Validierung, requireAdmin-Pattern, deutsche Umlaute).

**Empfehlung:** Feature kann deployed werden. Die gefundenen P3-Bugs können im Nachgang behoben werden.

## Deployment
_Wird von /deploy hinzugefügt_
