# PROJ-6: Kassenbuch-Export (Excel)

## Status: Geplant
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
_Wird von /architecture hinzugefügt_

## QA-Testergebnisse
_Wird von /qa hinzugefügt_

## Deployment
_Wird von /deploy hinzugefügt_
