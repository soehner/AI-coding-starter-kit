# PROJ-9: Seafile-Integration für Belege & Kontoauszüge

## Status: Geplant
**Erstellt:** 2026-04-10
**Zuletzt aktualisiert:** 2026-04-10

## Abhängigkeiten
- Benötigt: PROJ-3 (Kontoauszug-Import) – Kontoauszugs-PDFs werden beim Import zu Seafile hochgeladen
- Benötigt: PROJ-4 (Bankbewegungen-Dashboard) – Beleg-/Kontoauszug-Buttons in der Übersichtstabelle
- Benötigt: PROJ-5 (Eintragsbearbeitung) – erweitert `document_ref` um echten Upload statt manuellem Textfeld
- Erweitert: PROJ-3 Einstellungsseite (`/dashboard/admin/settings`) um Seafile-Konfiguration

## User Stories
- Als Administrator möchte ich in den App-Einstellungen meinen Seafile-Server und API-Token konfigurieren, damit die App Dateien auf Seafile ablegen kann.
- Als Administrator möchte ich an jeder Bankbewegung einen Button "Beleg hochladen" sehen, damit ich per Drag & Drop oder Dateiauswahl einen Beleg (PDF, JPG, PNG) zuordnen kann.
- Als Administrator möchte ich, dass der hochgeladene Beleg automatisch in ein jahresweises Verzeichnis auf Seafile abgelegt wird (z.B. `/Belege/2026/`), damit die Ablage strukturiert ist.
- Als Administrator möchte ich, dass nach dem Upload automatisch ein Seafile-Link erzeugt und in der Transaktion gespeichert wird, damit ich den Beleg jederzeit wiederfinde.
- Als Administrator möchte ich an jeder Bankbewegung einen Button "Beleg anschauen" sehen, der den Seafile-Link öffnet, damit ich den Beleg direkt einsehen kann.
- Als Administrator möchte ich, dass beim Kontoauszug-Import (PROJ-3) die PDF automatisch auf Seafile abgelegt wird (statt in Supabase Storage), damit alle Dokumente zentral auf Seafile liegen.
- Als Benutzer möchte ich in der Kontoauszugs-Liste und im Dashboard einen Button "Kontoauszug anschauen" sehen, der den Seafile-Link öffnet.
- Als Betrachter möchte ich Belege und Kontoauszüge über die Buttons anschauen können (Lesezugriff), ohne selbst Belege hochladen zu dürfen.
- Als Administrator möchte ich, dass der Dateiname auf Seafile automatisch aus Datum und Buchungstext generiert wird (z.B. `2026-03-15_Mitgliedsbeitrag_Mueller.pdf`), damit die Dateien auch direkt auf Seafile suchbar und lesbar sind.

## Akzeptanzkriterien

### Einstellungen (Seafile-Konfiguration)
- [ ] Seafile-Konfigurationsbereich auf der bestehenden Einstellungsseite (`/dashboard/admin/settings`)
- [ ] Eingabefelder: Seafile-Server-URL, Seafile API-Token (verschleiert), Bibliotheks-Name/ID
- [ ] "Verbindung testen"-Button: Prüft ob Server erreichbar und Token gültig ist
- [ ] Status-Anzeige: "Verbindung erfolgreich" oder Fehlermeldung
- [ ] Basispfad für Belege konfigurierbar (z.B. `/Förderverein/Belege/`)
- [ ] Basispfad für Kontoauszüge konfigurierbar (z.B. `/Förderverein/Kontoauszüge/`)
- [ ] Einstellungen werden in `app_settings` gespeichert (Token verschlüsselt)
- [ ] Ohne konfigurierte Seafile-Verbindung: Upload-Buttons sind deaktiviert mit Hinweis "Bitte Seafile in den Einstellungen konfigurieren"

### Beleg-Upload (pro Transaktion)
- [ ] Button "Beleg hochladen" an jeder Transaktion im Dashboard (nur für Admins sichtbar)
- [ ] Upload-Dialog mit Drag & Drop Zone und Dateiauswahl-Button
- [ ] Erlaubte Formate: PDF, JPG, PNG (Validierung mit Fehlermeldung bei ungültigem Format)
- [ ] Maximale Dateigröße: 10 MB (konfigurierbar)
- [ ] Datei wird in Seafile-Verzeichnis `{Basispfad Belege}/{Jahr}/` hochgeladen
- [ ] Unterordner pro Jahr wird automatisch erstellt, falls nicht vorhanden
- [ ] Dateiname wird automatisch generiert: `{JJJJ-MM-TT}_{Buchungstext_bereinigt}.{ext}` (Sonderzeichen entfernt, max. 100 Zeichen)
- [ ] Nach erfolgreichem Upload: Seafile-Link wird in `document_ref` der Transaktion gespeichert
- [ ] Fortschrittsanzeige während des Uploads
- [ ] Erfolgsmeldung als Toast: "Beleg hochgeladen"
- [ ] Ein Beleg pro Transaktion: Neuer Upload ersetzt den vorherigen (mit Bestätigungsdialog)

### Beleg anschauen
- [ ] Button "Beleg anschauen" an jeder Transaktion, die einen Beleg hat (für alle Benutzer sichtbar)
- [ ] Klick öffnet den Seafile-Link in einem neuen Browser-Tab
- [ ] Wenn kein Beleg vorhanden: Button ist nicht sichtbar oder ausgegraut
- [ ] Wenn Seafile-Link ungültig (404): Fehlermeldung "Beleg nicht gefunden"

### Kontoauszüge auf Seafile
- [ ] Beim Kontoauszug-Import (PROJ-3) wird die PDF auf Seafile hochgeladen statt in Supabase Storage
- [ ] Verzeichnis: `{Basispfad Kontoauszüge}/{Jahr}/`
- [ ] Dateiname: Originaler Dateiname der Kontoauszugs-PDF
- [ ] Seafile-Link wird in `bank_statements.file_path` gespeichert (statt Supabase Storage Pfad)
- [ ] Button "Kontoauszug anschauen" in der Liste der importierten Kontoauszüge
- [ ] Button "Kontoauszug anschauen" in der Kassenbuch-Spalte "Kontoauszug" im Dashboard
- [ ] Klick öffnet den Seafile-Link in einem neuen Browser-Tab

### Berechtigungen
- [ ] Seafile-Einstellungen: Nur Admins
- [ ] Beleg hochladen: Nur Admins (und Benutzer mit Edit-Berechtigung, vgl. PROJ-7)
- [ ] Beleg/Kontoauszug anschauen: Alle eingeloggten Benutzer
- [ ] Seafile-API-Token wird nur serverseitig verwendet (nie im Browser sichtbar)

## Randfälle
- Was passiert, wenn Seafile nicht erreichbar ist? → Upload wird blockiert, Fehlermeldung "Seafile-Server nicht erreichbar. Bitte versuchen Sie es später erneut." mit Retry-Button
- Was passiert, wenn der Seafile-API-Token abgelaufen/ungültig ist? → Fehlermeldung mit Link zu den Einstellungen
- Was passiert, wenn der Dateiname Sonderzeichen enthält (Umlaute, Sonderzeichen)? → Umlaute werden transliteriert (ä→ae, ü→ue, ö→oe, ß→ss), übrige Sonderzeichen durch Unterstrich ersetzt
- Was passiert bei Netzwerkabbruch während des Uploads? → Fehlermeldung, Datei auf Seafile ggf. unvollständig → kein Link gespeichert, Retry möglich
- Was passiert, wenn das Zielverzeichnis auf Seafile gelöscht wurde? → App erstellt es automatisch neu
- Was passiert, wenn eine Datei mit gleichem Namen bereits existiert? → Suffix anhängen (z.B. `_2`, `_3`)
- Was passiert, wenn ein Beleg ersetzt wird? → Bestätigungsdialog "Vorhandener Beleg wird ersetzt. Fortfahren?", alter Beleg auf Seafile wird gelöscht
- Was passiert bei Dateien > 10 MB? → Validierungsfehler "Datei zu groß. Maximal 10 MB erlaubt."
- Was passiert, wenn Seafile nicht konfiguriert ist, aber PROJ-3 Import läuft? → Import funktioniert weiterhin, aber ohne Seafile-Ablage; Warnung "Kontoauszug konnte nicht auf Seafile abgelegt werden – Seafile ist nicht konfiguriert"

## Technische Anforderungen
- Seafile Web API v2.1 für Datei-Upload und Link-Generierung
- Alle Seafile-API-Aufrufe serverseitig (API-Token nie im Browser)
- Seafile-Einstellungen in bestehender `app_settings`-Tabelle (Keys: `seafile_url`, `seafile_token`, `seafile_repo_id`, `seafile_receipt_path`, `seafile_statement_path`)
- Token verschlüsselt gespeichert (wie KI-API-Token in PROJ-3)
- Automatische Verzeichniserstellung via Seafile API wenn Jahresordner nicht existiert
- Dateiname-Bereinigung: Transliteration von Umlauten, Entfernung von Sonderzeichen, max. 100 Zeichen
- PROJ-3 Änderung: `bank_statements.file_path` speichert Seafile-Link statt Supabase Storage Pfad
- PROJ-5 Änderung: `transactions.document_ref` speichert Seafile-Link statt manuellem Text

---
<!-- Abschnitte unten werden von nachfolgenden Skills hinzugefügt -->

## Technisches Design (Solution Architect)

### Komponentenstruktur

```
Einstellungsseite (/dashboard/admin/settings)
+-- [bestehend] API-Einstellungen (KI-Token)
+-- [NEU] SeafileSettingsForm
    +-- Eingabefelder (Server-URL, API-Token, Bibliotheks-ID, Basispfade)
    +-- VerbindungTestenButton
    +-- StatusAnzeige ("Verbindung OK" / Fehlermeldung)

Dashboard (/dashboard)
+-- TransactionTable [erweitert]
    +-- [NEU] BelegButton (pro Zeile)
        +-- "Beleg hochladen" (nur Admins, wenn kein Beleg vorhanden)
        +-- "Beleg ersetzen" (nur Admins, wenn Beleg vorhanden)
        +-- "Beleg anschauen" (alle Nutzer, wenn Beleg vorhanden)
    +-- [NEU] BelegUploadDialog
        +-- Drag & Drop Zone (pdf-upload-zone.tsx als Vorlage)
        +-- Fortschrittsanzeige (Progress-Komponente aus shadcn)
        +-- Bestätigungsdialog bei Ersetzen (bestehender AlertDialog)

ImportedStatementsList [erweitert]
+-- [NEU] Button "Kontoauszug anschauen" (pro Zeile)
```

### Datenmodell

**Bestehende Tabelle `app_settings` — neue Schlüssel:**

| Schlüssel | Inhalt |
|---|---|
| `seafile_url` | Server-Adresse (z.B. https://seafile.example.com) |
| `seafile_token` | API-Token (verschlüsselt, wie KI-Token) |
| `seafile_repo_id` | ID der Seafile-Bibliothek |
| `seafile_receipt_path` | Basispfad für Belege (z.B. /Förderverein/Belege/) |
| `seafile_statement_path` | Basispfad für Kontoauszüge |

**Bestehende Tabelle `transactions` — Feldnutzung geändert:**
- `document_ref` speichert jetzt einen Seafile-Download-Link statt Freitext

**Bestehende Tabelle `bank_statements` — Feldnutzung geändert:**
- `file_path` speichert jetzt einen Seafile-Download-Link statt Supabase-Storage-Pfad

Keine neuen Datenbanktabellen nötig — alles nutzt bestehende Felder.

### Neue API-Endpunkte

| Endpunkt | Zweck | Berechtigung |
|---|---|---|
| `POST /api/admin/seafile/test` | Seafile-Verbindung testen | Admin |
| `POST /api/transactions/[id]/document` | Beleg hochladen → zu Seafile, Link speichern | Admin / Edit-Berechtigung |
| `DELETE /api/transactions/[id]/document` | Beleg-Link entfernen (vor Ersetzen) | Admin |

**Modifizierte Endpunkte:**
- `POST /api/admin/import` — lädt nach erfolgreichem Parsing zusätzlich das PDF auf Seafile hoch

### Technische Entscheidungen

**Warum alle Seafile-API-Aufrufe serverseitig?**
Der Seafile-API-Token ist ein Administrator-Geheimnis. Würde er im Browser verwendet, könnten Nutzer ihn in den Entwickler-Tools einsehen. Die Next.js API-Routen fungieren als sicheres Proxy-Layer.

**Warum keine neue Datenbanktabelle?**
`document_ref` in `transactions` und `file_path` in `bank_statements` existieren bereits und wurden genau für diesen Zweck vorgehalten. Eine neue Tabelle würde unnötige Komplexität erzeugen.

**Warum keine Seafile-SDK, sondern direkte API-Aufrufe?**
Seafile bietet eine gut dokumentierte REST-API (v2.1). Eine eigene SDK-Abhängigkeit wäre überdimensioniert für ~5 benötigte API-Aufrufe.

**Warum Unterordner pro Jahr automatisch erstellen?**
Verhindert manuelle Seafile-Einrichtung bei jedem Jahreswechsel — die App ist selbstverwaltend.

### Auswirkungen auf bestehende Features

| Feature | Änderung |
|---|---|
| PROJ-3 (Import) | Nach dem Parsing: PDF zusätzlich zu Seafile hochladen, Link in `file_path` speichern |
| PROJ-4 (Dashboard) | `TransactionTable` erhält neue Beleg-Buttons |
| PROJ-5 (Bearbeitung) | `document_ref`-Feld wird als "Beleg vorhanden"-Badge mit Link angezeigt statt Freitext |
| PROJ-3 (Einstellungen) | Bestehende Einstellungsseite wird um Seafile-Konfigurationsblock erweitert |

### Abhängigkeiten (neue Pakete)

Keine neuen Pakete nötig — alle benötigten Funktionen sind bereits vorhanden:
- HTTP-Aufrufe: natives `fetch` (in Next.js enthalten)
- Datei-Upload-UI: `pdf-upload-zone.tsx` als Vorlage
- UI-Komponenten: `Progress`, `AlertDialog`, `Dialog` aus shadcn/ui bereits installiert

## QA-Testergebnisse
_Wird von /qa hinzugefügt_

## Deployment
_Wird von /deploy hinzugefügt_
