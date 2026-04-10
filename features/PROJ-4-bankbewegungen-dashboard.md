# PROJ-4: Bankbewegungen-Übersicht (Dashboard)

## Status: Geplant
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
_Wird von /architecture hinzugefügt_

## QA-Testergebnisse
_Wird von /qa hinzugefügt_

## Deployment
_Wird von /deploy hinzugefügt_
