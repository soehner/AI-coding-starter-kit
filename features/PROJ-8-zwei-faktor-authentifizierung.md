# PROJ-8: Zwei-Faktor-Authentifizierung (2FA)

## Status: Geplant
**Erstellt:** 2026-04-10
**Zuletzt aktualisiert:** 2026-04-10

## Abhängigkeiten
- Benötigt: PROJ-1 (Authentifizierung) – Login-Flow muss bereits funktionieren

## Beschreibung
Jeder Benutzer kann optional eine Zwei-Faktor-Authentifizierung (2FA) für seinen Account aktivieren. Als zweiter Faktor wird TOTP (Time-based One-Time Password) verwendet, kompatibel mit Apps wie Google Authenticator, Authy oder anderen TOTP-Apps. Supabase unterstützt TOTP-basierte MFA nativ.

## User Stories
- Als Benutzer möchte ich 2FA in meinen Kontoeinstellungen aktivieren können, damit mein Account besser geschützt ist.
- Als Benutzer möchte ich beim Aktivieren einen QR-Code scannen, den ich mit meiner Authenticator-App einscannen kann.
- Als Benutzer möchte ich 2FA auch wieder deaktivieren können, wenn ich die App wechsle oder 2FA nicht mehr nutzen möchte.
- Als Benutzer mit aktivierter 2FA möchte ich nach dem Passwort-Login einen zweiten Schritt haben, bei dem ich meinen 6-stelligen TOTP-Code eingeben muss.
- Als Benutzer möchte ich beim Aktivieren einen Backup-Code erhalten, damit ich bei Verlust der Authenticator-App nicht ausgesperrt werde.

## Akzeptanzkriterien
- [ ] Seite "Mein Konto" / "Sicherheitseinstellungen" mit 2FA-Bereich
- [ ] Schaltfläche "2FA aktivieren" öffnet Dialog mit QR-Code und manuellem Setup-Key
- [ ] QR-Code ist kompatibel mit Google Authenticator, Authy, Microsoft Authenticator
- [ ] Nach QR-Code-Scan muss der Benutzer einen gültigen TOTP-Code eingeben, bevor 2FA aktiviert wird (Bestätigung)
- [ ] Nach erfolgreicher Aktivierung: Anzeige von 10 Einmal-Backup-Codes (zum Ausdrucken/Speichern)
- [ ] Backup-Codes werden gehasht in der Datenbank gespeichert
- [ ] Login-Flow mit 2FA: Nach Passwort-Eingabe erscheint zweiter Schritt "Code eingeben"
- [ ] Code-Eingabe akzeptiert TOTP-Codes (6 Ziffern) und Backup-Codes
- [ ] Bei 5 fehlgeschlagenen Versuchen: 15-Minuten-Sperrung (Rate Limiting)
- [ ] Schaltfläche "2FA deaktivieren": Erfordert aktuelles Passwort zur Bestätigung
- [ ] Status "2FA aktiv / inaktiv" ist auf der Sicherheitsseite sichtbar
- [ ] Admins können in der Benutzerverwaltung sehen, ob ein Benutzer 2FA aktiviert hat (Status-Anzeige, kein Deaktivieren durch Admin)

## Randfälle
- Was passiert, wenn der TOTP-Code abgelaufen ist? → Nächsten 30-Sekunden-Code verwenden
- Was passiert bei Verlust der Authenticator-App ohne Backup-Codes? → Admin muss 2FA manuell über Supabase-Dashboard zurücksetzen
- Was passiert, wenn Backup-Codes erschöpft sind? → Nach erfolgreicher 2FA-Anmeldung neue Backup-Codes generieren
- Was passiert bei falscher Systemzeit auf dem Smartphone? → TOTP-Code ungültig; Hinweis auf Uhrzeitkorrektur
- Was passiert, wenn der Browser keine Session hat und 2FA-Schritt gezeigt wird? → Session nur nach vollständigem Login (Passwort + TOTP) erstellt

## Technische Anforderungen
- Supabase MFA (TOTP) – nativ unterstützt seit Supabase 2023
- Supabase Auth-Methoden: `supabase.auth.mfa.enroll()`, `supabase.auth.mfa.challenge()`, `supabase.auth.mfa.verify()`
- Tabelle `mfa_backup_codes`: `user_id`, `code_hash` (bcrypt), `used_at` (nullable) – 10 Codes pro User
- API-Route `POST /api/auth/mfa/backup-codes/verify` für Backup-Code-Login
- Rate Limiting: Max. 5 Versuche pro 15 Minuten auf 2FA-Code-Eingabe
- QR-Code-Generierung client-seitig mit `qrcode` Library aus dem Supabase-Enrollment-Secret

---
<!-- Abschnitte unten werden von nachfolgenden Skills hinzugefügt -->

## Technisches Design (Solution Architect)
_Wird von /architecture hinzugefügt_

## QA-Testergebnisse
_Wird von /qa hinzugefügt_

## Deployment
_Wird von /deploy hinzugefügt_
