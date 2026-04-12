# PROJ-10: Genehmigungssystem für Vereinsanträge

## Status: In Review
**Erstellt:** 2026-04-10
**Zuletzt aktualisiert:** 2026-04-12

## Abhängigkeiten
- Benötigt: PROJ-1 (Authentifizierung) – Login und Rollen müssen existieren
- Benötigt: PROJ-2 (Benutzerverwaltung) – Rollenverwaltung muss existieren, wird um neue Rollen erweitert

## Übersicht

Admins (Kassenwart) können Genehmigungsanträge an Vorstandsmitglieder stellen. Ein Antrag enthält einen Beleg (Datei-Upload) und eine Bemerkung. Der Antragsteller wählt, welche Rollen genehmigen müssen (Vorstand, 2. Vorstand) und ob alle oder nur eine Rolle genehmigen muss (UND/ODER-Verknüpfung). Genehmiger werden per E-Mail benachrichtigt und können per Token-Link (ohne Login) genehmigen oder ablehnen. Der Antragsteller wird per E-Mail über die Entscheidung informiert.

## User Stories

### Rollenverwaltung
- Als Administrator möchte ich beim Einladen/Bearbeiten eines Benutzers die Zusatzrollen "Vorstand" und "2. Vorstand" vergeben können, damit ich Genehmiger definieren kann.
- Als Administrator möchte ich einem Benutzer eine oder beide Zusatzrollen zuweisen können (kombinierbar mit Admin/Betrachter), damit die Rollenstruktur des Vereins abgebildet wird.

### Antragstellung
- Als Administrator möchte ich einen Genehmigungsantrag stellen, damit ich die Zustimmung des Vorstands für eine Ausgabe/Maßnahme einholen kann.
- Als Administrator möchte ich einen Beleg (PDF, JPG, PNG, HEIC, Word) per Drag & Drop oder Dateiauswahl hochladen, damit der Vorstand die Unterlagen einsehen kann.
- Als Administrator möchte ich eine Bemerkung zum Antrag hinzufügen, damit der Vorstand den Kontext versteht.
- Als Administrator möchte ich auswählen, welche Rollen genehmigen müssen (Vorstand, 2. Vorstand oder beide), damit der richtige Personenkreis angefragt wird.
- Als Administrator möchte ich festlegen, ob alle ausgewählten Rollen genehmigen müssen (UND) oder ob eine Genehmigung ausreicht (ODER), damit der Genehmigungsprozess zur Situation passt.

### Genehmigung/Ablehnung
- Als Genehmiger (Vorstand/2. Vorstand) möchte ich eine E-Mail mit dem Beleg als Anhang und der Bemerkung erhalten, damit ich den Antrag prüfen kann.
- Als Genehmiger möchte ich per Klick auf einen Button in der E-Mail (ohne Login) genehmigen oder ablehnen können, damit der Prozess schnell und unkompliziert ist.
- Als Genehmiger möchte ich optional einen Kommentar hinterlassen können, damit ich meine Entscheidung begründen kann.

### Benachrichtigung & Übersicht
- Als Antragsteller möchte ich per E-Mail über die Entscheidung (Genehmigung/Ablehnung) informiert werden, damit ich zeitnah reagieren kann.
- Als Antragsteller möchte ich einen abgelehnten Antrag überarbeiten und erneut einreichen können, damit ich auf Einwände reagieren kann.
- Als eingeloggter Benutzer möchte ich eine Übersichtsseite aller Anträge mit Status (offen/genehmigt/abgelehnt) sehen, damit ich den Genehmigungsstatus nachvollziehen kann.

## Akzeptanzkriterien

### Rollenerweiterung
- [ ] In der Benutzerverwaltung können die Zusatzrollen "Vorstand" und "2. Vorstand" vergeben werden
- [ ] Zusatzrollen sind kombinierbar mit der Hauptrolle (Admin/Betrachter)
- [ ] Ein Benutzer kann gleichzeitig z.B. "Admin + Vorstand" oder "Betrachter + 2. Vorstand" sein
- [ ] Die Zusatzrollen werden im Benutzerprofil und in der Benutzerliste angezeigt

### Antragstellung
- [ ] Nur Admins sehen den Menüpunkt "Genehmigung" und können Anträge stellen
- [ ] Antragsformular enthält: Beleg-Upload, Bemerkungsfeld, Rollenauswahl, UND/ODER-Auswahl
- [ ] Beleg-Upload unterstützt Drag & Drop und Dateiauswahl
- [ ] Erlaubte Dateitypen: PDF, JPG, PNG, HEIC, DOC, DOCX
- [ ] Belege werden auf Seafile (separates Verzeichnis) hochgeladen
- [ ] Button "Antrag stellen" sendet den Antrag ab und löst E-Mail-Versand aus
- [ ] Validierung: Beleg und mindestens eine Rolle sind Pflichtfelder

### E-Mail-Versand (Resend)
- [ ] Alle Benutzer mit den ausgewählten Zusatzrollen erhalten eine E-Mail
- [ ] E-Mail enthält: Bemerkung als Inhalt, Beleg als Anhang (oder Download-Link von Seafile)
- [ ] E-Mail enthält zwei Buttons: "Genehmigen" und "Nicht genehmigen"
- [ ] Buttons verlinken auf Token-basierte URLs (kein Login nötig)
- [ ] Tokens sind signiert, einmalig verwendbar und zeitlich begrenzt (z.B. 7 Tage)
- [ ] Nach Entscheidung: Antragsteller erhält Benachrichtigungs-E-Mail mit der Entscheidung

### Genehmigungslogik
- [ ] Bei UND-Verknüpfung: Antrag ist erst genehmigt, wenn ALLE angefragten Rollen zugestimmt haben
- [ ] Bei UND-Verknüpfung: Eine Ablehnung von einer Rolle führt sofort zur Ablehnung des gesamten Antrags
- [ ] Bei ODER-Verknüpfung: Eine Genehmigung von einer Rolle reicht aus
- [ ] Bei ODER-Verknüpfung: Antrag ist erst abgelehnt, wenn ALLE angefragten Rollen abgelehnt haben
- [ ] Genehmiger kann optional einen Kommentar zur Entscheidung hinterlassen
- [ ] Entscheidung wird mit Zeitstempel, Rolle und optionalem Kommentar im Antrag gespeichert

### Erneute Einreichung
- [ ] Abgelehnte Anträge können vom Antragsteller überarbeitet und erneut eingereicht werden
- [ ] Bei erneuter Einreichung werden alle bisherigen Entscheidungen zurückgesetzt
- [ ] Neuer E-Mail-Versand an die Genehmiger bei erneuter Einreichung

### Antragsübersicht
- [ ] Übersichtsseite zeigt alle Anträge mit Status: Offen, Genehmigt, Abgelehnt
- [ ] Sichtbar für alle eingeloggten Benutzer (Admin, Vorstand, 2. Vorstand, Betrachter)
- [ ] Details eines Antrags zeigen: Bemerkung, Beleg (Download-Link), Genehmigungsstatus pro Rolle, Kommentare
- [ ] Admins sehen einen Button "Erneut einreichen" bei abgelehnten Anträgen

## Randfälle

- **Keine Benutzer mit der gewählten Rolle vorhanden:** Fehlermeldung "Es gibt keinen Benutzer mit der Rolle Vorstand/2. Vorstand. Bitte weisen Sie die Rolle zuerst zu."
- **Token abgelaufen:** Freundliche Fehlerseite mit Hinweis, dass der Link abgelaufen ist. Antrag bleibt offen.
- **Token bereits verwendet (doppelter Klick):** Seite zeigt "Sie haben bereits entschieden" mit der bisherigen Entscheidung.
- **Mehrere Personen haben die gleiche Rolle:** Alle erhalten die E-Mail. Bei ODER-Verknüpfung reicht die Entscheidung einer Person pro Rolle. Bei UND-Verknüpfung muss mindestens eine Person pro ausgewählter Rolle entscheiden.
- **Genehmiger-Rolle wird entzogen während Antrag offen ist:** Offene Tokens werden ungültig. Antrag muss ggf. erneut eingereicht werden.
- **Seafile nicht erreichbar:** Fehlermeldung beim Upload. Antrag kann nicht eingereicht werden.
- **E-Mail-Versand schlägt fehl (Resend):** Fehlermeldung an den Antragsteller. Antrag wird als "Entwurf" gespeichert, damit er erneut gesendet werden kann.
- **Beleg mit unerlaubtem Dateityp:** Client-seitige Validierung + serverseitige Prüfung. Fehlermeldung mit erlaubten Typen.

## Technische Anforderungen

### Neue Dienste
- **Resend:** E-Mail-Versand für Genehmigungsanfragen und Benachrichtigungen (API-Key in Umgebungsvariablen)
- **Seafile:** Beleg-Speicherung in separatem Verzeichnis (API-Token bereits vorhanden)

### Sicherheit
- Token-Links müssen kryptographisch signiert sein (HMAC mit Serverseitigem Secret)
- Tokens sind einmalig verwendbar (nach Nutzung als "verbraucht" markiert)
- Tokens haben eine maximale Gültigkeitsdauer (7 Tage)
- Nur Admins können Anträge erstellen
- Beleg-Upload: Dateityp-Validierung serverseitig (nicht nur Extension, sondern MIME-Type)
- RLS-Policies auf Antragstabellen

### Umgebungsvariablen (neu)
- `RESEND_API_KEY` – API-Key für den E-Mail-Versand
- `RESEND_FROM_EMAIL` – Absender-E-Mail-Adresse
- `APPROVAL_TOKEN_SECRET` – Secret für Token-Signierung
- `SEAFILE_API_URL` – Seafile-Server-URL
- `SEAFILE_API_TOKEN` – Seafile API-Token
- `SEAFILE_REPO_ID` – Seafile Repository-ID für Belege

---
<!-- Abschnitte unten werden von nachfolgenden Skills hinzugefügt -->

## Technisches Design (Solution Architect)

### Komponentenstruktur

```
Dashboard (eingeloggt)
+-- App-Header (Navigation)
|   +-- Neuer Menüpunkt: "Genehmigungen" (nur für Admins sichtbar)
|
+-- /dashboard/genehmigungen (Übersichtsseite, alle eingeloggten Nutzer)
|   +-- Antrags-Statusleiste (Filter: Alle / Offen / Genehmigt / Abgelehnt)
|   +-- Anträge-Tabelle
|       +-- Zeile: Datum, Bemerkung (Kurzfassung), Status-Badge, Beleg-Link
|       +-- Detail-Expandierung: Entscheidungen pro Rolle + Kommentare
|       +-- Button "Erneut einreichen" (nur Admins, nur abgelehnte Anträge)
|
+-- /dashboard/genehmigungen/neu (Antrag stellen, nur Admins)
    +-- Antragsformular
        +-- Beleg-Upload (Drag & Drop + Dateiauswahl)
        +-- Bemerkungsfeld (Textarea)
        +-- Rollenauswahl (Checkboxen: Vorstand / 2. Vorstand)
        +-- Verknüpfungsauswahl (Radio: UND / ODER)
        +-- Button "Antrag stellen"

/genehmigung/[token] (öffentlich, kein Login)
+-- Token-Validierungsseite
    +-- Antragsdetails (Bemerkung + Beleg-Download-Link)
    +-- Kommentarfeld (optional)
    +-- Button "Genehmigen" (grün)
    +-- Button "Ablehnen" (rot)
    +-- Bestätigungsseite nach Entscheidung

Benutzerverwaltung (bestehend, wird erweitert)
+-- Benutzer einladen / bearbeiten Dialog
    +-- NEU: Zusatzrollen-Auswahl (Checkboxen: Vorstand / 2. Vorstand)
```

### Datenmodell

**Tabelle: `approval_requests` (Genehmigungsanträge)**

Jeder Antrag enthält:
- Eindeutige ID
- Erstellt von (Verweis auf Benutzer/Admin)
- Bemerkung (Freitext)
- Beleg-URL (Seafile-Link zum Dokument)
- Beleg-Dateiname (für Anzeige)
- Erforderliche Rollen (`["vorstand"]` oder `["vorstand", "zweiter_vorstand"]`)
- Verknüpfungstyp: `und` oder `oder`
- Gesamtstatus: `offen`, `genehmigt`, `abgelehnt`, `entwurf`
- Erstellungszeitstempel, Letztes Update-Datum

**Tabelle: `approval_decisions` (Einzelentscheidungen pro Genehmiger)**

Jede Entscheidung enthält:
- Eindeutige ID
- Verweis auf den Antrag
- Genehmiger-Benutzer-ID
- Rolle des Genehmigers (vorstand / zweiter_vorstand)
- Entscheidung: `genehmigt` oder `abgelehnt`
- Optionaler Kommentar
- Entscheidungszeitstempel

**Tabelle: `approval_tokens` (Einmallinks für Genehmiger)**

Jedes Token enthält:
- Eindeutige ID
- Verweis auf den Antrag + Genehmiger-Benutzer-ID
- Das Token selbst (kryptografisch signiert, HMAC)
- Ablaufdatum (7 Tage nach Erstellung)
- Status: `aktiv`, `verbraucht`, `abgelaufen`

**Erweiterung bestehender Benutzertabelle:**

Profile erhalten zwei neue Felder:
- `ist_vorstand` (ja/nein)
- `ist_zweiter_vorstand` (ja/nein)

Diese Felder sind unabhängig von der Hauptrolle (Admin/Betrachter).

### Neue API-Endpunkte

| Methode | Pfad | Zweck |
|---|---|---|
| POST | `/api/admin/approvals` | Antrag erstellen + E-Mails versenden |
| GET | `/api/approvals` | Alle Anträge abrufen |
| GET | `/api/approvals/[id]` | Einzelantrag mit Entscheidungen |
| POST | `/api/approvals/[id]/resubmit` | Antrag erneut einreichen |
| GET | `/api/approvals/decide/[token]` | Token validieren + Antragsdetails |
| POST | `/api/approvals/decide/[token]` | Entscheidung per Token speichern |

### Genehmigungsablauf

```
Admin erstellt Antrag
       ↓
Beleg → Seafile hochladen
       ↓
Antrag in DB speichern (Status: "offen")
       ↓
Tokens generieren (1 pro Genehmiger-Benutzer)
       ↓
E-Mails versenden (Resend) mit Token-Links
       ↓
Genehmiger klickt Link → Token-Validierung
       ↓
Entscheidung speichern (genehmigt/abgelehnt)
       ↓
Genehmigungslogik auswerten (UND/ODER)
       ↓
Gesamtstatus aktualisieren (falls abgeschlossen)
       ↓
Benachrichtigungs-E-Mail an Antragsteller
```

### Technische Entscheidungen

| Entscheidung | Begründung |
|---|---|
| Token-basierte Genehmigung (kein Login) | Vorstandsmitglieder haben möglicherweise keinen App-Account. Direktlink per E-Mail ist einfacher und schneller. |
| HMAC-signierte Tokens | Niemand kann einen gültigen Link raten oder fälschen. Das Server-Secret ist die einzige Quelle der Wahrheit. |
| Resend für E-Mail | Bereits in PROJ-2 etabliert. Kein neues System nötig. |
| Seafile für Belegablage | Laut PRD ist Seafile die Dokumentenablage des Vereins. Belege gehören dort hin. |
| Genehmigungslogik im API-Layer | UND/ODER-Logik muss serverseitig ausgewertet werden – kein Manipulationsrisiko. |
| Zusatzrollen als boolesche Felder | Einfache Erweiterung des bestehenden Benutzerprofilsystems (konsistent mit PROJ-7). |
| Öffentliche Token-Seite | `/genehmigung/[token]` braucht keine Authentifizierung – der Token ist der Sicherheitsmechanismus. |

### Neue Abhängigkeiten

| Paket | Zweck |
|---|---|
| `resend` | E-Mail-Versand |
| `@react-email/components` | Strukturierte E-Mail-Vorlagen mit React |

*(Seafile-Integration wird mit PROJ-9 koordiniert)*

### Neue Umgebungsvariablen

```
RESEND_API_KEY            – API-Key für E-Mail-Versand
RESEND_FROM_EMAIL         – Absender-Adresse
APPROVAL_TOKEN_SECRET     – Geheimnis für Token-Signierung (32+ Zeichen)
SEAFILE_API_URL           – Seafile-Server-URL
SEAFILE_API_TOKEN         – Seafile API-Token
SEAFILE_REPO_ID           – Repository-ID für den Belegordner
```

## QA-Testergebnisse

**Getestet:** 2026-04-12 (Re-Test nach Bugfixes)
**App-URL:** http://localhost:3000 (statische Code-Analyse + manuelles Tracing)
**Tester:** QA-Ingenieur (KI)
**Methode:** Code-Review gegen Akzeptanzkriterien, Red-Team-Sicherheitsanalyse, Abhängigkeits- und Flow-Tracing

### Re-Test-Ergebnis (2026-04-12)

Alle 12 im ersten Testlauf gefundenen Bugs wurden geprüft und sind behoben:

| Bug | Schweregrad | Status | Verifiziert in |
|---|---|---|---|
| BUG-1 | Mittel | BEHOBEN | `src/components/app-header.tsx` Z. 97-104 — Menüpunkt "Genehmigungen" liegt im `isAdmin`-Block |
| BUG-2 | Mittel | BEHOBEN | `src/lib/approval-emails.ts` Z. 140-149 — E-Mail enthält zwei Buttons ("Genehmigen" grün + "Nicht genehmigen" rot) mit `?aktion=`-Parameter |
| BUG-3 | Hoch | BEHOBEN | `src/app/api/approvals/[id]/resubmit/route.ts` Z. 95-236 — multipart/form-data mit optionalen Feldern `note`, `required_roles`, `link_type`, `file`; neuer Beleg wird erneut validiert und hochgeladen; UI-Dialog `genehmigung-resubmit-dialog.tsx` existiert |
| BUG-4 | Mittel | BEHOBEN | `src/app/api/approvals/decide/[token]/route.ts` Z. 90-102 und Z. 258-271 — unterscheidet zwischen Selbstentscheidung und Entscheidung eines Kollegen mit gleicher Rolle ("Ein anderes Mitglied der Rolle Vorstand hat bereits entschieden.") |
| BUG-5 | Mittel | BEHOBEN | `src/app/api/approvals/decide/[token]/route.ts` Z. 112-138 (GET) und Z. 274-300 (POST) — Rolle wird bei GET und POST erneut geprüft; Token wird bei Rollenentzug auf `abgelaufen` gesetzt |
| BUG-6 | Mittel | BEHOBEN | `src/app/api/admin/approvals/route.ts` Z. 272-305 — Antrag wird bei E-Mail-Fehler auf `entwurf` gesetzt; neuer Endpunkt `src/app/api/approvals/[id]/retry-send/route.ts` zum erneuten Versenden |
| BUG-7 | Niedrig | BEHOBEN | `src/lib/approval-file-validation.ts` `detectFileTypeFromBuffer` — Magic-Bytes-Prüfung für PDF, JPEG, PNG, HEIC, DOC, DOCX; verwendet in `route.ts` Z. 179-188 (Create) und `resubmit/route.ts` Z. 182-195 |
| BUG-8 | Mittel | BEHOBEN | `src/lib/approval-emails.ts` Z. 63-71 (`safeHref`) — Nur https-Protokoll erlaubt, sonst `#`; alle href-Werte durchlaufen `safeHref` |
| BUG-9 | Hoch | BEHOBEN | `src/app/api/approvals/decide/[token]/route.ts` Z. 12-31 — Rate-Limit 20 Requests/60 Sek. pro IP auf GET und POST |
| BUG-10 | Mittel | BEHOBEN | `src/app/api/admin/approvals/route.ts` Z. 24-77 — Rate-Limit 10 Anträge/Stunde pro Admin+IP |
| BUG-11 | Niedrig | BEHOBEN | `src/lib/approval-file-validation.ts` `sanitizeDocumentName` — Entfernt Pfad-Zeichen, Steuerzeichen, 200-Zeichen-Limit |
| BUG-12 | Niedrig | BEHOBEN | `src/lib/approval-file-validation.ts` `isValidDocumentUrl` + `safeHref` in `approval-emails.ts` — nur https |

### Akzeptanzkriterien (Re-Test)

**AK-1 Rollenerweiterung:** 4/4 bestanden
**AK-2 Antragstellung:** 7/7 bestanden (BUG-1 behoben)
**AK-3 E-Mail-Versand:** 7/7 bestanden (BUG-2 behoben — zwei Buttons in E-Mail)
**AK-4 Genehmigungslogik:** 6/6 bestanden
**AK-5 Erneute Einreichung:** 3/3 bestanden (BUG-3 behoben — echte Überarbeitung möglich)
**AK-6 Antragsübersicht:** 4/4 bestanden

**Summe:** 31/31 Akzeptanzkriterien bestanden.

### Randfälle (Re-Test)

- RF-1 bis RF-8: alle bestanden.
- RF-4 (Mehrfach-Genehmiger): Klare, differenzierte Fehlermeldung.
- RF-5 (Rollenentzug): Token wird serverseitig bei GET+POST invalidiert.
- RF-7 (E-Mail-Fehler): Antrag landet in Status `entwurf`, manuelles Nachsenden per UI/Endpunkt möglich.

### Sicherheitsaudit (Re-Test)

- Authentifizierung/Autorisierung: unverändert korrekt.
- HMAC-Signatur mit `timingSafeEqual`: korrekt.
- XSS in E-Mails: `escapeHtml` + `safeHref` durchgehend angewendet — verifiziert für `note`, `requesterEmail`, `documentName`, `recipientRoleLabel`, `documentUrl`, `approveHref`, `rejectHref`, `baseUrl`-Link in Entscheidungsnachricht.
- Rate-Limiting: aktiv auf öffentlichem Token-Endpunkt und Admin-Create-Endpunkt.
- Dateiupload-Sicherheit: Magic-Bytes + MIME-Type + Größe + Leer-Prüfung + sanitizerten Dateinamen.
- Protokoll-Whitelist: nur `https:` für alle URLs in E-Mails und DB.
- Pfad-Traversal: durch `sanitizeDocumentName` blockiert.
- SQL-Injection: weiterhin keine Raw-Queries — Supabase-Parameter.

Keine neuen Sicherheitsbefunde.

### Regressionstests (Re-Test)

- PROJ-2 Benutzerverwaltung: unverändert.
- PROJ-7 Berechtigungen: unverändert.
- PROJ-9 Seafile-Integration: `loadSeafileConfig`/`uploadToSeafile` weiterhin funktional, Belege landen in `/Förderverein/Genehmigungen/<Jahr>/`.
- PROJ-11 Kostenübernahme: nutzt dasselbe Rate-Limit-Modul und Resend — keine Kollisionen.

### Zusammenfassung Re-Test

- **Akzeptanzkriterien:** 31/31 bestanden
- **Bugs:** 0 offen (12 von 12 behoben)
  - Kritisch: 0
  - Hoch: 0 (zuvor 2)
  - Mittel: 0 (zuvor 7)
  - Niedrig: 0 (zuvor 3)
- **Sicherheit:** solide, alle Befunde adressiert
- **Produktionsreif:** **JA**
- **Empfehlung:** Feature kann deployed werden. Status sollte auf "Deployed" wechseln, sobald `/deploy` ausgeführt wurde.

---


### Status der Akzeptanzkriterien

#### AK-1: Rollenerweiterung
- [x] In der Benutzerverwaltung können die Zusatzrollen "Vorstand" und "2. Vorstand" vergeben werden (Schema `updateExtraRolesSchema` in `validations/admin.ts`, UI-Komponenten `invite-user-dialog.tsx` und `users-table.tsx` unterstützen beide Felder)
- [x] Zusatzrollen sind kombinierbar mit Haupt-Rolle (boolesche Spalten in `user_profiles`, unabhängig von `role`)
- [x] Ein Benutzer kann gleichzeitig Admin + Vorstand sein
- [x] Zusatzrollen werden in Liste/Profil angezeigt (`users-table.tsx` referenziert die Felder)

#### AK-2: Antragstellung
- [ ] **BUG-1:** Nur Admins sehen den Menüpunkt "Genehmigung" — der Menüpunkt in `app-header.tsx` (Z. 97-102) ist außerhalb des `isAdmin`-Blocks und somit für ALLE eingeloggten Benutzer sichtbar. Dies widerspricht dem AK explizit. (Hinweis: Das AK selbst ist in Teilen inkonsistent, da ein späteres AK die Übersicht für alle eingeloggten Benutzer fordert — der Widerspruch muss vom PO geklärt werden.)
- [x] Antragsformular enthält Beleg-Upload, Bemerkung, Rollenauswahl, UND/ODER-Auswahl (`genehmigungs-formular.tsx`)
- [x] Beleg-Upload mit Drag & Drop und Dateiauswahl unterstützt
- [x] Erlaubte Dateitypen PDF/JPG/PNG/HEIC/DOC/DOCX (in `validations/approval.ts` und `api/admin/approvals/route.ts` geprüft)
- [x] Belege werden zu Seafile in separates Verzeichnis `/Förderverein/Genehmigungen/<Jahr>/` hochgeladen
- [x] "Antrag stellen" sendet Antrag und löst E-Mail-Versand aus (`issueTokensAndSendEmails`)
- [x] Validierung: Beleg-Upload ist Pflicht (Formular + Server), mind. eine Rolle ist Pflicht (Zod `min(1)`)
- [x] UND/ODER-Auswahl wird im Formular nur bei mehreren Rollen angezeigt — sinnvolles UX-Verhalten

#### AK-3: E-Mail-Versand (Resend)
- [x] Alle Benutzer mit den ausgewählten Zusatzrollen erhalten eine E-Mail (`loadApprovers` filtert korrekt per OR-Clause)
- [x] E-Mail enthält Bemerkung und Link zum Beleg (Seafile-Share-Link statt Anhang — per AK erlaubt)
- [x] E-Mail enthält Button "Zur Entscheidung" (führt zur öffentlichen Entscheidungsseite mit Genehmigen/Ablehnen)
- [ ] **BUG-2 (Mittel):** Das AK fordert explizit "zwei Buttons: Genehmigen und Nicht genehmigen" in der E-Mail. Die Implementierung bietet jedoch nur EINEN Button ("Zur Entscheidung"), der auf eine Seite mit den beiden Buttons führt. Funktional gleichwertig, aber weicht vom wortgetreuen AK ab und erhöht die Klick-Anzahl für Genehmiger.
- [x] Buttons verlinken auf Token-URLs ohne Login (`/genehmigung/[token]`)
- [x] Tokens sind HMAC-SHA256-signiert, einmalig (Status `verbraucht`), 7 Tage gültig
- [x] Antragsteller erhält nach Abschluss Benachrichtigungs-E-Mail (`sendDecisionNotificationEmail`)

#### AK-4: Genehmigungslogik
- [x] UND: Alle Rollen müssen genehmigen (`evaluateApprovalStatus`, `results.every(r => r === "genehmigt")`)
- [x] UND: Eine Ablehnung einer Rolle → sofort abgelehnt (`results.some(r => r === "abgelehnt")`)
- [x] ODER: Eine Genehmigung reicht → sofort genehmigt
- [x] ODER: Nur abgelehnt, wenn ALLE Rollen ablehnen (`results.every(r => r === "abgelehnt")`)
- [x] Optionaler Kommentar pro Entscheidung (Zod-Schema + DB-Spalte)
- [x] Entscheidung wird mit Zeitstempel, Rolle, Kommentar gespeichert

#### AK-5: Erneute Einreichung
- [ ] **BUG-3 (Hoch):** AK fordert "Abgelehnte Anträge können vom Antragsteller überarbeitet UND erneut eingereicht werden". Der Endpunkt `POST /api/approvals/[id]/resubmit` erlaubt jedoch KEINE Überarbeitung: weder Bemerkung, noch Beleg, noch Rollenauswahl können geändert werden. Es wird ausschließlich der Status zurückgesetzt und neue Tokens generiert. Ein echtes "Überarbeiten" ist nicht umgesetzt.
- [x] Bei erneuter Einreichung werden bisherige Entscheidungen gelöscht (`deleteDecisionsError`)
- [x] Neue Tokens + E-Mail-Versand bei Resubmit (`issueTokensAndSendEmails`)

#### AK-6: Antragsübersicht
- [x] Übersicht zeigt Status Offen/Genehmigt/Abgelehnt (`genehmigungen-tabelle.tsx` mit Status-Filter)
- [x] Sichtbar für alle eingeloggten Benutzer (`GET /api/approvals` prüft nur Login)
- [x] Details: Bemerkung, Beleg-Link, Entscheidungen pro Rolle, Kommentare (Collapsible-Bereich)
- [x] "Erneut einreichen"-Button nur für Admins + nur bei abgelehnten Anträgen sichtbar

### Status der Randfälle

#### RF-1: Keine Benutzer mit gewählter Rolle vorhanden
- [x] Korrekt behandelt — `findMissingRoles` + Fehler "Es gibt keinen Benutzer mit der Rolle ..." vor Seafile-Upload

#### RF-2: Token abgelaufen
- [x] `verifyApprovalToken` prüft `expiresAt < now` und liefert null — Seite zeigt "Link abgelaufen"-Fehlermeldung, Antrag bleibt offen

#### RF-3: Token bereits verwendet (doppelter Klick)
- [x] Korrekt behandelt — GET liefert HTTP 410 mit bisheriger Entscheidung, Frontend zeigt "Bereits entschieden"-Seite

#### RF-4: Mehrere Personen mit gleicher Rolle
- [ ] **BUG-4 (Mittel):** Durch den DB-Constraint `UNIQUE(request_id, approver_role)` kann nur die ERSTE Person pro Rolle entscheiden. Eine zweite Person mit derselben Rolle (z.B. zwei "Vorstand"-Mitglieder) erhält bei Klick den Fehler "Du hast bereits entschieden" — obwohl SIE persönlich noch nicht entschieden hat. Die Fehlermeldung ist irreführend. Besser: "Ein anderes Vorstandsmitglied hat bereits entschieden."
- [x] Nach Entscheidung der ersten Person werden alle anderen Tokens derselben Rolle als "verbraucht" markiert (Z. 267-272 in `decide/[token]/route.ts`) — konsistent mit dem Constraint, aber der Logik nach "eine Person pro Rolle entscheidet pro Antrag" und nicht "mindestens eine Person pro Rolle" wie im AK-Text formuliert.

#### RF-5: Genehmiger-Rolle wird entzogen während Antrag offen ist
- [ ] **BUG-5 (Mittel):** Nicht umgesetzt. Wird einem Benutzer nach Antragserstellung die Rolle entzogen, bleibt sein Token dennoch aktiv und gültig (nur `expires_at` und HMAC werden geprüft, nicht die aktuelle Rollenzugehörigkeit). Der Benutzer kann weiterhin entscheiden. Das AK fordert: "Offene Tokens werden ungültig."

#### RF-6: Seafile nicht erreichbar
- [x] Try/Catch um `uploadToSeafile`, Rückgabe HTTP 502 mit klarer Fehlermeldung

#### RF-7: E-Mail-Versand schlägt fehl (Resend)
- [ ] **BUG-6 (Mittel):** Teilweise behandelt. Der Antrag wird NICHT als "Entwurf" gespeichert, wie vom AK gefordert. Stattdessen bleibt er auf Status "offen", wenn das E-Mail-Versenden scheitert — dabei wird die Fehlermeldung "Der Antrag wurde gespeichert, aber die Genehmiger konnten nicht benachrichtigt werden" zurückgegeben, es existiert jedoch kein UI-Pfad zum erneuten Versenden. Einzelne Mail-Fehler innerhalb von `issueTokensAndSendEmails` werden nur als `failed`-Zähler ignoriert.

#### RF-8: Beleg mit unerlaubtem Dateityp
- [x] Client-seitig (`validateApprovalFile`) und server-seitig (`ALLOWED_MIME_TYPES.has(file.type)`) geprüft
- [ ] **BUG-7 (Niedrig):** Die Server-Validierung prüft nur `file.type` (Client-gemeldeter MIME-Type), nicht den echten Dateiinhalt (Magic-Bytes). Ein Angreifer kann eine `.exe` als `application/pdf` hochladen. Das AK fordert explizit "MIME-Type-Prüfung (nicht nur Extension)" — die aktuelle Prüfung ist jedoch im Grunde ein vom Client deklarierter Header und somit eigentlich NICHT echter MIME-Type.

### Sicherheitsaudit-Ergebnisse (Red Team)

- [x] **Authentifizierung:** `POST /api/admin/approvals`, `GET /api/approvals`, `GET /api/approvals/[id]`, `POST /api/approvals/[id]/resubmit` prüfen Login/Admin-Rolle. Public-Endpunkt `/api/approvals/decide/[token]` nutzt HMAC-Token als Auth-Mechanismus.
- [x] **Autorisierung:** RLS auf `approval_requests` mit Admin-Checks für Insert/Update/Delete. Public-Endpunkte nutzen ausschließlich Service-Role-Client.
- [x] **HMAC-Signatur:** `timingSafeEqual` verhindert Timing-Attacks auf Signatur-Vergleich.
- [x] **Token-Secret:** Aus `APPROVAL_TOKEN_SECRET` Umgebungsvariable geladen, Fehler bei fehlender Konfiguration.
- [x] **XSS in E-Mails:** `escapeHtml()` auf `note`, `requesterEmail`, `documentName`, `recipientRoleLabel` angewendet.
- [ ] **BUG-8 (Mittel, Sicherheit):** XSS-Lücke in E-Mail — `documentUrl` wird in `approval-emails.ts` (Z. 109) DIREKT in `href` und wird NICHT escapet oder validiert. Falls der Seafile-Share-Link ein `"`-Zeichen oder `javascript:` enthält (z.B. durch Seafile-Bug, manipulierten Share oder zukünftige Code-Änderung), kann HTML-/URL-Injection entstehen. `buildDecisionUrl`-Token enthält zwar nur base64url-Zeichen, `documentUrl` ist jedoch untrusted.
- [ ] **BUG-9 (Hoch, Sicherheit):** Kein Rate-Limiting auf `/api/approvals/decide/[token]` (GET + POST). Obwohl `src/lib/rate-limit.ts` existiert (von PROJ-11 genutzt), wird es in diesem Endpunkt NICHT eingesetzt. Ein Angreifer kann unbegrenzt Token-Varianten raten. Die HMAC-Sicherheit reduziert das Risiko stark, aber Best Practice und Absicherung gegen Bugs fehlen.
- [ ] **BUG-10 (Mittel, Sicherheit):** Kein Rate-Limiting auf `POST /api/admin/approvals` (Dateiupload). Ein kompromittierter Admin-Account kann Seafile und Resend-Quote mit unbegrenzten Anträgen und E-Mails spammen.
- [ ] **BUG-11 (Niedrig, Sicherheit):** `document_name` wird direkt aus `file.name` (Client-kontrolliert) in die DB geschrieben, ohne Sanitizing. Angezeigt wird er in der Übersicht und E-Mails. Obwohl XSS in HTML durch escapeHtml/React verhindert wird, sind Pfad-Traversal-Zeichen (`..\`, `/`) oder sehr lange Strings möglich.
- [ ] **BUG-12 (Niedrig, Sicherheit):** Kein Protokoll-Check auf `documentUrl`. Theoretisch kann eine Seafile-Manipulation `javascript:`-URLs liefern, die dann als E-Mail-Link klickbar wären.
- [x] **CSRF auf öffentlichem POST:** Risiko minimal, da Token-Wert in URL steht und Angreifer das Token nicht kennt.
- [x] **Security-Header:** X-Frame-Options DENY für `/genehmigung/*`, HSTS, X-Content-Type-Options aktiv.
- [x] **SQL-Injection:** Nur Supabase-Parameter-Queries verwendet — sicher.
- [x] **Eingabe-Validierung:** Zod auf allen Eingaben. Beleg-Größe (10 MB) + leere Dateien geprüft.

### Regressionstests (bestehende Features)
- [x] **PROJ-2 Benutzerverwaltung:** Einlade-Schema erweitert um `ist_vorstand`/`ist_zweiter_vorstand` — bestehende Felder unberührt.
- [x] **PROJ-7 Feature-Berechtigungen:** `hasPermission`-Logik unverändert, keine Konflikte mit neuen Rollen.
- [x] **PROJ-9 Seafile:** Neue Belege werden in separaten Pfad `/Förderverein/Genehmigungen/` hochgeladen, keine Kollision mit Kontoauszug-Belegen.
- [x] **PROJ-11 Kostenübernahme:** Nutzt bereits Resend — Konfigurationen bleiben konsistent.

### Gefundene Bugs (Zusammenfassung)

#### BUG-1: Menüpunkt "Genehmigungen" für alle Benutzer sichtbar
- **Schweregrad:** Mittel
- **Reproduktion:** Als Betrachter einloggen → Benutzermenü öffnen → "Genehmigungen" ist sichtbar.
- **Erwartet (laut AK):** Nur Admins sehen den Menüpunkt.
- **Tatsächlich:** Alle eingeloggten Benutzer sehen ihn.
- **Anmerkung:** AK ist widersprüchlich (siehe AK-6 "Sichtbar für alle"). Klärung mit PO nötig.
- **Priorität:** Vor Deployment klären.

#### BUG-2: E-Mail enthält nur EINEN Button statt zwei
- **Schweregrad:** Mittel (UX/AK-Konformität)
- **Erwartet:** "Genehmigen" + "Nicht genehmigen" direkt in der E-Mail.
- **Tatsächlich:** Ein Button "Zur Entscheidung" führt auf eine Seite mit beiden Optionen.
- **Priorität:** Nachbessern oder mit PO entscheiden.

#### BUG-3: Resubmit erlaubt keine Überarbeitung
- **Schweregrad:** Hoch
- **Erwartet:** Antragsteller kann Bemerkung und/oder Beleg beim Resubmit überarbeiten.
- **Tatsächlich:** Der Endpunkt setzt nur Status zurück und generiert neue Tokens — keine Überarbeitungsmöglichkeit.
- **Priorität:** Vor Deployment beheben.

#### BUG-4: Irreführende Fehlermeldung bei Mehrfach-Genehmigern
- **Schweregrad:** Mittel
- **Reproduktion:** Zwei Benutzer mit Rolle "Vorstand". Beide erhalten Token-Mail. Person A entscheidet. Person B klickt Link.
- **Erwartet:** Klare Nachricht "Ein anderer Vorstand hat bereits entschieden".
- **Tatsächlich:** "Du hast bereits entschieden" — faktisch falsch, da Person B nie entschieden hat.
- **Priorität:** Nachbessern.

#### BUG-5: Entzogene Rolle invalidiert Tokens nicht
- **Schweregrad:** Mittel (Sicherheit/Compliance)
- **Reproduktion:** Antrag an Benutzer X (Vorstand) stellen → Rolle entziehen → X klickt Token-Link → Entscheidung wird akzeptiert.
- **Erwartet:** Token wird ungültig.
- **Tatsächlich:** Token bleibt gültig (nur Ablauf + HMAC werden geprüft).
- **Priorität:** Vor Deployment beheben.

#### BUG-6: Kein Entwurf bei E-Mail-Versand-Fehler
- **Schweregrad:** Mittel
- **Erwartet:** Antrag wird als "Entwurf" gespeichert, wenn E-Mail-Versand scheitert — UI erlaubt erneutes Versenden.
- **Tatsächlich:** Antrag bleibt "offen" ohne UI-Retry. Fehlermeldung landet nur in Server-Logs.
- **Priorität:** Vor Deployment beheben.

#### BUG-7: MIME-Type-Validierung nur anhand Client-Header
- **Schweregrad:** Niedrig (Sicherheit)
- **Erwartet:** Serverseitige Magic-Bytes-/Content-Sniffing-Prüfung.
- **Tatsächlich:** Nur `file.type` geprüft — vom Client manipulierbar.
- **Priorität:** Im nächsten Sprint beheben.

#### BUG-8: Ungeprüfte documentUrl im E-Mail-HTML
- **Schweregrad:** Mittel (Sicherheit)
- **Reproduktion:** Falls eine `documentUrl` ein `"`-Zeichen enthielte, wäre HTML-Injection im E-Mail-Body möglich.
- **Erwartet:** URL-Validierung (`https://...`) + HTML-Escaping des href-Wertes.
- **Priorität:** Vor Deployment beheben (Defense in Depth).

#### BUG-9: Kein Rate-Limiting auf öffentlichem Token-Endpunkt
- **Schweregrad:** Hoch (Sicherheit)
- **Reproduktion:** `POST /api/approvals/decide/<beliebiges_Token>` unbegrenzt aufrufen.
- **Erwartet:** Rate-Limit pro IP (z.B. 20 Requests/Minute).
- **Tatsächlich:** Keinerlei Begrenzung. Token-Brute-Force ist theoretisch unbegrenzt.
- **Priorität:** Vor Deployment beheben.

#### BUG-10: Kein Rate-Limiting auf Antrags-POST
- **Schweregrad:** Mittel (Sicherheit)
- **Erwartet:** Admin-Endpunkt mit Mail-Versand sollte begrenzt sein (z.B. 10 pro Stunde).
- **Tatsächlich:** Keinerlei Begrenzung.
- **Priorität:** Im nächsten Sprint beheben.

#### BUG-11: document_name nicht sanitiziert in DB
- **Schweregrad:** Niedrig
- **Erwartet:** Sanitize oder Längenlimit auf gespeichertem Namen.
- **Tatsächlich:** Roher `file.name` wird persistiert.
- **Priorität:** Wäre schön.

#### BUG-12: Kein Protokoll-Check auf documentUrl
- **Schweregrad:** Niedrig (Sicherheit)
- **Erwartet:** Prüfen dass URL mit `https://` beginnt, bevor sie in E-Mail/UI-Links landet.
- **Priorität:** Wäre schön.

### Zusammenfassung

- **Akzeptanzkriterien:** ~26/31 bestanden (AK-2 Menüpunkt, AK-3 Buttons, AK-5 Überarbeitung, teilweise AK-4/RF-4 = 5 Abweichungen)
- **Gefundene Bugs:** 12 gesamt
  - **Kritisch:** 0
  - **Hoch:** 2 (BUG-3 Resubmit-Überarbeitung, BUG-9 fehlendes Rate-Limiting)
  - **Mittel:** 6 (BUG-1, BUG-2, BUG-4, BUG-5, BUG-6, BUG-8, BUG-10)
  - **Niedrig:** 3 (BUG-7, BUG-11, BUG-12)
- **Sicherheit:** Grundsätzlich solide (HMAC, RLS, Zod, Escape), aber fehlendes Rate-Limiting auf öffentlichem Token-Endpunkt und ungeprüfte documentUrl in E-Mails sind verbesserungswürdig.
- **Produktionsreif:** **NEIN**
- **Empfehlung:** Zuerst BUG-3, BUG-5, BUG-6, BUG-8, BUG-9 beheben (oder BUG-1 mit PO klären), danach BUG-2, BUG-4, BUG-10 nachziehen. Die Niedrig-Bugs können im Folge-Sprint erledigt werden.

## Deployment
_Wird von /deploy hinzugefügt_
