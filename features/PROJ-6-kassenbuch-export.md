# PROJ-6: Kassenbuch-Export (Excel)

## Status: Geplant
**Erstellt:** 2026-04-10
**Zuletzt aktualisiert:** 2026-04-10

## Abhängigkeiten
- Benötigt: PROJ-1 (Authentifizierung) – nur Admins und Benutzer mit Export-Berechtigung
- Benötigt: PROJ-4 (Dashboard) – Daten müssen vorhanden sein
- Benötigt: PROJ-5 (Eintragsbearbeitung) – Bemerkungen sind im Export enthalten

## User Stories
- Als Administrator möchte ich ein Kassenbuch für ein bestimmtes Jahr als Excel-Datei exportieren, damit ich die offizielle Kassenbuchführung wie bisher weiterführen kann.
- Als Administrator möchte ich, dass die exportierte Excel-Datei exakt dem Muster der bestehenden Kassenbücher entspricht (gleiche Spalten, gleiche Formeln, gleiche Struktur).
- Als Administrator möchte ich vor dem Export ein Jahr auswählen können (z. B. 2025 oder 2026).
- Als Benutzer mit Export-Berechtigung möchte ich ebenfalls einen Excel-Export erstellen dürfen, auch wenn ich kein Admin bin.
- Als Benutzer möchte ich den Export-Button leicht auffindbar im Dashboard haben.

## Akzeptanzkriterien
- [ ] Export-Button im Dashboard (nur sichtbar für Admins und Benutzer mit Export-Berechtigung)
- [ ] Jahr-Auswahl vor dem Export (Dropdown mit verfügbaren Jahren)
- [ ] Exportierte Excel-Datei entspricht dem Kassenbuch-Muster:
  - Einnahmen-Sektion: Datum, Kunde/Buchungstext, Bemerkung, brutto, MwSt-Satz, MwSt, netto
  - Ausgaben-Sektion: brutto, MwSt-Satz, MwSt, netto
  - Saldo-Sektion: Saldo, Belege-Ref, Kontoauszug-Ref
- [ ] Formeln sind in der Exportdatei enthalten (Saldo-Kumulierung, MwSt-Berechnung)
- [ ] Dateiname: `Kassenbuch_JJJJ.xlsx`
- [ ] Saldenmitteilung (Kontostand-Übersicht) wird als separate Zeilen am Anfang eingefügt
- [ ] Export läuft server-seitig, Download startet automatisch im Browser
- [ ] Ladeindikator während des Exports (kann bei vielen Buchungen etwas dauern)

## Spaltenstruktur (aus bestehendem Kassenbuch übernommen)
| Spalte | Inhalt |
|--------|--------|
| A | Datum |
| B | Buchungstext / Kunde |
| C | Bemerkung |
| D | Einnahme brutto |
| E | Einnahme MwSt-Satz |
| F | Einnahme MwSt |
| G | Einnahme netto |
| H | Ausgabe brutto |
| I | Ausgabe MwSt-Satz |
| J | Ausgabe MwSt |
| K | Ausgabe netto |
| L | Saldo (kumulativ) |
| M | Belege-Referenz |
| N | Kontoauszug-Referenz |

## Randfälle
- Was passiert, wenn keine Buchungen im gewählten Jahr vorhanden sind? → Leere Kassenbuch-Vorlage mit Hinweis
- Was passiert bei einem sehr großen Jahr (>500 Buchungen)? → Export dauert länger, Ladeindikator zeigen
- Was passiert, wenn MwSt-Satz nicht bekannt ist? → Felder leer lassen (0%)
- Was passiert bei Exportfehler? → Fehlermeldung mit Hinweis, erneut zu versuchen

## Technische Anforderungen
- Library: `exceljs` (server-seitig) oder `xlsx` (SheetJS)
- API-Route `GET /api/export/kassenbuch?year=JJJJ` (streaming download)
- Server Action oder API Route, kein client-seitiges Datei-Erstellen
- Berechtigung geprüft via Rolle oder `user_permissions.export_excel`
- Zod-Validierung: Jahr muss 4-stellige Zahl ≥ 2020 sein

---
<!-- Abschnitte unten werden von nachfolgenden Skills hinzugefügt -->

## Technisches Design (Solution Architect)
_Wird von /architecture hinzugefügt_

## QA-Testergebnisse
_Wird von /qa hinzugefügt_

## Deployment
_Wird von /deploy hinzugefügt_
