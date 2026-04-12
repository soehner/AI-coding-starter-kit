# PROJ-13: Automatische Kategorisierungsregeln

## Status: In Progress
**Erstellt:** 2026-04-12
**Zuletzt aktualisiert:** 2026-04-12

## Abhängigkeiten
- Benötigt: PROJ-12 (Buchungskategorisierung) – Kategorien müssen existieren
- Erweitert: PROJ-3 (PDF-Import) – Regeln werden nach dem Parsing angewendet

## Beschreibung
Der Administrator kann Regeln definieren, die beim Import von Kontoauszügen (und optional auf Knopfdruck für bestehende Buchungen) automatisch Kategorien zuweisen. Regeln basieren auf Buchungstext, Auftraggeber/Empfänger, Betragsbereichen oder Buchungsmonat/-quartal. Mehrere passende Regeln können gleichzeitig greifen (da mehrere Kategorien pro Buchung möglich sind).

## User Stories
- Als Administrator möchte ich Regeln anlegen, die einen Buchungstext-Begriff mit einer Kategorie verknüpfen, damit wiederkehrende Buchungen automatisch kategorisiert werden.
- Als Administrator möchte ich Regeln basierend auf dem Namen des Auftraggebers/Empfängers definieren, damit Buchungen von bekannten Partnern automatisch eingeordnet werden.
- Als Administrator möchte ich Regeln für Betragsbereiche anlegen (z.B. genau 15,00 € oder 10–20 €), damit regelmäßige Beiträge automatisch erkannt werden.
- Als Administrator möchte ich Regeln für bestimmte Monate oder Quartale definieren, damit saisonale Buchungen automatisch kategorisiert werden.
- Als Administrator möchte ich beim Import sehen, wie viele Buchungen durch Regeln automatisch kategorisiert wurden.
- Als Administrator möchte ich Regeln auch nachträglich auf bestehende unkategorisierte Buchungen anwenden, damit ich alte Kontoauszüge nicht manuell durchgehen muss.
- Als Administrator möchte ich Regeln aktivieren und deaktivieren, ohne sie löschen zu müssen.

## Akzeptanzkriterien
- [ ] In den Einstellungen gibt es einen Bereich „Kategorisierungsregeln" mit einer Liste aller Regeln
- [ ] Eine Regel besteht aus: Regeltyp, Bedingung, Ziel-Kategorie, aktiv/inaktiv-Status
- [ ] Unterstützte Regeltypen:
  - **Buchungstext enthält** – Freitextsuche im Verwendungszweck (Groß-/Kleinschreibung ignoriert)
  - **Auftraggeber/Empfänger enthält** – Freitextsuche im Feld Auftraggeber/Empfänger
  - **Betrag im Bereich** – Von-Betrag und Bis-Betrag (inklusiv); Vorzeichen wählbar (Eingang/Ausgang/beide)
  - **Buchungsmonat/-quartal** – Auswahl eines oder mehrerer Monate (1–12) oder Quartale (Q1–Q4)
- [ ] Beim Import (PROJ-3) werden alle aktiven Regeln auf jede neu importierte Buchung angewendet
- [ ] Import-Vorschau zeigt pro Buchung die automatisch zugewiesenen Kategorien
- [ ] Schaltfläche „Regeln jetzt anwenden" in den Einstellungen wendet alle aktiven Regeln auf alle bestehenden Buchungen an (nur auf Buchungen ohne Kategorie oder auf alle – Auswahl im Dialog)
- [ ] Wenn mehrere Regeln auf eine Buchung passen, werden alle zugeordneten Kategorien vergeben (keine Exklusivität)
- [ ] Regelreihenfolge kann per Drag-and-Drop angepasst werden (relevant für Anzeige, nicht für Priorität)
- [ ] Regeln können einzeln gelöscht werden; bestehende Kategorie-Zuordnungen bleiben erhalten

## Randfälle
- Was passiert, wenn eine Regel auf eine bereits kategorisierte Buchung trifft (beim nachträglichen Anwenden)? → Dialog fragt: nur unkategorisierte oder alle überschreiben
- Was passiert, wenn die Ziel-Kategorie einer Regel gelöscht wird? → Regel wird deaktiviert und als „ungültig" markiert (mit Warnung in der Regelliste)
- Was passiert, wenn Betrag-Regel mit Von > Bis konfiguriert wird? → Validierungsfehler beim Speichern
- Was passiert, wenn keine Regel auf eine Buchung passt? → Buchung bleibt unkategorisiert (kein Fehler)
- Was passiert bei sehr vielen Buchungen beim nachträglichen Anwenden (z.B. 1000+)? → Hintergrundverarbeitung mit Progress-Anzeige

## Technische Anforderungen
- Tabelle `categorization_rules`: `id`, `name` (Beschreibung), `rule_type` (enum: `text_contains`, `counterpart_contains`, `amount_range`, `month_quarter`), `condition` (JSONB für typ-spezifische Parameter), `category_id` (FK), `is_active` (bool), `sort_order` (int), `created_at`
- JSONB-Struktur je Regeltyp:
  - `text_contains`: `{ "term": "SEPA" }`
  - `counterpart_contains`: `{ "term": "Max Mustermann" }`
  - `amount_range`: `{ "min": 10.00, "max": 20.00, "direction": "both" }` (direction: both/in/out)
  - `month_quarter`: `{ "months": [3, 6, 9, 12] }` oder `{ "quarters": [1, 4] }`
- API-Route `GET/POST/PATCH/DELETE /api/admin/categorization-rules`
- API-Route `POST /api/admin/categorization-rules/apply` – wendet Regeln auf bestehende Buchungen an
- Serverseitige Hilfsfunktion `applyCategorizationRules(transactionIds[])` – wird beim Import und beim manuellen Anwenden genutzt
- RLS: Nur Admins dürfen `categorization_rules` lesen und schreiben

---
<!-- Abschnitte unten werden von nachfolgenden Skills hinzugefügt -->

## Technisches Design (Solution Architect)

### Komponentenstruktur

```
Einstellungen-Seite
└── Tab "Kategorisierungsregeln" (neu)
    ├── RulesTable – Liste aller Regeln mit Drag-Handle, Aktiv-Toggle, Löschen
    ├── "Neue Regel hinzufügen"-Button → RuleFormDialog (Modal)
    │   ├── Regelname, Regeltyp-Auswahl (Dropdown)
    │   ├── Typ-spezifische Felder (dynamisch je Typ)
    │   └── Ziel-Kategorie (Dropdown aus PROJ-12)
    └── "Regeln jetzt anwenden"-Button → ApplyRulesDialog
        ├── Auswahl: nur unkategorisierte ODER alle Buchungen
        └── Progress-Anzeige während Verarbeitung

Import-Vorschau (PROJ-3, bestehend – erweitert)
└── TransactionPreviewTable
    └── Neue Spalte „Automatische Kategorien" mit CategoryBadge
```

### Datenmodell

Neue Tabelle `categorization_rules`:
- **ID** – eindeutige Kennung
- **Name** – vom Admin vergebene Beschreibung (z.B. „Mitgliedsbeitrag 15 €")
- **Regeltyp** – text_contains | counterpart_contains | amount_range | month_quarter
- **Bedingung** – JSONB mit typ-spezifischen Parametern
- **Ziel-Kategorie** – Fremdschlüssel zu categories (PROJ-12)
- **Aktiv** – Boolean (inaktive Regeln werden übersprungen)
- **Reihenfolge** – Integer für Sortierung
- **Erstellt am** – Timestamp

JSONB-Bedingungen je Typ:
- text_contains / counterpart_contains: `{ "term": "Suchbegriff" }`
- amount_range: `{ "min": 10.00, "max": 20.00, "direction": "both|in|out" }`
- month_quarter: `{ "months": [3,6,9,12] }` oder `{ "quarters": [1,4] }`

### API-Endpunkte

| Route | Zweck |
|-------|-------|
| GET/POST `/api/admin/categorization-rules` | Regeln laden / anlegen |
| PATCH/DELETE `/api/admin/categorization-rules/[id]` | Bearbeiten / Löschen |
| POST `/api/admin/categorization-rules/apply` | Regeln auf Buchungen anwenden |
| POST `/api/admin/import/confirm` (bestehend, erweitert) | Regeln beim Import automatisch anwenden |

### Neue Komponenten

| Datei | Zweck |
|-------|-------|
| `kategorisierungsregeln-liste.tsx` | Tabelle mit Drag-and-Drop, Toggle, Löschen |
| `regel-form-dialog.tsx` | Modal zum Anlegen/Bearbeiten einer Regel |
| `regeln-anwenden-dialog.tsx` | Bestätigungs-Modal mit Progress-Anzeige |
| `use-categorization-rules.ts` | Hook für CRUD-Operationen auf Regeln |

### Technische Entscheidungen

**JSONB für Bedingungen:** Vier Regeltypen benötigen unterschiedliche Parameter. JSONB vermeidet ein starres Schema mit vielen leeren Spalten und erlaubt zukünftige Typen ohne Migrationsaufwand.

**Serverseitige Regelanwendung:** Eine gemeinsame Funktion `applyCategorizationRules()` wird sowohl beim Import als auch beim manuellen Anwenden genutzt – keine Logik-Duplikate.

**Batch-Verarbeitung:** Bei 1000+ Buchungen verarbeitet der Server in Batches mit Progress-Rückmeldung, um Browser-Timeouts zu vermeiden.

**Drag-and-Drop:** Reihenfolge ist rein kosmetisch (keine Priorität). `@dnd-kit` ist leichtgewichtig und Next.js-kompatibel.

**Kategorie-Löschung:** Wenn eine Kategorie gelöscht wird, wird die verknüpfte Regel per Datenbank-Trigger deaktiviert und als „ungültig" markiert.

### Neue Abhängigkeiten

| Paket | Zweck |
|-------|-------|
| `@dnd-kit/core` | Drag-and-Drop-Kern |
| `@dnd-kit/sortable` | Sortierbare Listen |

## QA-Testergebnisse
_Wird von /qa hinzugefügt_

## Deployment
_Wird von /deploy hinzugefügt_
