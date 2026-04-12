# Testprogramm CBS-Finanz

> Stand: 2026-04-12 · Umfang: Alle Features PROJ-1 bis PROJ-11 · Testumgebung: Produktion (Vercel) + lokale Entwicklung

## Vorbereitungen

### Testdaten bereitstellen
- [ ] Zwei Test-Accounts: `admin@test.local` (Administrator), `viewer@test.local` (Betrachter)
- [ ] Mindestens ein echter PDF-Kontoauszug der Badischen Beamtenbank (aktuell + älter)
- [ ] Zweites Gerät/Browser für parallele Sessions und 2FA-Tests
- [ ] Authenticator-App (Google Authenticator, Authy o. ä.)
- [ ] OpenAI- bzw. Anthropic-API-Token mit Restguthaben
- [ ] Seafile-Testbibliothek mit Schreibrechten
- [ ] Zugriff auf Supabase-Dashboard (Logs, Tabellen)

### Checks vor Testbeginn
- [ ] `npm run build` lokal erfolgreich
- [ ] `npm run lint` ohne Fehler
- [ ] Vercel-Deployment aktuell und erreichbar
- [ ] Alle Env-Vars in Vercel gesetzt (Supabase, OpenAI/Anthropic, Seafile, App-URL)

---

## 1. Grundlagen & Infrastruktur

### 1.1 Erreichbarkeit & Sicherheit
- [ ] Produktions-URL lädt per HTTPS, Zertifikat gültig
- [ ] Security-Header gesetzt: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Strict-Transport-Security`
- [ ] `/` leitet nicht eingeloggte Nutzer nach `/login`
- [ ] 404-Seite erscheint bei unbekannten Routen
- [ ] Keine JS-Fehler in der Browser-Konsole auf Hauptseiten

### 1.2 Responsivität
- [ ] Mobile 375 px: Login, Dashboard, Upload, Tabellen funktionieren
- [ ] Tablet 768 px: Navigation und Formulare nutzbar
- [ ] Desktop 1440 px: keine Layoutbrüche

---

## 2. PROJ-1: Authentifizierung

- [ ] Login mit korrekten Daten führt ins Dashboard
- [ ] Login mit falschem Passwort zeigt deutsche Fehlermeldung
- [ ] Login mit unbekannter E-Mail: generische Meldung (keine User-Enumeration)
- [ ] Passwort-vergessen-Flow: E-Mail wird zugestellt, Link setzt Passwort zurück
- [ ] Abmelden löscht die Session und leitet zu `/login`
- [ ] Session überlebt Seiten-Reload
- [ ] Direkter Aufruf geschützter URLs ohne Login → Redirect nach `/login`
- [ ] Keine Passwörter oder Tokens im HTML-Quelltext oder Network-Tab sichtbar

## 3. PROJ-2: Benutzereinladung & Rollen

- [ ] Admin kann unter `/dashboard/admin` neue Nutzer einladen
- [ ] Einladungs-E-Mail wird zugestellt, Link führt zum Account-Setup
- [ ] Eingeladener Nutzer kann Passwort setzen und sich einloggen
- [ ] Rolle „Betrachter" kann Admin-Bereich **nicht** öffnen (Redirect oder 403)
- [ ] Rolle-Wechsel durch Admin greift sofort nach Re-Login
- [ ] Benutzer löschen entfernt Auth-Eintrag und Profildatensatz
- [ ] RLS: Betrachter sieht keine fremden Profildaten in der API-Antwort

## 4. PROJ-3: PDF-Kontoauszug-Upload & Parsing

- [ ] Admin kann PDF hochladen; Fortschritt wird angezeigt
- [ ] Parsing erzeugt Transaktionen mit Datum, Betrag, Verwendungszweck, Saldo
- [ ] Gesamtsumme / Saldo stimmt mit dem PDF überein
- [ ] Upload derselben Datei führt nicht zu Duplikaten (Idempotenz)
- [ ] Falsches Dateiformat (z. B. .txt, .docx) wird abgelehnt
- [ ] PDF ohne erkennbare Buchungen zeigt klare Fehlermeldung
- [ ] Fehlendes API-Token zeigt verständlichen Hinweis
- [ ] Fehler beim KI-Provider (Rate-Limit, 500) wird sauber abgefangen
- [ ] Betrachter sieht Upload-Button **nicht**
- [ ] Sehr große PDFs (>10 MB) werden korrekt behandelt oder abgewiesen

## 5. PROJ-4: Bankbewegungen-Dashboard

- [ ] Liste zeigt alle Buchungen chronologisch sortiert
- [ ] Filter nach Datum funktioniert (Von/Bis)
- [ ] Suche nach Verwendungszweck findet korrekte Treffer
- [ ] Pagination oder Virtual-Scroll funktioniert bei vielen Einträgen
- [ ] Kontostand / Summen werden korrekt berechnet
- [ ] Ladezustände (Skeleton/Spinner) sichtbar während Fetch
- [ ] Leerer Zustand („Keine Buchungen") wird korrekt angezeigt
- [ ] Betrachter sieht Liste, aber keine Bearbeiten-Buttons

## 6. PROJ-5: Eintragsbearbeitung & Bemerkungen

- [ ] Admin kann Betrag, Datum, Verwendungszweck, Kategorie bearbeiten
- [ ] Bemerkung kann hinzugefügt, bearbeitet, gelöscht werden
- [ ] Änderungen werden sofort in der Liste sichtbar
- [ ] Validierung: Betrag als Zahl, Datum als gültiges Datum
- [ ] Abbrechen verwirft Änderungen
- [ ] Betrachter sieht keine Bearbeiten-UI und erhält bei direktem API-Call 403

## 7. PROJ-6: Kassenbuch-Export (Excel)

- [ ] Export-Button erzeugt `.xlsx`-Datei
- [ ] Excel öffnet sich in LibreOffice / MS Excel ohne Fehler
- [ ] Spalten: Datum, Betrag, Verwendungszweck, Kategorie, Bemerkung, Saldo
- [ ] Deutsche Umlaute (ä, ö, ü, ß) korrekt codiert
- [ ] Datumsformat deutsch (TT.MM.JJJJ)
- [ ] Betragsformat mit Komma als Dezimaltrenner
- [ ] Zeitraumfilter wirkt sich auf Export aus
- [ ] Leerer Zeitraum erzeugt leere Datei oder Warnung
- [ ] Betrachter hat keinen Zugriff auf Export

## 8. PROJ-7: Granulare Feature-Berechtigungen

- [ ] Admin kann pro Nutzer Feature-Flags setzen (Upload, Export, Genehmigung, …)
- [ ] Deaktivierte Features werden im UI ausgeblendet
- [ ] Deaktivierte Features geben bei direktem API-Call 403
- [ ] Wiederaktivieren gibt Zugriff unmittelbar frei
- [ ] Berechtigungs-Matrix wird in der DB per RLS erzwungen

## 9. PROJ-8: Zwei-Faktor-Authentifizierung (2FA)

- [ ] Nutzer kann 2FA unter `/dashboard/sicherheit` aktivieren
- [ ] QR-Code scanbar, TOTP-Codes funktionieren
- [ ] Backup-Codes werden angezeigt, einmalig verwendbar
- [ ] Login fordert nach Passwort TOTP-Code an
- [ ] Falscher Code → Fehler, kein Login
- [ ] 2FA deaktivieren erfordert Bestätigung
- [ ] Admin kann 2FA bei Bedarf zurücksetzen
- [ ] Session-Handling: 2FA überlebt Page-Reload, bricht bei Logout ab

## 10. PROJ-9: Seafile-Integration

- [ ] Upload eines Belegs speichert Datei in Seafile-Bibliothek
- [ ] Verknüpfung Beleg ↔ Transaktion wird persistiert
- [ ] Vorschau/Download-Link funktioniert
- [ ] Fehler (ungültiger Token, Bibliothek nicht gefunden) wird sauber angezeigt
- [ ] Löschen einer Transaktion verwaist Beleg nicht ungewollt
- [ ] Dateinamen mit Umlauten funktionieren
- [ ] Sehr große Dateien werden korrekt hochgeladen oder begrenzt abgewiesen

## 11. PROJ-10: Genehmigungssystem

- [ ] Neuen Antrag stellen funktioniert (Admin und berechtigte Nutzer)
- [ ] E-Mail-Benachrichtigung geht an Genehmiger
- [ ] Öffentlicher Abstimmungslink `/abstimmung/[id]` lädt auch ohne Login
- [ ] Zustimmen / Ablehnen aktualisiert Status
- [ ] Doppelabstimmung pro Person wird verhindert
- [ ] Antragssteller sieht Status-Änderungen im Dashboard
- [ ] Mehrheitslogik korrekt (einstimmig / Mehrheit gemäß Spec)
- [ ] Abgelaufene/abgeschlossene Anträge können nicht mehr abgestimmt werden
- [ ] Manipulation via URL-ID anderer Anträge schlägt fehl (RLS)

## 12. PROJ-11: Kostenübernahme-Antrag (iFrame)

- [ ] Öffentliches Formular `/antrag` lädt ohne Login
- [ ] iFrame-Einbettung auf externer Seite funktioniert (CSP/X-Frame passend konfiguriert)
- [ ] Pflichtfeld-Validierung greift client- und serverseitig
- [ ] Upload von Belegen (falls vorgesehen) funktioniert
- [ ] Nach Absenden: Bestätigungsseite + E-Mail an Antragsteller
- [ ] Antrag erscheint im Admin-Dashboard
- [ ] Rate-Limit / Honeypot gegen Spam vorhanden
- [ ] XSS-Versuche in Textfeldern werden escaped
- [ ] Umlaute in Name, Verwendungszweck, Beschreibung korrekt gespeichert

---

## 13. Rollen- & Berechtigungsmatrix (Querschnitt)

Für jede Rolle die Hauptpfade durchklicken:

| Pfad | Admin | Betrachter | Gast |
|------|-------|------------|------|
| `/login` | ✓ | ✓ | ✓ |
| `/dashboard` | ✓ | ✓ (read) | ✗ |
| `/dashboard/admin` | ✓ | ✗ | ✗ |
| `/dashboard/sicherheit` | ✓ | ✓ | ✗ |
| Upload PDF | ✓ | ✗ | ✗ |
| Export Excel | ✓ | ✗ | ✗ |
| Eintrag bearbeiten | ✓ | ✗ | ✗ |
| Genehmigungs-Abstimmung | ✓ | ✓ | ✓ (per Link) |
| `/antrag` | ✓ | ✓ | ✓ |

- [ ] Alle Zellen obiger Matrix verifiziert (UI **und** direkter API-Call)

## 14. Sicherheitsaudit (Querschnitt)

- [ ] Keine Secrets im Frontend-Bundle (`NEXT_PUBLIC_*` prüfen)
- [ ] RLS auf allen Tabellen aktiv (Supabase-Dashboard → Table → Policies)
- [ ] Authenticated Requests ohne gültigen JWT werden abgelehnt
- [ ] SQL-Injection-Versuche in Suchfeldern schlagen fehl
- [ ] XSS-Versuche (`<script>alert(1)</script>`) werden escaped
- [ ] CSRF: State-ändernde APIs verlangen Auth-Header
- [ ] Rate-Limit auf Login, Passwort-Reset, öffentlichem Antragsformular
- [ ] PDF-Upload akzeptiert nur `application/pdf`
- [ ] Datei-Download setzt Content-Disposition korrekt

## 15. Performance & Stabilität

- [ ] Dashboard lädt unter 2 Sekunden (DevTools → Network)
- [ ] Kein Memory-Leak bei langem Dashboard-Betrieb (mehrfach Tabelle filtern)
- [ ] Supabase-Queries nutzen Indizes (keine Sequential Scans in Logs)
- [ ] Keine N+1-Queries beim Laden der Bankbewegungen
- [ ] Vercel-Logs zeigen nach Testlauf keine 5xx-Fehler

## 16. Daten-Konsistenz

- [ ] Gleicher PDF-Import liefert identische Buchungen (Deterministik)
- [ ] Transaktionssumme = Anfangssaldo + Δ Buchungen
- [ ] Löschen eines Benutzers löscht/anonymisiert abhängige Datensätze sauber
- [ ] Datum-Zeitzone: Alle Anzeigen in `Europe/Berlin`

---

## Test-Durchführungsprotokoll

Für jeden Testlauf dokumentieren:

| # | Feature | Tester | Datum | Ergebnis | Bug-ID | Bemerkung |
|---|---------|--------|-------|----------|--------|-----------|
|   |         |        |       | ✓ / ✗    |        |           |

### Bug-Schweregrade
- **Kritisch:** Datenverlust, Sicherheitslücke, Login funktioniert nicht → sofort fixen
- **Hoch:** Hauptfunktion defekt, kein Workaround → vor Freigabe fixen
- **Mittel:** Funktion defekt, Workaround vorhanden → Sprint-Backlog
- **Niedrig:** UI/UX-Kleinigkeit → Backlog

---

## Empfohlene Reihenfolge

1. Abschnitt 1 + 2 (Infra, Auth) — ohne diese keine weiteren Tests sinnvoll
2. Abschnitt 3 (Rollen) — bildet die Basis für Berechtigungstests
3. Abschnitte 4–12 (Features der Reihe nach)
4. Abschnitt 13 (Matrix) als Regression nach Feature-Tests
5. Abschnitte 14–16 (Sicherheit, Performance, Daten) als Abschluss

Ergebnis des kompletten Testlaufs bitte im Commit `test(qa): Testlauf YYYY-MM-DD Ergebnisse` als Kopie dieses Dokuments mit abgehakten Checkboxen ablegen.
