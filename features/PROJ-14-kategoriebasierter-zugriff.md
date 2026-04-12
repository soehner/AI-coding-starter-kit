# PROJ-14: Kategoriebasierter Zugriff für Betrachter

## Status: In Review
**Erstellt:** 2026-04-12
**Zuletzt aktualisiert:** 2026-04-12

## Abhängigkeiten
- Benötigt: PROJ-12 (Buchungskategorisierung) – Kategorien müssen existieren
- Benötigt: PROJ-7 (Granulare Feature-Berechtigungen) – erweitert das bestehende Berechtigungssystem
- Erweitert: PROJ-2 (Benutzerverwaltung) – Kategorie-Einschränkungen werden dort konfiguriert

## Beschreibung
Administratoren können in der Benutzerverwaltung für jeden einzelnen Betrachter festlegen, welche Buchungskategorien er sehen darf. Ein eingeschränkter Betrachter sieht im Dashboard, beim Export und in allen Auswertungen ausschließlich Buchungen, die mindestens einer seiner erlaubten Kategorien zugeordnet sind. Unkategorisierte Buchungen sind für eingeschränkte Betrachter standardmäßig nicht sichtbar.

## User Stories
- Als Administrator möchte ich in der Benutzerverwaltung für einen Betrachter auswählen, welche Kategorien er sehen darf, damit z.B. ein Prüfer nur Reisekosten einsehen kann.
- Als Administrator möchte ich einem Betrachter Zugriff auf „alle Kategorien" geben (Standard), damit bestehende Betrachter ohne Einschränkung weiterarbeiten.
- Als Betrachter mit Kategorie-Einschränkung möchte ich im Dashboard nur die für mich freigegebenen Buchungen sehen, damit mein Blick auf die relevanten Daten fokussiert bleibt.
- Als Betrachter möchte ich klar sehen, dass meine Ansicht gefiltert ist, damit ich nicht fälschlicherweise denke, es gäbe keine anderen Buchungen.
- Als Administrator möchte ich jederzeit die Kategorie-Einschränkung eines Betrachters ändern oder aufheben.

## Akzeptanzkriterien
- [ ] In der Benutzerverwaltung gibt es pro Betrachter einen Bereich „Kategorie-Zugriff" (unterhalb der Feature-Berechtigungen aus PROJ-7)
- [ ] Standardmäßig ist „Alle Kategorien" ausgewählt (kein Filter)
- [ ] Admin kann per Multi-Select-Dropdown eine oder mehrere Kategorien als erlaubt markieren
- [ ] Änderungen werden gespeichert (Speichern-Button oder Sofortspeichern – konsistent mit PROJ-7)
- [ ] Server-seitig wird bei `GET /api/transactions` und `GET /api/transactions/summary` die Kategorie-Einschränkung des aktuell eingeloggten Benutzers berücksichtigt
- [ ] Unkategorisierte Buchungen sind für eingeschränkte Betrachter nicht sichtbar (kein gesondertes Opt-in)
- [ ] Im Dashboard erscheint für eingeschränkte Betrachter ein Hinweisbanner: „Ihre Ansicht ist auf bestimmte Kategorien beschränkt."
- [ ] Der Export (PROJ-6) exportiert für eingeschränkte Betrachter nur die sichtbaren Buchungen
- [ ] KPI-Cards (Kontostand, Summen) spiegeln nur die sichtbaren Buchungen wider – kein Zugriff auf Gesamtzahlen
- [ ] Admins unterliegen nie einer Kategorie-Einschränkung

## Randfälle
- Was passiert, wenn eine erlaubte Kategorie gelöscht wird? → Kategorie wird aus der Erlaubt-Liste des Betrachters entfernt; bei 0 verbleibenden Kategorien → Betrachter sieht Hinweis „Keine Buchungen verfügbar" (nicht Fehler)
- Was passiert, wenn ein Betrachter mit Einschränkung `edit_transactions`-Berechtigung (PROJ-7) hat? → Er kann nur die sichtbaren Buchungen bearbeiten
- Was passiert bei einem Betrachter ohne Einschränkung (Standardfall)? → Kein Performance-Overhead; API verhält sich wie bisher
- Was passiert, wenn der Betrachter versucht, eine Buchung direkt per ID aufzurufen (`GET /api/transactions/[id]`), die nicht in seinen Kategorien liegt? → 404 (nicht 403, um keine Informationen preiszugeben)
- Was passiert bei neuen Buchungen, die unkategorisiert importiert werden? → Eingeschränkte Betrachter sehen diese nicht, bis sie kategorisiert werden

## Technische Anforderungen
- Tabelle `user_category_access`: `user_id` (FK zu user_profiles), `category_id` (FK zu categories) – viele-zu-viele
- Wenn für einen Benutzer kein Eintrag existiert → Zugriff auf alle Kategorien (kein Filter)
- API `GET /api/transactions` erhält einen serverseitigen Filter: JOINs auf `transaction_categories` und prüft erlaubte `category_id`s des Benutzers
- Hilfsfunktion `getCategoryFilter(userId)` – gibt `null` (kein Filter) oder `Set<categoryId>` zurück
- API-Route `GET/PUT /api/admin/users/[id]/category-access` – nur Admins
- RLS: `user_category_access` nur für Admins schreibbar; Benutzer können eigene Zeilen lesen
- Erweiterung von `user_permissions` nicht nötig – eigene Tabelle für klare Trennung

---
<!-- Abschnitte unten werden von nachfolgenden Skills hinzugefügt -->

## Technisches Design (Solution Architect)

### Komponentenstruktur

```
Benutzerverwaltung (Admin-Seite)
└── BenutzerBearbeitenDialog / BenutzerDetailSeite
    ├── FeatureBerechtigungenPanel (PROJ-7, bestehend)
    └── KategorieZugriffPanel (NEU)
        ├── Hinweistext: "Einschränkung gilt nur für Betrachter"
        ├── Toggle: "Alle Kategorien" (Standard) / "Eingeschränkter Zugriff"
        └── [Wenn eingeschränkt:] CategoryMultiSelect (bestehend, wiederverwenden)
            └── Speichern-Button

Dashboard (Betrachter-Ansicht)
├── EingeschränkteBetrachterBanner (NEU, nur wenn Einschränkung aktiv)
│   └── Info: "Ihre Ansicht ist auf bestimmte Kategorien beschränkt."
├── KpiCards (bestehend, Zahlen automatisch gefiltert via API)
├── TransaktionsFilterBar (bestehend)
└── TransaktionsTabelle (bestehend, Daten automatisch gefiltert via API)
```

### Datenmodell

**Neue Tabelle: `user_category_access`**
```
Jeder Eintrag verknüpft einen Benutzer mit einer erlaubten Kategorie:
- Benutzer-ID (Verweis auf Benutzerprofil)
- Kategorie-ID (Verweis auf Kategorien-Tabelle)
- Erstellt am

Logik: Keine Einträge = alle Kategorien sichtbar (kein Filter)
        Ein oder mehr Einträge = nur diese Kategorien sichtbar
```

**Betroffene bestehende Tabellen:**
- `transactions` → wird gefiltert (JOIN auf Kategorie-Zuordnungen)
- `transaction_categories` → Verknüpfung Buchung ↔ Kategorie (bereits vorhanden)

### Neue API-Routen

| Route | Methode | Zweck |
|-------|---------|-------|
| `/api/admin/users/[id]/category-access` | GET | Aktuelle Kategorieeinschränkung lesen |
| `/api/admin/users/[id]/category-access` | PUT | Kategorieeinschränkung setzen/löschen |

**Erweiterte bestehende Routen:**
- `GET /api/transactions` → prüft nun Kategorie-Filter des eingeloggten Benutzers
- `GET /api/transactions/[id]` → gibt 404 zurück, wenn Buchung nicht in erlaubten Kategorien
- `GET /api/transactions/summary` → KPI-Zahlen nur für sichtbare Buchungen
- `GET /api/export/kassenbuch` → exportiert nur sichtbare Buchungen

### Hilfsfunktion (serverseitig)

Eine zentrale Hilfsfunktion `getCategoryFilter(userId)` wird einmalig gebaut und von allen API-Routen genutzt:
- Gibt `null` zurück → kein Filter, alle Buchungen sichtbar (Standard für Admins und uneingeschränkte Betrachter)
- Gibt eine Liste von Kategorie-IDs zurück → nur diese Buchungen werden zurückgegeben

### Sicherheitsschicht (RLS)

- `user_category_access`: Admins können alle Zeilen lesen/schreiben; Betrachter können nur ihre eigenen Zeilen lesen
- Keine Kategorie-Einschränkung für Admins (serverseitig geprüft, nicht nur RLS)

### Technische Entscheidungen

| Entscheidung | Begründung |
|---|---|
| Eigene Tabelle statt Erweiterung von `user_permissions` | Klare Trennung: Feature-Rechte vs. Datenzugang – leichter wartbar |
| "Kein Eintrag = voller Zugriff" (Opt-in-Filter) | Bestehende Betrachter sind nicht betroffen – kein Breaking Change |
| 404 statt 403 bei Direktzugriff per ID | Verhindert, dass Betrachter erkennen können, ob eine Buchung existiert |
| Serverseitiger Filter (nicht clientseitig) | Sicherheitsrelevant: Daten gelangen gar nicht erst zum Client |
| Gelöschte Kategorie → automatisch aus Erlaubt-Liste entfernen | ON DELETE CASCADE in der Datenbank – keine Inkonsistenz möglich |

### Neue Komponenten

| Komponente | Typ | Beschreibung |
|---|---|---|
| `KategorieZugriffPanel` | Neu | Abschnitt in der Benutzerverwaltung zum Konfigurieren der Einschränkung |
| `EingeschränkteBetrachterBanner` | Neu | Info-Banner im Dashboard für eingeschränkte Betrachter |

**Wiederverwendete Komponenten:**
- `CategoryMultiSelect` (bereits in PROJ-12 gebaut) → direkt nutzbar für die Kategorieauswahl

### Abhängigkeiten (keine neuen Pakete nötig)

Keine neuen npm-Pakete erforderlich – alle benötigten UI-Bausteine (Multi-Select, Banner/Alert, Button) sind bereits installiert.

## QA-Testergebnisse

### Re-Test nach Bug-Fixes (2026-04-12, 4. Durchlauf)

**Getestet:** 2026-04-12 (4. Nachkontrolle)
**App-URL:** http://localhost:3000
**Tester:** QA-Ingenieur (KI) – statischer Code-Review
**Anlass:** Überprüfung der Bug-Fixes nach dem 3. QA-Durchlauf (BUG-12 Migrations-Kollision 017)

#### Status der offenen Bugs aus 3. Durchlauf

| Bug | Schwere | Status | Nachweis |
|-----|---------|--------|----------|
| BUG-12: Migrations-Kollision 017 (PROJ-14 vs. PROJ-15) | Kritisch | **BEHOBEN** | `ls supabase/migrations/` zeigt eindeutige Präfixe: `017_proj14_category_access.sql`, `018_proj14_bug_fixes.sql`, `019_proj15_compound_rules.sql`, `020_proj15_insert_rpc_update.sql`. Keine doppelten Präfixe mehr. |
| BUG-2: Fail-safe sperrt uneingeschränkten Betrachter aus | Mittel | **OFFEN** | `src/lib/category-access.ts` Z. 51-60 unverändert: DB-Fehler → `{ restricted: true, allowedCategoryIds: [] }`. Als bewusster sicherer Default dokumentiert. |
| BUG-3: Inkonsistentes Speicher-Paradigma | Niedrig | **OFFEN** | `kategorie-zugriff-panel.tsx` nutzt weiterhin expliziten Speichern-Button vs. Sofortspeichern im Nachbar-Panel. |
| BUG-4: RF-4 verweist auf nicht existierende Route `GET /api/transactions/[id]` | Niedrig | **OFFEN** | `src/app/api/transactions/[id]/route.ts` exportiert weiterhin nur `PATCH`, kein `GET`. Rein dokumentarischer Spec-Hinweis. |
| BUG-7: `availableYears` `.limit(10000)` für eingeschränkte Benutzer | Niedrig | **OFFEN** | `summary/route.ts` Z. 112 weiterhin `.limit(10000)`. Nicht skalierend, aber bei aktuellen Datenmengen unkritisch. |
| BUG-8: `isDirty`-Check brüchig | Niedrig | **OFFEN** | `kategorie-zugriff-panel.tsx` Z. 98-102 unverändert. Funktioniert solange Duplikate ausgeschlossen bleiben. |
| BUG-10: PATCH-Timing-Leak | Niedrig | **OFFEN** | Unverändert. Theoretisches Timing-Seitenkanal-Risiko, keine realistische Bedrohung. |
| BUG-11: `kategorie-zugriff-panel` verliert Auswahl bei Toggle-Off | Niedrig | **OFFEN** | `kategorie-zugriff-panel.tsx` Z. 117-120 weiterhin `category_ids: restricted ? selectedIds : []`. Auswahl wird beim Toggle-Off nicht clientseitig bewahrt. |

**Behoben in diesem Durchlauf:** 1 (BUG-12 – produktive Auflösung)
**Weiterhin offen:** 7

#### Neue Findings im 4. Durchlauf

Keine neuen Bugs gefunden. Die Migrations-Reihenfolge ist nun sauber und deterministisch:
```
014_proj13_categorization_rules.sql
015_proj13_bug002_counterpart.sql
016_proj13_bug007_atomic_rule_insert.sql
017_proj14_category_access.sql
018_proj14_bug_fixes.sql
019_proj15_compound_rules.sql
020_proj15_insert_rpc_update.sql
```

Alle Präfixe sind eindeutig, die alphabetische Sortierung spiegelt die beabsichtigte Feature-Reihenfolge wider (PROJ-13 vor PROJ-14 vor PROJ-15).

### Zusammenfassung (4. Durchlauf)

- **Akzeptanzkriterien:** 10/10 bestanden (unverändert)
- **Randfälle:** 4/5 bestanden (RF-4 weiterhin spec-inkonsistent, nicht funktionsrelevant)
- **Offene Bugs:** 7 gesamt
  - **Kritisch:** 0
  - **Hoch:** 0
  - **Mittel:** 1 (BUG-2)
  - **Niedrig:** 6 (BUG-3, BUG-4, BUG-7, BUG-8, BUG-10, BUG-11)
- **Sicherheitsaudit:** Keine neuen Sicherheitslücken. Die Info-Leak-Fixes aus dem 2. Durchlauf (`get_current_balance` und `get_opening_balance` mit `p_category_filter`) sind weiterhin korrekt umgesetzt.
- **Produktionsreif:** **JA** (keine Kritischen oder Hohen Bugs mehr offen)
- **Empfehlung:** PROJ-14 ist bereit für das Deployment. BUG-2 sollte zeitnah im Folge-Sprint adressiert werden (UX-Problem bei transienten DB-Fehlern). Alle anderen offenen Bugs sind niedrige Priorität und können nach dem Deployment schrittweise abgearbeitet werden. Empfehlung: Einen Pre-Commit-Hook einführen, der Migrations-Präfix-Kollisionen verhindert (`ls supabase/migrations/ | cut -c1-3 | sort | uniq -d` muss leer sein), um Wiederkehr von BUG-9/BUG-12 auszuschließen.

### Noch nicht getestet (Grenzen des statischen Reviews)

- Live-Deployment gegen eine frische Supabase-Instanz
- Cross-Browser-Test (Chrome/Firefox/Safari) – strukturell keine Risiken erkennbar
- Responsive Breakpoints des `KategorieZugriffPanel` (375/768/1440 px)
- End-to-End-Test mit Demo-Betrachter und realen Kategorien

---

### Re-Test nach Bug-Fixes (2026-04-12, 3. Durchlauf)

**Getestet:** 2026-04-12 (3. Nachkontrolle)
**App-URL:** http://localhost:3000
**Tester:** QA-Ingenieur (KI) – statischer Code-Review
**Anlass:** Überprüfung der Bug-Fixes nach dem 2. QA-Durchlauf (BUG-9 Migrations-Kollision)

#### Status der offenen Bugs aus 2. Durchlauf

| Bug | Schwere | Status | Nachweis |
|-----|---------|--------|----------|
| BUG-9: Migrations-Kollision 016 | Kritisch | **BEHOBEN (teilweise, siehe BUG-12)** | `016_proj14_category_access.sql` wurde zu `017_proj14_category_access.sql` umbenannt und `017_proj14_bug_fixes.sql` zu `018_proj14_bug_fixes.sql`. Kollision bei 016 ist weg. |
| BUG-2: Fail-safe sperrt uneingeschränkten Betrachter aus | Mittel | **OFFEN** | `category-access.ts` Z. 51-60 unverändert. |
| BUG-3: Inkonsistentes Speicher-Paradigma | Niedrig | **OFFEN** | Unverändert. |
| BUG-4: RF-4 verweist auf nicht existierende Route | Niedrig | **OFFEN** | `GET /api/transactions/[id]` existiert weiterhin nicht. |
| BUG-7: `availableYears` `.limit(10000)` | Niedrig | **OFFEN** | Unverändert. |
| BUG-8: `isDirty`-Check brüchig | Niedrig | **OFFEN** | Unverändert. |
| BUG-10: PATCH-Timing-Leak | Niedrig | **OFFEN** | Unverändert. |
| BUG-11: `kategorie-zugriff-panel` verliert Auswahl bei Toggle-Off | Niedrig | **OFFEN** | Unverändert. |

**Behoben in diesem Durchlauf:** 1 (BUG-9 → aber neue Kollision bei 017, siehe BUG-12)
**Weiterhin offen:** 7

#### Neue Findings im 3. Durchlauf

##### BUG-12: NEUE Migrations-Nummer-Kollision 017 zwischen PROJ-14 und PROJ-15
- **Schweregrad:** Kritisch (Deployment-Blocker)
- **Komponente:** `supabase/migrations/`
- **Beobachtung:** Die Umbenennung der PROJ-14-Migration von `016_*` auf `017_*` hat BUG-9 an der ursprünglichen Stelle behoben, aber eine NEUE Kollision erzeugt: Es existieren jetzt zwei Dateien mit dem Präfix `017`:
  - `017_proj14_category_access.sql` (PROJ-14)
  - `017_proj15_compound_rules.sql` (PROJ-15)
- **Auswirkung:** Gleiche nicht-deterministische Reihenfolge wie bei BUG-9. Auf einer frisch aufgesetzten Supabase-Instanz ist die Ausführungsreihenfolge der beiden `017_*`-Dateien vom Sortieralgorithmus abhängig. Schlimmer: PROJ-15 (`017_proj15_compound_rules.sql`) ist eine destruktive Migration (`TRUNCATE TABLE public.categorization_rules`) und betrifft PROJ-13-Daten. Wenn beide als "017" registriert werden, kann es passieren, dass nur eine von beiden angewendet wird — je nach Supabase-CLI-Version und Migration-Tracking.
- **Reproduktionsschritte:**
  1. Frische Supabase-Instanz mit `supabase db reset` hochfahren
  2. Migrationen anwenden → alphabetisch sortiert würde `017_proj14_category_access.sql` VOR `017_proj15_compound_rules.sql` laufen (da "14" < "15"). Das ist zufällig korrekt, aber nicht garantiert.
  3. In einer bestehenden Umgebung, die bereits eine der beiden Migrationen als "017" fixiert hat, wird die andere übersprungen → entweder fehlende Tabelle `user_category_access` ODER PROJ-15-Compound-Rules werden nicht migriert
- **Lösungsvorschlag:** Eine der beiden Dateien umbenennen. Da PROJ-15 später (im Featurestapel) kommt als PROJ-14, wäre die saubere Lösung:
  - `017_proj14_category_access.sql` bleibt
  - `018_proj14_bug_fixes.sql` bleibt
  - `017_proj15_compound_rules.sql` → `019_proj15_compound_rules.sql`
- **Priorität:** Vor Deployment beheben (PRODUKTIONS-BLOCKER)
- **Gelernt:** Das Projekt sollte einen Migrations-Präfix-Check im Pre-Commit einführen (`ls migrations/ | cut -c1-3 | sort | uniq -d` muss leer sein), damit solche Kollisionen nicht wiederkehren.

### Zusammenfassung (3. Durchlauf)

- **Akzeptanzkriterien:** 10/10 bestanden (unverändert ggü. 2. Durchlauf)
- **Randfälle:** 4/5 bestanden (unverändert)
- **Offene Bugs:** 8 gesamt
  - **Kritisch:** 1 (BUG-12: neue 017-Kollision zwischen PROJ-14 und PROJ-15)
  - **Hoch:** 0
  - **Mittel:** 1 (BUG-2)
  - **Niedrig:** 6 (BUG-3, BUG-4, BUG-7, BUG-8, BUG-10, BUG-11)
- **Sicherheitsaudit:** Keine neuen Sicherheitslücken im Feature selbst. Die Info-Leak-Fixes aus dem 2. Durchlauf (`get_current_balance` und `get_opening_balance` mit `p_category_filter`) sind weiterhin korrekt umgesetzt.
- **Produktionsreif:** **NEIN** (wegen BUG-12)
- **Empfehlung:** BUG-12 MUSS vor Deployment behoben werden. Dies ist inzwischen die zweite Migrations-Kollision in Folge — ein automatisierter Präfix-Check wäre dringend angeraten, um weitere Wiederholungen zu vermeiden. Alle anderen offenen Bugs sind unverändert und können im Folge-Sprint adressiert werden.

### Noch nicht getestet (weiterhin)

- Live-Deployment gegen eine frische Supabase-Instanz, um BUG-12 praktisch zu verifizieren
- Cross-Browser-Test (Chrome/Firefox/Safari)
- Responsive Breakpoints des `KategorieZugriffPanel` (375/768/1440 px)
- End-to-End-Test mit Demo-Betrachter und realen Kategorien

---

### Re-Test nach Bug-Fixes (2026-04-12, 2. Durchlauf)

**Getestet:** 2026-04-12 (Nachkontrolle)
**App-URL:** http://localhost:3000
**Tester:** QA-Ingenieur (KI) – statischer Code-Review
**Anlass:** Überprüfung der Bug-Fixes nach dem ersten QA-Durchlauf

#### Status der Bugs aus 1. Durchlauf

| Bug | Schwere | Status | Nachweis |
|-----|---------|--------|----------|
| BUG-1: Kontostand-KPI Info-Leak | Kritisch | **BEHOBEN** | Migration `017_proj14_bug_fixes.sql`: `get_current_balance(p_category_filter)` nutzt für eingeschränkte Benutzer `SUM(amount)` über sichtbare Buchungen. Neue Funktion `get_opening_balance(p_before_date, p_category_filter)` behebt den Leak auch im Export. `summary/route.ts` ruft RPC mit `p_category_filter` auf. `kassenbuch/route.ts` berechnet Schlusssaldo als `openingBalance + totalIncome - totalExpense` für eingeschränkte Benutzer. |
| BUG-5: Skalierung `.in("id", allowedTxIds)` | Hoch | **BEHOBEN** | `transactions/route.ts` und `export/kassenbuch/route.ts` nutzen jetzt `transaction_categories!inner` JOIN mit `.in("transaction_categories.category_id", ...)`. Kein Vorab-ID-Lookup mehr, URL bleibt unabhängig von der Buchungs-Anzahl kurz. Einschränkung bleibt serverseitig wirksam. |
| BUG-6: `getAllowedTransactionIds` `.limit(100000)` | Mittel | **BEHOBEN (implizit)** | Die Funktion `getAllowedTransactionIds` ist in `src/lib/category-access.ts` komplett entfernt. Kein Cap mehr nötig. |
| BUG-2: Fail-safe sperrt uneingeschränkten Betrachter aus | Mittel | **OFFEN** | `category-access.ts` Z. 51-60: Der DB-Fehler-Zweig gibt weiterhin `{ restricted: true, allowedCategoryIds: [] }` zurück. UX-kritisch, aber als "sicherer Default" dokumentiert. |
| BUG-3: Inkonsistentes Speicher-Paradigma | Niedrig | **OFFEN** | `kategorie-zugriff-panel.tsx` nutzt weiterhin expliziten Speichern-Button, während `user-permissions-panel.tsx` sofortspeichert. Spec erlaubt beides, aber visuelle Inkonsistenz im selben Aufklappbereich. |
| BUG-4: RF-4 verweist auf nicht existierende Route | Niedrig | **OFFEN** | `GET /api/transactions/[id]` existiert weiterhin nicht (nur PATCH). PATCH-Route prüft Sichtbarkeit korrekt (404). Rein dokumentarischer Spec-Hinweis. |
| BUG-7: `availableYears` `.limit(10000)` für eingeschränkte Benutzer | Niedrig | **OFFEN** | `summary/route.ts` Z. 102-122: Für eingeschränkte Benutzer weiterhin `.limit(10000)` SELECT statt RPC. Nicht skalierend, aber bei aktuellen Datenmengen unkritisch. |
| BUG-8: `isDirty`-Check brüchig | Niedrig | **OFFEN** | `kategorie-zugriff-panel.tsx` Z. 98-102: Unverändert. Funktioniert, solange Duplikate ausgeschlossen bleiben. |

**Behoben:** 3 (1 Kritisch + 1 Hoch + 1 Mittel)
**Weiterhin offen:** 5 (0 Kritisch + 0 Hoch + 1 Mittel + 4 Niedrig)

#### Neue Findings im 2. Durchlauf

##### BUG-9: Migrations-Nummer-Kollision 016
- **Schweregrad:** Kritisch (Deployment-Blocker)
- **Komponente:** `supabase/migrations/`
- **Beobachtung:** Es existieren ZWEI Migrationen mit dem Präfix `016`:
  - `016_proj14_category_access.sql` (PROJ-14)
  - `016_proj13_bug007_atomic_rule_insert.sql` (PROJ-13 BUG-007-Fix)
- **Auswirkung:** Supabase sortiert Migrationen alphabetisch. Die Reihenfolge der beiden `016_*`-Dateien hängt dann vom alphabetischen Vergleich ab – nicht deterministisch über verschiedene Tool-Versionen hinweg. Schlimmer: Wenn eine Umgebung bereits eine der beiden als "016" angewendet hat, wird die zweite entweder übersprungen oder erzeugt einen Migration-Drift. Das ist ein echter Deployment-Bruch für frisch aufgesetzte Staging/Prod-Umgebungen.
- **Reproduktionsschritte:**
  1. Frische Supabase-Instanz mit `supabase db reset` hochfahren
  2. Migrationen anwenden → je nach Tool wird entweder nur eine von beiden `016_*`-Dateien registriert, oder beide werden in einer nicht-deterministischen Reihenfolge ausgeführt
  3. In bestehenden Umgebungen, die nur eine der beiden Migrationen als "016" haben, wird die andere nie ausgeführt → fehlende Tabelle `user_category_access` ODER fehlende RPC `insert_categorization_rule`
- **Lösungsvorschlag:** Eine der beiden Migrationen umbenennen – z.B. `016_proj14_category_access.sql` → `017_proj14_category_access.sql`, und die bestehende `017_proj14_bug_fixes.sql` → `018_proj14_bug_fixes.sql`. Alternativ Zeitstempel-basierte Präfixe verwenden.
- **Priorität:** Vor Deployment beheben (PRODUKTIONS-BLOCKER)

##### BUG-10: PATCH-Route prüft Existenz vor Sichtbarkeit → theoretischer Timing-Leak
- **Schweregrad:** Niedrig
- **Komponente:** `src/app/api/transactions/[id]/route.ts` Z. 107-135
- **Beobachtung:** Die Route prüft zuerst, ob die Transaktion existiert (404 falls nicht), und DANACH die Sichtbarkeit (ebenfalls 404 falls nicht). Beide geben den gleichen HTTP-Status zurück, aber die Antwortzeit unterscheidet sich messbar: Bei nicht existierender ID kommt das 404 nach einem einzigen SELECT, bei existierender-aber-unsichtbarer ID nach zwei SELECTs + `isTransactionVisible`. Ein Angreifer könnte per Timing-Seitenkanal die Existenz fremder Buchungen herausfinden.
- **Auswirkung:** Gering – erfordert viele Messungen und lokale/stabile Netzverbindung. Für einen Vereins-Finanzverwalter keine realistische Bedrohung, aber der Randfall RF-4 der Spezifikation fordert explizit "kein Preisgeben von Informationen".
- **Lösungsvorschlag:** Existenz- und Sichtbarkeits-Check zu einer Query zusammenführen oder beide immer ausführen (gleichseitige Arbeit).
- **Priorität:** Wäre schön

##### BUG-11: `kategorie-zugriff-panel` sendet nach Deaktivierung trotzdem `category_ids`-Liste nicht
- **Schweregrad:** Niedrig
- **Komponente:** `src/components/kategorie-zugriff-panel.tsx` Z. 117-120
- **Beobachtung:** Im Request-Body wird `category_ids: restricted ? selectedIds : []` gesendet. Der Admin-Server akzeptiert das korrekt, aber der User-Workflow ist dadurch intransparent: Wenn der Admin "Eingeschränkt" togglet, dann die Auswahl ändert, dann wieder "Uneingeschränkt" togglet und speichert – verliert er seine Auswahl stillschweigend. Beim erneuten Aktivieren ist die Liste leer.
- **Erwartet:** Entweder die Auswahl clientseitig beibehalten (wie Feature-Berechtigungen) oder eine Warnung beim Toggle-Off anzeigen.
- **Priorität:** Wäre schön

### Zusammenfassung (Nachkontrolle)

- **Akzeptanzkriterien:** 10/10 bestanden (BUG-1 behoben → AK-8 und AK-9 jetzt korrekt)
- **Randfälle:** 4/5 bestanden (RF-4 weiterhin spec-inkonsistent, nicht funktionsrelevant)
- **Offene Bugs:** 7 gesamt
  - **Kritisch:** 1 (BUG-9: Migrations-Kollision – **neu gefunden**)
  - **Hoch:** 0
  - **Mittel:** 1 (BUG-2)
  - **Niedrig:** 5 (BUG-3, BUG-4, BUG-7, BUG-8, BUG-10, BUG-11)
- **Sicherheitsaudit:** Der kritische Info-Leak BUG-1 ist sauber behoben. Migration 017 und der Wechsel auf JOIN-basierte Filterung in transactions/summary/export sind korrekt umgesetzt.
- **Produktionsreif:** **NEIN** (wegen BUG-9)
- **Empfehlung:** BUG-9 MUSS vor Deployment behoben werden (eine der beiden `016_*`-Migrationen umbenennen). BUG-2 sollte bald behoben werden. Alle anderen offenen Bugs sind im Folge-Sprint akzeptabel.

### Noch nicht getestet (Grenzen des statischen Reviews, weiterhin)

- Live-Deployment gegen eine frische Supabase-Instanz, um BUG-9 praktisch zu verifizieren
- Cross-Browser-Test (Chrome/Firefox/Safari) – strukturell keine Risiken erkennbar
- Responsive Breakpoints des `KategorieZugriffPanel` (375/768/1440 px)
- End-to-End-Test mit Demo-Betrachter und realen Kategorien

---

### 1. Durchlauf (2026-04-12, ursprünglich)

**Getestet:** 2026-04-12
**App-URL:** http://localhost:3000
**Tester:** QA-Ingenieur (KI) – statischer Code-Review + Red-Team-Analyse

### Getestete Artefakte
- Migration: `supabase/migrations/016_proj14_category_access.sql`
- Helper: `src/lib/category-access.ts`
- Validation: `src/lib/validations/category-access.ts`
- Admin-API: `src/app/api/admin/users/[id]/category-access/route.ts`
- Self-API: `src/app/api/me/category-access/route.ts`
- Erweitert: `src/app/api/transactions/route.ts`, `src/app/api/transactions/[id]/route.ts`, `src/app/api/transactions/summary/route.ts`, `src/app/api/export/kassenbuch/route.ts`
- Frontend: `src/components/kategorie-zugriff-panel.tsx`, `src/components/eingeschraenkte-betrachter-banner.tsx`
- Dashboard-Integration: `src/app/dashboard/page.tsx`
- Benutzerverwaltung-Integration: `src/components/users-table.tsx`

### Status der Akzeptanzkriterien

#### AK-1: Kategorie-Zugriff-Bereich in Benutzerverwaltung unter Feature-Berechtigungen
- [x] `KategorieZugriffPanel` wird im Aufklapp-Bereich nach `UserPermissionsPanel` gerendert (`users-table.tsx` Z. 424-433)
- [x] Panel wird nur für Betrachter angezeigt (`canExpand = isViewer && ...`, Z. 234)

#### AK-2: Standardmäßig „Alle Kategorien" ausgewählt (kein Filter)
- [x] Initialer Switch-Zustand `restricted = false`, wenn `category_ids` leer
- [x] Backend: `unrestricted = (categoryIds.length === 0)` – konsistent
- [x] Neuer Betrachter ohne Einträge → kein Filter greift

#### AK-3: Multi-Select-Dropdown für erlaubte Kategorien
- [x] Wiederverwendung von `CategoryMultiSelect` aus PROJ-12
- [x] Wird nur gerendert, wenn `restricted = true`

#### AK-4: Speichern-Button (konsistent mit PROJ-7)
- [x] Expliziter Speichern-Button mit `isDirty`-Tracking
- [ ] INKONSISTENZ: PROJ-7 nutzt Sofortspeichern (siehe `UserPermissionsPanel`), PROJ-14 nutzt expliziten Speichern-Button. Die Spec erlaubt beides ("Speichern-Button oder Sofortspeichern – konsistent mit PROJ-7"), aber die beiden Panels in derselben Aufklappzeile verhalten sich unterschiedlich. Siehe BUG-3.

#### AK-5: Serverseitige Filterung in `/api/transactions` und `/api/transactions/summary`
- [x] `GET /api/transactions` ruft `getCategoryFilter` + `getAllowedTransactionIds` auf (Z. 85, 198)
- [x] Schnittmenge mit dem benutzergewählten Kategorie-Filter wird serverseitig gebildet
- [x] `GET /api/transactions/summary` ruft `getCategoryFilter` auf und übergibt `p_category_filter` an die RPC-Funktionen

#### AK-6: Unkategorisierte Buchungen für eingeschränkte Betrachter nicht sichtbar
- [x] `get_transaction_sums` in der SQL-Migration: `EXISTS (SELECT 1 FROM transaction_categories tc WHERE ...)` schließt unkategorisierte Buchungen aus
- [x] `getAllowedTransactionIds` nutzt JOIN auf `transaction_categories` → unkategorisierte werden nicht zurückgegeben

#### AK-7: Dashboard-Banner für eingeschränkte Betrachter
- [x] `EingeschraenkteBetrachterBanner` wird eingeblendet, wenn `categoryAccess?.restricted === true` (`page.tsx` Z. 456)
- [x] Banner zeigt die erlaubten Kategorien als Badges an
- [x] Banner zeigt spezifische Meldung, wenn keine Kategorien freigegeben sind

#### AK-8: Export für eingeschränkte Betrachter liefert nur sichtbare Buchungen
- [x] `/api/export/kassenbuch` ruft `getCategoryFilter` + `getAllowedTransactionIds` auf
- [x] Eröffnungssaldo wird aus den sichtbaren Buchungen berechnet (konsistent!)
- [ ] BUG-1: Schlusssaldo ist `rows[rows.length - 1].balance_after` – das ist der ECHTE Kontostand zum Zeitpunkt der letzten sichtbaren Buchung und beinhaltet auch unsichtbare Transaktionen (Info-Leak, siehe BUG-1)

#### AK-9: KPI-Cards spiegeln nur sichtbare Buchungen wider – kein Zugriff auf Gesamtzahlen
- [x] `totalIncome` / `totalExpenses` werden per `get_transaction_sums` mit `p_category_filter` berechnet → korrekt gefiltert
- [ ] BUG-1 (Kritisch): `currentBalance` wird per `get_current_balance` als `balance_after` der letzten sichtbaren Buchung zurückgegeben. Dieser Wert ist der ECHTE Vereinskontostand zu diesem Zeitpunkt, da `balance_after` in der DB alle Transaktionen (auch unsichtbare) kumuliert. Ein eingeschränkter Betrachter kann so den tatsächlichen Kontostand ermitteln – klarer Verstoß gegen "kein Zugriff auf Gesamtzahlen".

#### AK-10: Admins unterliegen nie einer Kategorie-Einschränkung
- [x] `getCategoryFilter` gibt für Admins sofort `{ restricted: false }` zurück (Z. 40)
- [x] SQL-Funktion `get_user_allowed_category_ids` prüft Rolle und gibt NULL bei Admin zurück (doppelte Absicherung)
- [x] PUT-Route weist Versuche, einem Admin eine Einschränkung zu setzen, mit 400 ab

### Status der Randfälle

#### RF-1: Erlaubte Kategorie wird gelöscht
- [x] `user_category_access.category_id` hat `ON DELETE CASCADE` → Eintrag wird automatisch entfernt
- [x] Bei 0 verbleibenden Kategorien → `filter.allowedCategoryIds.length === 0` → Banner zeigt "Aktuell sind keine Kategorien freigegeben"
- [x] Keine Fehler, keine Exceptions

#### RF-2: Eingeschränkter Betrachter mit `edit_transactions`-Berechtigung
- [x] PATCH-Route prüft `isTransactionVisible` und gibt 404 zurück, wenn die Zielbuchung nicht sichtbar ist (`[id]/route.ts` Z. 123-135)
- [x] Betrachter kann nur sichtbare Buchungen bearbeiten
- [ ] BUG-2: Der Eintrag, über den der Betrachter bearbeiten möchte, wird erst auf Existenz geprüft (404 wenn nicht existent), DANN auf Sichtbarkeit. Beide geben 404 zurück – Informationsleak vermieden. **Passt**.

#### RF-3: Uneingeschränkter Betrachter (Standardfall)
- [x] `getCategoryFilter` gibt `{ restricted: false }` zurück, wenn keine Einträge existieren
- [x] `getAllowedTransactionIds` returns `null` (Early-Return Z. 83) → keine Zusatz-Query, kein Performance-Overhead

#### RF-4: Direktzugriff per ID auf nicht sichtbare Buchung
- [ ] BUG-4 (Mittel): Die Route `GET /api/transactions/[id]` EXISTIERT NICHT – es gibt nur PATCH. Die Spec-Randfall-Beschreibung bezieht sich auf eine nicht vorhandene Route. PATCH prüft die Sichtbarkeit korrekt und gibt 404 zurück. Die Spec sollte entweder den Randfall entfernen oder die Route implementieren (falls Seafile- oder Detail-Aufrufe per ID existieren).

#### RF-5: Neue unkategorisierte Buchungen nach Import
- [x] Eingeschränkte Betrachter sehen sie nicht (Filter schließt unkategorisierte aus)
- [x] Werden automatisch sichtbar, sobald sie mit einer erlaubten Kategorie verknüpft werden

### Sicherheitsaudit-Ergebnisse (Red Team)

- [x] **Authentifizierung:** Alle relevanten Routen prüfen `supabase.auth.getUser()` bzw. `requireAdmin()` / `requirePermission()`
- [x] **Autorisierung Admin-Route:** `/api/admin/users/[id]/category-access` nutzt `requireAdmin` und zusätzlich die RLS (Admins-only Policies in Migration 016)
- [x] **RLS-Policies:** Benutzer kann nur eigene Zeilen lesen; Schreiboperationen sind auf Admins beschränkt – doppelt abgesichert
- [x] **UUID-Validierung:** Admin-Route validiert User-ID per Regex, `updateCategoryAccessSchema` validiert alle Kategorie-UUIDs
- [x] **Existenzprüfung von Kategorien:** PUT-Route filtert nicht-existierende IDs aus und weist bei leerer Schnittmenge mit 400 ab
- [x] **Admin-Client-Nutzung:** `/api/me/category-access` begründet die Nutzung des Admin-Clients (Lesen der Kategorie-Namen für den Banner, da Betrachter keinen direkten RLS-Zugriff auf `categories` haben) – akzeptabel
- [x] **Fail-safe bei Fehlern:** `getCategoryFilter` gibt bei DB-Fehler `{ restricted: true, allowedCategoryIds: [] }` zurück (kein versehentliches Freischalten)
- [x] **404 statt 403:** PATCH-Route verwendet bewusst 404, um keine Informationen über Existenz fremder Buchungen preiszugeben
- [x] **Serverseitiger Filter:** Daten gelangen gar nicht erst zum Client – keine clientseitige Sicherheitsannahme
- [x] **Zod-Validierung:** `updateCategoryAccessSchema` prüft `unrestricted` als Bool, UUID-Regex, max. 100 IDs, konsistenz-Refine
- [ ] **BUG-1 (Kritisch): Info-Leak über `balance_after`** – siehe unten. Der Kontostand-KPI verrät den echten Gesamtsaldo trotz Kategorie-Einschränkung.
- [ ] **BUG-5 (Hoch): Skalierung `.in("id", allowedTxIds)`** – bei vielen sichtbaren Buchungen (>~180) wird die PostgREST-URL zu lang. Siehe unten.
- [x] **Rate Limiting:** `/api/admin/users/[id]/category-access` nutzt `requireAdmin` – eine explizite Rate-Limit-Schicht wäre optional, aber konsistent mit anderen Admin-Routen.

### Gefundene Bugs

#### BUG-1: Kontostand-KPI verrät echten Vereinskontostand trotz Einschränkung
- **Schweregrad:** Kritisch
- **Komponente:** `supabase/migrations/016_proj14_category_access.sql` → Funktion `get_current_balance`; indirekt `src/app/api/transactions/summary/route.ts` und `src/app/api/export/kassenbuch/route.ts`
- **Reproduktionsschritte:**
  1. Als Admin anlegen: Betrachter „pruefer@example.org" mit Einschränkung auf Kategorie „Reisekosten"
  2. Sorge dafür, dass die CHRONOLOGISCH LETZTE Buchung des Vereins der Kategorie „Reisekosten" zugeordnet ist (z.B. eine aktuelle Reisekostenerstattung)
  3. Als „pruefer@example.org" ins Dashboard einloggen
  4. KPI-Card „Kontostand" lesen
  - **Erwartet:** Ein Saldo, der nur die sichtbaren (Reisekosten-)Buchungen kumuliert – NICHT der echte Vereinskontostand
  - **Tatsächlich:** `get_current_balance` liefert `transactions.balance_after` der letzten sichtbaren Buchung. Da `balance_after` der echte Kontostand zum Zeitpunkt dieser Buchung ist, sieht der Betrachter den tatsächlichen Vereinskontostand
- **Semantik:** Das Akzeptanzkriterium AK-9 ist explizit: „KPI-Cards spiegeln nur die sichtbaren Buchungen wider – kein Zugriff auf Gesamtzahlen". Der aktuelle Code verstößt dagegen.
- **Gleiches Problem im Export:** Der Eröffnungssaldo der sichtbaren Buchungen in `kassenbuch/route.ts` Z. 191-195 nutzt ebenfalls `balance_after` einer vorherigen sichtbaren Buchung → Gleicher Info-Leak im Excel-Export
- **Lösungsvorschlag:** `get_current_balance` darf für eingeschränkte Betrachter nicht `balance_after` zurückgeben, sondern muss `SUM(amount)` über die sichtbaren Buchungen berechnen. Analog für den Eröffnungssaldo im Export: `SUM(amount) WHERE booking_date < startDate AND sichtbar`.
- **Priorität:** Vor Deployment beheben

#### BUG-2: Fail-safe in `getCategoryFilter` kann uneingeschränkten Betrachter fälschlich aussperren
- **Schweregrad:** Mittel
- **Komponente:** `src/lib/category-access.ts` Z. 51-60
- **Reproduktionsschritte:**
  1. Vorübergehender DB-Fehler beim SELECT auf `user_category_access` (z.B. Netzwerk-Hickup, Connection-Pool-Limit)
  2. Betrachter OHNE Einschränkung lädt das Dashboard
  3. `getCategoryFilter` fällt in den `error`-Zweig und gibt `{ restricted: true, allowedCategoryIds: [] }` zurück
  4. Der Betrachter sieht keine Buchungen und bekommt den Banner „Aktuell sind keine Kategorien freigegeben"
- **Erwartet:** Ein transienter DB-Fehler sollte nicht plötzlich alle Daten verbergen. Entweder klarer 500-Error an den Client oder ein Retry/Caching-Fallback.
- **Tatsächlich:** Der Betrachter glaubt, sein Admin hat ihm die Kategorien weggenommen. Support-Alarm.
- **Hinweis:** Die Kommentierung im Code begründet das als „sicherer Default" – sachlich korrekt, aber UX-kritisch. Mindestens sollte der Fehler an die Oberfläche propagiert werden (`throw`) und der Client einen Fehlerzustand zeigen statt leerer Tabelle.
- **Priorität:** Im nächsten Sprint beheben

#### BUG-3: Inkonsistenter Speicher-Mechanismus (PROJ-7 vs. PROJ-14) im selben Aufklapp-Bereich
- **Schweregrad:** Niedrig
- **Komponente:** `src/components/kategorie-zugriff-panel.tsx` (Speichern-Button) vs. `src/components/user-permissions-panel.tsx` (Sofortspeichern, vermutlich)
- **Reproduktionsschritte:**
  1. Als Admin Benutzer aufklappen in der Benutzerverwaltung
  2. Feature-Berechtigung (z.B. `export_excel`) togglen → wird direkt gespeichert
  3. Kategorie-Einschränkung aktivieren → Speichern-Button erscheint, nur dort ist explizites Speichern nötig
- **Erwartet:** Einheitliches Verhalten für denselben visuellen Container (beides sofort ODER beides Button-basiert).
- **Tatsächlich:** Zwei verschiedene Speicher-Paradigmen im gleichen Panel – Verwirrungsgefahr. Admin kann vergessen, die Kategorie-Auswahl zu speichern.
- **Mindest-Mitigation:** Eine sichtbare „Nicht gespeicherte Änderungen"-Warnung beim Schließen des Aufklappbereichs. Aktuell geht die Auswahl ohne Warnung verloren.
- **Priorität:** Im nächsten Sprint beheben

#### BUG-4: Randfall „GET /api/transactions/[id]" bezieht sich auf nicht existierende Route
- **Schweregrad:** Niedrig (Spec-Inkonsistenz)
- **Komponente:** `features/PROJ-14-kategoriebasierter-zugriff.md` (Spec) vs. tatsächlicher Code
- **Beobachtung:** Der Randfall „Was passiert, wenn der Betrachter versucht, eine Buchung direkt per ID aufzurufen (`GET /api/transactions/[id]`)?" ist nicht relevant, weil die Route `GET /api/transactions/[id]` nicht existiert (nur PATCH ist implementiert). PATCH schützt bereits korrekt per 404.
- **Erwartet:** Entweder die Spec aktualisieren (Randfall entfernen oder auf PATCH umformulieren) oder die Route tatsächlich implementieren.
- **Priorität:** Wäre schön

#### BUG-5: Skalierungsproblem bei `.in("id", allowedTxIds)` mit großer Liste
- **Schweregrad:** Hoch (ab bestimmter Datenmenge)
- **Komponente:** `src/app/api/transactions/route.ts` Z. 266-268, `src/app/api/export/kassenbuch/route.ts` Z. 126-132, `src/lib/category-access.ts` Z. 93-97
- **Reproduktionsschritte:**
  1. Betrachter mit Einschränkung auf eine große Kategorie (z.B. „Mitgliedsbeiträge") mit >200 Buchungen
  2. `getAllowedTransactionIds` liefert >200 UUIDs
  3. `.in("id", ...)` wird an PostgREST gesendet → URL überschreitet ~7000 Zeichen Limit
  4. Supabase/PostgREST antwortet mit 414 URI Too Long oder 500
- **Erwartet:** Eingeschränkte Betrachter sehen alle ihnen zustehenden Buchungen unabhängig von der Anzahl
- **Tatsächlich:** Dashboard und Export brechen ab einem bestimmten Volumen ab
- **Lösungsvorschlag:** Statt IN-Liste eine SQL-RPC-Funktion nutzen, die die JOIN-Logik auf `transaction_categories` serverseitig durchführt (analog zu `get_transaction_sums`). Oder: Supabase-`filter`-API mit SQL-CTE. PROJ-13 Bug-Fix Migration 015 hat einen ähnlichen RPC-Ansatz bereits vorbereitet.
- **Priorität:** Vor Deployment beheben, sobald der Verein >~150 Buchungen in einer eingeschränkten Kategorie hat

#### BUG-6: `getAllowedTransactionIds` mit `.limit(100000)` – harter Cap
- **Schweregrad:** Mittel
- **Komponente:** `src/lib/category-access.ts` Z. 97
- **Beobachtung:** `.limit(100000)` ist ein hardcoded Cap. Für den Förderverein aktuell ausreichend, aber nicht zukunftssicher. Vergleichbares Cap existiert auch in `/api/transactions/route.ts` Z. 146.
- **Erwartet:** Entweder explizit dokumentierter Cap ODER paginiert/CTE-basierte Lösung
- **Priorität:** Wäre schön (gemeinsam mit BUG-5 zu lösen)

#### BUG-7: `availableYears` in Summary-Route nutzt ebenfalls `.limit(10000)`
- **Schweregrad:** Niedrig
- **Komponente:** `src/app/api/transactions/summary/route.ts` Z. 103-113
- **Beobachtung:** Für uneingeschränkte Benutzer wird `get_available_years`-RPC genutzt. Für eingeschränkte Betrachter wird eine normale SELECT-Abfrage mit `.limit(10000)` gemacht, um die Jahre zu ermitteln. Das lädt unnötig viele Zeilen (nur `booking_date` wird benötigt) und ist inkonsistent mit dem RPC-Ansatz.
- **Lösungsvorschlag:** RPC `get_available_years_for_categories(p_category_filter)` neu implementieren (DISTINCT YEAR im Server).
- **Priorität:** Im nächsten Sprint beheben

#### BUG-8: `isDirty`-Check in `kategorie-zugriff-panel.tsx` ist ordnungsunabhängig, aber keine Set-Equality
- **Schweregrad:** Niedrig
- **Komponente:** `src/components/kategorie-zugriff-panel.tsx` Z. 98-102
- **Beobachtung:** Der `isDirty`-Check vergleicht Länge und prüft dann, ob alle initial-IDs im aktuellen `selectedIds` enthalten sind. Das ist korrekt für „Symmetrische Differenz ≠ ∅", funktioniert aber nur, weil es keine Duplikate geben kann. Edge-Case: Wenn der Benutzer „Eingeschränkt" togglet, ohne eine Kategorie zu wählen, bleibt die Button-Logik korrekt. Kein tatsächlicher Bug, aber brüchige Implementierung. Empfehlung: Set-basierte Gleichheit (`xor`).
- **Priorität:** Wäre schön

### Zusammenfassung

- **Akzeptanzkriterien:** 9/10 bestanden (AK-8 und AK-9 von BUG-1 betroffen; AK-4 von BUG-3 betroffen – inhaltlich grenzwertig)
- **Randfälle:** 4/5 bestanden (RF-4 bezieht sich auf nicht-existente Route → BUG-4)
- **Gefundene Bugs:** 8 gesamt
  - **Kritisch:** 1 (BUG-1: Kontostand-Info-Leak)
  - **Hoch:** 1 (BUG-5: Skalierung `in()`-Liste)
  - **Mittel:** 2 (BUG-2: Fail-safe sperrt aus; BUG-6: hardcoded Cap)
  - **Niedrig:** 4 (BUG-3, BUG-4, BUG-7, BUG-8)
- **Sicherheitsaudit:** Strukturell sehr solide (RLS, Fail-safe, 404 statt 403, Zod-Validierung, serverseitige Filterung, Admin-only Writes). **Aber:** BUG-1 ist ein echter Info-Leak, der die gesamte Kategoriezugriffs-Schutzmechanik im KPI-Bereich untergräbt.
- **Produktionsreif:** NEIN
- **Empfehlung:** BUG-1 und BUG-5 MÜSSEN vor Deployment behoben werden. BUG-2 und BUG-6 sollten zeitnah folgen. BUG-3, BUG-4, BUG-7, BUG-8 sind kosmetisch/organisatorisch und können in einen Folge-Sprint.

### Noch nicht getestet (Grenzen des statischen Reviews)

- Tatsächliches Cross-Browser-Verhalten (Chrome/Firefox/Safari) – statischer Review sieht keine Runtime-Probleme
- Responsive Breakpoints des `KategorieZugriffPanel` (375/768/1440 px) – empfehlenswert manuell durchzuklicken
- Live-Rate-Limiting auf der Admin-Route unter Last
- Echter End-to-End-Test mit Demo-Betrachter und realen Kategorien

## Deployment
_Wird von /deploy hinzugefügt_
