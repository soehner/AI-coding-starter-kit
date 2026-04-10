# PROJ-3: PDF-Kontoauszug-Upload & Parsing

## Status: In Review
**Erstellt:** 2026-04-10
**Zuletzt aktualisiert:** 2026-04-10

## Abhängigkeiten
- Benötigt: PROJ-1 (Authentifizierung) – nur eingeloggte Admins dürfen importieren

## User Stories
- Als Administrator möchte ich eine PDF-Datei eines Kontoauszugs hochladen, damit die Buchungen automatisch erkannt und gespeichert werden.
- Als Administrator möchte ich nach dem Upload eine Vorschau der erkannten Buchungen sehen, damit ich Fehler vor dem Speichern korrigieren kann.
- Als Administrator möchte ich sehen, welche Kontoauszüge bereits importiert wurden, damit ich keine Dubletten erstelle.
- Als Administrator möchte ich beim Import-Ergebnis sehen, wie viele Buchungen erkannt wurden, damit ich die Vollständigkeit prüfen kann.
- Als Administrator möchte ich eine bereits importierte PDF erneut hochladen und auf Duplikate hingewiesen werden.

## Akzeptanzkriterien
- [ ] Upload-Formular akzeptiert nur PDF-Dateien (Datei-Typ-Validierung)
- [ ] PDF wird per KI-API (OpenAI Vision oder Anthropic Claude) geparst
- [ ] API-Token (OpenAI / Anthropic) ist in den App-Einstellungen durch den Administrator konfigurierbar (Pflichtfeld)
- [ ] App-Einstellungen speichern den gewählten KI-Provider und den verschlüsselten API-Token in der Datenbank
- [ ] Ohne konfigurierten API-Token ist der PDF-Upload deaktiviert mit Hinweis auf Einstellungen
- [ ] Parser erkennt das Badische Beamtenbank-Format: Datum, Buchungstext, Betrag, Saldo
- [ ] Erkannte Buchungen werden in einer Vorschau-Tabelle angezeigt (vor dem Speichern)
- [ ] Benutzer kann einzelne Buchungen aus der Vorschau entfernen oder korrigieren
- [ ] Nach Bestätigung werden Buchungen in Tabelle `transactions` gespeichert
- [ ] PDF-Datei selbst wird in Supabase Storage gespeichert (als Archiv)
- [ ] Metadaten des Kontoauszugs werden in Tabelle `bank_statements` gespeichert (Dateiname, Datum, Anzahl Buchungen)
- [ ] Duplikat-Erkennung: Wenn eine Buchung mit gleichem Datum + Betrag + Text bereits existiert → Warnung
- [ ] Liste der bereits importierten Kontoauszüge mit Datum und Anzahl Buchungen

## Datenstruktur Badische Beamtenbank PDF
Typisches Format (aus den vorliegenden PDFs abgeleitet):
- Kontoauszugs-Nummer (z. B. "Nr.024")
- Buchungsdatum (TT.MM.JJJJ)
- Wertstellungsdatum (TT.MM.JJJJ)
- Buchungstext / Verwendungszweck (mehrzeilig möglich)
- Betrag (positiv = Gutschrift, negativ = Lastschrift)
- Saldo nach Buchung

## Randfälle
- Was passiert bei unlesbarem PDF? → Fehlermeldung mit Hinweis auf manuellen Import
- Was passiert bei leerem PDF (0 Buchungen erkannt)? → Warnung, Upload abbrechen
- Was passiert bei Nicht-Badische-Beamtenbank-PDFs? → Parser gibt Fehlermeldung aus
- Was passiert bei sehr großen PDFs (>50 Seiten)? → Warnung, Verarbeitung fortsetzen
- Was passiert bei Netzwerkfehler während des Uploads? → Fehlermeldung, Retry möglich

## Randfälle (KI-Parsing)
- Was passiert wenn kein API-Token konfiguriert ist? → Upload-Button deaktiviert, Hinweis: "Bitte KI-API-Token in den Einstellungen konfigurieren"
- Was passiert bei ungültigem API-Token? → Fehlermeldung mit Link zu den Einstellungen
- Was passiert bei API-Rate-Limit? → Fehlermeldung, Retry möglich

## Technische Anforderungen
- KI-API (OpenAI Vision / Anthropic Claude) für PDF-Parsing – PDF wird als Bild/Dokument an die API gesendet, strukturierte Buchungsdaten zurück
- Tabelle `app_settings`: `id`, `key` (unique), `value` (encrypted für Secrets), `updated_by`, `updated_at` – speichert KI-Provider und API-Token
- Einstellungsseite (nur Admin): KI-Provider wählen (OpenAI / Anthropic), API-Token eingeben, Token-Validierung per Test-Request
- Supabase Storage Bucket `bank-statements` (private, nur für Admins)
- Tabelle `bank_statements`: `id`, `file_name`, `statement_date`, `statement_number`, `transaction_count`, `file_path`, `uploaded_by`, `created_at`
- Tabelle `transactions`: `id`, `statement_id`, `booking_date`, `value_date`, `description`, `amount` (decimal), `balance_after`, `category` (nullable), `note` (nullable), `created_at`, `updated_at`
- RLS: Alle eingeloggten Benutzer können lesen; nur Admins dürfen schreiben/löschen

---
<!-- Abschnitte unten werden von nachfolgenden Skills hinzugefügt -->

## Technisches Design (Solution Architect)

### Komponentenstruktur

```
/dashboard/admin/import        (nur Admins, Hauptseite)
+-- Import-Seite
    +-- [Wenn kein API-Token konfiguriert]
    |   +-- Hinweis-Banner: "KI-Token fehlt" + Link zu Einstellungen
    +-- Upload-Bereich (Drag & Drop oder Datei-Button)
    |   +-- Datei-Auswahl (nur PDF erlaubt)
    |   +-- Upload-Button (deaktiviert ohne API-Token)
    |   +-- Fortschrittsanzeige (Schritte: Hochladen → KI parst → Fertig)
    +-- Vorschau-Tabelle (nach erfolgreichem Parsing)
    |   +-- Zusammenfassung (erkannte Buchungen, Datumsbereich, Anfangs-/Endsaldo)
    |   +-- Tabelle der Buchungen (Datum, Text, Betrag, Saldo)
    |       +-- Zeile: bearbeitbar (Betrag / Text korrigierbar)
    |       +-- Zeile: löschbar (einzelne Buchung entfernen)
    |   +-- Duplikat-Warnungen (orange hervorgehoben)
    |   +-- "Speichern"- und "Abbrechen"-Button
    +-- Importierte Kontoauszüge (Liste am Ende)
        +-- Tabellenzeile: Dateiname, Datum, Anzahl Buchungen, importiert von

/dashboard/admin/settings      (nur Admins, Einstellungsseite)
+-- Einstellungs-Seite
    +-- Abschnitt "KI-Konfiguration"
        +-- Auswahlfeld: KI-Provider (OpenAI / Anthropic Claude)
        +-- Texteingabe: API-Token (verschleiert)
        +-- "Token testen"-Button
        +-- Status-Anzeige: "Token gültig ✓" oder Fehlermeldung
        +-- Speichern-Button
```

### Verarbeitungsablauf

```
Admin wählt PDF → PDF wird zu Supabase Storage hochgeladen (Archiv)
               → PDF wird an API-Route geschickt
               → Server ruft KI-API auf (mit dem gespeicherten Token)
               → KI liefert strukturierte Buchungsliste zurück
               → Vorschau wird im Browser angezeigt
               → Admin prüft, korrigiert ggf.
               → Admin klickt "Speichern"
               → Buchungen werden in Tabelle transactions gespeichert
               → Metadaten werden in Tabelle bank_statements gespeichert
```

### Datenmodell

**Neue Tabelle `app_settings`:**
- Schlüssel (z. B. "ki_provider", "ki_token")
- Wert (verschlüsselt für API-Token)
- Wer hat es zuletzt geändert + wann

**Neue Tabelle `bank_statements`:**
- Dateiname der PDF, Kontoauszugsnummer
- Zeitraum (Anfangs- und Enddatum)
- Anzahl der Buchungen
- Pfad zur gespeicherten PDF-Datei
- Wer hat es importiert + wann

**Neue Tabelle `transactions`:**
- Verknüpfung zu bank_statements
- Buchungsdatum + Wertstellungsdatum
- Buchungstext / Verwendungszweck
- Betrag (positiv = Eingang, negativ = Ausgang)
- Saldo nach der Buchung
- Kategorie + Bemerkung (optional, für spätere Features)

**PDF-Dateien:** Supabase Storage, privater Bucket "bank-statements"

### Neue Bausteine

**Neue Seiten:**
- `/dashboard/admin/import` – Upload & Vorschau-Seite
- `/dashboard/admin/settings` – KI-Token Einstellungsseite

**Neue API-Endpunkte (serverseitig, nur Admins):**
- `POST /api/admin/import` – PDF empfangen, an KI senden, Buchungen zurückliefern
- `POST /api/admin/import/confirm` – Vorschau bestätigen, in DB speichern
- `GET /api/admin/import/statements` – Liste importierter Kontoauszüge
- `GET /api/admin/settings` – KI-Einstellungen lesen
- `POST /api/admin/settings` – KI-Einstellungen speichern
- `POST /api/admin/settings/test` – API-Token validieren

**Neue UI-Komponenten:**
- `PdfUploadZone` – Drag & Drop Bereich (nutzt: Button, Progress)
- `TransactionPreviewTable` – bearbeitbare Vorschau-Tabelle (nutzt: Table, Input, Badge)
- `ApiSettingsForm` – Einstellungsformular (nutzt: Select, Input, Button)

### Technische Entscheidungen

| Entscheidung | Warum |
|---|---|
| KI-API serverseitig | API-Token darf nie im Browser sichtbar sein |
| Zwei KI-Anbieter (OpenAI / Anthropic) | Admin wählt, welchen er bereits hat |
| API-Token in Datenbank (verschlüsselt) | Admin kann Token selbst konfigurieren ohne Vercel-Zugriff |
| Vorschau vor dem Speichern | Parsing-Fehler werden sichtbar bevor Daten gespeichert werden |
| PDF in Supabase Storage | Archiv für Prüfungszwecke; bereits in Infrastruktur vorhanden |

### Abhängigkeiten (neue Pakete)

| Paket | Zweck |
|---|---|
| `openai` | OpenAI API SDK (Vision / Responses API) |
| `@anthropic-ai/sdk` | Anthropic Claude API SDK |
| `pdfjs-dist` | PDF-Seiten als Bilder für Vision-APIs rendern |

## QA-Testergebnisse (Re-Test)

**Getestet:** 2026-04-10 (Re-Test nach Bugfixes)
**App-URL:** https://cbs-finanz.vercel.app + http://localhost:3000
**Tester:** QA-Ingenieur (KI)
**Build-Status:** Erfolgreich (keine Fehler)
**Lint-Status:** Erfolgreich (keine Warnungen)

### Status der Akzeptanzkriterien

#### AK-1: Upload-Formular akzeptiert nur PDF-Dateien -- BESTANDEN
- [x] Client-seitige Validierung: `accept=".pdf,application/pdf"` auf dem Input-Element
- [x] Client-seitige Typ-Pruefung in `validateFile()` prueft `file.type !== "application/pdf"`
- [x] Server-seitige Validierung in `/api/admin/import`: prueft `file.type !== "application/pdf"` (Zeile 41)
- [x] Groessen-Limit: Client 50 MB, Server 10 MB

#### AK-2: PDF wird per KI-API (OpenAI/Anthropic) geparst -- BESTANDEN
- [x] `parseBankStatement()` in `ki-parser.ts` unterstuetzt beide Provider
- [x] Anthropic: PDF nativ als `document`-Typ (base64-encoded) gesendet
- [x] OpenAI: Text-Extraktion mit `pdfjs-dist`, dann als Prompt gesendet
- [x] Strukturierter System-Prompt mit klarem JSON-Output-Format
- [x] Fehlerbehandlung fuer KI-Antworten (JSON-Parsing, Validierung)

#### AK-3: API-Token in App-Einstellungen konfigurierbar -- BESTANDEN
- [x] Einstellungsseite unter `/dashboard/admin/settings` implementiert
- [x] Provider-Auswahl (OpenAI / Anthropic) mit Select-Komponente
- [x] Token-Eingabe als Passwort-Feld (verschleiert)
- [x] Speichern und Laden der Einstellungen ueber API

#### AK-4: App-Einstellungen speichern KI-Provider und verschluesselten Token -- BESTANDEN
- [x] AES-256-GCM Verschluesselung in `encryption.ts`
- [x] ENCRYPTION_KEY als Umgebungsvariable (64-Zeichen Hex-String)
- [x] Token wird vor dem Speichern verschluesselt, beim Lesen entschluesselt
- [x] Provider und Token als separate Eintraege in `app_settings` Tabelle
- [x] Upsert auf `key`-Spalte verhindert Duplikate

#### AK-5: Ohne konfigurierten API-Token ist Upload deaktiviert -- BESTANDEN
- [x] Import-Seite prueft `hasApiToken` beim Laden
- [x] Alert-Banner zeigt Hinweis mit Link zu Einstellungen
- [x] Upload-Zone und Button sind deaktiviert (`opacity-50`, `cursor-not-allowed`)
- [x] Server-seitige Pruefung: API gibt 400 zurueck wenn kein Token konfiguriert

#### AK-6: Parser erkennt Badische-Beamtenbank-Format -- BESTANDEN
- [x] System-Prompt spezifisch fuer Badische Beamtenbank
- [x] Extrahiert: Datum, Buchungstext, Betrag, Saldo
- [x] Datumsformat: YYYY-MM-DD
- [x] Betraege: negativ fuer Abbuchungen, positiv fuer Gutschriften

#### AK-7: Erkannte Buchungen in Vorschau-Tabelle angezeigt -- BESTANDEN
- [x] `TransactionPreviewTable` zeigt alle erkannten Buchungen
- [x] Zusammenfassung: Anzahl Buchungen, Anfangs-/Endsaldo, Kontoauszugsnummer
- [x] Tabelle: Datum, Wertstellung, Buchungstext, Betrag, Saldo
- [x] Farbkodierung: Gruen fuer Gutschriften, Rot fuer Lastschriften

#### AK-8: Benutzer kann Buchungen entfernen oder korrigieren -- BESTANDEN
- [x] Bearbeiten: Klick auf Stift-Icon oeffnet Inline-Bearbeitung (Text + Betrag)
- [x] Entfernen: Klick auf Papierkorb-Icon markiert Buchung als entfernt (durchgestrichen)
- [x] Wiederherstellen: Entfernte Buchungen koennen wiederhergestellt werden
- [x] Betrag-Parsing: Unterstuetzt Komma-Dezimalstellen (deutsches Format)

#### AK-9: Nach Bestaetigung werden Buchungen in `transactions` gespeichert -- BESTANDEN
- [x] `/api/admin/import/confirm` speichert Buchungen
- [x] Zod-Validierung mit `confirmImportSchema`
- [x] Rollback bei Fehler: bank_statement wird geloescht wenn Buchungen fehlschlagen
- [x] Erfolgs-Meldung im UI mit Anzahl gespeicherter Buchungen

#### AK-10: PDF-Datei wird in Supabase Storage gespeichert -- BESTANDEN
- [x] Upload in `bank-statements` Bucket (privat)
- [x] Sanitized Dateiname mit Timestamp-Prefix
- [x] Storage-Policies: Nur Admins koennen hochladen, lesen, loeschen

#### AK-11: Metadaten in `bank_statements` gespeichert -- BESTANDEN
- [x] Dateiname, Kontoauszugsdatum, Nummer, Buchungsanzahl, Dateipfad
- [x] `uploaded_by` referenziert den Admin
- [x] Timestamps automatisch gesetzt

#### AK-12: Duplikat-Erkennung -- BESTANDEN
- [x] Prueft bestehende Buchungen auf Datum + Betrag + Buchungstext
- [x] Duplikate werden mit orangenem Badge "Duplikat?" markiert
- [x] Zusammenfassung zeigt Anzahl moeglicher Duplikate
- [x] Duplikat-Check verwendet `.in("booking_date", uniqueDates)` - gezielter Query statt Limit (frueherer BUG-1 behoben)

#### AK-13: Liste der importierten Kontoauszuege -- BESTANDEN
- [x] `ImportedStatementsList` zeigt alle importierten Kontoauszuege
- [x] Spalten: Dateiname, Nr., Datum, Buchungsanzahl, Importiert am
- [x] Sortiert nach Erstellungsdatum (neueste zuerst)
- [x] Leerer Zustand mit erklaerenden Text
- [x] Limit auf 100 Eintraege

### Status der Randfaelle

#### RF-1: Unlesbares PDF -- BESTANDEN
- [x] KI-Parser wirft Fehler mit Fehlermeldung
- [x] Fehler wird im UI als Alert angezeigt

#### RF-2: Leeres PDF (0 Buchungen) -- BESTANDEN
- [x] `parseKiResponse()` prueft ob `transactions` leer ist und wirft Fehler
- [x] Fehlermeldung: "KI-Antwort enthaelt keine Buchungen"

#### RF-3: Nicht-Badische-Beamtenbank-PDFs -- TEILWEISE BESTANDEN
- [x] KI-Parser versucht trotzdem zu parsen - das Ergebnis kann ungenau sein
- [ ] BUG: Keine explizite Warnung wenn der Parser ein unerwartetes Format erkennt. Die Spezifikation verlangt eine Fehlermeldung bei Nicht-BBBank-PDFs, aber die Implementierung verlaesst sich darauf, dass die KI den Fehler erkennt.

#### RF-4: Sehr grosse PDFs (>50 Seiten) -- ABWEICHUNG VON SPEZIFIKATION
- [x] Server prueft Seitenanzahl mit pdfjs-dist und gibt Fehler bei >50 Seiten zurueck
- [ ] BUG-NEU: Die Spezifikation verlangt eine "Warnung, Verarbeitung fortsetzen", aber die Implementierung lehnt PDFs mit >50 Seiten komplett ab (HTTP 400). Das ist strenger als spezifiziert.

#### RF-5: Netzwerkfehler waehrend Upload -- BESTANDEN
- [x] Try-Catch in `uploadAndParse()` faengt Netzwerkfehler ab
- [x] Fehlermeldung: "Netzwerkfehler beim Hochladen. Bitte erneut versuchen."
- [x] Retry moeglich durch "Zuruecksetzen"-Button und erneuten Upload

#### RF-6: Kein API-Token konfiguriert -- BESTANDEN
- [x] Upload-Button deaktiviert
- [x] Hinweistext: "Bitte KI-API-Token in den Einstellungen konfigurieren" mit Link

#### RF-7: Ungueltiger API-Token -- BESTANDEN
- [x] `testApiToken()` erkennt 401-Fehler
- [x] Fehlermeldung bei Token-Test im UI
- [x] Bei Import: Fehlermeldung aus der KI-API wird durchgereicht

#### RF-8: API-Rate-Limit -- TEILWEISE BESTANDEN
- [x] Fehler von der KI-API werden als generische Fehlermeldung angezeigt
- [ ] BUG: Rate-Limit-Fehler werden nicht spezifisch erkannt - der Benutzer sieht nur eine generische Fehlermeldung ohne Hinweis, dass es sich um ein Rate-Limit handelt

### Sicherheitsaudit-Ergebnisse

#### Authentifizierung & Autorisierung
- [x] Alle API-Endpunkte verwenden `requireAdmin()` - prueft Auth + Admin-Rolle
- [x] Frontend-Seiten leiten Nicht-Admins zum Dashboard um
- [x] RLS auf allen Tabellen aktiviert: app_settings, bank_statements, transactions
- [x] Storage-Bucket `bank-statements` ist privat mit Admin-only Policies
- [x] Viewer-Rolle: Lese-Zugriff auf bank_statements und transactions (korrekt fuer PROJ-4)

#### Eingabevalidierung
- [x] Server-seitige Zod-Validierung auf `/api/admin/import/confirm`
- [x] Server-seitige Zod-Validierung auf `/api/admin/settings`
- [x] Server-seitige Zod-Validierung auf `/api/admin/settings/test`
- [x] Datei-Typ-Validierung (PDF) serverseitig
- [x] Datei-Groessen-Limit serverseitig (10 MB)
- [x] Dateiname wird sanitized (`replace(/[^a-zA-Z0-9._-]/g, "_")`)

#### Token-Sicherheit
- [x] API-Token wird AES-256-GCM verschluesselt in der Datenbank gespeichert
- [x] ENCRYPTION_KEY in Umgebungsvariable (nicht im Code)
- [x] Token wird nie an den Client zurueckgegeben (nur `hasToken: boolean`)
- [x] GET /api/admin/settings gibt nur Provider und ob Token existiert zurueck
- [x] Token-Feld im Frontend als `type="password"` (verschleiert)

#### Rate Limiting
- [x] Rate Limiting in `admin-auth.ts`: 20 Anfragen pro Minute pro IP
- [x] In-Memory Rate Limiting (zurueckgesetzt bei Serverstart)

#### Potenzielle Sicherheitsprobleme
- [ ] BUG-SEC-1 (weiterhin offen): Der `confirmImportSchema` akzeptiert beliebige `file_path`-Strings ohne Validierung gegen den tatsaechlichen Storage-Pfad. Ein Admin-Angreifer koennte einen falschen `file_path` in die DB schreiben.
- [x] BUG-SEC-2 (BEHOBEN): Duplikat-Check verwendet jetzt `.in("booking_date", uniqueDates)` statt eines Limits von 1000 Buchungen. Gezielter Query, kein Datenverlust.
- [ ] BUG-SEC-3 (weiterhin offen): Kein Mechanismus zum Loeschen eines gespeicherten API-Tokens. Token kann nur ueberschrieben werden.
- [ ] BUG-SEC-4 (NEU): `createAdminSupabaseClient()` wird in mehreren API-Routen aufgerufen und erstellt bei jedem Request eine neue Supabase-Client-Instanz. Dies ist kein Singleton (anders als der Client-seitige Supabase-Client in PROJ-2). Im Serverkontexs ist dies weniger kritisch, aber koennte bei hoher Last zu erhoehtem Ressourcenverbrauch fuehren.
- [ ] BUG-SEC-5 (NEU): Die Import-Route laedt die PDF erst in Supabase Storage hoch (Zeile 100-113), fuehrt dann das KI-Parsing durch (Zeile 137-145). Wenn das Parsing fehlschlaegt, bleibt die PDF im Storage als verwaiste Datei zurueck - kein Cleanup.
- [ ] BUG-SEC-6 (NEU): In `ki-parser.ts` wird die KI-Antwort als `parsed as ParsedStatementResult` gecastet (Zeile 175) ohne Zod-Validierung der einzelnen Felder. Die KI koennte theoretisch unerwartete Feldtypen zurueckgeben (z.B. `amount` als String statt Number), was spaeter zu Fehlern fuehren koennte.

### Gefundene Bugs

#### BUG-1: Duplikat-Check Limit auf 1000 Buchungen -- BEHOBEN
- **Status:** Behoben. Der Code verwendet jetzt `.in("booking_date", uniqueDates)` fuer einen gezielten Query.

#### BUG-2: Grosse PDFs (>50 Seiten) -- ABWEICHUNG
- **Schweregrad:** Niedrig
- **Beschreibung:** Die Spezifikation verlangt "Warnung, Verarbeitung fortsetzen", aber die Implementierung lehnt PDFs mit >50 Seiten komplett ab (HTTP 400). Dies ist strenger als spezifiziert, aber akzeptabel fuer den Anwendungsfall (Kontoauszuege haben selten >50 Seiten). Die Fehlermeldung empfiehlt, einzelne Kontoauszuege hochzuladen.
- **Prioritaet:** Waere schoen (Verhalten ist vertretbar)

#### BUG-3: Keine explizite Erkennung von Nicht-BBBank-PDFs -- WEITERHIN OFFEN
- **Schweregrad:** Niedrig
- **Reproduktionsschritte:** Wie im vorherigen QA-Bericht
- **Prioritaet:** Waere schoen (KI kann das Format meist erkennen)

#### BUG-4: Rate-Limit-Fehler nicht spezifisch erkannt -- WEITERHIN OFFEN
- **Schweregrad:** Niedrig
- **Reproduktionsschritte:** Wie im vorherigen QA-Bericht
- **Prioritaet:** Waere schoen

#### BUG-5: file_path im Confirm-Endpoint nicht validiert -- WEITERHIN OFFEN
- **Schweregrad:** Mittel
- **Reproduktionsschritte:** Wie im vorherigen QA-Bericht
- **Hinweis:** Da nur Admins diesen Endpoint aufrufen koennen, ist die Auswirkung begrenzt. Trotzdem sollte eine Pruefung gegen den Storage-Inhalt erfolgen.
- **Prioritaet:** Im naechsten Sprint beheben

#### BUG-6: Client/Server Groessen-Diskrepanz -- WEITERHIN OFFEN
- **Schweregrad:** Niedrig
- **Beschreibung:** Client erlaubt 50 MB, Server nur 10 MB. Benutzer bekommt erst nach dem Upload eine Fehlermeldung.
- **Prioritaet:** Waere schoen

#### BUG-7: Kein Token-Loeschen moeglich -- WEITERHIN OFFEN
- **Schweregrad:** Niedrig
- **Reproduktionsschritte:** Wie im vorherigen QA-Bericht
- **Prioritaet:** Waere schoen

#### BUG-8 (NEU): Verwaiste PDFs im Storage bei Parser-Fehler
- **Schweregrad:** Mittel
- **Reproduktionsschritte:**
  1. Lade eine gueltige PDF hoch
  2. KI-Parsing schlaegt fehl (z.B. ungueltiger Token, Netzwerkfehler, ungueltige KI-Antwort)
  3. Erwartet: PDF wird aus dem Storage entfernt oder als "fehlerhaft" markiert
  4. Tatsaechlich: PDF bleibt als verwaiste Datei im Storage-Bucket zurueck
- **Betroffene Datei:** `src/app/api/admin/import/route.ts` (Zeile 100-145: Upload vor Parsing, kein Cleanup im Error-Pfad)
- **Prioritaet:** Im naechsten Sprint beheben

#### BUG-9 (NEU): KI-Antwort wird ohne Zod-Validierung gecastet
- **Schweregrad:** Mittel
- **Reproduktionsschritte:**
  1. KI gibt unerwartetes JSON-Format zurueck (z.B. `amount` als String "123.45" statt Number)
  2. Erwartet: Validierungsfehler mit hilfreicher Meldung
  3. Tatsaechlich: Cast mit `as ParsedStatementResult` ueberspringt Typenpruefung, Fehler tritt erst spaeter auf (z.B. beim Speichern in die DB)
- **Betroffene Datei:** `src/lib/ki-parser.ts` (Zeile 175: `const result = parsed as ParsedStatementResult`)
- **Prioritaet:** Im naechsten Sprint beheben

#### BUG-10 (NEU): Button-Text "Zuruecksetzen" mit ae-Ersetzung statt echtem Umlaut
- **Schweregrad:** Niedrig
- **Reproduktionsschritte:**
  1. Oeffne die Import-Seite
  2. Waehle eine PDF-Datei aus
  3. Beachte den Button-Text "Zuruecksetzen" (Zeile 271 in `pdf-upload-zone.tsx`)
  4. Erwartet: "Zurücksetzen" mit echtem ue
  5. Tatsaechlich: "Zuruecksetzen" mit ue-Ersetzung
- **Betroffene Datei:** `src/components/pdf-upload-zone.tsx` (Zeile 271)
- **Prioritaet:** Vor Deployment beheben (Projektregel: immer echte Umlaute verwenden)

### Cross-Browser / Responsive

#### Desktop (1440px)
- [x] Import-Seite: Layout korrekt, Tabelle vollstaendig sichtbar
- [x] Einstellungen-Seite: Formular zentriert, max-w-2xl
- [x] Vorschau-Tabelle: Alle Spalten sichtbar inkl. Saldo und Wertstellung

#### Tablet (768px)
- [x] Import-Seite: Layout stapelt sich korrekt
- [x] Vorschau-Tabelle: Wertstellungs-Spalte wird auf `hidden sm:table-cell` korrekt ausgeblendet
- [x] Buttons: flex-col auf mobil, flex-row ab sm-Breakpoint

#### Mobil (375px)
- [x] Import-Seite: Upload-Zone passt sich an
- [x] Vorschau-Tabelle: `overflow-x-auto` ermoeglicht horizontales Scrollen
- [x] Saldo-Spalte: `hidden md:table-cell` korrekt ausgeblendet
- [x] Action-Buttons: Stapeln sich vertikal

### Regressionstests

#### PROJ-1: Authentifizierung
- [x] Login-Flow unveraendert
- [x] Auth-Hook `useAuth()` funktioniert korrekt auf neuen Seiten
- [x] Redirect fuer nicht-authentifizierte Benutzer funktioniert

#### PROJ-2: Benutzerverwaltung
- [x] Benutzerverwaltungs-Seite weiterhin erreichbar
- [x] App-Header: Neue Links (Import, Einstellungen) nur fuer Admins sichtbar
- [x] Viewer-Benutzer sehen keine Admin-Menuepunkte

#### PROJ-4: Bankbewegungen-Dashboard
- [x] Dashboard zeigt Buchungen korrekt an
- [x] Filter und Suche funktionieren
- [x] KPI-Karten werden geladen

### Zusammenfassung
- **Akzeptanzkriterien:** 13/13 bestanden (frueher BUG-1 bei AK-12 behoben)
- **Gefundene Bugs:** 8 verbleibend (0 kritisch, 0 hoch, 3 mittel, 5 niedrig)
  - Mittel: BUG-5 (file_path-Validierung), BUG-8 (verwaiste PDFs), BUG-9 (KI-Cast ohne Zod)
  - Niedrig: BUG-2, BUG-3, BUG-4, BUG-6, BUG-7, BUG-10
- **Sicherheit:** Solide. AES-256-GCM Verschluesselung, RLS auf allen Tabellen, Admin-Pruefung auf allen Endpoints. Mittlere Hinweise (file_path, verwaiste Dateien, KI-Cast).
- **Produktionsreif:** JA (keine kritischen oder hohen Bugs)
- **Empfehlung:** BUG-10 (Umlaut) vor Deployment beheben. BUG-5, BUG-8, BUG-9 im naechsten Sprint beheben.

## Deployment
_Wird von /deploy hinzugefügt_
