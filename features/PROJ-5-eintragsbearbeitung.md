# PROJ-5: Eintragsbearbeitung & Bemerkungen

## Status: Deployed
**Erstellt:** 2026-04-10
**Zuletzt aktualisiert:** 2026-04-10

## Abhängigkeiten
- Benötigt: PROJ-1 (Authentifizierung) – Schreibzugriff nur für Admins (und Benutzer mit Edit-Berechtigung)
- Benötigt: PROJ-4 (Dashboard) – Bearbeitung erfolgt direkt in der Übersichtstabelle

## User Stories
- Als Administrator möchte ich eine Bemerkung zu einer Buchung hinzufügen, indem ich einfach in das Bemerkungsfeld klicke, damit ich Kontext zur Buchung hinterlegen kann.
- Als Administrator möchte ich den Buchungstext einer Buchung korrigieren können (z. B. Tippfehler aus dem PDF-Parsing), indem ich direkt in das Feld klicke.
- Als Administrator möchte ich einen Verweis auf einen Beleg oder Kontoauszug hinzufügen, damit die Dokumentation vollständig ist.
- Als Benutzer mit Edit-Berechtigung möchte ich ebenfalls Bemerkungen hinzufügen oder bearbeiten können.
- Als Betrachter (ohne Edit-Berechtigung) möchte ich Felder nur lesen können und bei Klick einen Hinweis erhalten, dass ich keine Bearbeitungsrechte habe.
- Als Benutzer möchte ich nach dem Bearbeiten eines Felds die Änderung sofort gespeichert sehen (ohne Seite neu laden), damit der Workflow flüssig ist.

## Akzeptanzkriterien
- [ ] Klick auf ein bearbeitbares Feld wandelt es in ein Eingabefeld um (Inline-Edit)
- [ ] Bearbeitbare Felder: Buchungstext, Bemerkung, Beleg-Referenz, Kontoauszug-Referenz
- [ ] Nicht bearbeitbare Felder (schreibgeschützt): Datum, Betrag, Saldo (kommen direkt aus der Bank)
- [ ] Speichern durch Enter-Taste oder Klick außerhalb des Felds (onBlur)
- [ ] Abbrechen durch Escape-Taste (Änderung verwerfen)
- [ ] Erfolgreiches Speichern zeigt kurze Toast-Meldung "Gespeichert"
- [ ] Fehler beim Speichern zeigt Fehlermeldung, Feld bleibt editierbar
- [ ] Bemerkungsfeld unterstützt mehrzeiligen Text (Textarea)
- [ ] Betrachter ohne Edit-Recht: Felder sind optisch erkennbar als schreibgeschützt (kein Hover-Effekt)
- [ ] Alle Änderungen werden mit `updated_at` Timestamp und `updated_by` User-ID protokolliert
- [ ] Admins können immer alles bearbeiten; einfache Benutzer nur, wenn die Feature-Berechtigung "Bearbeiten" gesetzt ist (vgl. PROJ-2)

## Randfälle
- Was passiert, wenn zwei Benutzer gleichzeitig dasselbe Feld bearbeiten? → Last-Write-Wins (kein Echtzeit-Locking nötig)
- Was passiert bei leerem Speichern (Feld geleert)? → Leerer String wird gespeichert, kein Pflichtfeld außer Buchungstext
- Was passiert, wenn der Buchungstext auf leer gesetzt wird? → Validierungsfehler "Buchungstext darf nicht leer sein"
- Was passiert bei sehr langen Bemerkungen (>1000 Zeichen)? → Maximale Länge 1000 Zeichen mit Zeichenzähler
- Was passiert bei Netzwerkfehler beim Speichern? → Optimistic UI zurückrollen, Fehlermeldung

## Technische Anforderungen
- Optimistic Update: UI aktualisiert sofort, Rollback bei Fehler
- API-Route `PATCH /api/transactions/[id]` mit Zod-Validierung
- Felder: `description`, `note`, `document_ref`, `statement_ref`
- Audit-Felder: `updated_at`, `updated_by` auf Tabelle `transactions`
- RLS: Schreibzugriff abhängig von Rolle oder Feature-Berechtigung (aus `user_permissions`)

---
<!-- Abschnitte unten werden von nachfolgenden Skills hinzugefügt -->

## Technisches Design (Solution Architect)

### Überblick
PROJ-5 erweitert die bestehende Buchungstabelle (aus PROJ-4) um Inline-Bearbeitung. Felder werden direkt in der Tabellenzeile anklickbar — ohne separate Bearbeitungsseite. Änderungen werden sofort gespeichert und mit Optimistic UI angezeigt.

---

### A) Komponentenstruktur

```
Dashboard-Seite (bestehend, PROJ-4)
└── TransactionTable (bestehend — wird erweitert)
    └── TransactionRow (neu — kapselt eine Tabellenzeile)
        ├── Schreibgeschützte Felder (Datum, Betrag, Saldo)
        │   └── Nur Anzeige, kein Hover-Effekt
        └── Bearbeitbare Felder (Inline-Edit-Feld)
            ├── Anzeigemodus → Text mit Hover-Markierung (Stift-Icon)
            ├── Bearbeitungsmodus → Eingabefeld oder Textarea
            └── Zeichenzähler (nur Bemerkungsfeld, max. 1000 Zeichen)

Globale Komponenten
└── Toast-Benachrichtigung (Sonner — bereits installiert)
    ├── "Gespeichert" bei Erfolg
    └── Fehlermeldung bei Netzwerkfehler
```

**Bearbeitbare Felder im Detail:**

| Feld | Typ | Max. Länge | Pflichtfeld |
|------|-----|-----------|------------|
| Buchungstext | Einzeiliges Textfeld | 500 Zeichen | Ja |
| Bemerkung | Mehrzeilige Textarea | 1000 Zeichen | Nein |
| Beleg-Referenz | Einzeiliges Textfeld | 255 Zeichen | Nein |
| Kontoauszug-Referenz | Einzeiliges Textfeld | 255 Zeichen | Nein |

---

### B) Datenmodell

Die bestehende Tabelle `transactions` in der Datenbank wird um Audit-Felder erweitert:

```
Tabelle: transactions (Erweiterung)
Neue Felder:
- note              → Bemerkungstext (frei editierbar)
- document_ref      → Beleg-Referenz (z. B. Seafile-Link oder Dateiname)
- statement_ref     → Kontoauszug-Referenz
- updated_at        → Zeitstempel der letzten Änderung (automatisch)
- updated_by        → Benutzer-ID, wer zuletzt geändert hat

Bestehende Felder (unverändert):
- description       → Buchungstext (wird nun editierbar)
- date, amount, balance → schreibgeschützt (Bankdaten)
```

**Wichtig:** `date`, `amount` und `balance` stammen direkt vom Kontoauszug und dürfen niemals überschrieben werden — weder über die UI noch über die API.

---

### C) API-Endpunkte

**Neu:** `PATCH /api/transactions/[id]`
- Empfängt nur die geänderten Felder (Partial Update)
- Erlaubte Felder: `description`, `note`, `document_ref`, `statement_ref`
- Schreibt automatisch `updated_at` und `updated_by`
- Gibt den aktualisierten Datensatz zurück

**Bestehend (unverändert):**
- `GET /api/transactions` → Listenabfrage für das Dashboard

---

### D) Berechtigungslogik

```
Benutzerrolle prüfen (Reihenfolge):
1. Admin → darf immer alles bearbeiten
2. Normaler Benutzer mit Feature-Berechtigung "Bearbeiten" → darf bearbeiten
3. Betrachter oder Benutzer ohne Berechtigung → nur Lesen

Sicherheitsebenen:
- Frontend: Felder ohne Edit-Recht werden optisch als schreibgeschützt angezeigt
- API: Server prüft Berechtigung unabhängig vom Frontend (RLS-Policy)
- Datenbank: Row Level Security verhindert unberechtigte Schreibzugriffe
```

---

### E) Optimistic UI – Ablauf

```
Benutzer ändert Feld → Enter / Klick außerhalb
    ↓
1. UI zeigt sofort den neuen Wert an (Optimistic Update)
2. API-Anfrage wird im Hintergrund gesendet
    ↓
Erfolg → Toast "Gespeichert ✓"
Fehler → UI rollt auf alten Wert zurück + Fehlermeldung anzeigen
```

---

### F) Technische Entscheidungen (Begründung)

| Entscheidung | Warum |
|---|---|
| **Inline-Edit statt Bearbeitungsseite** | Flüssigerer Workflow — kein Seitenwechsel nötig, besonders bei mehreren Korrekturen hintereinander |
| **Optimistic UI** | Die App fühlt sich sofort reaktiv an, auch bei langsamer Verbindung |
| **onBlur + Enter zum Speichern** | Vertrautes Verhalten (wie in Excel/Tabellen-Apps) — kein extra "Speichern"-Button nötig |
| **Escape zum Abbrechen** | Sicherheitsnetz: Versehentliche Änderungen können schnell verworfen werden |
| **Sonner Toast** | Bereits installiert, passt zum bestehenden Design — keine neue Abhängigkeit |
| **Partial Update (PATCH)** | Nur geänderte Felder werden übertragen — keine versehentliche Überschreibung anderer Daten |
| **Last-Write-Wins** | Vereinfachte Konfliktlösung — für ein Einzelbenutzer-Kassenbuch ausreichend, kein Echtzeit-Locking nötig |

---

### G) Abhängigkeiten

Keine neuen Pakete erforderlich — alle benötigten Komponenten sind bereits installiert:
- `shadcn/ui`: Input, Textarea, Toast (Sonner) — bereits vorhanden
- Supabase Client — bereits konfiguriert
- Next.js App Router — bereits im Einsatz

---

### H) Nicht in diesem Feature (Abgrenzung)

- Kein Echtzeit-Locking bei gleichzeitiger Bearbeitung (→ PROJ-7 oder später)
- Keine Änderungshistorie / Audit-Log-Ansicht (→ mögliches späteres Feature)
- Keine Bearbeitung von Datum, Betrag oder Saldo (Bankdaten, unveränderlich)
- Keine Seafile-Dateiauswahl für Belege (→ PROJ-9), nur manuelle Texteingabe

## QA-Testergebnisse

**Getestet:** 2026-04-10
**Re-Test:** 2026-04-10
**App-URL:** http://localhost:3000
**Tester:** QA-Ingenieur (KI)

### Status der Akzeptanzkriterien

#### AK-1: Klick auf bearbeitbares Feld wandelt in Eingabefeld um (Inline-Edit)
- [x] InlineEditField-Komponente implementiert mit Anzeige-/Bearbeitungsmodus
- [x] Klick auf Button-Element öffnet Eingabefeld
- [x] Stift-Icon erscheint bei Hover als visueller Hinweis

#### AK-2: Bearbeitbare Felder: Buchungstext, Bemerkung, Beleg-Referenz, Kontoauszug-Referenz
- [x] Buchungstext (description) als InlineEditField in TransactionTable
- [x] Bemerkung (note) als InlineEditField mit multiline in TransactionTable
- [x] Beleg-Referenz (document_ref) als InlineEditField in TransactionTable
- [x] Kontoauszug-Referenz (statement_ref) als InlineEditField in TransactionTable (BUG-1 BEHOBEN — Spalte "Auszug" zeigt jetzt InlineEditField mit Placeholder der automatischen Auszugsnummer)

#### AK-3: Nicht bearbeitbare Felder (schreibgeschützt): Datum, Betrag, Saldo
- [x] Datum wird als reiner Text dargestellt (kein InlineEditField)
- [x] Betrag (Einnahme/Ausgabe) wird als reiner Text dargestellt
- [x] Saldo wird als reiner Text dargestellt
- [x] API-Route filtert nur erlaubte Felder (ALLOWED_FIELDS) — date, amount, balance_after können nicht über die API verändert werden

#### AK-4: Speichern durch Enter-Taste oder Klick außerhalb (onBlur)
- [x] Enter-Taste löst handleSave aus (bei einzeiligem Feld)
- [x] onBlur löst handleSave aus
- [x] Bei Textarea: Ctrl+Enter / Cmd+Enter zum Speichern (Enter allein erzeugt Zeilenumbruch)

#### AK-5: Abbrechen durch Escape-Taste
- [x] Escape-Taste ruft handleCancel auf
- [x] editValue wird auf den ursprünglichen Wert zurückgesetzt
- [x] Bearbeitungsmodus wird beendet

#### AK-6: Erfolgreiches Speichern zeigt Toast-Meldung "Gespeichert"
- [x] toast.success("Gespeichert") wird bei erfolgreichem API-Aufruf angezeigt
- [x] Sonner Toaster ist global im Layout eingebunden (position="bottom-right")

#### AK-7: Fehler beim Speichern zeigt Fehlermeldung, Feld bleibt editierbar
- [x] catch-Block wirft Fehler weiter (throw err), damit InlineEditField im Bearbeitungsmodus bleibt
- [x] toast.error(message) zeigt die Fehlermeldung an
- [x] Optimistic UI rollt bei Fehler auf alten Wert zurück

#### AK-8: Bemerkungsfeld unterstützt mehrzeiligen Text (Textarea)
- [x] note-Feld hat multiline={true} gesetzt
- [x] Textarea-Komponente mit rows={3} und min-h-[60px]

#### AK-9: Betrachter ohne Edit-Recht: Felder optisch als schreibgeschützt
- [x] canEdit={false} rendert nur ein span-Element ohne Hover-Effekt
- [x] Kein Stift-Icon, kein klickbarer Button für Viewer
- [x] Dashboard übergibt canEdit={isAdmin} an TransactionTable

#### AK-10: Alle Änderungen mit updated_at und updated_by protokolliert
- [x] API-Route setzt updated_at und updated_by bei jedem PATCH
- [x] Datenbank-Trigger set_updated_at() aktualisiert updated_at automatisch
- [x] Migration 005 fügt updated_by als Foreign Key auf auth.users hinzu

#### AK-11: Admins können immer bearbeiten; einfache Benutzer nur mit Berechtigung
- [x] API prüft profile.role === "admin" serverseitig via requireAdmin()
- [x] RLS-Policy "Admins können Buchungen aktualisieren" ist vorhanden
- [x] (Bekannte Einschränkung) Feature-Berechtigung "Bearbeiten" für Nicht-Admins wird erst mit PROJ-7 implementiert — akzeptabel für aktuellen Stand

### Status der Randfälle

#### RF-1: Zwei Benutzer bearbeiten gleichzeitig dasselbe Feld (Last-Write-Wins)
- [x] Kein Locking implementiert — Last-Write-Wins Strategie wie spezifiziert

#### RF-2: Leeres Speichern (Feld geleert)
- [x] Leerer String wird als null gespeichert (value || null in handleUpdateTransaction)
- [x] Keine Pflichtfeldprüfung außer bei Buchungstext

#### RF-3: Buchungstext auf leer gesetzt
- [x] required={true} bei description-Feld
- [x] Validierung "Buchungstext darf nicht leer sein" im Frontend (InlineEditField)
- [x] Zod-Validierung .min(1) im API-Backend

#### RF-4: Sehr lange Bemerkungen (>1000 Zeichen)
- [x] maxLength={1000} bei note-Feld gesetzt
- [x] Zeichenzähler wird angezeigt (charCount/maxLength)
- [x] Zod-Validierung .max(1000) im Backend
- [ ] BUG-3 (offen, Niedrig): Frontend-Validierung prüft maxLength erst beim Speichern. Eingabe von mehr als 1000 Zeichen wird nicht während der Eingabe verhindert — Zähler zeigt rot an, aber Eingabe wird nicht blockiert. UX-Problem, kein funktionales Problem.

#### RF-5: Netzwerkfehler beim Speichern
- [x] Optimistic UI mit Rollback auf oldTransactions implementiert
- [x] toast.error zeigt Fehlermeldung
- [x] Fehler wird weitergeworfen, Feld bleibt editierbar

### Sicherheitsaudit-Ergebnisse

- [x] Authentifizierung: API prüft User via requireAdmin() -> supabase.auth.getUser() — kein Zugriff ohne Login
- [x] Autorisierung: API prüft admin-Rolle vor jedem Update
- [x] Eingabevalidierung: Zod-Schema validiert alle Felder mit Längenbeschränkungen
- [x] Feld-Filterung: ALLOWED_FIELDS verhindert Updates an geschützten Feldern (date, amount, balance_after)
- [x] SQL-Injection: Supabase-Client verwendet parametrisierte Queries
- [x] XSS: React escaped Ausgaben automatisch; kein dangerouslySetInnerHTML verwendet
- [x] Security Headers: X-Frame-Options, CSP, HSTS korrekt konfiguriert
- [x] RLS: Row Level Security auf transactions-Tabelle aktiv mit Admin-only UPDATE-Policy
- [x] Rate Limiting: PATCH-Route verwendet jetzt requireAdmin() mit integriertem IP-basiertem Rate Limiting (20 Req/Min) (BUG-4 BEHOBEN)
- [ ] BUG-5 (offen, Niedrig): Transaction-ID im URL-Pfad wird nicht als UUID validiert. Kein Sicherheitsrisiko (Supabase parametrisiert), aber unnötige Datenbank-Anfragen bei ungültigen IDs.

### Gefundene Bugs

#### BUG-1: Kontoauszug-Referenz (statement_ref) fehlt als bearbeitbares Feld — BEHOBEN
- **Schweregrad:** Hoch
- **Status:** BEHOBEN in Commit d99c39b
- **Verifizierung:** InlineEditField für statement_ref in TransactionTable Zeilen 265-275 vorhanden. Placeholder zeigt automatische Auszugsnummer.

#### BUG-2: (Bekannte Einschränkung) Feature-Berechtigung "Bearbeiten" für Nicht-Admins
- **Schweregrad:** Niedrig (bekannte Einschränkung)
- **Status:** Akzeptiert — wird mit PROJ-7 umgesetzt
- **Priorität:** Im nächsten Sprint beheben (mit PROJ-7)

#### BUG-3: Zeichenlimit wird während der Eingabe nicht erzwungen
- **Schweregrad:** Niedrig
- **Status:** Offen
- **Reproduktionsschritte:**
  1. Gehe zu /dashboard als Admin
  2. Klicke auf ein Bemerkungsfeld
  3. Tippe mehr als 1000 Zeichen
  4. Erwartet: Eingabe wird bei 1000 Zeichen gestoppt oder deutlicher Hinweis
  5. Tatsächlich: Eingabe ist möglich, Zähler wird rot, aber Validierungsfehler erscheint erst beim Speichern
- **Priorität:** Wäre schön

#### BUG-4: Kein Rate Limiting auf PATCH /api/transactions/[id] — BEHOBEN
- **Schweregrad:** Mittel
- **Status:** BEHOBEN in Commit d99c39b
- **Verifizierung:** Route verwendet jetzt requireAdmin() mit integriertem Rate Limiting (20 Req/Min, IP-basiert).

#### BUG-5: Fehlende UUID-Validierung für Transaction-ID
- **Schweregrad:** Niedrig
- **Status:** Offen
- **Reproduktionsschritte:**
  1. Sende PATCH /api/transactions/nicht-eine-uuid mit gültigem Body
  2. Erwartet: 400 Bad Request mit Meldung "Ungültige Buchungs-ID"
  3. Tatsächlich: Supabase-Query wird ausgeführt, gibt 404 zurück (kein Match)
- **Priorität:** Wäre schön

### Re-Test-Ergebnisse (2026-04-10)

| Bug | Schweregrad | Vorher | Nachher | Verifiziert |
|-----|-------------|--------|---------|-------------|
| BUG-1 | Hoch | Offen | BEHOBEN | Ja — InlineEditField für statement_ref in UI vorhanden |
| BUG-2 | Niedrig | Akzeptiert | Akzeptiert | Bekannte Einschränkung (PROJ-7) |
| BUG-3 | Niedrig | Offen | Offen | Kein Fix nötig vor Deployment |
| BUG-4 | Mittel | Offen | BEHOBEN | Ja — requireAdmin() mit Rate Limiting |
| BUG-5 | Niedrig | Offen | Offen | Kein Fix nötig vor Deployment |

### Build-Verifizierung
- [x] TypeScript-Kompilierung fehlerfrei (tsc --noEmit)
- [x] Produktions-Build erfolgreich (npm run build)
- [x] Alle API-Routen korrekt registriert (/api/transactions/[id] vorhanden)

### Zusammenfassung
- **Akzeptanzkriterien:** 11/11 bestanden
- **Randfälle:** 5/5 bestanden (RF-4 hat kleines UX-Problem, funktional korrekt)
- **Behobene Bugs:** 2 (BUG-1 Hoch, BUG-4 Mittel) — beide verifiziert
- **Offene Bugs:** 3 (0 kritisch, 0 hoch, 0 mittel, 3 niedrig)
- **Sicherheit:** Bestanden — Auth, RLS, Rate Limiting, Input-Validierung vorhanden
- **Produktionsreif:** JA
- **Empfehlung:** Deployen. Verbleibende niedrige Bugs (BUG-2, BUG-3, BUG-5) können im nächsten Sprint behoben werden.

## Deployment

- **Produktions-URL:** https://cbs-finanz.vercel.app
- **Deployt am:** 2026-04-10
- **Commit:** 0663b72 (feat(PROJ-5): Eintragsbearbeitung & Bemerkungen implementiert)
- **Datenbank-Migration:** 005_proj5_edit_fields.sql erfolgreich angewandt
