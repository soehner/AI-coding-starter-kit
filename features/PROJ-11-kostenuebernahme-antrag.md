# PROJ-11: Kostenübernahme-Antrag (iFrame-Formular)

## Status: Geplant
**Erstellt:** 2026-04-11
**Zuletzt aktualisiert:** 2026-04-11

## Abhängigkeiten
- Benötigt: PROJ-1 (Authentifizierung) – Kassier-Account muss existieren
- Benötigt: PROJ-2 (Benutzerverwaltung) – Rollen "1. Vorsitzender", "2. Vorsitzender" und "Kassier/Admin" müssen zugewiesen sein
- Unabhängig von: PROJ-10 (wird als separates Feature parallel entwickelt)

## Übersicht

Vereinsmitglieder können ohne Login einen Kostenübernahme-Antrag stellen. Das Formular ist als öffentliche Seite verfügbar und kann per iFrame in beliebige externe Websites (z.B. Vereinswebseite) eingebettet werden. Nach dem Absenden erhalten der 1. Vorsitzende, der 2. Vorsitzende und der Kassier (Admin) je eine E-Mail mit der Möglichkeit, den Antrag per Button-Klick zu genehmigen oder abzulehnen – ohne Login. Es gilt das **Mehrheitsprinzip (2 von 3)**: Sobald zwei übereinstimmende Entscheidungen vorliegen, steht das Ergebnis fest. Alle Beteiligten werden über die Entscheidung informiert. Der Antragsteller erhält abschließend eine E-Mail mit der Entscheidung und einer Zusammenfassung der Abstimmung.

---

## User Stories

### Antragstellung (öffentliches Formular)
- Als Vereinsmitglied möchte ich einen Kostenübernahme-Antrag ohne Login ausfüllen und absenden können, damit ich unkompliziert eine Förderanfrage stellen kann.
- Als Vereinsmitglied möchte ich meine persönlichen Kontaktdaten (Vorname, Nachname, E-Mail) angeben, damit der Verein mich kontaktieren kann.
- Als Vereinsmitglied möchte ich den gewünschten Betrag in Euro und einen Verwendungszweck angeben, damit der Vorstand die Anfrage bewerten kann.
- Als Vereinsmitglied möchte ich nach dem Absenden eine Bestätigungsseite sehen, damit ich weiß, dass mein Antrag erfolgreich eingereicht wurde.
- Als Vereinsmitglied möchte ich per E-Mail über die finale Entscheidung informiert werden, damit ich zeitnah reagieren kann.

### iFrame-Einbettung
- Als Webseitenbetreiber (CBS-Mannheim) möchte ich das Antragsformular per iFrame in unsere Vereinswebseite einbetten, damit Mitglieder den Antrag direkt auf der Vereinsseite stellen können.
- Als Webseitenbetreiber möchte ich, dass das Formular im iFrame responsiv dargestellt wird und sich an verschiedene Breiten anpasst, damit es auf Desktop und Mobile korrekt aussieht.

### Abstimmung (Genehmiger, ohne Login)
- Als 1. Vorsitzender, 2. Vorsitzender oder Kassier möchte ich eine E-Mail mit den Antragsdetails erhalten, damit ich den Antrag prüfen kann.
- Als Genehmiger möchte ich in der E-Mail direkt auf "Genehmigen" oder "Ablehnen" klicken können (ohne Login), damit die Abstimmung schnell und einfach ist.
- Als Genehmiger möchte ich nach meiner Entscheidung eine Bestätigungsseite sehen, damit ich weiß, dass meine Stimme erfasst wurde.
- Als Genehmiger möchte ich informiert werden, sobald eine endgültige Entscheidung gefallen ist (Mehrheit erreicht), damit ich den Ausgang kenne.

### Benachrichtigungen & Zusammenfassung
- Als Genehmiger möchte ich benachrichtigt werden, wenn ein anderer Genehmiger bereits abgestimmt hat, damit ich den aktuellen Abstimmungsstand kenne.
- Als Antragsteller möchte ich eine abschließende E-Mail mit der Entscheidung (genehmigt/abgelehnt), dem Abstimmungsergebnis aller drei Personen und einem kurzen Hinweis zum weiteren Vorgehen erhalten.

---

## Akzeptanzkriterien

### Öffentliches Antragsformular
- [ ] Das Formular ist unter einer öffentlichen URL erreichbar (z.B. `/antrag/kostenuebernahme`) – kein Login erforderlich
- [ ] Das Formular enthält folgende **Pflichtfelder**: Vorname, Nachname, E-Mail-Adresse, Betrag (in Euro, Zahlenfeld), Verwendungszweck (Freitext)
- [ ] Alle Felder werden client- und serverseitig validiert (Zod)
- [ ] E-Mail-Format wird validiert
- [ ] Betrag muss eine positive Zahl > 0 sein
- [ ] Nach erfolgreichem Absenden wird eine Bestätigungsmeldung angezeigt ("Ihr Antrag wurde erfolgreich eingereicht")
- [ ] Das Formular setzt sich nach dem Absenden zurück (oder zeigt nur die Bestätigungsmeldung)

### iFrame-Kompatibilität
- [ ] Die Seite erlaubt iFrame-Einbettung (keine X-Frame-Options: DENY – stattdessen SAMEORIGIN oder spezifische Allowlist)
- [ ] Das Formular ist vollständig responsiv (320px bis 1440px Breite)
- [ ] Keine Login-Redirects oder Auth-Checks auf dieser Route
- [ ] Die Seite hat ein schlankes Layout (kein App-Header/Sidebar), das für iFrame-Einbettung optimiert ist

### E-Mail-Versand an Genehmiger
- [ ] Nach dem Absenden erhalten **alle drei** Genehmiger (1. Vorsitzender, 2. Vorsitzender, Kassier) eine E-Mail
- [ ] Die E-Mail enthält: Name des Antragstellers, Betrag, Verwendungszweck, Datum des Antrags
- [ ] Die E-Mail enthält zwei Buttons: "Genehmigen" und "Ablehnen"
- [ ] Jeder Button verlinkt auf eine einmalig verwendbare, token-basierte URL (kein Login nötig)
- [ ] Tokens sind HMAC-signiert, einmalig verwendbar und 14 Tage gültig

### Abstimmungslogik (Mehrheitsprinzip 2 von 3)
- [ ] Jeder Genehmiger kann genau einmal abstimmen (Token wird nach Nutzung als verbraucht markiert)
- [ ] Das System prüft nach jeder Abstimmung, ob die Mehrheit (2 von 3) erreicht ist
- [ ] Sobald 2 Genehmiger identisch abgestimmt haben (beide genehmigt oder beide abgelehnt), steht die Entscheidung fest – ohne auf die 3. Stimme zu warten
- [ ] Die Entscheidung wird mit Zeitstempel und Person im Antrag gespeichert

### Benachrichtigungen nach Abstimmung
- [ ] Nach jeder Abstimmung erhalten die **anderen beiden** Genehmiger eine Benachrichtigungs-E-Mail: "Person X hat [genehmigt/abgelehnt]. Aktueller Stand: Y von 3 Stimmen."
- [ ] Sobald die Mehrheit feststeht, erhalten alle drei Genehmiger eine Abschluss-E-Mail mit dem Ergebnis und der Zusammenfassung aller Stimmen
- [ ] Der Antragsteller erhält eine Abschluss-E-Mail mit: Entscheidung (genehmigt/abgelehnt), Abstimmungsübersicht (wer hat wie abgestimmt), Hinweis zum weiteren Vorgehen
- [ ] Wenn alle drei abgestimmt haben (ohne vorherige Mehrheit), wird das Ergebnis mit der 3. Stimme finalisiert

### Antrags-Datenbank
- [ ] Anträge werden in der Datenbank gespeichert (Tabelle `cost_requests`)
- [ ] Jeder Antrag hat einen Status: `offen`, `genehmigt`, `abgelehnt`
- [ ] Einzelne Abstimmungen werden pro Genehmiger gespeichert (Tabelle `cost_request_votes`)
- [ ] RLS: Anträge sind nur für eingeloggte Admins einsehbar (in der App); der Antragsteller hat keinen App-Zugang

---

## Randfälle

- **Doppelter Klick auf Token-Link:** Seite zeigt "Sie haben bereits abgestimmt" mit der gespeicherten Entscheidung – keine doppelte Stimme möglich
- **Token abgelaufen (nach 14 Tagen):** Freundliche Fehlerseite "Dieser Link ist abgelaufen. Bitte kontaktieren Sie den Kassier direkt." – Antrag bleibt im Status `offen`
- **Mehrheit bereits erreicht, aber dritter Genehmiger klickt dennoch:** Seite zeigt "Die Entscheidung wurde bereits getroffen" – Token wird als ungültig markiert, keine Stimme wird gezählt
- **E-Mail-Versand schlägt fehl (Resend-Fehler):** Antrag wird trotzdem in der Datenbank gespeichert; Fehlermeldung in der Admin-Übersicht; Retry-Möglichkeit für Admin
- **Ungültige E-Mail-Adresse des Antragstellers:** Validierungsfehler im Formular – Antrag kann nicht abgesendet werden
- **Betrag = 0 oder negativ:** Client- und serverseitige Validierung – Fehlermeldung "Bitte geben Sie einen Betrag größer als 0 Euro ein"
- **Spam/Mehrfachabsendung:** Rate-Limiting auf der API-Route (z.B. max. 3 Anträge pro E-Mail-Adresse pro Stunde)
- **Genehmiger-E-Mail-Adresse nicht konfiguriert:** Beim Absenden des Antrags wird geprüft, ob alle drei Genehmiger in der Benutzerverwaltung hinterlegt und mit den richtigen Rollen versehen sind; falls nicht, Fehlermeldung im Formular
- **XSS im Freitextfeld:** Alle Eingaben werden serverseitig bereinigt, bevor sie in E-Mails oder in die Datenbank geschrieben werden

---

## Technische Anforderungen

### Neue Route
- `GET/POST /antrag/kostenuebernahme` – Öffentliche iFrame-Seite (kein Auth-Middleware)
- `POST /api/cost-requests` – Antrag einreichen (öffentlich, Rate-Limiting)
- `GET /api/cost-requests/vote?token=...` – Abstimmungstoken validieren und Entscheidungsseite anzeigen
- `POST /api/cost-requests/vote` – Abstimmung speichern (token-basiert, kein Login)

### E-Mail-Dienst
- **Resend** (bereits in PROJ-10 eingeplant): Transaktionale E-Mails für Genehmigungsanfrage, Abstimmungsbenachrichtigungen und Abschlusszusammenfassung

### Sicherheit
- iFrame-Header: `Content-Security-Policy: frame-ancestors 'self' https://cbs-mannheim.de` (Allowlist)
- Token-Signierung: HMAC-SHA256 mit `APPROVAL_TOKEN_SECRET`
- Tokens: einmalig verwendbar, 14 Tage Gültigkeitsdauer
- Rate-Limiting: max. 3 Anträge pro IP/Stunde auf `POST /api/cost-requests`
- Input-Sanitization: Alle Freitexte werden vor Datenbankschreibung bereinigt

### Umgebungsvariablen (neu/geteilt mit PROJ-10)
- `RESEND_API_KEY` – API-Key für E-Mail-Versand (geteilt mit PROJ-10)
- `RESEND_FROM_EMAIL` – Absender-E-Mail-Adresse
- `APPROVAL_TOKEN_SECRET` – Secret für Token-Signierung (geteilt mit PROJ-10)
- `IFRAME_ALLOWED_ORIGINS` – Kommagetrennte Liste erlaubter iFrame-Origins (z.B. `https://cbs-mannheim.de`)

---
<!-- Abschnitte unten werden von nachfolgenden Skills hinzugefügt -->

## Technisches Design (Solution Architect)

### Seitenstruktur
```
Öffentlicher Bereich (kein Login, iFrame-tauglich)
├── /antrag/kostenuebernahme        ← Schlankes Layout (kein Header)
│   └── KostenuebernahmeFormular
│       ├── Eingabefelder (Vorname, Nachname, E-Mail, Betrag, Verwendungszweck)
│       ├── Absenden-Button
│       └── AntragsBestaetigung (Erfolgsmeldung)
└── /abstimmung/[token]             ← Abstimmungsseite für Genehmiger
    └── AbstimmungsSeite
        ├── Antragsdetails + aktueller Abstimmungsstand
        ├── Buttons: Genehmigen / Ablehnen
        └── AbstimmungsBestaetigung

Geschützter Bereich
└── /dashboard/admin/kostenuebernahmen
    └── KostenuebernahmenTabelle (alle Anträge + Status + E-Mail-Retry)
```

### Datenmodell
- **cost_requests:** ID, Vorname, Nachname, E-Mail, Betrag (Cent), Verwendungszweck, Status (offen/genehmigt/abgelehnt), E-Mail-Status, Zeitstempel
- **cost_request_votes:** ID, cost_request_id, Rolle, Entscheidung, Zeitstempel, Token-Hash
- **Tokens:** HMAC-SHA256-signiert, einmalig verwendbar, 14 Tage gültig

### Datenfluss
1. Mitglied füllt Formular → API prüft Rate-Limit + Genehmiger → DB-Speicherung → 3 Token erzeugt → 3 E-Mails via Resend
2. Genehmiger klickt Link → Token-Prüfung → Abstimmungsseite → Stimme speichern → Mehrheitsprüfung
3. Bei Mehrheit (2/3): Antrag finalisiert → Abschluss-E-Mails an alle + Antragsteller

### Neue Dateien
- `src/app/(public)/layout.tsx` – Schlankes iFrame-Layout
- `src/app/(public)/antrag/kostenuebernahme/page.tsx`
- `src/app/(public)/abstimmung/[token]/page.tsx`
- `src/app/api/cost-requests/route.ts` – POST: Antrag einreichen
- `src/app/api/cost-requests/vote/route.ts` – GET+POST: Abstimmen
- `src/app/dashboard/admin/kostenuebernahmen/page.tsx`
- `src/components/kostenuebernahme-formular.tsx`
- `src/components/abstimmungs-seite.tsx`
- `src/components/kostenuebernahmen-tabelle.tsx`
- `src/lib/cost-request-token.ts` – HMAC-Token-Logik

### Abhängigkeit
- `resend` – E-Mail-Versand (geteilt mit PROJ-10)

## QA-Testergebnisse
_Wird von /qa hinzugefügt_

## Deployment
_Wird von /deploy hinzugefügt_
