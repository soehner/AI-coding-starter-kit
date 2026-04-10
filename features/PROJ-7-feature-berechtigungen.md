# PROJ-7: Granulare Feature-Berechtigungen für Benutzer

## Status: Geplant
**Erstellt:** 2026-04-10
**Zuletzt aktualisiert:** 2026-04-10

## Abhängigkeiten
- Benötigt: PROJ-1 (Authentifizierung) – Rollen müssen existieren
- Benötigt: PROJ-2 (Benutzerverwaltung) – Berechtigungen werden pro Benutzer in der Benutzerverwaltung gesetzt
- Erweitert: PROJ-5 (Eintragsbearbeitung) und PROJ-6 (Kassenbuch-Export) nutzen diese Berechtigungen

## Beschreibung
Neben den Basis-Rollen (Admin / Betrachter) können Admins für einzelne Benutzer granulare Feature-Berechtigungen aktivieren. Damit ist z. B. möglich, dass ein Betrachter dennoch Einträge bearbeiten oder Excel-Exporte erstellen darf – ohne zum vollen Admin gemacht werden zu müssen.

## User Stories
- Als Administrator möchte ich einem Betrachter erlauben, Buchungen zu bearbeiten, damit er Bemerkungen hinzufügen kann, ohne Admin-Rechte zu erhalten.
- Als Administrator möchte ich einem Betrachter das Recht geben, Excel-Exporte zu erstellen, damit er eigenständig Kassenbücher erstellen kann.
- Als Administrator möchte ich im Benutzerprofil eines Benutzers sehen, welche Feature-Berechtigungen er hat, damit ich den Überblick behalte.
- Als Administrator möchte ich Feature-Berechtigungen per Toggle (An/Aus) aktivieren und deaktivieren.
- Als Benutzer möchte ich nur Features sehen und nutzen können, für die ich berechtigt bin, damit die Oberfläche nicht verwirrend ist (nicht berechtigte Features sind ausgeblendet oder deaktiviert).

## Verfügbare Feature-Berechtigungen

| Berechtigung | Beschreibung | Standard Betrachter | Standard Admin |
|---|---|---|---|
| `edit_transactions` | Buchungen bearbeiten und Bemerkungen hinzufügen | Nein | Ja (implizit) |
| `export_excel` | Kassenbuch als Excel exportieren | Nein | Ja (implizit) |
| `import_statements` | Kontoauszüge hochladen und importieren | Nein | Ja (implizit) |

> Admins haben alle Berechtigungen immer – die granularen Einstellungen gelten nur für Benutzer mit der Basis-Rolle "Betrachter".

## Akzeptanzkriterien
- [ ] In der Benutzerverwaltung (PROJ-2) gibt es pro Betrachter-Benutzer einen Bereich "Feature-Berechtigungen"
- [ ] Jede Berechtigung ist per Toggle (shadcn Switch) aktivierbar
- [ ] Änderungen werden sofort gespeichert (kein separater Speichern-Button nötig)
- [ ] Feature-Berechtigungen sind in Tabelle `user_permissions` gespeichert
- [ ] Server-seitige Prüfung bei jeder berechtigungs-relevanten API-Route
- [ ] Client-seitig: Nicht berechtigte Buttons/Felder sind deaktiviert oder ausgeblendet
- [ ] Admins sehen keine Berechtigung-Toggles für sich selbst (wäre redundant)

## Randfälle
- Was passiert, wenn ein Betrachter `import_statements` hat, aber die Rolle auf Admin geändert wird? → Berechtigungen bleiben gespeichert, sind aber redundant (Admin hat alles)
- Was passiert, wenn ein Admin auf Betrachter downgestuft wird? → Explizit gesetzte Berechtigungen bleiben erhalten
- Was passiert, wenn eine neue Feature-Berechtigung hinzukommt? → Standard ist immer "Nein" für Betrachter

## Technische Anforderungen
- Tabelle `user_permissions`: `user_id` (FK), `edit_transactions` (bool), `export_excel` (bool), `import_statements` (bool), `updated_at`
- 1:1-Beziehung zu `user_profiles`
- API-Route `PATCH /api/admin/users/[id]/permissions` (nur Admins)
- Helper-Funktion `hasPermission(userId, permission)` serverseitig
- RLS: Nur Admins dürfen `user_permissions` schreiben; Benutzer können eigene Zeile lesen

---
<!-- Abschnitte unten werden von nachfolgenden Skills hinzugefügt -->

## Technisches Design (Solution Architect)
_Wird von /architecture hinzugefügt_

## QA-Testergebnisse
_Wird von /qa hinzugefügt_

## Deployment
_Wird von /deploy hinzugefügt_
