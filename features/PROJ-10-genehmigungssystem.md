# PROJ-10: Genehmigungssystem für Vereinsanträge

## Status: Geplant
**Erstellt:** 2026-04-10
**Zuletzt aktualisiert:** 2026-04-10

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
_Wird von /architecture hinzugefügt_

## QA-Testergebnisse
_Wird von /qa hinzugefügt_

## Deployment
_Wird von /deploy hinzugefügt_
