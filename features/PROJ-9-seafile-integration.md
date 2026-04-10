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
_Wird von /architecture hinzugefügt_

## QA-Testergebnisse
_Wird von /qa hinzugefügt_

## Deployment
_Wird von /deploy hinzugefügt_
