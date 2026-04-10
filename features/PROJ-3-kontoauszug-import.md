# PROJ-3: PDF-Kontoauszug-Upload & Parsing

## Status: Geplant
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

## QA-Testergebnisse
_Wird von /qa hinzugefügt_

## Deployment
_Wird von /deploy hinzugefügt_
