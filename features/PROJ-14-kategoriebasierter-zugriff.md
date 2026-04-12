# PROJ-14: Kategoriebasierter Zugriff für Betrachter

## Status: Planned
**Erstellt:** 2026-04-12
**Zuletzt aktualisiert:** 2026-04-12

## Abhängigkeiten
- Benötigt: PROJ-12 (Buchungskategorisierung) – Kategorien müssen existieren
- Benötigt: PROJ-7 (Granulare Feature-Berechtigungen) – erweitert das bestehende Berechtigungssystem
- Erweitert: PROJ-2 (Benutzerverwaltung) – Kategorie-Einschränkungen werden dort konfiguriert

## Beschreibung
Administratoren können in der Benutzerverwaltung für jeden einzelnen Betrachter festlegen, welche Buchungskategorien er sehen darf. Ein eingeschränkter Betrachter sieht im Dashboard, beim Export und in allen Auswertungen ausschließlich Buchungen, die mindestens einer seiner erlaubten Kategorien zugeordnet sind. Unkategorisierte Buchungen sind für eingeschränkte Betrachter standardmäßig nicht sichtbar.

## User Stories
- Als Administrator möchte ich in der Benutzerverwaltung für einen Betrachter auswählen, welche Kategorien er sehen darf, damit z.B. ein Prüfer nur Reisekosten einsehen kann.
- Als Administrator möchte ich einem Betrachter Zugriff auf „alle Kategorien" geben (Standard), damit bestehende Betrachter ohne Einschränkung weiterarbeiten.
- Als Betrachter mit Kategorie-Einschränkung möchte ich im Dashboard nur die für mich freigegebenen Buchungen sehen, damit mein Blick auf die relevanten Daten fokussiert bleibt.
- Als Betrachter möchte ich klar sehen, dass meine Ansicht gefiltert ist, damit ich nicht fälschlicherweise denke, es gäbe keine anderen Buchungen.
- Als Administrator möchte ich jederzeit die Kategorie-Einschränkung eines Betrachters ändern oder aufheben.

## Akzeptanzkriterien
- [ ] In der Benutzerverwaltung gibt es pro Betrachter einen Bereich „Kategorie-Zugriff" (unterhalb der Feature-Berechtigungen aus PROJ-7)
- [ ] Standardmäßig ist „Alle Kategorien" ausgewählt (kein Filter)
- [ ] Admin kann per Multi-Select-Dropdown eine oder mehrere Kategorien als erlaubt markieren
- [ ] Änderungen werden gespeichert (Speichern-Button oder Sofortspeichern – konsistent mit PROJ-7)
- [ ] Server-seitig wird bei `GET /api/transactions` und `GET /api/transactions/summary` die Kategorie-Einschränkung des aktuell eingeloggten Benutzers berücksichtigt
- [ ] Unkategorisierte Buchungen sind für eingeschränkte Betrachter nicht sichtbar (kein gesondertes Opt-in)
- [ ] Im Dashboard erscheint für eingeschränkte Betrachter ein Hinweisbanner: „Ihre Ansicht ist auf bestimmte Kategorien beschränkt."
- [ ] Der Export (PROJ-6) exportiert für eingeschränkte Betrachter nur die sichtbaren Buchungen
- [ ] KPI-Cards (Kontostand, Summen) spiegeln nur die sichtbaren Buchungen wider – kein Zugriff auf Gesamtzahlen
- [ ] Admins unterliegen nie einer Kategorie-Einschränkung

## Randfälle
- Was passiert, wenn eine erlaubte Kategorie gelöscht wird? → Kategorie wird aus der Erlaubt-Liste des Betrachters entfernt; bei 0 verbleibenden Kategorien → Betrachter sieht Hinweis „Keine Buchungen verfügbar" (nicht Fehler)
- Was passiert, wenn ein Betrachter mit Einschränkung `edit_transactions`-Berechtigung (PROJ-7) hat? → Er kann nur die sichtbaren Buchungen bearbeiten
- Was passiert bei einem Betrachter ohne Einschränkung (Standardfall)? → Kein Performance-Overhead; API verhält sich wie bisher
- Was passiert, wenn der Betrachter versucht, eine Buchung direkt per ID aufzurufen (`GET /api/transactions/[id]`), die nicht in seinen Kategorien liegt? → 404 (nicht 403, um keine Informationen preiszugeben)
- Was passiert bei neuen Buchungen, die unkategorisiert importiert werden? → Eingeschränkte Betrachter sehen diese nicht, bis sie kategorisiert werden

## Technische Anforderungen
- Tabelle `user_category_access`: `user_id` (FK zu user_profiles), `category_id` (FK zu categories) – viele-zu-viele
- Wenn für einen Benutzer kein Eintrag existiert → Zugriff auf alle Kategorien (kein Filter)
- API `GET /api/transactions` erhält einen serverseitigen Filter: JOINs auf `transaction_categories` und prüft erlaubte `category_id`s des Benutzers
- Hilfsfunktion `getCategoryFilter(userId)` – gibt `null` (kein Filter) oder `Set<categoryId>` zurück
- API-Route `GET/PUT /api/admin/users/[id]/category-access` – nur Admins
- RLS: `user_category_access` nur für Admins schreibbar; Benutzer können eigene Zeilen lesen
- Erweiterung von `user_permissions` nicht nötig – eigene Tabelle für klare Trennung

---
<!-- Abschnitte unten werden von nachfolgenden Skills hinzugefügt -->

## Technisches Design (Solution Architect)
_Wird von /architecture hinzugefügt_

## QA-Testergebnisse
_Wird von /qa hinzugefügt_

## Deployment
_Wird von /deploy hinzugefügt_
