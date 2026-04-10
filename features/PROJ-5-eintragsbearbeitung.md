# PROJ-5: Eintragsbearbeitung & Bemerkungen

## Status: Geplant
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
_Wird von /qa hinzugefügt_

## Deployment
_Wird von /deploy hinzugefügt_
