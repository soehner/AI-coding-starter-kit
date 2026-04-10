# PROJ-2: Benutzereinladung & Rollenverwaltung

## Status: Deployed
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

### Komponentenstruktur

```
/dashboard/admin/users  (nur für Admins sichtbar)
+-- Benutzerverwaltungs-Seite
    +-- Seitenkopf ("Benutzerverwaltung" + "Benutzer einladen"-Button)
    +-- Benutzertabelle
    |   +-- Tabellenzeile pro Benutzer
    |       +-- Name / E-Mail
    |       +-- Rolle (Admin / Betrachter) – änderbar via Dropdown
    |       +-- Status (Aktiv / Eingeladen)
    |       +-- Registrierungsdatum
    |       +-- Aktionen (Rolle ändern, Benutzer löschen)
    +-- "Benutzer einladen"-Dialog (Modal)
        +-- Eingabefeld: E-Mail-Adresse
        +-- Auswahlfeld: Rolle (Admin / Betrachter)
        +-- Absenden-Button
        +-- Fehlermeldung (z.B. E-Mail bereits vorhanden)
```

### Datenmodell

Kein neues Datenbankschema nötig – PROJ-1 hat alle benötigten Tabellen angelegt.

**Tabelle `user_profiles` (bereits vorhanden):**
- Eindeutige ID (verknüpft mit dem Auth-Konto)
- E-Mail-Adresse
- Vollständiger Name
- Rolle: "admin" oder "viewer"
- Erstellt am: Datum der Einladung/Registrierung

**Supabase Auth (bereits vorhanden):**
- Verwaltet Anmeldedaten, Passwörter und Einladungslinks automatisch

### Neue Bausteine

**Neue Seite:**
- `/dashboard/admin/users` – Benutzerverwaltungsseite (nur für Admins)

**Neue API-Endpunkte (serverseitig, nur für Admins):**
- `POST /api/admin/invite` – Benutzer per E-Mail einladen
- `PATCH /api/admin/users/[id]` – Rolle eines Benutzers ändern
- `DELETE /api/admin/users/[id]` – Benutzer löschen

**Neue UI-Komponenten:**
- `InviteUserDialog` – Modal zum Einladen (nutzt: Dialog, Form, Input, Select, Button)
- `UsersTable` – Tabelle mit allen Benutzern (nutzt: Table, Badge, DropdownMenu)

### Technische Entscheidungen

| Entscheidung | Warum |
|---|---|
| Supabase Admin-Funktion für Einladungen | Automatischer Versand von Einladungs-E-Mails mit sicherem Aktivierungslink – kein eigener E-Mail-Dienst nötig |
| Serverseitige API-Routen | Admin-Schlüssel darf niemals im Browser sichtbar sein |
| Rollenänderung sofort wirksam | Rolle wird direkt in der DB geändert; neue Berechtigung greift beim nächsten Seitenaufruf automatisch |
| Selbstschutz-Regel | Admins können sich nicht selbst löschen oder degradieren – verhindert versehentliches Aussperren |

### Abhängigkeiten

Keine neuen Pakete nötig – alle shadcn/ui-Komponenten (Dialog, Table, Select, Badge, DropdownMenu) sind bereits installiert.

## QA-Testergebnisse (Re-Test)

**Ersttest:** 2026-04-10
**Re-Test:** 2026-04-10
**App-URL:** http://localhost:3000
**Tester:** QA-Ingenieur (KI)
**Methode:** Statische Code-Analyse + Build-Verifizierung

### Status der Akzeptanzkriterien

#### AK-1: Adminbereich "Benutzerverwaltung" ist nur fuer Admins sichtbar
- [x] Navigation (Header-Dropdown) zeigt "Benutzerverwaltung"-Link nur wenn `isAdmin === true`
- [x] Seite `/dashboard/admin/users` prueft `isAdmin` im `useEffect` und leitet Nicht-Admins zu `/dashboard` um
- [x] API-Routen (`/api/admin/invite`, `/api/admin/users`, `/api/admin/users/[id]`) pruefen Admin-Berechtigung serverseitig via `requireAdmin()`
- [x] `requireAdmin()` prueft Authentifizierung mit `getUser()` und Rolle in `user_profiles`
- **Ergebnis: BESTANDEN**

#### AK-2: Formular zum Einladen: E-Mail-Adresse und Rolle (Admin / Betrachter)
- [x] `InviteUserDialog` implementiert als Modal mit shadcn/ui Dialog
- [x] E-Mail-Eingabefeld mit `type="email"` und `autoComplete="email"`
- [x] Rollen-Select mit "Administrator" und "Betrachter" Optionen
- [x] Zod-Validierung fuer E-Mail-Format und Rollen-Enum (`inviteUserSchema`)
- [x] Ladezustand mit Spinner waehrend Absenden
- [x] Erfolgs- und Fehlermeldungen korrekt implementiert
- **Ergebnis: BESTANDEN**

#### AK-3: Einladungs-E-Mail wird ueber Supabase Auth (invite-Funktion) versendet
- [x] API-Route verwendet `adminClient.auth.admin.inviteUserByEmail()`
- [x] Service-Role-Key wird serverseitig ueber `createAdminSupabaseClient()` verwendet
- [x] Service-Role-Key ist in `.env.local.example` dokumentiert als `SUPABASE_SERVICE_ROLE_KEY`
- [x] Service-Role-Key ist NICHT mit `NEXT_PUBLIC_` Praefix versehen (korrekt)
- **Ergebnis: BESTANDEN**

#### AK-4: Eingeladener Benutzer erhaelt Link zum Passwort-Setzen mit E-Mail-Verifizierung
- [x] Supabase `inviteUserByEmail` generiert automatisch einen Einladungslink
- [x] Auth-Callback-Route (`/api/auth/callback`) ist implementiert fuer Token-Austausch
- **Ergebnis: BESTANDEN (Supabase-Standardverhalten)**

#### AK-5: Nach Registrierung wird der Benutzer in user_profiles mit der festgelegten Rolle gespeichert
- [x] Trigger `handle_new_user` wurde in Migration 002 aktualisiert: liest Rolle aus `raw_user_meta_data`
- [x] Rolle wird bei Einladung als Metadaten uebergeben: `{ data: { role } }`
- [x] Zusaetzliches `upsert` in der Invite-Route als Fallback
- [x] `ON CONFLICT (id) DO UPDATE` in der Trigger-Funktion verhindert Duplikate
- **Ergebnis: BESTANDEN**

#### AK-6: Liste zeigt: Name/E-Mail, Rolle, Registrierungsdatum, Status (aktiv/eingeladen)
- [x] `UsersTable` zeigt E-Mail, Rolle, Status-Badge und Registrierungsdatum
- [x] Status wird ueber `last_sign_in_at` bestimmt: vorhanden = "Aktiv", null = "Eingeladen"
- [x] BUG-1 BEHOBEN: Neue GET-Route `/api/admin/users` laedt `last_sign_in_at` ueber `adminClient.auth.admin.listUsers()` und merged Auth-Daten mit Profilen
- [ ] BUG-2 OFFEN: "Name" fehlt in der Tabelle - nur E-Mail wird angezeigt. `user_profiles` hat kein `full_name`-Feld. E-Mail identifiziert den Benutzer aber eindeutig.
- **Ergebnis: TEILWEISE BESTANDEN (nur BUG-2 offen - Niedrig)**

#### AK-7: Rollenaenderung sofort wirksam (ohne erneutes Login)
- [x] Rollenaenderung ueber PATCH `/api/admin/users/[id]` aktualisiert direkt in der Datenbank
- [x] Lokale Liste wird nach Aenderung sofort aktualisiert (`setUsers`)
- [x] Andere Benutzer laden Profil bei naechstem Seitenaufruf via `useAuth` -> `fetchProfile`
- **Ergebnis: BESTANDEN**

#### AK-8: Loeschen eines Benutzers entfernt ihn aus Supabase Auth und user_profiles
- [x] DELETE-Route verwendet `adminClient.auth.admin.deleteUser(targetUserId)`
- [x] `ON DELETE CASCADE` in der Tabelle `user_profiles` sorgt fuer automatische Bereinigung
- [x] Lokale Liste wird nach Loeschen aktualisiert (`setUsers`)
- [x] Bestaetigungsdialog via `AlertDialog` vor dem Loeschen
- **Ergebnis: BESTANDEN**

#### AK-9: Admins koennen sich nicht selbst loeschen oder die eigene Rolle auf "Betrachter" aendern
- [x] PATCH-Route: Selbstschutz implementiert (`authResult.profile.id === targetUserId`)
- [x] DELETE-Route: Selbstschutz implementiert
- [x] UI: Eigene Zeile zeigt keine Rolle-Dropdown und keinen Loeschen-Button (nur Text + "Du"-Badge)
- **Ergebnis: BESTANDEN**

### Status der Randfaelle

#### RF-1: Bereits vorhandene E-Mail eingeladen -> Fehlermeldung
- [x] Invite-Route prueft `user_profiles` auf existierende E-Mail vor Einladung
- [x] Zusaetzliche Pruefung auf Supabase Auth-Ebene ("already been registered")
- [x] Fehlermeldung: "Ein Benutzer mit dieser E-Mail-Adresse existiert bereits." (HTTP 409)
- **Ergebnis: BESTANDEN**

#### RF-2: Einladungslink laeuft ab -> Benutzer kann neuen Link anfordern (Admin muss erneut einladen)
- [x] Supabase verwaltet Einladungslink-Ablauf automatisch
- [x] Auth-Callback behandelt Fehler und redirectet zu `/login?error=auth_callback_error`
- [ ] HINWEIS: Kein expliziter "erneut einladen"-Mechanismus (Admin muss Benutzer loeschen und neu einladen). Akzeptabel fuer MVP.
- **Ergebnis: BESTANDEN (mit Einschraenkung)**

#### RF-3: Letzter Admin soll geloescht werden -> Blockiert mit Fehlermeldung
- [x] DELETE-Route zaehlt Admins und blockiert Loeschen wenn nur noch 1 Admin
- [x] Fehlermeldung: "Der letzte Administrator kann nicht geloescht werden." (HTTP 400)
- [x] PATCH-Route prueft jetzt ebenfalls Letzter-Admin-Schutz bei Degradierung (BUG-3 BEHOBEN)
- [x] Fehlermeldung: "Der letzte Administrator kann nicht zum Betrachter geaendert werden." (HTTP 400)
- **Ergebnis: BESTANDEN**

#### RF-4: Betrachter versucht Benutzerverwaltung aufzurufen -> 403 / Redirect
- [x] Client-seitig: `useEffect` mit Redirect zu `/dashboard` wenn nicht Admin
- [x] Server-seitig: `requireAdmin()` gibt HTTP 403 zurueck
- [ ] HINWEIS: Middleware prueft NICHT auf Admin-Rolle - nur auf Authentifizierung. Betrachter sieht kurz Skeleton-Loading bevor Client-Redirect greift. Kein Sicherheitsproblem (API geschuetzt), aber UX-Problem.
- **Ergebnis: BESTANDEN (mit UX-Einschraenkung)**

### Sicherheitsaudit-Ergebnisse

#### Authentifizierung
- [x] Alle Admin-API-Routen pruefen Authentifizierung via `requireAdmin()` -> `getUser()`
- [x] Service-Role-Key ist nur serverseitig verfuegbar (kein `NEXT_PUBLIC_` Praefix)
- [x] Admin-Client wird nur in API-Routen erstellt, nie auf dem Client

#### Autorisierung
- [x] `requireAdmin()` prueft `profile.role === "admin"` nach Authentifizierung
- [x] RLS-Policies auf `user_profiles` sind korrekt konfiguriert (SELECT, UPDATE, INSERT, DELETE)
- [x] Admin-API verwendet `createAdminSupabaseClient()` mit Service-Role-Key (umgeht RLS bewusst)
- [x] Selbstschutz: Admin kann eigene Rolle nicht aendern und sich nicht loeschen
- [x] Letzter-Admin-Schutz bei DELETE und PATCH implementiert (BUG-3 BEHOBEN)

#### Eingabevalidierung
- [x] Zod-Validierung fuer Invite-Eingaben (`inviteUserSchema`: E-Mail + Rolle)
- [x] Zod-Validierung fuer Rollenaenderung (`updateRoleSchema`: Rolle)
- [x] UUID-Format-Validierung fuer Benutzer-ID in der Route
- [x] E-Mail wird normalisiert: `toLowerCase().trim()`
- [x] Request-Body-Parsing ist in try-catch gewrappt

#### Rate Limiting
- [x] `requireAdmin()` hat In-Memory Rate Limiting (20 Req/Min pro IP)
- [ ] HINWEIS: In-Memory Rate Limiting funktioniert nicht bei mehreren Serverinstanzen (bekannter Mangel aus PROJ-1)

#### Secrets
- [x] `SUPABASE_SERVICE_ROLE_KEY` in `.env.local.example` dokumentiert
- [x] Kein `NEXT_PUBLIC_` Praefix fuer Service-Role-Key
- [x] Admin-Client wirft Fehler wenn Umgebungsvariablen fehlen
- [x] Keine hartcodierten Secrets im Quellcode

#### XSS / Injection
- [x] Kein `dangerouslySetInnerHTML`, kein `innerHTML`, kein `eval`
- [x] Supabase-Client verwendet parametrisierte Queries
- [x] E-Mail-Eingabe wird durch Zod validiert

#### IDOR (Insecure Direct Object Reference)
- [x] API-Routen pruefen Admin-Berechtigung vor jeder Operation
- [x] UUID-Format wird validiert (verhindert Path-Traversal)
- [ ] HINWEIS: Ein Admin kann jeden anderen Benutzer aendern/loeschen - beabsichtigtes Verhalten

#### Race Condition (Letzter-Admin-Schutz)
- [ ] BUG-6 NEU: Die Letzter-Admin-Pruefung in PATCH und DELETE erfolgt ohne Datenbank-Transaktion. Bei gleichzeitigen Requests (z.B. PATCH degradiert Admin B + DELETE loescht Admin A) koennten beide Pruefungen 2 Admins sehen, aber das Endergebnis 0 Admins sein. Risiko: Sehr gering (Single-User-App, kein gleichzeitiger Zugriff erwartet), aber theoretisch moeglich.

### Behobene Bugs (aus Ersttest)

| Bug | Schweregrad | Status |
|-----|-------------|--------|
| BUG-1: Status immer "Eingeladen" | Mittel | BEHOBEN - Neue GET-Route `/api/admin/users` laedt `last_sign_in_at` ueber Admin-API |
| BUG-3: Letzter-Admin-Schutz fehlt bei Rollenaenderung | Hoch | BEHOBEN - PATCH-Route prueft jetzt Admin-Anzahl vor Degradierung |
| BUG-4: ESLint-Fehler in use-auth.ts | Mittel | BEHOBEN - `useMemo` statt `useRef` fuer Supabase-Client |

### Verbleibende Bugs

#### BUG-2: Name/Vollstaendiger Name fehlt in der Benutzerliste
- **Schweregrad:** Niedrig
- **Beschreibung:** Das Akzeptanzkriterium fordert "Name/E-Mail" in der Liste. Die Tabelle `user_profiles` hat kein `full_name`-Feld. Die Tabelle zeigt nur die E-Mail. Die E-Mail identifiziert den Benutzer aber eindeutig.
- **Reproduktionsschritte:**
  1. Oeffne die Benutzerverwaltung `/dashboard/admin/users`
  2. Erwartet: Spalte "Name" oder "Name/E-Mail"
  3. Tatsaechlich: Nur E-Mail wird angezeigt
- **Prioritaet:** Im naechsten Sprint beheben (erfordert Datenbankschema-Aenderung)

#### BUG-5: Kein serverseitiger Admin-Schutz in Middleware fuer /dashboard/admin/*
- **Schweregrad:** Niedrig
- **Beschreibung:** Die Middleware prueft nur Authentifizierung, nicht Autorisierung. Ein eingeloggter Betrachter sieht kurz die Seite (Skeleton-Loading) bevor der Client-Redirect greift. API-Endpunkte sind geschuetzt, daher kein Datenleck.
- **Reproduktionsschritte:**
  1. Melde dich als Betrachter an
  2. Navigiere direkt zu `/dashboard/admin/users`
  3. Erwartet: Sofortiger Redirect oder 403-Seite
  4. Tatsaechlich: Skeleton-Loading sichtbar, dann Redirect
- **Prioritaet:** Im naechsten Sprint beheben

#### BUG-6: Race Condition bei Letzter-Admin-Schutz (theoretisch)
- **Schweregrad:** Niedrig
- **Beschreibung:** Die Letzter-Admin-Pruefung in PATCH und DELETE erfolgt ohne Datenbank-Transaktion. Bei gleichzeitigen Requests koennten beide Pruefungen 2 Admins sehen, aber das Endergebnis 0 Admins sein. Risiko ist sehr gering, da die App fuer einen Einzelentwickler/Kassenwart konzipiert ist und gleichzeitige Admin-Operationen praktisch nicht vorkommen.
- **Reproduktionsschritte:**
  1. Erstelle eine Situation mit genau 2 Admins
  2. Sende gleichzeitig: PATCH (degradiere Admin B) + DELETE (loesche Admin A)
  3. Theoretisch: Beide Pruefungen sehen 2 Admins, fuehren aber zu 0 Admins
- **Prioritaet:** Im naechsten Sprint beheben (erfordert DB-Transaktion oder Advisory Lock)

### Cross-Browser-Analyse (statisch)
- [x] Keine browser-spezifischen APIs verwendet
- [x] Tailwind CSS fuer Styling (gute Browser-Kompatibilitaet)
- [x] shadcn/ui-Komponenten (Dialog, Table, Select, Badge, AlertDialog) korrekt eingesetzt
- [x] Standard-HTML-Formularelemente mit korrekten Typen

### Responsive-Analyse (statisch)
- [x] Seitenkopf: `flex-col gap-4 sm:flex-row` - stapelt auf Mobile, nebeneinander auf Desktop
- [x] Tabelle: Status-Spalte `hidden sm:table-cell`, Datum-Spalte `hidden md:table-cell` - progressive Anzeige
- [x] Dialog: `sm:max-w-[425px]` - responsiv
- [x] Select-Trigger: `w-[150px]` - fixe Breite, koennte auf sehr kleinen Bildschirmen eng werden
- [ ] HINWEIS: Die Tabelle hat kein horizontales Scrolling auf sehr kleinen Bildschirmen. Bei langen E-Mail-Adressen koennte sie ueberlaufen.

### Regressionstests (PROJ-1)
- [x] Login-Seite unveraendert und funktionsfaehig (keine Aenderungen an login-form.tsx)
- [x] Dashboard-Layout unveraendert
- [x] Passwort-vergessen-Seite unveraendert
- [x] Auth-Callback unveraendert
- [x] Header: "Benutzerverwaltung"-Link hinzugefuegt, alle bestehenden Elemente (Logout, Rolle, Passwort aendern) bleiben funktional
- [x] ESLint-Fehler in `use-auth.ts` behoben (BUG-4)
- [x] Build erfolgreich (TypeScript + ESLint fehlerfrei)

### Zusammenfassung
- **Akzeptanzkriterien:** 8/9 bestanden, 1 teilweise bestanden (AK-6: nur BUG-2 offen - Niedrig)
- **Randfaelle:** 4/4 bestanden (mit Einschraenkungen)
- **Behobene Bugs:** 3 von 5 aus dem Ersttest behoben (BUG-1, BUG-3, BUG-4)
- **Verbleibende Bugs:** 3 gesamt (0 kritisch, 0 hoch, 0 mittel, 3 niedrig)
- **Sicherheit:** Alle hohen/mittleren Bugs behoben. Nur theoretische Race Condition verbleibt (niedriges Risiko).
- **Build:** Erfolgreich (TypeScript fehlerfrei)
- **Lint:** BESTANDEN (keine Fehler)
- **Produktionsreif:** JA
- **Empfehlung:** Feature kann deployt werden. Die 3 verbleibenden niedrigen Bugs (BUG-2, BUG-5, BUG-6) koennen im naechsten Sprint behoben werden.

## Deployment

**Deployt:** 2026-04-10
**Produktions-URL:** https://cbs-finanz.vercel.app
**Umgebung:** Vercel (soehners-projects/cbs-finanz)
**Neue Umgebungsvariable:** `SUPABASE_SERVICE_ROLE_KEY` in Vercel gesetzt (production + preview)
