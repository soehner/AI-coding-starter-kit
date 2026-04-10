# PROJ-2: Benutzereinladung & Rollenverwaltung

## Status: Geplant
**Erstellt:** 2026-04-10
**Zuletzt aktualisiert:** 2026-04-10

## Abhängigkeiten
- Benötigt: PROJ-1 (Authentifizierung) – Login und Rollen müssen existieren

## User Stories
- Als Administrator möchte ich einen neuen Benutzer per E-Mail einladen, damit er Zugriff auf die Anwendung erhält.
- Als eingeladener Benutzer möchte ich eine Einladungs-E-Mail mit einem Link erhalten, über den ich mein Passwort setze und meinen Account aktiviere.
- Als Administrator möchte ich beim Einladen die Rolle (Admin oder Betrachter) festlegen, damit der neue Benutzer direkt die richtigen Rechte hat.
- Als Administrator möchte ich eine Liste aller Benutzer sehen, damit ich den Überblick über Zugriffe behalte.
- Als Administrator möchte ich die Rolle eines bestehenden Benutzers ändern können, damit ich Rechte anpassen kann.
- Als Administrator möchte ich einen Benutzer löschen/deaktivieren können, damit ausgeschiedene Mitglieder keinen Zugriff mehr haben.

## Akzeptanzkriterien
- [ ] Adminbereich "Benutzerverwaltung" ist nur für Admins sichtbar
- [ ] Formular zum Einladen: E-Mail-Adresse und Rolle (Admin / Betrachter)
- [ ] Einladungs-E-Mail wird über Supabase Auth (invite-Funktion) versendet
- [ ] Eingeladener Benutzer erhält Link zum Passwort-Setzen mit E-Mail-Verifizierung
- [ ] Nach Registrierung wird der Benutzer in `user_profiles` mit der festgelegten Rolle gespeichert
- [ ] Liste zeigt: Name/E-Mail, Rolle, Registrierungsdatum, Status (aktiv/eingeladen)
- [ ] Rollenänderung sofort wirksam (ohne erneutes Login)
- [ ] Löschen eines Benutzers entfernt ihn aus Supabase Auth und `user_profiles`
- [ ] Admins können sich nicht selbst löschen oder die eigene Rolle auf "Betrachter" ändern

## Randfälle
- Was passiert, wenn eine bereits vorhandene E-Mail eingeladen wird? → Fehlermeldung
- Was passiert, wenn der Einladungslink abläuft? → Benutzer kann neuen Link anfordern (Admin muss erneut einladen)
- Was passiert, wenn der letzte Admin gelöscht werden soll? → Blockiert mit Fehlermeldung
- Was passiert, wenn ein Betrachter versucht die Benutzerverwaltung aufzurufen? → 403 / Redirect

## Technische Anforderungen
- Supabase Auth `admin.inviteUserByEmail()` (Service-Role-Key erforderlich)
- API-Route `/api/admin/invite` (nur für Admins, Service-Role-Key serverseitig)
- API-Route `/api/admin/users/[id]` für Rollen-Update und Löschen
- RLS auf `user_profiles`: Nur Admins dürfen alle Profile sehen und bearbeiten
- Zod-Validierung für E-Mail-Format und Rollen-Enum

---
<!-- Abschnitte unten werden von nachfolgenden Skills hinzugefügt -->

## Technisches Design (Solution Architect)
_Wird von /architecture hinzugefügt_

## QA-Testergebnisse
_Wird von /qa hinzugefügt_

## Deployment
_Wird von /deploy hinzugefügt_
