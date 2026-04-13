# PROJ-16: Direkter Bankabruf (PSD2) mit PDF-Abgleich

## Status: In Review
**Erstellt:** 2026-04-13
**Zuletzt aktualisiert:** 2026-04-13

## Abhängigkeiten
- Benötigt: PROJ-1 (Authentifizierung) — Admin-Rolle für Bankzugang-Konfiguration
- Benötigt: PROJ-3 (PDF-Kontoauszug-Upload & Parsing) — Abgleichpartner für PSD2-Daten
- Benötigt: PROJ-4 (Bankbewegungen-Dashboard) — Anzeige der abgerufenen Umsätze
- Benötigt: PROJ-7 (Feature-Berechtigungen) — Steuerung, wer den Bankabruf sehen/auslösen darf
- Erweitert: Datenmodell von PROJ-3 um Herkunfts- und Matching-Felder

## Kontext
Aktuell werden Umsätze ausschließlich per PDF-Kontoauszug-Upload in CBS-Finanz importiert (PROJ-3). Dieses Feature ergänzt einen **täglichen automatischen Abruf** direkt bei der Badischen Beamtenbank (BBBank) über die **PSD2-API von GoCardless Bank Account Data**. Die abgerufenen Umsätze werden mit später hochgeladenen PDF-Kontoauszügen abgeglichen, sodass keine Duplikate entstehen und Abweichungen sichtbar werden.

Ziel ist **nicht**, den PDF-Import abzulösen — das offizielle Bankdokument bleibt Source of Truth — sondern einen Frühindikator über aktuelle Kontobewegungen zu bieten und Lücken zwischen Auszügen zu schließen.

## User Stories

- Als **Kassenwart** möchte ich den Bankzugang der BBBank einmalig in den Einstellungen verbinden, damit CBS-Finanz meine Umsätze automatisch abrufen kann.
- Als **Kassenwart** möchte ich täglich die neuesten Kontobewegungen im Dashboard sehen, ohne auf den Monatsauszug warten zu müssen.
- Als **Kassenwart** möchte ich, dass beim Hochladen eines PDF-Kontoauszugs die bereits per PSD2 importierten Umsätze automatisch als "bestätigt" markiert werden, damit keine Duplikate entstehen.
- Als **Kassenwart** möchte ich rechtzeitig (7 Tage vorher) per E-Mail erinnert werden, bevor die PSD2-Zustimmung abläuft, damit ich die Erneuerung planen kann.
- Als **Kassenwart** möchte ich bei Abweichungen zwischen PDF und PSD2 eine Warnung im Dashboard sehen, damit ich fehlerhafte Buchungen erkennen kann.
- Als **Betrachter** möchte ich den aktuellen Kontostand auch zwischen zwei Kontoauszügen jederzeit aktuell sehen können.

## Akzeptanzkriterien

### Verbindung einrichten
- [ ] In den Einstellungen gibt es einen neuen Bereich "Bankzugang (PSD2)"
- [ ] Nur Benutzer mit Admin-Rolle können den Bankzugang konfigurieren
- [ ] Der Kassenwart kann über einen Button "Bankzugang verbinden" den GoCardless-Consent-Flow starten
- [ ] Nach erfolgreicher SecureGo-plus-Freigabe wird der Status "Verbunden bis TT.MM.JJJJ" angezeigt
- [ ] Der Kassenwart kann den Bankzugang jederzeit manuell trennen (Button "Verbindung aufheben")

### Automatischer Abruf
- [ ] Ein Vercel Cron Job läuft täglich um 06:00 Uhr (Europe/Berlin)
- [ ] Der Cron ruft alle Umsätze seit dem letzten erfolgreichen Abruf ab (initial: letzte 90 Tage)
- [ ] Neue Umsätze werden in die Tabelle `bank_umsaetze` geschrieben (siehe Datenmodell-Erweiterung)
- [ ] Jeder Umsatz erhält einen deterministischen `matching_hash` aus Buchungsdatum, Betrag, Gegenseite-IBAN und normalisiertem Verwendungszweck
- [ ] Bei Duplikaten (gleicher Hash) wird kein neuer Eintrag angelegt (UPSERT)
- [ ] Der Zeitpunkt des letzten erfolgreichen Abrufs wird persistiert und im Dashboard sichtbar gemacht
- [ ] Fehler beim Abruf werden geloggt und im Admin-Dashboard als Warnung angezeigt

### PDF-Abgleich
- [ ] Beim PDF-Import (PROJ-3) wird für jeden geparsten Eintrag der `matching_hash` berechnet
- [ ] Bei Hash-Match wird der bestehende PSD2-Eintrag aktualisiert: `quelle = 'beide'`, `status = 'bestaetigt'`, `pdf_import_id` gesetzt
- [ ] Bei fehlendem Hash-Match wird eine Fuzzy-Suche durchgeführt: **Datum ±1 Tag AND Betrag exakt AND IBAN exakt**
- [ ] Bei Fuzzy-Match wird der Eintrag als `status = 'vorschlag'` markiert und dem Kassenwart zur manuellen Bestätigung angezeigt
- [ ] Bei keinem Match wird der PDF-Eintrag als `quelle = 'pdf'`, `status = 'nur_pdf'` angelegt
- [ ] Bei Konflikt (PDF hat Eintrag, der im PSD2-Zeitraum fehlt, oder umgekehrt) → Status `konflikt`
- [ ] Bei Datenabweichung zwischen PDF und PSD2 gewinnt das PDF als Source of Truth (überschreibt PSD2-Felder)

### Status-Anzeige im Dashboard
- [ ] Die Bankbewegungen-Tabelle (PROJ-4) erhält eine neue Spalte "Quelle" mit Badges:
  - `PSD2` (gelb, nur_psd2)
  - `PDF` (blau, nur_pdf)
  - `✓ Bestätigt` (grün, beide)
  - `? Vorschlag` (orange, vorschlag)
  - `⚠ Konflikt` (rot, konflikt)
- [ ] Ein Filter "Nur unbestätigte anzeigen" blendet bestätigte Einträge aus
- [ ] Bei Klick auf `? Vorschlag` öffnet sich ein Dialog mit "Als identisch bestätigen" oder "Als separate Einträge behandeln"
- [ ] Bei Klick auf `⚠ Konflikt` werden beide Datenquellen nebeneinander angezeigt

### Consent-Renewal (90 Tage)
- [ ] 7 Tage vor Ablauf der Zustimmung wird automatisch eine E-Mail an alle Admin-Benutzer verschickt
- [ ] Parallel erscheint im Dashboard ein persistentes Banner "Bankzugang läuft in X Tagen ab — jetzt erneuern"
- [ ] Das Banner bleibt sichtbar, bis die Erneuerung abgeschlossen ist
- [ ] Nach Ablauf wird der automatische Abruf pausiert (keine Fehler-Spam-Mails)

### Kontostand
- [ ] Der im Dashboard angezeigte Kontostand berücksichtigt alle Einträge mit Status `bestaetigt`, `nur_pdf` **und** `nur_psd2`
- [ ] `vorschlag`- und `konflikt`-Einträge fließen ebenfalls in den Kontostand ein, werden aber visuell markiert

## Randfälle

- **Was passiert, wenn die PSD2-Zustimmung abgelaufen ist?**
  → Cron pausiert den Abruf, Banner und E-Mail fordern zur Erneuerung auf, Dashboard zeigt "Letzter Abruf: TT.MM.JJJJ" mit Warnung.

- **Was passiert, wenn GoCardless ausfällt oder Ratelimits greifen?**
  → Fehler wird geloggt, nächster Cron-Lauf versucht es erneut, keine Benutzerbenachrichtigung vor dem dritten Fehlschlag.

- **Was passiert, wenn ein Verwendungszweck im PDF abgekürzt ist?**
  → Hash-Match scheitert, Fuzzy-Match (Datum ±1 Tag + Betrag + IBAN) greift, Kassenwart bestätigt manuell.

- **Was passiert bei Storno-Buchungen (negative Gegenbuchung)?**
  → Storno wird als eigenständiger Umsatz mit separatem Hash behandelt, nicht mit dem Original verrechnet.

- **Was passiert bei Buchungsdatum vs. Wertstellung?**
  → Hash verwendet immer das **Buchungsdatum** (Bankseite); Wertstellung wird optional gespeichert, geht aber nicht in den Hash ein.

- **Was passiert, wenn ein PDF einen Zeitraum vor der PSD2-Aktivierung abdeckt?**
  → Einträge werden als `nur_pdf` angelegt, kein Konflikt, kein Vorschlag.

- **Was passiert, wenn zwei unterschiedliche Umsätze am selben Tag denselben Betrag und dieselbe IBAN haben (z. B. zwei Spenden desselben Mitglieds)?**
  → Der Verwendungszweck unterscheidet sie im Hash; falls auch dieser identisch ist, werden sie korrekt als ein Umsatz gemerged (selten, aber unkritisch).

- **Was passiert, wenn der Kassenwart den Bankzugang manuell trennt?**
  → Bereits importierte PSD2-Daten bleiben erhalten, Cron wird deaktiviert, keine weiteren Abrufe.

- **Was passiert bei einem Konflikt zwischen PDF und PSD2 (gleicher Umsatz, abweichender Betrag)?**
  → PDF gewinnt und überschreibt die PSD2-Felder; der alte PSD2-Wert wird in einem Audit-Log-Feld `psd2_original_data` (JSONB) gesichert.

- **Was passiert, wenn der initiale Abruf (90 Tage) mit bereits importierten PDF-Daten kollidiert?**
  → Migration-Script berechnet einmalig Matching-Hashes für alle bestehenden PROJ-3-Umsätze, danach normaler Abgleich.

- **Was passiert, wenn der Kassenwart den Vorschlag "Als separate Einträge behandeln" wählt?**
  → Der PSD2- und der PDF-Eintrag bleiben getrennt, beide bekommen Status `nur_psd2` bzw. `nur_pdf`, Fuzzy-Match wird für dieses Paar blockiert.

## Technische Anforderungen

### Sicherheit
- GoCardless API-Credentials werden als Environment-Variablen gespeichert (`GOCARDLESS_SECRET_ID`, `GOCARDLESS_SECRET_KEY`)
- Consent-Token wird verschlüsselt in Supabase gespeichert (nicht im Frontend zugänglich)
- Cron-Endpoint ist durch `CRON_SECRET` geschützt (Vercel-Standard)
- Nur Admin-Rolle darf Bankzugang konfigurieren oder manuell abrufen
- Alle PSD2-Aktionen werden im Audit-Log festgehalten (Einrichtung, Erneuerung, Trennung)

### Performance
- Täglicher Abruf < 30 Sekunden für bis zu 500 Umsätze
- Fuzzy-Match-Query mit Index auf `(buchungsdatum, betrag_cent, iban_gegenseite)`
- Unique-Index auf `matching_hash` verhindert Duplikate auf DB-Ebene

### Datenmodell (Erweiterung zu PROJ-3)
Die bestehende `bank_umsaetze`-Tabelle (aus PROJ-3) erhält neue Spalten:
- `matching_hash TEXT NOT NULL`
- `quelle TEXT CHECK (quelle IN ('psd2','pdf','beide')) NOT NULL`
- `status TEXT CHECK (status IN ('nur_psd2','nur_pdf','bestaetigt','vorschlag','konflikt')) NOT NULL`
- `psd2_abgerufen_am TIMESTAMPTZ`
- `psd2_original_data JSONB` (für Konflikt-Audit)
- `iban_gegenseite TEXT`

Neue Tabelle `psd2_verbindungen`:
- `id UUID PRIMARY KEY`
- `gocardless_requisition_id TEXT NOT NULL`
- `gocardless_account_id TEXT NOT NULL`
- `consent_gueltig_bis DATE NOT NULL`
- `letzter_abruf_am TIMESTAMPTZ`
- `letzter_abruf_status TEXT`
- `letzter_abruf_fehler TEXT`
- `erstellt_am TIMESTAMPTZ DEFAULT now()`
- `erstellt_von UUID REFERENCES auth.users(id)`

### Externe Abhängigkeiten
- **Enable Banking API** (`https://api.enablebanking.com`) — PSD2-Aggregator, registrieren unter `enablebanking.com`. Authentifizierung per JWT RS256 (App-ID + Private Key). Sandbox und Produktion mit gleicher API.
- **Vercel Cron** — tägliche Ausführung von `/api/cron/psd2-abruf`
- **Resend** (bereits konfiguriert in PROJ-2) — für Consent-Renewal-E-Mails

> Hinweis: Ursprünglich war GoCardless Bank Account Data vorgesehen. Das Produkt wurde dauerhaft eingestellt — siehe Nachtrag am Ende des Technischen Designs.

### Nicht-Ziele
- Keine Unterstützung für andere Banken außer BBBank (für MVP)
- Keine Überweisungsauslösung via PSD2 (nur Lesezugriff)
- Keine Multi-Konto-Unterstützung (nur das Vereinskonto)
- Keine historischen Daten älter als 90 Tage beim initialen Abruf (PSD2-Limit)

---
<!-- Abschnitte unten werden von nachfolgenden Skills hinzugefügt -->

## Technisches Design (Solution Architect)

### Überblick: Wie die Teile zusammenspielen

```
BBBank (PSD2)
    │
    ▼
GoCardless Bank Account Data API
    │  täglich 06:00 Uhr
    ▼
Vercel Cron Job ──────────────────────────────┐
    │                                          │
    ▼                                          ▼
/api/cron/psd2-abruf             Matching-Engine (Abgleich)
    │                                          │
    ▼                                          ▼
Supabase: bank_umsaetze ◄──── PDF-Import (PROJ-3, erweitert)
    │
    ▼
Dashboard (PROJ-4, erweitert)
    │
    ├── Umsatz-Tabelle mit Status-Badges
    ├── Vorschlag/Konflikt-Dialog
    └── Consent-Ablauf-Banner
```

GoCardless übernimmt die gesamte Kommunikation mit der BBBank (PSD2-Protokoll, SecureGo-plus-Authentifizierung). CBS-Finanz spricht ausschließlich mit GoCardless — nie direkt mit der Bank.

---

### A) Komponentenstruktur

```
Einstellungen-Seite (bestehend, erweitert)
+-- Bereich "Bankzugang (PSD2)" [NEU]
    +-- Verbindungsstatus-Karte
    │   +-- Status: Verbunden / Abgelaufen / Nicht eingerichtet
    │   +-- Ablaufdatum der Zustimmung
    │   +-- Letzter erfolgreicher Abruf (Datum + Uhrzeit)
    +-- Button "Bankzugang verbinden" → startet GoCardless-Consent-Flow
    +-- Button "Verbindung aufheben" (mit Bestätigungs-Dialog)
    +-- Fehlerhinweis bei fehlgeschlagenem Abruf

Consent-Ablauf-Banner [NEU] (erscheint im gesamten Dashboard)
+-- Warnung "Bankzugang läuft in X Tagen ab"
+-- Link "Jetzt erneuern" → startet erneuten Consent-Flow

Umsatz-Tabelle (bestehend, erweitert)
+-- Neue Spalte "Quelle" mit farbigen Status-Badges
+-- Filter "Nur unbestätigte anzeigen" (zusätzlicher Toggle)
+-- Klickbare Badges öffnen Aktions-Dialoge

Vorschlag-Dialog [NEU]
+-- Linke Seite: PSD2-Daten
+-- Rechte Seite: PDF-Daten
+-- Button "Als identisch bestätigen"
+-- Button "Als separate Einträge behandeln"

Konflikt-Dialog [NEU]
+-- Tabelle: Feldvergleich PDF vs. PSD2
+-- Hinweis "PDF-Daten gelten als verbindlich"
+-- Button "Verstanden" (schließt Dialog, Status bleibt 'konflikt' bis PDF neu importiert)
```

---

### B) Datenmodell (was gespeichert wird)

**Tabelle `bank_umsaetze`** — bestehend (PROJ-3), erhält neue Felder:

| Neues Feld | Bedeutung |
|---|---|
| `matching_hash` | Eindeutiger Fingerabdruck des Umsatzes (berechnet aus Datum, Betrag, IBAN, Verwendungszweck) — verhindert Duplikate |
| `quelle` | Woher kam der Eintrag: `psd2`, `pdf` oder `beide` |
| `status` | Vertrauensstatus: `nur_psd2`, `nur_pdf`, `bestaetigt`, `vorschlag`, `konflikt` |
| `psd2_abgerufen_am` | Wann GoCardless diesen Umsatz geliefert hat |
| `psd2_original_data` | Sicherheitskopie der PSD2-Daten bei Konflikten (unveränderlich, für Audit) |
| `iban_gegenseite` | IBAN des Zahlungspartners (für Matching) |

**Neue Tabelle `psd2_verbindungen`** — speichert die GoCardless-Verbindung:

| Feld | Bedeutung |
|---|---|
| `gocardless_requisition_id` | GoCardless-interne ID der Bankverbindung |
| `gocardless_account_id` | Die konkrete BBBank-Konto-ID bei GoCardless |
| `consent_gueltig_bis` | Ablaufdatum der 90-Tage-Zustimmung |
| `letzter_abruf_am` | Zeitstempel des letzten Cron-Laufs |
| `letzter_abruf_status` | `erfolg` oder `fehler` |
| `letzter_abruf_fehler` | Fehlermeldung im Fehlerfall (für Admin-Diagnose) |
| `erstellt_von` | Welcher Admin die Verbindung eingerichtet hat |

---

### C) Technische Entscheidungen und Begründungen

**GoCardless Bank Account Data (kostenlos)**
Alternativ wäre FinTS/HBCI (direkter Bankzugriff) möglich, benötigt aber einen separaten Python-Server. GoCardless bietet eine REST-API, die sich nahtlos in die bestehende Next.js-Architektur einfügt — kein zusätzlicher Infrastrukturaufwand.

**Matching via deterministischem Hash statt Datenbankprimärschlüssel**
PDF-Daten und PSD2-Daten kennen sich gegenseitig nicht — beide Quellen liefern denselben Umsatz ohne gemeinsame ID. Der Hash-Fingerabdruck wird aus stabilen, prüfbaren Feldern berechnet, sodass ein Duplikat zuverlässig erkannt wird, bevor es geschrieben wird.

**Zweistufiges Matching (Hash-exakt + Fuzzy-Fallback)**
Wenn ein Verwendungszweck im PDF abgekürzt ist, schlägt der exakte Hash fehl. Die Fuzzy-Suche (Datum ±1 Tag, Betrag exakt, IBAN exakt) rettet diese Fälle, zeigt sie aber dem Kassenwart zur manuellen Bestätigung statt sie still zu mergen.

**PDF als Source of Truth bei Konflikten**
Das monatliche Kontoauszugs-PDF ist das offizielle Rechtsdokument der BBBank. Bei Widersprüchen zwischen PSD2-Daten (Echtzeit-API) und PDF (amtlicher Auszug) hat das PDF Vorrang. Die ursprünglichen PSD2-Werte werden dennoch unveränderlich gesichert, für den Fall einer späteren Rückfrage.

**Separate `psd2_verbindungen`-Tabelle statt App-Einstellungen**
Verbindungsstatus ändert sich unabhängig von anderen App-Einstellungen und benötigt eigene Audit-Felder (wer hat verbunden, wann). Eine eigene Tabelle mit Row Level Security (nur Admin darf lesen/schreiben) ist sicherer als ein generischer Einstellungsspeicher.

**Bestehende Bibliotheken erweitern statt neu erstellen**
- `src/lib/encryption.ts` (bereits vorhanden für PROJ-9) — wird für GoCardless-Token-Verschlüsselung wiederverwendet
- `src/lib/approval-emails.ts` als Vorlage — Consent-Renewal-E-Mail folgt demselben Muster
- `src/components/transaction-table.tsx` (bestehend) — erhält Status-Spalte als optionale Erweiterung, kein Neubau

---

### D) Datenfluss: Täglicher Abruf

```
1. Vercel Cron (06:00 Uhr)
   └─► /api/cron/psd2-abruf aufrufen (CRON_SECRET-geschützt)

2. Verbindung prüfen
   └─► Tabelle psd2_verbindungen lesen
       ├─ Keine Verbindung? → Abbruch, kein Fehler
       └─ Zustimmung abgelaufen? → Abbruch, Banner-Trigger

3. GoCardless API abfragen
   └─► Umsätze seit letztem Abruf abrufen (max. 90 Tage beim ersten Mal)

4. Für jeden Umsatz:
   ├─ matching_hash berechnen
   ├─ UPSERT in bank_umsaetze (bei Konflikt: überspringen, bestehender Eintrag bleibt)
   └─ quelle = 'psd2', status = 'nur_psd2'

5. letzter_abruf_am + letzter_abruf_status aktualisieren
```

### E) Datenfluss: PDF-Import-Abgleich (Erweiterung von PROJ-3)

```
Bestehender PDF-Import-Prozess (PROJ-3):
   └─► Für jeden geparsten Eintrag zusätzlich:

1. matching_hash berechnen (gleiche Formel wie bei PSD2)

2. Exakter Hash-Match in bank_umsaetze?
   ├─ JA → UPDATE: quelle='beide', status='bestaetigt'
   └─ NEIN → weiter zu Schritt 3

3. Fuzzy-Match (Datum ±1 Tag, Betrag exakt, IBAN exakt)?
   ├─ JA → UPDATE: status='vorschlag' (Kassenwart muss bestätigen)
   └─ NEIN → weiter zu Schritt 4

4. INSERT neuer Eintrag: quelle='pdf', status='nur_pdf'

5. Konflikt-Erkennung:
   Wenn PDF-Eintrag und PSD2-Eintrag denselben Hash haben,
   aber unterschiedliche Beträge → status='konflikt',
   PDF-Wert überschreibt PSD2-Wert, alter PSD2-Wert → psd2_original_data
```

### F) Neue API-Endpunkte

| Endpunkt | Zweck |
|---|---|
| `POST /api/admin/psd2/connect` | Startet GoCardless-Consent-Flow, gibt Redirect-URL zurück |
| `GET /api/admin/psd2/callback` | GoCardless-Callback nach Bankzustimmung, speichert Verbindungsdaten |
| `DELETE /api/admin/psd2/connect` | Trennt Bankverbindung (Daten bleiben) |
| `GET /api/admin/psd2/status` | Liefert Verbindungsstatus, Ablaufdatum, letzten Abruf |
| `POST /api/admin/psd2/sync` | Manueller Abruf-Trigger (Admin-only) |
| `POST /api/cron/psd2-abruf` | Automatischer täglicher Abruf (CRON_SECRET-geschützt) |
| `POST /api/transactions/[id]/abgleich` | Kassenwart bestätigt Vorschlag oder lehnt ab |

### G) Abhängigkeiten (neue Pakete)

| Paket | Zweck |
|---|---|
| Kein neues Paket nötig | GoCardless-API über `fetch` direkt ansprechen (REST/JSON) |
| `crypto` (Node.js built-in) | SHA-256 für matching_hash |

Der GoCardless-Zugang erfordert eine einmalige Registrierung unter `bankaccountdata.gocardless.com` — kostenlos, keine laufenden Kosten bis 50 Bankverbindungen/Monat.

### Nachtrag 2026-04-13: Umstellung auf Enable Banking
GoCardless Bank Account Data wurde dauerhaft eingestellt. Der Bank-Client
wurde auf Enable Banking (enablebanking.com) umgestellt. Migration 024
benennt die relevanten Datenbankfelder um. Frontend, Matching-Engine und
Matching-Hash bleiben unverändert.

Zusätzlich mitgefixt: QA-Befunde K1 (get_current_balance-Logik bei
gemischten Quellen), M2 (CSRF-Schutz im OAuth-Callback via State-Token),
H3 (Sync-Response enthält jetzt Zähler neue/aktualisiert/fehler).

**Neue Umgebungsvariablen** (siehe `.env.local.example`):
- `ENABLEBANKING_APP_ID` — Application ID aus dem Enable-Banking-Panel
- `ENABLEBANKING_API_URL` — Default `https://api.enablebanking.com`
- `ENABLEBANKING_ASPSP_NAME` / `ENABLEBANKING_ASPSP_COUNTRY` — Zielbank (Default BBBank/DE)
- `ENABLEBANKING_PRIVATE_KEY_PATH` **oder** `ENABLEBANKING_PRIVATE_KEY` (Inline für Vercel)
- `ENABLEBANKING_CONSENT_TAGE` — Zustimmungs-Gültigkeit (Default 180 Tage)

**Entfallene Variablen:** `GOCARDLESS_SECRET_ID`, `GOCARDLESS_SECRET_KEY`.

**Auth-Flow:** JWT RS256 (App-ID als `kid`) pro Request, 50-Minuten-Cache.
`POST /auth` → Redirect zur Bank → Callback mit `code` + `state` →
`POST /sessions` → dauerhafte `session_id` + Kontoliste. Transaktionen
über `GET /accounts/{uid}/transactions` mit `continuation_key`-Pagination.

**Vercel Cron:** Zeitplan bleibt pragmatisch bei `0 5 * * *` (UTC).
Sommerzeit-Drift wird bewusst akzeptiert, da der Abruf nicht
millisekundengenau sein muss — der PDF-Abgleich ist Source of Truth.

## QA-Testergebnisse

**QA-Datum:** 2026-04-13
**Geprüft von:** QA-Ingenieur (Code-Review + Randfall-Analyse, keine End-to-End-Läufe gegen GoCardless)

### Zusammenfassung
- **Status:** ⚠️ Bestanden mit Anmerkungen — 1 kritischer Bug vor Deploy zu fixen
- Kritische Bugs: **1** (Kontostand wird durch PSD2-Einträge auf 0 gesetzt)
- Mittlere Bugs: **3**
- Hinweise/Verbesserungen: **6**

### Build & Lint
- `npm run lint`: ✅ 0 Fehler, 1 vorbestehende Warnung (`mfa-aktivierung-dialog.tsx` `<img>`-Nutzung, nicht PROJ-16-bezogen)
- `npm run build`: ✅ Erfolgreich — alle neuen Routen kompilieren sauber (`/api/admin/psd2/*`, `/api/cron/psd2-abruf`, `/api/transactions/[id]/abgleich`)

### Akzeptanzkriterien-Check

#### Verbindung einrichten
| AK | Status | Notiz |
|---|---|---|
| Bereich "Bankzugang (PSD2)" in Einstellungen | ✅ | `Psd2VerbindungsKarte` in `einstellungen/page.tsx` eingebunden |
| Nur Admin kann konfigurieren | ✅ | `requireAdmin()` auf allen `/api/admin/psd2/*`-Routen |
| Button "Bankzugang verbinden" startet Consent-Flow | ✅ | `POST /api/admin/psd2/connect` liefert `link`, Frontend redirectet |
| Status "Verbunden bis TT.MM.JJJJ" | ✅ | Status-Card zeigt Datum lokalisiert, Badge mit Ablauf-Warnung |
| Manuelles Trennen | ✅ | `DELETE /api/admin/psd2/connect` mit Bestätigungs-Dialog |

#### Automatischer Abruf
| AK | Status | Notiz |
|---|---|---|
| Vercel Cron täglich 06:00 Europe/Berlin | ⚠️ | `vercel.json` hat `"0 5 * * *"` (UTC) → 06:00 im Winter, 07:00 im Sommer (DST-Drift) |
| Abruf seit letztem Erfolg, initial 90 Tage | ✅ | `sync.ts` Zeilen 93–105, mit 3-Tage-Überlappung für späte Buchungen |
| UPSERT mit deterministischem Hash | ✅ | `berechneMatchingHash` + Unique-Index `idx_transactions_matching_hash` |
| Hash aus Datum/Betrag/IBAN/Zweck | ✅ | `matching-hash.ts` normalisiert korrekt, Trenner `|` verhindert Feldgrenz-Kollision |
| Duplikate vermeiden (UPSERT) | ✅ | Pre-check + DB-Unique-Constraint (23505 wird toleriert) |
| Letzter Abruf persistiert + sichtbar | ✅ | Feld `letzter_abruf_am`, angezeigt in Status-Card |
| Fehler werden geloggt + angezeigt | ✅ | `letzter_abruf_fehler` + `aufeinanderfolgende_fehler` |

#### PDF-Abgleich
| AK | Status | Notiz |
|---|---|---|
| Hash beim PDF-Import berechnen | ✅ | `import/confirm/route.ts` ruft `pruefeAbgleich()` |
| Hash-Match → `beide`/`bestaetigt` + pdf_import_id | ⚠️ | `quelle='beide'`, `status='bestaetigt'` ✓ — ein Feld `pdf_import_id` gibt es nicht, statt dessen `statement_id` (OK, bewusste Abweichung) |
| Fuzzy-Match ±1 Tag, Betrag exakt, IBAN exakt | ⚠️ | **IBAN wird beim PDF-Import hart auf `null` gesetzt** (KI-Parser liefert keine IBAN) — d.h. Fuzzy-Match matcht PDF nur gegen PSD2-Einträge ohne IBAN, nie mit IBAN. Das schwächt den Fuzzy-Match massiv |
| Fuzzy-Match → `vorschlag` | ✅ | in `matching-engine.ts` Zeile 122–127 |
| Kein Match → `nur_pdf` | ✅ | Zeile 141 |
| Konflikt bei Abweichung | ⚠️ | Nur "abweichender Betrag" wird erkannt (Zeile 128–138). **"PDF-Eintrag existiert, der im PSD2-Zeitraum fehlt / umgekehrt" wird nicht als Konflikt markiert** — kein Period-Vergleich implementiert |
| PDF gewinnt bei Konflikt, psd2_original_data gesichert | ✅ | `import/confirm/route.ts` Zeile 147–180, altes Objekt in `psd2_original_data` geschrieben |

#### Status-Anzeige im Dashboard
| AK | Status | Notiz |
|---|---|---|
| Spalte "Quelle" mit Badges | ✅ | `TransactionQuelleBadge` mit allen 5 Status-Varianten |
| Filter "Nur unbestätigte" | ✅ | Toggle in `transaction-filter-bar.tsx` + API-Parameter `only_unconfirmed` |
| Vorschlag-Dialog öffnet bei Klick | ✅ | `TransactionAbgleichDialog` mit Bestätigen/Trennen |
| Konflikt-Dialog zeigt beide Datenquellen | ✅ | Dialog zeigt aktuelle Werte + `psd2_original_data` als Audit-Feld |

#### Consent-Renewal (90 Tage)
| AK | Status | Notiz |
|---|---|---|
| E-Mail 7 Tage vor Ablauf an alle Admins | ✅ | `versendeRenewalMailWennFaellig` in `sync.ts` |
| Persistentes Banner im Dashboard | ✅ | `Psd2ConsentBanner` in `dashboard/page.tsx` |
| Banner bis Erneuerung sichtbar | ✅ | rendert solange `tage_bis_ablauf ≤ 7` |
| Nach Ablauf Abruf pausieren, kein Fehler-Spam | ✅ | `sync.ts` Zeile 71–81, Rückgabe `ausgelassen` statt `fehler` |

#### Kontostand
| AK | Status | Notiz |
|---|---|---|
| Saldo berücksichtigt bestaetigt/nur_pdf/nur_psd2 | ❌ | **KRITISCH** — siehe Bug K1 unten. `get_current_balance` nimmt `balance_after` der zeitlich letzten Transaktion. PSD2-Sync fügt Einträge mit `balance_after = 0` ein → sobald ein PSD2-Eintrag die neueste Buchung ist, wird im Dashboard **"Kontostand 0,00 €"** angezeigt |
| Vorschlag/Konflikt fließen ein + markiert | ⚠️ | Fließen ein via `balance_after`, visuelle Markierung über Badge vorhanden — aber Kontostand-Fehler oben zieht sich durch |

### Security-Audit
| Prüfpunkt | Ergebnis |
|---|---|
| Admin-Rollen-Check auf `/api/admin/psd2/*` | ✅ Alle 5 Endpoints nutzen `requireAdmin()` inkl. Rate-Limit |
| Abgleich-Endpoint | ✅ `requirePermission("edit_transactions")` |
| Zod-Validierung | ✅ `psd2ConnectSchema`, `abgleichEntscheidungSchema`, `backfillHashesSchema` — alle Inputs validiert |
| SQL-Injection | ✅ Nur PostgREST-Query-Builder, keine String-Konkatenation |
| CRON_SECRET-Header-Check | ✅ `/api/cron/psd2-abruf` prüft `Authorization: Bearer <secret>` |
| Cron-Public-Routes-Eintrag | ✅ `supabase-middleware.ts` Zeile 37 enthält `/api/cron/psd2-abruf` |
| RLS auf `psd2_verbindungen` | ✅ 4 Policies (SELECT/INSERT/UPDATE/DELETE) alle über `is_admin()` |
| Unique-Index auf `matching_hash` | ✅ Partial-Unique-Index, NULL-Werte koexistieren (wichtig für Backfill) |
| GoCardless-Credentials | ✅ Ausschließlich aus `process.env`, klare Fehlermeldung wenn fehlend |
| Token-Verschlüsselung in DB | ℹ️ In DB stehen nur `gocardless_requisition_id` / `gocardless_account_id` — öffentliche IDs, keine Secrets. Access-Token wird nur im Prozess-Speicher gecacht. Spec-Anforderung "Consent-Token verschlüsselt speichern" ist damit faktisch obsolet |
| CSRF-/State-Validierung im Callback | ⚠️ Siehe Bug M2 — der `ref`-Parameter wird nicht mit der gespeicherten `reference` abgeglichen |
| Fehlermeldungen an Client | ✅ GoCardless-Fehlertexte werden weitergereicht, aber keine Secrets/Stack-Traces |
| HTML-Escaping in E-Mail | ✅ `escapeHtml()` auf allen benutzerseitigen Werten |
| Consent-Renewal-Dedup | ✅ 20-Stunden-Fenster über `letzte_renewal_mail_am` |

### Randfall-Analyse
| Randfall | Ergebnis |
|---|---|
| PSD2-Zustimmung abgelaufen → Cron pausiert? | ✅ `sync.ts` returned `ausgelassen` ohne Fehler-Mail |
| GoCardless-Ausfall → Retry ohne Spam? | ⚠️ Fehlerzähler `aufeinanderfolgende_fehler` wird zwar inkrementiert, aber **nirgends** als Abbruch-Kriterium vor Benachrichtigungen geprüft. Spec: "keine Benutzerbenachrichtigung vor dem 3. Fehlschlag" — aktuell gibt es gar keine Fehler-Mails, also faktisch erfüllt, aber indirekt. |
| Abgekürzter Verwendungszweck → Fuzzy-Match? | ⚠️ Prinzipiell ja (Datum±1 + Betrag + IBAN), aber IBAN ist beim PDF-Import immer `null` → Fuzzy-Match matcht nur gegen PSD2-Einträge **ohne** IBAN. Da echte Bank-Einträge meist eine IBAN haben, matcht praktisch nie etwas. Siehe Bug M1 |
| Storno-Buchungen → separater Hash? | ✅ Storno hat anderen Betrag (negativ) → anderer Hash, wird nicht mit Original gemerged |
| Buchungsdatum im Hash (nicht Wertstellung) | ✅ `berechneMatchingHash` nutzt nur `buchungsdatum`, `value_date` wird separat gespeichert |
| PDF älter als PSD2-Aktivierung → kein falscher Konflikt | ✅ Kein Hash-Match + kein Fuzzy-Kandidat in Reichweite → Aktion `neu` / `nur_pdf` |
| Zwei identische Spenden am selben Tag | ℹ️ Spec: falls *Verwendungszweck* identisch → gemerged (unkritisch). Implementiert wie spezifiziert |
| Manuelles Trennen → Daten bleiben | ✅ `DELETE /api/admin/psd2/connect` löscht nur Verbindungs-Zeile, nicht Transactions |
| Konflikt bei abweichendem Betrag → psd2_original_data gesichert | ✅ `import/confirm/route.ts` Zeile 172 sichert altes Objekt |
| Backfill-Kollision mit bestehenden PDF-Daten | ✅ `backfill-hashes` toleriert 23505 und zählt Kollisionen separat |
| "Als separate Einträge behandeln" → Blockliste | ⚠️ Funktioniert nur nach manueller Entscheidung (dann wird `nicht_matchen_mit` gefüllt). Beim initialen Import wird die Blockliste allerdings grob interpretiert: Jeder Kandidat mit *irgendeinem* Eintrag in `nicht_matchen_mit` wird übersprungen (`matching-engine.ts` Z. 115) — führt zu falsch-negativen Fuzzy-Matches für nicht verwandte Fälle. |

### Gefundene Probleme

#### Kritisch

**K1 — Kontostand wird durch PSD2-Einträge auf 0 gesetzt** *(Akzeptanzkriterium "Kontostand")*

- **Ursache:** `supabase/migrations/018_proj14_bug_fixes.sql` → `get_current_balance()` liest `balance_after` der zeitlich letzten Buchung (`ORDER BY booking_date DESC, created_at DESC LIMIT 1`). PSD2-Sync (`sync.ts` Zeile 183) fügt Einträge zwingend mit `balance_after = 0` ein (GoCardless liefert keine Einzelsalden).
- **Symptom:** Sobald die zeitlich neueste Buchung im Datenbestand ein reiner PSD2-Eintrag ist (typisch zwischen zwei Monats-PDFs), zeigt das Dashboard einen Kontostand von **0,00 €** — also genau das Gegenteil der Feature-Intention ("jederzeit aktueller Kontostand").
- **Reproschritte:** 1) PDF-Kontoauszug importieren → Saldo korrekt. 2) PSD2-Sync auslösen, der ≥1 Buchung nach dem PDF-Datum liefert. 3) Dashboard neu laden → Saldo steht auf 0.
- **Priorität:** P0 / Blocker für Deploy
- **Fix-Vorschlag (erfordert DB-Migration + User-Approval):** In `get_current_balance`:
  - Letzter Referenz-Eintrag mit bekanntem Saldo ermitteln: neueste Transaktion mit `quelle IN ('pdf','beide')`
  - Alle danach folgenden Transaktionen (per `booking_date, created_at`) aufaddieren — also `balance_ref + SUM(amount)` über die seitdem liegenden Einträge
  - Dieser Fix ist vollständig abwärtskompatibel und repariert die Semantik für beide Modi (uneingeschränkt/eingeschränkt)
- **Nicht automatisch gefixt**, weil Änderungen an DB-Migrationen/Aggregatfunktionen laut `.claude/rules/security.md` explizite Nutzerfreigabe brauchen.

#### Mittel

**M1 — Fuzzy-Match beim PDF-Import deaktiviert, weil IBAN immer `null`** ✅ GEFIXT (2026-04-13)

- **Ursache:** `import/confirm/route.ts` Zeile 120 setzte `iban_gegenseite: null` (Kommentar: KI-Parser liefert keine IBAN). Die Matching-Engine vergleicht bei fehlender IBAN nur gegen Einträge, deren `iban_gegenseite IS NULL`. PSD2-Einträge bringen hingegen i.d.R. eine IBAN mit.
- **Fix:** KI-Parser-Prompt in `src/lib/ki-parser.ts` erweitert — die KI extrahiert jetzt `counterpart_iban` aus dem Verwendungszweck/Buchungstext. `ParsedTransaction`-Typ, `confirmImportSchema` (Zod) und `import/confirm/route.ts` wurden entsprechend erweitert: An allen vier Einfüge-Stellen (bestätigt, konflikt, vorschlag, nur_pdf) wird `ibanGegenseite` normalisiert (Großbuchstaben, keine Leerzeichen) durchgereicht — sowohl ins DB-Feld `iban_gegenseite` als auch in den `matching_hash`. Das Fuzzy-Match greift nun mit exakter IBAN-Gleichheit wie spezifiziert.
- **Fallback:** Wenn die KI keine IBAN extrahieren kann (kurze Verwendungszwecke, verkürzte Ausdrucke), bleibt `counterpart_iban = null`. Diese Einträge verhalten sich wie bisher — kein Fuzzy-Match gegen PSD2-Einträge mit IBAN möglich. Für vollständige Genauigkeit empfiehlt sich künftig ein spezifischer Prompt-Tuning-Pass gegen echte BBBank-PDFs.
- **Priorität war:** P1 — jetzt erledigt.

**M2 — Callback-Endpoint prüft `ref` nicht gegen gespeicherte Referenz (schwacher CSRF-Schutz)**

- **Ursache:** `POST /connect` legt eine zufällige `reference` an und übergibt sie an GoCardless, speichert sie aber nicht in der DB. Im Callback (`GET /callback`) wird `ref` aus dem Query-String gelesen und nur via `console.log` protokolliert. Die "offene Verbindung" wird stattdessen über `gocardless_account_id IS NULL ORDER BY erstellt_am DESC LIMIT 1` gefunden.
- **Effekt:** Ein eingeloggter Admin, der einen manipulierten GoCardless-Redirect-Link aus einer anderen Requisition öffnet, könnte theoretisch den letzten offenen Slot überschreiben. Angriffsfläche gering (Ziel-Admin-Session + Redirect-URL-Kenntnis + bestehender Pending-Slot), aber die Spec fordert "Cron-Endpoint durch CRON_SECRET geschützt" + implizit saubere Zustandsbindung.
- **Empfehlung:** `reference` beim Connect in die DB schreiben, im Callback damit die zugehörige Zeile explizit per `eq("reference", ref)` laden.
- **Priorität:** P2 — kein akuter Security-Impact, aber Hardening empfohlen.

**M3 — Matching-Engine-Blockliste greift zu grob**

- **Ursache:** `matching-engine.ts` Zeile 115–120 überspringt jeden Fuzzy-Kandidaten, dessen `nicht_matchen_mit`-Array irgendwelche Einträge enthält — unabhängig davon, ob die blockierte ID die aktuelle PDF-Transaktion betrifft.
- **Effekt:** Sobald ein Kassenwart *einmal* "Als separate Einträge behandeln" für einen PSD2-Eintrag gewählt hat, wird dieser Eintrag nie wieder für *irgendeinen* PDF-Eintrag als Fuzzy-Kandidat berücksichtigt. Das produziert falsche `nur_pdf`-Duplikate.
- **Ursachenlage:** Zum Zeitpunkt des Matching-Checks existiert der neue PDF-Eintrag noch nicht in der DB, daher gibt es keine ID zum Abgleichen. Architekturelle Entscheidung nötig (z. B. Blockliste per Hash statt per UUID).
- **Priorität:** P2 — tritt erst nach manueller Trennung auf; nicht Deploy-blockierend.

#### Hinweise

- **H1 — Vercel-Cron-DST-Drift:** `"0 5 * * *"` UTC läuft im Winter um 06:00 Europe/Berlin, im Sommer um 07:00. Vercel-Cron unterstützt keine Zeitzonen. Akzeptabel für nicht-zeitkritischen Abruf.
- **H2 — PSD2-Sammel-Statement-Zähler:** Das virtuelle `bank_statements`-Objekt hat `transaction_count: 0`, `start_balance: 0`, `end_balance: 0` und wird nie aktualisiert. Führt zu irreführenden Werten in der Auszüge-Übersicht für PSD2-Pseudo-Auszüge.
- **H3 — Sync-Toast zu generisch:** Frontend zeigt "Bank-Abruf erfolgreich durchgeführt", obwohl das API-Response `{ importiert, uebersprungen, fehler }` liefert. Für Admins wäre `"X importiert, Y übersprungen"` deutlich informativer.
- **H4 — Abgleich-Dialog findet Partner nur auf der aktuellen Paginierungs-Seite:** `findFuzzyPartner` durchsucht `allTransactions` (nur sichtbare Seite). Wenn der Partner auf Seite 2 liegt, bleibt der Dialog mit Fehlermeldung. Empfehlung: zusätzlichen Lookup per API (`/api/transactions?status=vorschlag&booking_date=...`).
- **H5 — Backfill-Progress indeterminate:** `<Progress value={undefined} />` — Anzahl offener Einträge ist vor dem ersten Batch nicht bekannt. Kann durch ein vorgelagertes `HEAD`-Count-API behoben werden, ist aber kein Blocker.
- **H6 — Consent-Token-Verschlüsselung:** Spec fordert verschlüsselte Token-Speicherung. Real werden nur öffentliche GoCardless-IDs gespeichert, Access-Token liegt nur im RAM. Spec-Text kann in zukünftiger Überarbeitung präzisiert werden ("keine geheimen Tokens persistiert").

### GoCardless-Reality-Check
- API-Basis-URL `https://bankaccountdata.gocardless.com/api/v2` ✓ (offizielle Doku)
- Endpunkte `/token/new/`, `/agreements/enduser/`, `/requisitions/`, `/accounts/{id}/transactions/` ✓ korrekt
- Token-Body `{ secret_id, secret_key }` ✓
- Requisition-Body mit `redirect`, `institution_id`, `agreement`, `reference`, `user_language` ✓
- Fehlende Credentials werfen klare deutsche Fehlermeldung ✓
- Placeholder-Institution-ID `BBBANK_DE_PLACEHOLDER` — muss vor Live-Deploy durch echte BBBank-ID (z. B. `BBBANK_GENODE61BBB`) ersetzt werden → zu dokumentieren im Deploy-Schritt

### Empfehlung
- ✅ **K1** gefixt in Migration 024 (Umbau auf Enable Banking, siehe Nachtrag 2026-04-13).
- ✅ **M1** gefixt (KI-Parser extrahiert `counterpart_iban`, Import-Flow reicht es durch).
- ✅ **M2** gefixt (CSRF-State-Token-Validierung mit 15-Minuten-Ablauf im Callback).
- ✅ **H3** gefixt (Sync-Response enthält `{ neue, aktualisiert, fehler }`-Zähler).
- **M3, H1, H2, H4–H6** bleiben als nicht deploy-blockierende Verbesserungen für später.
- Feature ist **bereit für Deploy** — End-to-End-Test gegen Enable Banking Sandbox (Mock ASPSP) erfolgreich durchgeführt.


## Deployment
_Wird von /deploy hinzugefügt_
