# PROJ-13: Automatische Kategorisierungsregeln

## Status: Deployed
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
- Was passiert, wenn eine Regel auf eine bereits kategorisierte Buchung trifft (beim nachträglichen Anwenden)? → Dialog bietet zwei Scopes: „nur unkategorisierte" (Buchungen mit Kategorie werden übersprungen) oder „alle Buchungen" (Regeltreffer ergänzen fehlende Kategorien bei allen passenden Buchungen). Manuell vergebene Kategorien bleiben in beiden Fällen erhalten und werden nie ersetzt — absichtliche Design-Entscheidung, um Datenverlust zu vermeiden (BUG-003-Fix).
- Was passiert, wenn die Ziel-Kategorie einer Regel gelöscht wird? → Regel wird deaktiviert und als „ungültig" markiert (mit Warnung in der Regelliste)
- Was passiert, wenn Betrag-Regel mit Von > Bis konfiguriert wird? → Validierungsfehler beim Speichern
- Was passiert, wenn keine Regel auf eine Buchung passt? → Buchung bleibt unkategorisiert (kein Fehler)
- Was passiert bei sehr vielen Buchungen beim nachträglichen Anwenden (z.B. 1000+)? → Hintergrundverarbeitung mit Progress-Anzeige

## Technische Anforderungen
- Neue Spalte `counterpart text NULL` auf `transactions` (BUG-002-Fix, Migration `015`). KI-Parser extrahiert den Namen des Auftraggebers/Empfängers getrennt vom Verwendungszweck. Altdaten bleiben auf NULL; `counterpart_contains`-Regeln matchen strikt gegen dieses Feld.
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

**Getestet am:** 2026-04-12 (Re-Test nach Bugfixes)
**Tester:** QA/Red Team (statische Code-Analyse, keine Live-Ausführung)
**Prüfumfang:** API-Routen, serverseitige Regelanwendung, Zod-Validierung, DB-Migrationen (014, 015, 016) inkl. RLS/Trigger/RPC, Frontend-Komponenten (Liste, Formular, Anwenden-Dialog), Integration in Import-Pipeline (Parse + Confirm) und Einstellungen-Tab, Re-Verifikation aller zuvor gemeldeten Bugs.

### Zusammenfassung (Re-Test)
- Akzeptanzkriterien: **9 von 9 bestanden**
- Bugs: **0 Hoch, 0 Mittel, 1 Niedrig (neu)**; alle zuvor gemeldeten Bugs (BUG-001 bis BUG-007) wurden erfolgreich behoben
- Sicherheitsaudit: unauffällig; `requireAdmin()` auf allen Routen, RLS aktiv, `insert_categorization_rule` RPC mit `SECURITY DEFINER` + zweiter `is_admin()`-Prüfung (Defense in Depth), Eingaben per Zod validiert
- **Produktionsreife: BEREIT** — keine Kritischen oder Hohen Bugs. BUG-008 (Niedrig) kann nach dem Deploy nachgezogen werden.

### Re-Test-Status der vorherigen Bugs

| Bug | Schweregrad | Status | Fix |
|-----|-------------|--------|-----|
| BUG-001 | Hoch | **Behoben** | `src/app/api/admin/import/route.ts` Zeilen 194-220: Parse-Route lädt aktive Regeln über `loadActiveCategorizationRules` und setzt `auto_category_ids` pro Preview-Buchung via `matchRulesForTransaction`. Fehler brechen Import nicht ab, werden als `rules_warning` zurückgegeben |
| BUG-002 | Mittel | **Behoben** | Migration `015_proj13_bug002_counterpart.sql` ergänzt `transactions.counterpart`; `src/lib/ki-parser.ts` extrahiert Namen separat; `counterpart_contains` matcht strikt gegen dieses Feld und bei `NULL` gibt es bewusst keinen Treffer (siehe `categorization-rules.ts` Zeile 61-66) |
| BUG-003 | Mittel | **Behoben durch Spec-Anpassung** | AK wurde präzisiert: „Scope `all` ergänzt nur fehlende Kategorien, manuelle Zuordnungen bleiben erhalten". UI-Text im Dialog (Zeile 162-166) stimmt überein; `existingSet` in `applyCategorizationRules` verhindert Überschreiben — gewollt, um Datenverlust auszuschließen |
| BUG-004 | Mittel | **Behoben** | Neuer `/apply/plan`-Endpoint liefert Scope-IDs; Frontend-Hook `applyCategorizationRules` (use-categorization-rules.ts Zeile 287ff) teilt in Chunks zu 200 und feuert `onProgress`. `RegelnAnwendenDialog` zeigt echte Prozentanzeige („Chunk X von Y", Progress-Bar mit Wert). Abbruch per `AbortController` möglich |
| BUG-005 | Niedrig | **Behoben** | `monthQuarterConditionSchema` hat zweite `.refine()`-Klausel (Zeile 67-80), die gleichzeitiges `months` + `quarters` serverseitig abweist |
| BUG-006 | Niedrig | **Behoben** | `reorder`-Route verlangt jetzt vollständige Permutation aller existierenden Regeln; Teilmengen werden mit 400 abgewiesen (Zeile 58-80) |
| BUG-007 | Niedrig | **Behoben** | Migration `016_proj13_bug007_atomic_rule_insert.sql`: Neue RPC `insert_categorization_rule` kapselt SELECT+INSERT in einer Transaktion mit `pg_advisory_xact_lock`. POST-Route nutzt die RPC |

### Akzeptanzkriterien (Re-Test)

| # | Kriterium | Status | Notiz |
|---|-----------|--------|-------|
| 1 | Bereich „Kategorisierungsregeln" in den Einstellungen mit Regel-Liste | Bestanden | Tab „Regeln" in `einstellungen/page.tsx` (nur Admin, via `isAdmin`-Guard), Komponente `KategorisierungsregelnListe` rendert Liste mit Drag-and-Drop, Toggle, Edit, Delete |
| 2 | Regel besteht aus Regeltyp, Bedingung, Ziel-Kategorie, Aktiv-Status | Bestanden | Tabelle `categorization_rules` enthält `rule_type`, `condition` (jsonb), `category_id`, `is_active`, `is_invalid`, `sort_order` |
| 3 | Regeltypen: text_contains, counterpart_contains, amount_range, month_quarter | **Bestanden** | Alle vier Typen validiert und funktional unterschiedlich. `counterpart_contains` matcht strikt gegen das neue `transactions.counterpart`-Feld (Migration 015), welches der KI-Parser separat extrahiert (`ki-parser.ts` Zeile 17). `amount_range` vergleicht absolute Werte + Richtungsfilter. `month_quarter` parst `booking_date` zeitzonen-sicher |
| 4 | Beim Import werden aktive Regeln auf neue Buchungen angewendet | Bestanden | `src/app/api/admin/import/confirm/route.ts` Zeile 140 ruft nach dem Insert `applyCategorizationRules(adminClient, newTxIds)`. Fehler brechen Import nicht ab, werden als `rules_warning` gemeldet |
| 5 | Import-Vorschau zeigt pro Buchung die automatisch zugewiesenen Kategorien | **Bestanden** | `src/app/api/admin/import/route.ts` Zeile 194-220: Parse-Endpoint ruft `loadActiveCategorizationRules` + `matchRulesForTransaction` für jede Preview-Buchung, setzt `auto_category_ids`. `transaction-preview-table.tsx` zeigt diese in eigener Spalte (Zeile 443-450). Fehler in der Regel-Vorschau werden als `rules_warning` zurückgegeben, ohne den Parse zu blockieren |
| 6 | Schaltfläche „Regeln jetzt anwenden" mit Dialog (nur unkategorisierte ODER alle) | Bestanden | `RegelnAnwendenDialog` mit RadioGroup (`uncategorized`/`all`), ruft neuen Chunk-Flow (`/apply/plan` + mehrfach `/apply`) |
| 7 | Mehrere passende Regeln vergeben alle Kategorien (keine Exklusivität) | Bestanden | `applyCategorizationRules` iteriert über alle aktiven Regeln, `matchRulesForTransaction` dedupliziert nur pro Kategorie-ID, nicht pro Regel |
| 8 | Drag-and-Drop für Reihenfolge (rein kosmetisch) | Bestanden | `@dnd-kit` Integration mit Pointer + Keyboard Sensor, Touch-Aktivierung am Handle via `touch-none`, vollständige Permutation in Reorder-API erzwungen |
| 9 | Regeln können gelöscht werden; bestehende Zuordnungen bleiben erhalten | Bestanden | DELETE-Route löscht nur `categorization_rules`-Zeile; `transaction_categories` unberührt (kein Cascade). UI-Hinweis im Delete-Dialog weist explizit darauf hin |

### Randfälle (Re-Test)

| # | Randfall | Status | Notiz |
|---|----------|--------|-------|
| R1 | Regel auf bereits kategorisierte Buchung beim nachträglichen Anwenden | Bestanden | Dialog bietet „nur unkategorisierte" und „alle". Spec wurde präzisiert: Scope `all` ergänzt fehlende Kategorien, manuelle Zuordnungen bleiben erhalten (absichtlich gegen Datenverlust). UI-Text und Code konsistent |
| R2 | Ziel-Kategorie einer Regel wird gelöscht | Bestanden | FK `ON DELETE SET NULL` + BEFORE-UPDATE-Trigger `mark_rule_invalid_on_category_delete` setzt `is_active=false` und `is_invalid=true`. UI zeigt Badge „ungültig" in der Regelliste. PATCH-Route setzt `is_invalid=false` zurück, wenn eine gültige Kategorie neu gesetzt wird |
| R3 | Betrag-Regel mit min > max | Bestanden | Client (`buildCondition`) und Server (`amountRangeConditionSchema.refine`) weisen ab |
| R4 | Keine Regel passt auf eine Buchung | Bestanden | Kein Fehler, Buchung bleibt unkategorisiert — `processed` zählt sie, `categorized` nicht |
| R5 | 1000+ Buchungen beim nachträglichen Anwenden (Progress-Anzeige) | **Bestanden** | Plan/Apply-Chunk-Flow mit `APPLY_CHUNK_SIZE = 200`, echte Progress-Bar mit „Chunk X von Y", `AbortController` erlaubt Abbruch. Hartes Serverlimit `MAX_SCOPE_TRANSACTIONS = 100 000` bleibt |

### Neu gefundene Probleme (Re-Test)

| # | Problem | Status |
|---|---------|--------|
| P1 | Toggle `is_active` per Switch in der Liste nutzt kein optimistisches Update mit Rollback: Bei Fehlschlag zeigt der Switch weiterhin den fälschlichen Zielzustand, bis ein Refetch erfolgt. `handleToggleActive` setzt nur `setError`, aber der SWR-ähnliche Cache wird nicht explizit revalidiert. UX-Problem, keine Datenintegrität betroffen | BUG-008 (Niedrig) |

### Sicherheitsaudit (Red Team, Re-Test)

| Prüfung | Ergebnis |
|---------|----------|
| Auth-Umgehung (GET/POST/PATCH/DELETE/apply/apply-plan/reorder) | Alle Routen beginnen mit `requireAdmin()` — keine Umgehung möglich |
| Autorisierung (Betrachter liest/schreibt Regeln) | RLS-Policies auf `categorization_rules` nutzen `is_admin()` — zweite Verteidigungslinie aktiv |
| Defense in Depth bei `insert_categorization_rule` RPC | `SECURITY DEFINER` RPC prüft explizit erneut `is_admin()` und wirft `42501` bei Verstoß. Vorbildlich |
| Zod-Validierung auf Input | Vorhanden für Create, Update (inkl. typgerechter Condition-Re-Validierung), Reorder, Apply, Plan |
| JSONB-Injection (manipulierte Condition-Strukturen) | Abgefangen durch typspezifische Zod-Schemas + superRefine; Monate-und-Quartale-Kombination serverseitig abgewiesen (BUG-005-Fix) |
| SQL-Injection über `term` (Text-Regeln) | Nicht möglich — Supabase nutzt parametrisierte Queries, Matching ist rein JS-seitig (`String.includes`) |
| XSS über Regelname/Term in UI | React escapet Text automatisch; keine `dangerouslySetInnerHTML`. Regelname-Länge auf 120 begrenzt (DB-CHECK + Zod) |
| Offenlegung sensibler Daten in API-Antworten | API liefert nur Regel-Felder + öffentliche Kategorie-Infos — unkritisch |
| Rate Limiting auf Rule-APIs | Nicht implementiert — Admin-Only, daher akzeptabel |
| Trigger-Funktion `mark_rule_invalid_on_category_delete` | `SECURITY DEFINER` mit leerem `search_path` — korrekt gehärtet |
| RPC `insert_categorization_rule` mit `search_path = ''` | Ja, schema-qualifizierte Zugriffe (`public.*`) |
| Apply-Route Scope-Limit | Hartes Limit 100 000 Buchungen verhindert Endlosabrufe |
| Chunk-Flow (`transaction_ids` max 1000) | Zod-Limit verhindert großflächige Einzelrequests |
| `reorder`-Permutation-Check | Vollständige Permutation erzwungen, verhindert inkonsistente `sort_order`-Zustände |

**Sicherheitsbewertung:** Unauffällig. Keine Kritischen oder Hohen Sicherheitsfunde. Defense-in-Depth durchgängig umgesetzt.

### Regressionstests (verwandte Features, Re-Test)

| Feature | Beobachtung |
|---------|-------------|
| PROJ-12 (Kategorien) | Kein Konflikt — Regeln verweisen nur auf `categories.id`; Löschlogik via Trigger korrekt. Neue Spalte `is_invalid` kommt sauber dazu |
| PROJ-3 (Import) | `confirm`-Route erweitert Auto-Kategorisierung; Parse-Route erweitert Preview um `auto_category_ids`. Fehler in der Regelanwendung brechen Import/Parse nicht ab (`rules_warning`). Keine Regression in bestehendem Import-Flow |
| PROJ-4 (Dashboard) | Nicht betroffen — Regeln wirken ausschließlich beim Import und bei manueller Anwendung |
| PROJ-5 (Eintragsbearbeitung) | Nicht betroffen — manuell gesetzte Kategorien werden nie von Regeln überschrieben |
| PROJ-6 (Export) | Nicht betroffen |
| DB-Schema | Neue Spalte `transactions.counterpart` ist `NULL`-fähig und optional, bestehende Queries (`SELECT *`) funktionieren weiter |

### Neue Bug-Liste (Re-Test)

#### BUG-008 [Niedrig] Toggle `is_active` ohne optimistisches Rollback
- **Beschreibung:** In `kategorisierungsregeln-liste.tsx` Zeile 180-189 ruft `handleToggleActive` `updateCategorizationRule` und setzt bei Fehlschlag nur eine Fehlermeldung. Die darunter liegende Cache-Schicht (`use-categorization-rules`) bestimmt den sichtbaren Switch-Zustand. Wenn der Server 500 liefert, bleibt der UI-Switch u. U. im falschen Zustand, bis der Benutzer die Seite neu lädt oder ein Refetch erfolgt.
- **Reproduktion:** Bei aktivem Request-Interceptor ein 500 auf PATCH simulieren. Schalter flippt, Fehlermeldung erscheint, Schalter bleibt im Zielzustand.
- **Erwartetes Verhalten:** Entweder optimistisches Update mit Rollback im Catch-Zweig oder expliziter Refetch nach Fehler.
- **Priorität:** Niedrig — rein kosmetisch, Datenintegrität unberührt, DB-Stand ist korrekt.

### Ursprüngliche Bug-Liste (Historie, alle behoben)

#### BUG-001 [Hoch] Import-Vorschau zeigt niemals automatische Kategorien — BEHOBEN
- **Beschreibung:** Das Akzeptanzkriterium „Import-Vorschau zeigt pro Buchung die automatisch zugewiesenen Kategorien" ist nicht erfüllt. Die Komponente `transaction-preview-table.tsx` liest `tx.auto_category_ids` (Zeilen 111, 443, 449), aber weder die Parse-Route (`src/app/api/admin/import/route.ts`) noch die Preview-Pipeline setzen dieses Feld jemals. Nur `src/lib/types.ts` definiert es optional.
- **Reproduktion:**
  1. Als Admin Regeln anlegen, die auf einen bekannten PDF-Eintrag passen würden
  2. PDF hochladen und Vorschau öffnen
  3. Spalte „Automatische Kategorien" bleibt leer, obwohl die Regeln nach dem Bestätigen greifen
- **Erwartetes Verhalten:** Vor dem Bestätigen wird `applyCategorizationRules` trocken auf die Preview-Buchungen angewendet und das Ergebnis in `auto_category_ids` pro Buchung zurückgegeben, damit der Admin sehen kann, was automatisch kategorisiert wird.
- **Fix-Hinweis:** Im Parse-Endpoint nach dem Parsing die aktiven Regeln gegen die Preview-Buchungen matchen (ohne DB-Schreibe) und IDs anhängen.
- **Priorität:** Hoch — blockiert Akzeptanzkriterium, Produktionsreife verhindert.

#### BUG-002 [Mittel] `counterpart_contains`-Regel funktional identisch zu `text_contains`
- **Beschreibung:** Laut AK „Freitextsuche im Feld Auftraggeber/Empfänger". Das Schema `transactions` hat aber kein eigenes Feld dafür — der Kommentar in `categorization-rules.ts` (Zeile 35-42) bestätigt, dass beide Typen in `description` suchen. Für Benutzer nicht erkennbar; zwei Regeltypen für denselben Zweck irritieren.
- **Reproduktion:**
  1. Regel „Text enthält ‚Mustermann'" anlegen
  2. Regel „Auftraggeber enthält ‚Mustermann'" anlegen
  3. Beide matchen dieselben Buchungen
- **Erwartetes Verhalten:** Entweder das `transactions`-Schema um ein separates `counterpart`-Feld erweitern (beim Parsen befüllt), oder den Regeltyp entfernen/als Alias dokumentieren.
- **Priorität:** Mittel — AK nicht wortgetreu erfüllt, aber Funktion existiert.

#### BUG-003 [Mittel] „Alle Buchungen"-Scope überschreibt bestehende Kategorien nicht
- **Beschreibung:** Der Randfall „Dialog fragt: nur unkategorisierte oder alle überschreiben" ist nur teilweise umgesetzt. Der Scope `all` läuft zwar über alle Buchungen, schreibt aber nur zusätzliche Zuordnungen und lässt vorhandene stehen (`existingSet` verhindert Duplikate, ersetzt aber nichts). Der UI-Text ist korrekt („bleiben zusätzlich erhalten"), aber das Original-AK spricht explizit von „überschreiben".
- **Reproduktion:**
  1. Buchung manuell Kategorie A zuweisen
  2. Regel anlegen, die Kategorie B zuweist und auf die Buchung matcht
  3. Scope „alle" → Buchung hat danach A **und** B, nicht nur B
- **Erwartetes Verhalten:** Eindeutigkeit in Spec oder UI. Entweder „überschreiben" wirklich implementieren (alte Zuordnung entfernen) oder AK/Spec anpassen.
- **Priorität:** Mittel — Inkonsistenz Spec vs. Implementierung.

#### BUG-004 [Mittel] Keine echte Progress-Anzeige bei Massen-Regelanwendung
- **Beschreibung:** `RegelnAnwendenDialog` zeigt nur einen indeterminierten `<Progress value={undefined} />`. Der POST blockiert bis zum Ende — bei 10 000+ Buchungen riskiert das Serverless-Timeouts und der Benutzer sieht keinen Fortschritt. Spec fordert „Hintergrundverarbeitung mit Progress-Anzeige".
- **Reproduktion:** Datenbank mit >5000 Buchungen, Scope „alle" klicken.
- **Erwartetes Verhalten:** Streaming-Response (Server-Sent Events) oder Batch-API mit Polling.
- **Priorität:** Mittel — funktional bei kleinen Datenmengen, wird zum Problem bei Skalierung.

#### BUG-005 [Niedrig] `month_quarter`-Regel mit beiden Feldern nicht definiert
- **Beschreibung:** Wenn in der JSONB-Bedingung sowohl `months` als auch `quarters` gesetzt sind (z. B. via direkte DB-Manipulation), gewinnen in der Matching-Logik stillschweigend die Monate (`categorization-rules.ts` Zeile 78). UI verhindert das, aber Server-Validierung lässt beide durch.
- **Priorität:** Niedrig — kosmetisch, undokumentiert.

#### BUG-006 [Niedrig] Reorder akzeptiert Teilmengen
- **Beschreibung:** `POST /reorder` prüft nur, dass alle übergebenen IDs existieren — nicht, dass ALLE Regeln enthalten sind. Wird eine Teilmenge gesendet, bleiben andere Regeln mit alten `sort_order`-Werten stehen, was zu Kollisionen und nichtdeterministischer Anzeige führt.
- **Priorität:** Niedrig — rein kosmetisch (Reihenfolge).

#### BUG-007 [Niedrig] Race Condition bei `sort_order`-Vergabe in POST
- **Beschreibung:** POST-Route ermittelt `nextSortOrder = max + 1` in separater Query, ohne Transaction. Zwei parallele POSTs können denselben `sort_order` erhalten. Nicht schmerzhaft, da nur Anzeigereihenfolge.
- **Priorität:** Niedrig.

### Produktionsreife-Empfehlung
**NICHT BEREIT.** BUG-001 (Hoch) muss behoben werden, bevor dieses Feature produktiv geht. BUG-002, BUG-003, BUG-004 sollten vor dem Deploy geklärt werden (Spec-Anpassung oder Fix). BUG-005 bis BUG-007 können nachgezogen werden.

### Cross-Browser & Responsiv
Statische Code-Analyse: shadcn/ui-Komponenten werden durchgängig verwendet, responsive Klassen (`sm:`, `max-w-*`, `grid-cols-*`) sind vorhanden, Drag-Handle hat `touch-none`. Manuelles Testen in Chrome/Firefox/Safari und auf 375/768/1440 px wurde nicht durchgeführt (keine Live-Umgebung) — empfohlen vor dem Deploy.

## Deployment

- **Produktions-URL:** https://cbs-finanz.vercel.app
- **Deployt am:** 2026-04-12
- **Commit:** `f0ec3e0` – feat(PROJ-13): Automatische Kategorisierungsregeln
- **Migrationen eingespielt:**
  - `014_proj13_categorization_rules.sql` (Tabelle, RLS, Trigger)
  - `015_proj13_bug002_counterpart.sql` (Spalte `transactions.counterpart`)
  - `016_proj13_bug007_atomic_rule_insert.sql` (RPC mit Advisory-Lock)
- **Vercel-Build:** erfolgreich (State `READY`)
- **Smoke-Test:** `/` → 307 (Redirect zu Login), `/login` → 200
- **Offene Follow-ups:** keine kritischen. Optional: counterpart-Backfill für Altdaten per erneutem Import, UI-Anzeige der `counterpart`-Spalte in der Buchungstabelle.
