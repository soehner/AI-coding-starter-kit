# Product Requirements Document

## Vision
**CBS-Finanz** ist eine Web-Applikation für den CBS-Mannheim Förderverein, die den manuellen Prozess der Kassenbuchführung digitalisiert. Kontoauszüge der Badischen Beamtenbank werden als PDF hochgeladen, automatisch geparst und in einer Datenbank gespeichert. Die Anwendung ersetzt die händische Übertragung in Excel-Kassenbücher und ermöglicht kollaboratives Arbeiten mit rollenbasiertem Zugriffsschutz.

## Target Users

### Administrator (Kassenwart)
- Verwaltet die Finanzen des Fördervereins
- Lädt Kontoauszüge hoch und überprüft die geparsten Daten
- Bearbeitet Felder und fügt Bemerkungen hinzu
- Exportiert das Kassenbuch als Excel
- Verwaltet Benutzer und deren Rollen

### Betrachter (Vorstandsmitglieder, Prüfer)
- Möchte jederzeit einen aktuellen Überblick über die Finanzen
- Hat nur Lesezugriff – kein Bearbeiten, kein Exportieren
- Wird per E-Mail-Einladung in die Anwendung aufgenommen

## Core Features (Roadmap)

| Priority | Feature | Status |
|----------|---------|--------|
| P0 (MVP) | PROJ-1: Authentifizierung & Benutzerverwaltung | Planned |
| P0 (MVP) | PROJ-2: Benutzereinladung & Rollenverwaltung | Planned |
| P0 (MVP) | PROJ-3: PDF-Kontoauszug-Upload & Parsing | Planned |
| P0 (MVP) | PROJ-4: Bankbewegungen-Übersicht (Dashboard) | Planned |
| P1 | PROJ-5: Eintragsbearbeitung & Bemerkungen | Planned |
| P1 | PROJ-6: Kassenbuch-Export (Excel) | Planned |
| P1 | PROJ-7: Granulare Feature-Berechtigungen | Planned |
| P1 | PROJ-8: Zwei-Faktor-Authentifizierung (2FA) | Planned |
| P1 | PROJ-9: Seafile-Integration für Belege & Kontoauszüge | Planned |
| P1 | PROJ-10: Genehmigungssystem für Vereinsanträge | Planned |
| P1 | PROJ-11: Kostenübernahme-Antrag (iFrame-Formular) | Planned |
| P2 | PROJ-12: Buchungskategorisierung | Planned |
| P2 | PROJ-13: Automatische Kategorisierungsregeln | Planned |
| P2 | PROJ-14: Kategoriebasierter Zugriff für Betrachter | Planned |
| P1 | PROJ-16: Direkter Bankabruf (PSD2) mit PDF-Abgleich | Planned |

## Success Metrics
- Zeiteinsparung: Manuelles Übertragen entfällt (aktuell ~30 Min pro Kontoauszug)
- Fehlerreduktion: Kein manuelles Abtippen mehr
- Zugänglichkeit: Vorstandsmitglieder können jederzeit den Kontostand einsehen
- Akzeptanz: Kassenwart nutzt die App für alle zukünftigen Kontoauszüge

## Constraints
- Technologie: Next.js + Supabase + Vercel + GitHub (vorgegeben)
- Bank: Badische Beamtenbank (BW-Bank) – spezifisches PDF-Format
- Team: Einzelentwickler
- PDF-Parsing: Ausschließlich KI-basiert (OpenAI Vision oder Anthropic Claude API). API-Token wird vom Administrator in den App-Einstellungen konfiguriert (Pflichtfeld für PDF-Import)

## Non-Goals
- Keine Buchhaltungssoftware (keine DATEV-Integration)
- Keine Mitgliederverwaltung (separates System)
- Keine eigenständige Belegverwaltung (Belege werden über Seafile verlinkt, nicht in der App selbst verwaltet)
- Keine Mobile App (responsive Web reicht)
- Keine automatische Verzeichnis-Überwachung (manueller Upload)
