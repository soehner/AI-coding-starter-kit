# PROJ-5: Eintragsbearbeitung & Bemerkungen

## Status: Geplant
**Erstellt:** 2026-04-10
**Zuletzt aktualisiert:** 2026-04-10

## Abhängigkeiten
- Benötigt: PROJ-1 (Authentifizierung) – Schreibzugriff nur für Admins (und Benutzer mit Edit-Berechtigung)
- Benötigt: PROJ-4 (Dashboard) – Bearbeitung erfolgt direkt in der Übersichtstabelle

## User Stories
- Als Administrator möchte ich eine Bemerkung zu einer Buchung hinzufügen, indem ich einfach in das Bemerkungsfeld klicke, damit ich Kontext zur Buchung hinterlegen kann.
- Als Administrator möchte ich den Buchungstext einer Buchung korrigieren können (z. B. Tippfehler aus dem PDF-Parsing), indem ich direkt in das Feld klicke.
- Als Administrator möchte ich einen Verweis auf einen Beleg oder Kontoauszug hinzufügen, damit die Dokumentation vollständig ist.
- Als Benutzer mit Edit-Berechtigung möchte ich ebenfalls Bemerkungen hinzufügen oder bearbeiten können.
- Als Betrachter (ohne Edit-Berechtigung) möchte ich Felder nur lesen können und bei Klick einen Hinweis erhalten, dass ich keine Bearbeitungsrechte habe.
- Als Benutzer möchte ich nach dem Bearbeiten eines Felds die Änderung sofort gespeichert sehen (ohne Seite neu laden), damit der Workflow flüssig ist.

## Akzeptanzkriterien
- [ ] Klick auf ein bearbeitbares Feld wandelt es in ein Eingabefeld um (Inline-Edit)
- [ ] Bearbeitbare Felder: Buchungstext, Bemerkung, Beleg-Referenz, Kontoauszug-Referenz
- [ ] Nicht bearbeitbare Felder (schreibgeschützt): Datum, Betrag, Saldo (kommen direkt aus der Bank)
- [ ] Speichern durch Enter-Taste oder Klick außerhalb des Felds (onBlur)
- [ ] Abbrechen durch Escape-Taste (Änderung verwerfen)
- [ ] Erfolgreiches Speichern zeigt kurze Toast-Meldung "Gespeichert"
- [ ] Fehler beim Speichern zeigt Fehlermeldung, Feld bleibt editierbar
- [ ] Bemerkungsfeld unterstützt mehrzeiligen Text (Textarea)
- [ ] Betrachter ohne Edit-Recht: Felder sind optisch erkennbar als schreibgeschützt (kein Hover-Effekt)
- [ ] Alle Änderungen werden mit `updated_at` Timestamp und `updated_by` User-ID protokolliert
- [ ] Admins können immer alles bearbeiten; einfache Benutzer nur, wenn die Feature-Berechtigung "Bearbeiten" gesetzt ist (vgl. PROJ-2)

## Randfälle
- Was passiert, wenn zwei Benutzer gleichzeitig dasselbe Feld bearbeiten? → Last-Write-Wins (kein Echtzeit-Locking nötig)
- Was passiert bei leerem Speichern (Feld geleert)? → Leerer String wird gespeichert, kein Pflichtfeld außer Buchungstext
- Was passiert, wenn der Buchungstext auf leer gesetzt wird? → Validierungsfehler "Buchungstext darf nicht leer sein"
- Was passiert bei sehr langen Bemerkungen (>1000 Zeichen)? → Maximale Länge 1000 Zeichen mit Zeichenzähler
- Was passiert bei Netzwerkfehler beim Speichern? → Optimistic UI zurückrollen, Fehlermeldung

## Technische Anforderungen
- Optimistic Update: UI aktualisiert sofort, Rollback bei Fehler
- API-Route `PATCH /api/transactions/[id]` mit Zod-Validierung
- Felder: `description`, `note`, `document_ref`, `statement_ref`
- Audit-Felder: `updated_at`, `updated_by` auf Tabelle `transactions`
- RLS: Schreibzugriff abhängig von Rolle oder Feature-Berechtigung (aus `user_permissions`)

---
<!-- Abschnitte unten werden von nachfolgenden Skills hinzugefügt -->

## Technisches Design (Solution Architect)
_Wird von /architecture hinzugefügt_

## QA-Testergebnisse
_Wird von /qa hinzugefügt_

## Deployment
_Wird von /deploy hinzugefügt_
