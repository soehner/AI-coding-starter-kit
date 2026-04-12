# PROJ-15: Zusammengesetzte Kategorisierungsregeln

## Status: Deployed
**Erstellt:** 2026-04-12
**Zuletzt aktualisiert:** 2026-04-12

## Abhängigkeiten
- Baut auf: PROJ-13 (Automatische Kategorisierungsregeln). Alle PROJ-13-Infrastruktur (RLS, Trigger, Reorder, Plan/Apply-Chunking, Import-Integration) bleibt unverändert — geändert wird nur die innere Struktur einer Regel.

## Beschreibung
Eine Regel kann mehrere Kriterien enthalten, die per **UND** oder **ODER** verknüpft sind. Das ersetzt die bisherige Beschränkung auf genau ein Kriterium pro Regel.

Beispiel: Eine Regel „Mitgliedsbeitrag" kann aus drei Kriterien bestehen — Buchungstext enthält „SEPA", Betrag zwischen 15 € und 15 € (Eingang), Auftraggeber enthält „Mustermann" — und wird nur dann angewendet, wenn alle drei gleichzeitig zutreffen (UND) oder wenn mindestens eines zutrifft (ODER).

## User Stories
- Als Administrator möchte ich innerhalb einer Regel mehrere Kriterien definieren, damit ich präzisere Zuordnungen bauen kann.
- Als Administrator möchte ich wählen, ob alle Kriterien zutreffen müssen (UND) oder ob ein Treffer reicht (ODER).
- Als Administrator möchte ich Kriterien vom selben Typ mehrfach verwenden können (z.B. zwei „Buchungstext enthält" per ODER, um „enthält A oder B" abzubilden).
- Als Administrator möchte ich Kriterien einzeln hinzufügen und wieder entfernen, während ich eine Regel anlege oder bearbeite.

## Akzeptanzkriterien
- [ ] Das Regelformular zeigt eine Liste von Kriterien mit „Hinzufügen" und „Entfernen".
- [ ] Oberhalb der Kriterienliste gibt es eine Auswahl „Alle Kriterien müssen zutreffen (UND)" / „Mindestens ein Kriterium trifft zu (ODER)".
- [ ] Eine Regel muss mindestens 1 und darf höchstens 10 Kriterien enthalten.
- [ ] Kriterien vom selben Typ sind mehrfach erlaubt (z.B. zwei `text_contains`).
- [ ] Jedes Kriterium wird einzeln validiert (wie in PROJ-13 gehabt) und zeigt Fehler typ-spezifisch an.
- [ ] Beim Regel-Matching werden alle Kriterien ausgewertet und per UND/ODER verknüpft. Mehrere passende Regeln vergeben weiterhin alle ihre Ziel-Kategorien.
- [ ] Die Regelliste zeigt pro Regel eine Kurzbeschreibung aller Kriterien mit Verknüpfungs-Operator (z.B. „Buchungstext enthält „SEPA" **UND** Betrag 10,00 € – 20,00 €").
- [ ] Die Typ-Badge (bisher „Buchungstext"/„Betrag" etc.) wird durch eine Combinator-Badge („UND"/„ODER") ersetzt.
- [ ] Bestehende PROJ-13-Funktionen (Drag-and-Drop, Aktiv-Toggle, Löschen, „Regeln jetzt anwenden", Import-Integration, ungültig-Markierung bei Kategorielöschung) funktionieren unverändert weiter.

## Randfälle
- **Leere Kriterienliste beim Speichern** → Validierungsfehler „Mindestens ein Kriterium ist erforderlich."
- **Mehr als 10 Kriterien** → „Hinzufügen"-Button wird deaktiviert, serverseitige Validierung weist den Request ab.
- **Regel mit nur einem Kriterium** → Funktioniert wie bisher; `combinator` ist dann bedeutungslos, wird aber mitgespeichert (Default `"AND"`).
- **Migration der einen Bestandsregel** → wird im Zuge der Schema-Migration verworfen (`TRUNCATE`), Admin legt sie über das neue UI neu an. Bestätigt durch den Benutzer.
- **PATCH (Bearbeiten) einer Regel**: Kriterien können dabei komplett ersetzt werden (Client sendet die neue Liste). Kein selektives Einfügen/Entfernen pro Kriterium — Client merged das vor dem Absenden.

## Technische Anforderungen

### Datenbank (Migration 019)
- `TRUNCATE public.categorization_rules` (Nutzer verwirft die eine Bestandsregel)
- `ALTER TABLE ... DROP COLUMN rule_type` (Spalte wird hinfällig, weil Kriterien im JSONB getragen werden)
- `DROP CONSTRAINT categorization_rules_rule_type_check` (wird durch den Spalten-Drop mitgelöscht)
- Die Spalte `condition jsonb` bleibt erhalten, aber ihre Bedeutung ändert sich:
  - Neu: `{ "combinator": "AND" | "OR", "criteria": [ {"type": "...", ...}, ... ] }`
- Kommentar an der Spalte dokumentiert die neue Struktur

### Datenbank (Migration 020)
- `DROP FUNCTION public.insert_categorization_rule(text, text, jsonb, uuid, boolean)` (alte Signatur)
- `CREATE FUNCTION public.insert_categorization_rule(text, jsonb, uuid, boolean) RETURNS uuid` (neue Signatur ohne `p_rule_type`)
- Advisory-Lock + SECURITY DEFINER + `is_admin()`-Check bleiben

### Typen
```
type Combinator = "AND" | "OR"

type RuleCriterion =
  | { type: "text_contains"; term: string }
  | { type: "counterpart_contains"; term: string }
  | { type: "amount_range"; min: number; max: number; direction: AmountDirection }
  | { type: "month_quarter"; months?: number[]; quarters?: number[] }

interface CategorizationRule {
  id: string
  name: string
  combinator: Combinator
  criteria: RuleCriterion[]
  category_id: string
  category?: Category | null
  is_active: boolean
  is_invalid?: boolean
  sort_order: number
  created_at: string
}
```

### Match-Logik
- `criterionMatches(criterion, tx)` — innere Switch-Logik (heute in `ruleMatches`)
- `ruleMatches(rule, tx)` — iteriert über `rule.criteria`, kombiniert per `every()` (AND) oder `some()` (OR)
- Eine Regel ohne Kriterien matcht nichts (Defensiv-Check)

### API
- `POST /api/admin/categorization-rules` — Body: `{ name, combinator, criteria[], category_id, is_active? }`
- `PATCH /api/admin/categorization-rules/[id]` — optional: `name`, `combinator`, `criteria[]`, `category_id`, `is_active`, `sort_order`
- `GET` liefert die neue Struktur
- `reorder`, `apply`, `apply/plan` — unverändert

### UI (RegelFormDialog)
- Name-Input
- Radio-Auswahl Combinator (UND/ODER) — oberhalb der Kriterienliste
- Kriterienliste:
  - Je Zeile: Typ-Dropdown + dynamische Felder (Suchbegriff / Von+Bis+Richtung / Monat oder Quartal)
  - Löschen-Button pro Zeile (deaktiviert, wenn nur noch 1 Kriterium)
- Button „Kriterium hinzufügen" (deaktiviert ab 10 Kriterien)
- Kategorie-Dropdown (wie bisher)

### UI (KategorisierungsregelnListe)
- Typ-Badge wird zur Combinator-Badge (`UND` / `ODER`)
- `formatRule(rule)` erzeugt eine kommaseparierte Bedingung mit Verknüpfung:
  - AND: „Buchungstext enthält „SEPA" **UND** Betrag 10,00 € – 20,00 € (Eingang)"
  - OR: gleicher Aufbau mit „**ODER**"
  - Bei nur einem Kriterium: Combinator weggelassen
- Rest der Zeile (Drag-Handle, Kategorie-Badge, Toggle, Bearbeiten, Löschen, ungültig-Badge) unverändert

### Sicherheit
- RLS-Policies auf `categorization_rules` (aus PROJ-13) bleiben; `combinator` und `criteria` sind reine Inhaltsänderungen.
- Zod-Schema für `criteria` nutzt `z.discriminatedUnion("type", [...])` und ruft die bestehenden Kriterien-Schemas pro Typ auf. `min(1)`, `max(10)`.

---
<!-- Abschnitte unten werden von nachfolgenden Skills hinzugefügt -->

## Technisches Design (Solution Architect)
_Nicht benötigt — Design steht oben unter „Technische Anforderungen", da es sich um einen internen Umbau von PROJ-13 handelt und PM-seitig nichts Neues zu präsentieren ist._

## QA-Testergebnisse
_Wird von /qa hinzugefügt_

## Deployment

- **Produktions-URL:** https://cbs-finanz.vercel.app
- **Deployt am:** 2026-04-12
- **Commit:** `8bdba86` – feat(PROJ-15): Zusammengesetzte Kategorisierungsregeln mit UND/ODER
- **Migrationen eingespielt:**
  - `019_proj15_compound_rules.sql` (TRUNCATE, DROP rule_type, Kommentar)
  - `020_proj15_insert_rpc_update.sql` (RPC ohne rule_type-Parameter)
- **Vercel-Build:** erfolgreich (State `READY`)
- **Anmerkung:** QA-Skill wurde für dieses Feature nicht separat ausgeführt — der Umbau ist klein und rein intern zu PROJ-13. Build + Lint + TypeScript sind grün.
