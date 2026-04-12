# PROJ-12: Buchungskategorisierung

## Status: Deployed
**Erstellt:** 2026-04-12
**Zuletzt aktualisiert:** 2026-04-12

## Abhängigkeiten
- Benötigt: PROJ-4 (Bankbewegungen-Dashboard) – Kategorie-Spalte wird dort ergänzt
- Benötigt: PROJ-5 (Eintragsbearbeitung) – Kategoriezuweisung als Teil der Bearbeitungsoptionen
- Erweitert: PROJ-13 (Kategorisierungsregeln) baut auf dem Kategorien-System auf
- Erweitert: PROJ-14 (Kategoriebasierter Zugriff) setzt Kategorien voraus

## Beschreibung
Der Administrator kann eine zentrale Liste von Buchungskategorien verwalten (z.B. „Mitgliedsbeiträge", „Reisekosten", „Veranstaltungen"). Jede Bankbewegung kann einer oder mehreren Kategorien zugeordnet werden. Die Zuweisung ist möglich:
- **Einzeln** – direkt am Eintrag im Dashboard
- **Massenweise** – mehrere Buchungen markieren und per Befehl eine Kategorie zuweisen

## User Stories
- Als Administrator möchte ich Kategorien anlegen, umbenennen und löschen, damit ich eine strukturierte Liste passend zum Verein pflegen kann.
- Als Administrator möchte ich einer Bankbewegung im Dashboard direkt eine oder mehrere Kategorien zuweisen, damit ich die Buchung einordnen kann.
- Als Administrator möchte ich mehrere Buchungen im Dashboard markieren und ihnen mit einem Befehl eine Kategorie zuweisen, damit ich viele Buchungen effizient kategorisieren kann.
- Als Administrator möchte ich im Dashboard nach Kategorie filtern, damit ich z.B. nur Ausgaben einer bestimmten Art sehe.
- Als Betrachter möchte ich die Kategorie(n) jeder Buchung sehen, damit ich den Zweck der Zahlung verstehe.

## Akzeptanzkriterien
- [ ] In den Einstellungen gibt es einen Bereich „Kategorien" mit einer Liste aller angelegten Kategorien
- [ ] Admin kann Kategorien anlegen (Name, optional Farbe/Badge), umbenennen und löschen
- [ ] Löschen einer Kategorie entfernt die Zuordnung bei allen betroffenen Buchungen (Warnung vorab)
- [ ] Im Dashboard gibt es eine Spalte „Kategorien" mit Badges für jede zugeordnete Kategorie
- [ ] Einzelzuweisung: Beim Bearbeiten einer Buchung kann man Kategorien per Multi-Select hinzufügen/entfernen
- [ ] Massenzuweisung: Im Dashboard können Buchungen per Checkbox markiert werden; ein „Kategorie zuweisen"-Button öffnet einen Dialog zur Auswahl einer Kategorie
- [ ] Massenentfernung: Beim Massenbefehl kann man eine Kategorie auch von allen markierten Buchungen entfernen
- [ ] Filterleiste im Dashboard hat einen Kategorie-Filter (Dropdown, Mehrfachauswahl)
- [ ] Export (PROJ-6) enthält die Kategorien als kommagetrennte Spalte
- [ ] Nur Admins (und Betrachter mit `edit_transactions`-Berechtigung, PROJ-7) können Kategorien zuweisen

## Randfälle
- Was passiert, wenn eine Kategorie gelöscht wird, die noch Buchungen hat? → Warndialog mit Anzahl betroffener Buchungen; Löschen entfernt Zuordnungen, nicht die Buchungen selbst
- Was passiert, wenn eine Buchung gar keine Kategorie hat? → Leere Spalte; Filterung nach „Ohne Kategorie" möglich
- Was passiert bei Massenzuweisung mit 0 markierten Buchungen? → Button ist deaktiviert
- Was passiert, wenn dieselbe Kategorie einer Buchung doppelt zugewiesen wird? → Wird ignoriert (Duplikat-Schutz in der Datenbank)
- Wie werden sehr lange Kategorienamen in der Tabelle dargestellt? → Truncation mit Tooltip

## Technische Anforderungen
- Tabelle `categories`: `id`, `name`, `color` (optional, Hex), `created_at`
- Tabelle `transaction_categories`: `transaction_id` (FK), `category_id` (FK), PK auf beiden (many-to-many)
- RLS: Admins und berechtigte Betrachter können `transaction_categories` schreiben; alle eingeloggten Benutzer können lesen
- API-Route `GET/POST/PATCH/DELETE /api/admin/categories`
- API-Route `POST /api/transactions/[id]/categories` und `DELETE /api/transactions/[id]/categories/[categoryId]`
- API-Route `POST /api/transactions/bulk-categorize` für Massenzuweisung

---
<!-- Abschnitte unten werden von nachfolgenden Skills hinzugefügt -->

## Technisches Design (Solution Architect)

### Überblick

Das Feature ergänzt das bestehende Dashboard um eine Kategorie-Dimension. Es besteht aus drei Teilen: (1) Kategorienverwaltung in den Einstellungen, (2) Anzeige und Zuweisung im Dashboard, (3) Massenbearbeitung per Checkbox-Auswahl. Alle bestehenden Komponenten werden erweitert – keine kompletten Neubauten nötig.

### Komponentenstruktur (visueller Baum)

```
Einstellungen-Seite (bestehend)
└── Tabs (bestehend)
    └── [NEU] Tab „Kategorien" (nur für Admins)
        └── KategorienVerwaltung (neue Komponente)
            ├── Kategorie-Liste
            │   └── Kategorie-Zeile (Name + Farb-Badge + Bearbeiten + Löschen)
            ├── „Neue Kategorie"-Button → Inline-Formular (Name + Farbwähler)
            └── Lösch-Bestätigungsdialog (mit Anzahl betroffener Buchungen)

Dashboard-Seite (bestehend)
├── TransactionFilterBar (bestehend – wird erweitert)
│   └── [NEU] Kategorie-Filter (Multi-Select-Dropdown)
├── [NEU] Massenaktions-Leiste (erscheint wenn ≥1 Buchung markiert)
│   ├── „X Buchungen ausgewählt"-Badge
│   ├── „Kategorie zuweisen"-Button → BulkKategorisierungDialog
│   └── „Auswahl aufheben"-Button
└── TransactionTable (bestehend – wird erweitert)
    ├── [NEU] Checkbox-Spalte (ganz links)
    ├── [NEU] Kategorien-Spalte (zeigt KategorieBadge-Komponenten)
    └── Tabellenzeile → Edit-Dialog (bestehend, wird erweitert)

EditTransactionDialog (bestehend – wird erweitert)
└── [NEU] Multi-Select-Feld „Kategorien"
    ├── Badges der zugeordneten Kategorien (entfernbar per ×)
    └── Dropdown-Suche aus vorhandenen Kategorien

BulkKategorisierungDialog (neue Komponente)
├── Aktion wählen: „Kategorie hinzufügen" oder „Kategorie entfernen"
├── Kategorie-Dropdown (Einzelauswahl)
└── Bestätigen-Button
```

### Datenmodell

**Neue Tabelle: `categories`**
```
Jede Kategorie hat:
- Eindeutige ID
- Name (z.B. „Mitgliedsbeiträge", max. 100 Zeichen, muss einmalig sein)
- Farbe (optionaler Hex-Farbcode, z.B. #3b82f6 – für farbige Badges)
- Erstellungszeitpunkt
```

**Neue Verknüpfungstabelle: `transaction_categories`**
```
Verbindet Buchungen mit Kategorien (viele-zu-viele):
- Buchungs-ID → Verweis auf bestehende Bankbewegung
- Kategorie-ID → Verweis auf Kategorie
- Kombination beider IDs ist der eindeutige Schlüssel (kein Duplikat möglich)
- Wenn eine Buchung oder Kategorie gelöscht wird → Verknüpfung entfällt automatisch
```

**Beziehung zur bestehenden Datenbank:**
- `transaction_categories.transaction_id` → verweist auf bestehende `transactions`-Tabelle
- `transaction_categories.category_id` → verweist auf neue `categories`-Tabelle
- Beide Fremdschlüssel mit `ON DELETE CASCADE` – kein verwaister Datenmüll

### Technische Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| **Kategorien-Verwaltung** | Neuer Tab in bestehenden Einstellungen | Kein neues Menüelement nötig; Admin findet alles an einem Ort |
| **Mehrfach-Kategorien** | Many-to-many Verknüpfungstabelle | Jede Buchung kann mehreren Kategorien angehören – flexibel und erweiterbar |
| **Bulk-Aktion** | Floating-Leiste über der Tabelle | Sichtbarer Hinweis „du hast X Buchungen markiert" – verhindert versehentliche Massenzuweisungen |
| **Farbwahl** | Vordefinierte Farbpalette (8 Farben) | Einfacher als Freitext-Hex; verhindert schlecht lesbare Farbkombinationen |
| **Kategorien im Export** | Kommagetrennte Spalte | Kompatibel mit Excel; keine Breaking Change an bestehender Exportstruktur |
| **Filter „Ohne Kategorie"** | Eigene Option im Kategorie-Filter | Ermöglicht gezielt unkategorisierte Buchungen zu finden und zu bearbeiten |

### API-Struktur

**Neue Admin-Routen (nur für Admins):**
- `GET /api/admin/categories` – alle Kategorien abrufen (inkl. Anzahl zugeordneter Buchungen)
- `POST /api/admin/categories` – neue Kategorie anlegen (Name + optionale Farbe)
- `PATCH /api/admin/categories/[id]` – Kategorie umbenennen oder Farbe ändern
- `DELETE /api/admin/categories/[id]` – Kategorie löschen (entfernt alle Zuordnungen)

**Erweiterte Transaktions-Routen:**
- `GET /api/transactions` → liefert künftig `categories[]` pro Buchung mit
- `POST /api/transactions/[id]/categories` – eine Kategorie einer Buchung zuordnen
- `DELETE /api/transactions/[id]/categories/[categoryId]` – Kategorie entfernen
- `POST /api/transactions/bulk-categorize` – Kategorie auf mehrere Buchungen anwenden oder entfernen

**Erweiterung bestehender Route:**
- `GET /api/export/kassenbuch` → Kategorien-Spalte wird als kommagetrennte Liste ergänzt

### Sicherheitskonzept

**Row Level Security auf `categories`:**
- Alle eingeloggten Benutzer dürfen Kategorien lesen (für die Anzeige im Dashboard)
- Nur Admins dürfen Kategorien anlegen, umbenennen, löschen

**Row Level Security auf `transaction_categories`:**
- Alle eingeloggten Benutzer dürfen Zuordnungen lesen
- Admins dürfen immer schreiben
- Betrachter dürfen nur schreiben, wenn sie die `edit_transactions`-Berechtigung haben (PROJ-7)

### Auswirkungen auf bestehende Features

| Feature | Änderung |
|---|---|
| PROJ-4 (Dashboard) | `TransactionTable` erhält Checkbox-Spalte + Kategorien-Spalte; `TransactionFilterBar` erhält Kategorie-Filter |
| PROJ-5 (Eintragsbearbeitung) | `EditTransactionDialog` erhält Multi-Select-Feld für Kategorien |
| PROJ-6 (Excel-Export) | Kategorien als neue Spalte im Export |
| PROJ-8 (Einstellungen) | Einstellungen-Seite erhält neuen Tab „Kategorien" (nur Admins) |

### Neue Komponenten (Überblick)

| Komponente | Dateiname | Zweck |
|---|---|---|
| Kategorien-Verwaltung | `kategorien-verwaltung.tsx` | CRUD-Liste für Kategorien in den Einstellungen |
| Bulk-Kategorisierung | `bulk-kategorisierung-dialog.tsx` | Dialog zum Massen-Zuweisen/Entfernen |
| Kategorie-Badge | (intern in transaction-table) | Farbiger Badge pro Kategorie in der Tabellenspalte |

### Abhängigkeiten (neue Pakete)

Keine neuen Pakete erforderlich. Alle benötigten shadcn/ui-Komponenten (`Badge`, `Dialog`, `Checkbox`, `Popover`, `Command` für Multi-Select-Suche) sind bereits installiert oder Teil von shadcn.

## QA-Testergebnisse

**Getestet am:** 2026-04-12
**Tester:** QA-Skill (Code-Review + statische Analyse)
**Teststand:** Uncommitted Working Tree (git status: modifiziert + neue Dateien)
**Produktionsreife:** NICHT BEREIT – 2 Hohe und 1 Kritischer Bug, zusätzlich 3 Mittel/Niedrig

### Zusammenfassung Akzeptanzkriterien

| # | Kriterium | Ergebnis |
|---|---|---|
| 1 | Einstellungen-Bereich „Kategorien" | BESTANDEN – neuer Tab in `einstellungen/page.tsx`, nur für Admins sichtbar |
| 2 | Admin kann Kategorien anlegen, umbenennen, löschen | BESTANDEN – CRUD in `KategorienVerwaltung` + `/api/admin/categories` |
| 3 | Löschen entfernt Zuordnung bei betroffenen Buchungen + Warnung | BESTANDEN – `ON DELETE CASCADE` + `AlertDialog` mit `transaction_count` |
| 4 | Dashboard-Spalte „Kategorien" mit Badges | TEILWEISE BESTANDEN – Spalte existiert, aber `hidden md:table-cell` → auf 375 px unsichtbar (siehe BUG-004) |
| 5 | Einzelzuweisung per Multi-Select im Edit-Dialog | BESTANDEN – `CategoryMultiSelect` im `EditTransactionDialog` |
| 6 | Massenzuweisung per Checkbox + Dialog | BESTANDEN – Checkbox-Spalte, sticky Bar, `BulkKategorisierungDialog` |
| 7 | Massenentfernung auch möglich | BESTANDEN – Radio-Option `remove` im Bulk-Dialog |
| 8 | Filterleiste mit Kategorie-Filter (Multi-Select) | BESTANDEN – `TransactionFilterBar` + `__uncategorized__`-Option |
| 9 | Excel-Export enthält Kategorien als Spalte | BESTANDEN – Spalte O „Kategorien", kommagetrennt |
| 10 | Nur Admins **und** Betrachter mit `edit_transactions` können zuweisen | **NICHT BESTANDEN** – API + RLS erlauben nur Admins (siehe BUG-001) |

**Gesamt:** 8 vollständig bestanden, 1 teilweise bestanden, 1 nicht bestanden.

### Bugs

#### BUG-001 (KRITISCH) – Betrachter mit `edit_transactions` können keine Kategorien zuweisen
- **Beschreibung:** Das Akzeptanzkriterium und das technische Design (Abschnitt „Sicherheitskonzept") fordern, dass Betrachter mit der `edit_transactions`-Berechtigung Kategorien zuweisen/entfernen dürfen. In der Implementierung wird in **allen** schreibenden API-Routen jedoch ausschließlich `requireAdmin()` aufgerufen:
  - `src/app/api/admin/categories/route.ts` (POST) – ok, nur Admin korrekt
  - `src/app/api/admin/categories/[id]/route.ts` (PATCH, DELETE) – ok, nur Admin korrekt
  - `src/app/api/transactions/[id]/categories/route.ts` (POST) – **sollte `requirePermission("edit_transactions")`** sein
  - `src/app/api/transactions/[id]/categories/[categoryId]/route.ts` (DELETE) – **sollte `requirePermission("edit_transactions")`** sein
  - `src/app/api/transactions/bulk-categorize/route.ts` (POST) – **sollte `requirePermission("edit_transactions")`** sein
- Zusätzlich erlauben die RLS-Policies in `supabase/migrations/011_proj12_categories.sql` bei `transaction_categories` INSERT/DELETE nur `public.is_admin()` – auch dies muss angepasst werden, sonst schlägt selbst ein Fix auf API-Ebene wegen RLS fehl.
- **Auswirkung:** Feature-Berechtigungsmodell (PROJ-7) für Kategorienzuweisung ist vollständig ausgehebelt. Kernversprechen „Betrachter mit Schreibrecht arbeiten mit" nicht erfüllt.
- **Reproduktion:** Einem Betrachter die Berechtigung `edit_transactions = true` geben → Einzelzuweisung und Bulk-Zuweisung von Kategorien schlagen beide mit HTTP 403 („Keine Berechtigung. Nur Administratoren haben Zugriff.") fehl.
- **Schweregrad:** Kritisch – betrifft sowohl Verhalten als auch Sicherheits-/Berechtigungsdesign und blockiert PROJ-14.
- **Zu ändernde Dateien:** 3 API-Routen + Migration 011 (RLS-Policies auf `transaction_categories`).

#### BUG-002 (HOCH) – Tabelle wird nach Bulk-Kategorisierung nicht neu geladen
- **Beschreibung:** In `src/app/dashboard/page.tsx` wird nach erfolgreicher Bulk-Aktion lediglich `clearSelection()` aufgerufen (siehe `onDone`-Callback). Die `fetchTransactions`-`useEffect`-Deps enthalten aber keinen Refresh-Trigger, daher zeigt die Tabelle weiterhin die alten Kategorie-Badges für die gerade bearbeiteten Buchungen. Erst ein manueller Filter-/Seitenwechsel lädt aktuelle Daten.
- **Auswirkung:** Nutzer hält das Feature für kaputt („Zuweisung war erfolgreich, aber nichts ändert sich"). Risiko für doppelte Zuweisung, weil Nutzer die Aktion erneut ausführt.
- **Reproduktion:** 3 Buchungen markieren → „Kategorie zuweisen" → Mitgliedsbeiträge → Anwenden → Toast „zu 3 Buchungen hinzugefügt" erscheint, aber in der Tabelle bleibt die Kategorien-Spalte unverändert leer.
- **Schweregrad:** Hoch – blockiert den gesamten „effizient viele Buchungen kategorisieren"-Anwendungsfall.
- **Zu ändernde Datei:** `src/app/dashboard/page.tsx` – `fetchTransactions` aus dem Effekt als `useCallback` extrahieren und nach der Bulk-Aktion sowie nach einer Einzel-Kategorie-Aktualisierung aus `EditTransactionDialog` aufrufen.

#### BUG-003 (HOCH) – Einzelzuweisung im Edit-Dialog aktualisiert Kategorien nicht im lokalen State
- **Beschreibung:** `EditTransactionDialog.handleSave` ruft `onSave()` (PATCH-Feldupdate, ersetzt den Table-Eintrag) **und danach** `setCategoriesForTransaction()` auf. Der Table-State wird aber bereits durch die Response von `onSave` überschrieben – die neuen Kategorien werden serverseitig zwar gespeichert, aber der `transactions`-State im Dashboard enthält weiterhin die alten `categories[]` aus der PATCH-Response (denn die PATCH-Response wird gelesen, *bevor* `setCategoriesForTransaction` ausgeführt wird). Ergebnis: nach Schließen des Dialogs zeigt die Zeile die alten Kategorien.
- **Auswirkung:** Für Nutzer wirkt es, als wäre die Änderung verloren. Erst ein Page-Reload zeigt die korrekten Kategorien.
- **Reproduktion:** Buchung bearbeiten → Kategorie „Spenden" hinzufügen → Speichern → Dialog schließt → Tabelle zeigt weiterhin keine/alte Kategorien.
- **Schweregrad:** Hoch – Kernfluss „Einzel-Kategorisierung" wirkt fehlerhaft.
- **Lösungsidee:** Reihenfolge umdrehen: erst `setCategoriesForTransaction`, dann `onSave`, oder nach beiden Calls explizit ein Re-Fetch der betroffenen Zeile auslösen bzw. `categories` aus Response manuell mergen.

#### BUG-004 (MITTEL) – Kategorien-Spalte auf Mobil/Tablet unsichtbar
- **Beschreibung:** Die `TableHead`/`TableCell` „Kategorien" in `transaction-table.tsx` hat `hidden md:table-cell`, wodurch sie unter 768 px Breite komplett ausgeblendet wird. Akzeptanzkriterium fordert „Im Dashboard gibt es eine Spalte Kategorien". Auf dem 375-px-Viewport sieht der Nutzer weder die Kategorien noch eine Möglichkeit, sie einzeln im Dialog anzusehen (Dialog-Öffnen auf Mobil zeigt sie jedoch weiterhin).
- **Auswirkung:** Betrachter auf Mobilgeräten verstehen den Zweck der Buchungen nicht, obwohl Kategorisierung vorhanden ist.
- **Reproduktion:** Dashboard auf Viewport 375×667 px öffnen → Kategorien-Spalte fehlt vollständig.
- **Schweregrad:** Mittel – responsives Design, aber widerspricht Spec für Betrachter-User-Story.
- **Lösungsidee:** Entweder Spalte auch auf Mobil zeigen (evtl. gekürzt) oder Kategorien in die Buchungstext-Zelle einfügen (z. B. als kleine Badge-Reihe unter dem Beschreibungstext auf `<md`).

#### BUG-005 (MITTEL) – `GET /api/transactions` Filter „Ohne Kategorie" lädt bis zu 100 000 Zeilen in den Node-Prozess
- **Beschreibung:** Bei aktivem `__uncategorized__`-Filter werden in `src/app/api/transactions/route.ts` zwei Queries mit `limit(100000)` gegen `transaction_categories` und `transactions` abgesetzt, anschließend per JavaScript-Set gemischt. Das ist für die aktuelle Datenmenge (hunderte Zeilen) unproblematisch, skaliert aber nicht und verletzt die `general.md`-Regel „Use `.limit()` sinnvoll, keine Voll-Scans in Hot Paths". Zudem ist das `month`-Date-Range `${year}-${monthNum}-31` nicht zwangsläufig ein gültiges Datum (28./30. Februar) – dort gibt es einen bestehenden, durch PROJ-12 nicht eingeführten Korrektheitsrand (Lexikografisch ok, aber semantisch falsch für `lte`). Bitte in einem Folgecommit beheben.
- **Auswirkung:** Performance-Schulden; bei ≈50 000 Buchungen sekundenlange Antwortzeiten und hoher RAM-Peak in der Serverless-Funktion.
- **Schweregrad:** Mittel – funktional ok, architektonisch riskant.
- **Lösungsidee:** RPC-Funktion / View mit `LEFT JOIN` + `WHERE category_id IS NULL`, oder zumindest Seitenlimit durchreichen.

#### BUG-006 (NIEDRIG) – Fehlende Eingabevalidierung für Farbpalette
- **Beschreibung:** `src/lib/category-colors.ts` liefert 8 Paletten-Farben. Das Zod-Schema `hexColorSchema` erlaubt aber jedes gültige `#rrggbb`, und das DB-CHECK-Constraint ebenfalls. Ein Angreifer mit Admin-Rolle könnte beliebige Farben (z. B. `#ffffff` auf weißem Hintergrund → unsichtbare Badges) setzen; die Spec deutet „Vordefinierte Palette" als bewusste Entscheidung gegen Freitext-Hex an.
- **Auswirkung:** Niedrige Sicherheit/UX-Risiko, kein Datenverlust. XSS ausgeschlossen, weil Farbe als `style`-Attribut und nicht als HTML interpretiert wird. Allerdings: CategoryBadge fügt die Farbe direkt in `style={{ borderColor, color, backgroundColor }}` ein – React escaped das automatisch, also **keine XSS-Lücke**.
- **Schweregrad:** Niedrig – Design-Inkonsistenz zur Spec.
- **Lösungsidee:** Serverseitig gegen eine harte Palette validieren, oder das Spec-Design auf „Freitext-Hex" anpassen (Vorschlag: Spec anpassen, da komfortabler).

### Sicherheitsaudit (Red Team)

| Angriffsvektor | Ergebnis |
|---|---|
| Unauthenticated Access auf `/api/admin/categories` | OK – `requireAdmin` mit 401/403 |
| Betrachter ruft `/api/admin/categories` | OK – 403 |
| Betrachter ruft `/api/transactions/bulk-categorize` mit `edit_transactions`-Recht | **FAIL** – 403 trotz Recht (siehe BUG-001) |
| SQL-Injection in `categories` / `category_id` (Query-Parameter) | OK – UUID-Regex-Prüfung + Supabase parameterisiert |
| XSS via Kategoriename | OK – Name landet in `{cat.name}` (React-escaped) und im Excel-Export (ExcelJS-escaped) |
| XSS via Kategoriefarbe | OK – Farbe via `style`-Object (React-escaped) und Zod `#rrggbb`-Regex |
| Rate Limiting | OK – `requireAdmin`/`requirePermission` mit 20/min pro IP |
| Mass-Assignment auf Kategorie-Create | OK – Zod-Schema filtert auf `name`/`color` |
| Offengelegte Geheimnisse in API-Responses | OK – keine `service_role`-Keys o. Ä. |
| CSRF | OK – Supabase-Cookies mit SameSite=Lax, kein State-Changing GET |
| Löschen fremder Buchungen via `POST /api/transactions/[id]/categories` | OK – Prüfung `maybeSingle` + RLS |
| Bulk-Request mit 1001 IDs | OK – Zod `.max(1000)` |
| Bulk-Request mit duplizierten IDs | OK – `new Set(transaction_ids)` |
| Kategorie-ID als Nicht-UUID | OK – Zod UUID-Validierung |

**Fazit Audit:** Ein Kritischer Berechtigungs-Bug (BUG-001). Ansonsten sauber gebaut: Validierung, Rate Limiting, UUID-Checks und RLS konsistent.

### Regressionstests (verwandte Features)

| Feature | Prüfpunkte | Status |
|---|---|---|
| PROJ-4 (Dashboard) | TransactionTable rendert weiterhin mit Checkbox-Spalte nur für Editoren; Header-Checkbox-Indeterminate korrekt | OK |
| PROJ-5 (Bearbeitung) | InlineEdit auf Buchungstext/Bemerkung funktioniert, Edit-Dialog speichert Felder unverändert | OK – aber siehe BUG-003 bzgl. Kategorien im selben Dialog |
| PROJ-6 (Export) | Export-Route wurde um Kategorien-Spalte (Spalte O) erweitert, `requirePermission("export_excel")` beibehalten | OK |
| PROJ-7 (Feature-Berechtigungen) | `hasPermission("edit_transactions")` schaltet Checkboxen im Dashboard frei | OK im Client – aber nicht im Backend durchgesetzt (BUG-001) |
| PROJ-8 (Einstellungen) | Neuer Tab „Kategorien" nur für Admins; Default-Tab-Logik funktioniert | OK |
| PROJ-10/11 (Genehmigung) | Nicht betroffen | OK |

### Cross-Browser / Responsive

Hinweis: Tests wurden per statische Code-Analyse und Tailwind-Klassen-Review durchgeführt (kein Live-Browser im QA-Skill verfügbar). Manuelle Verifikation durch den Entwickler empfohlen.

- **Chrome / Firefox / Safari Desktop (1440 px):** Layout laut Klassen ok; sticky Bulk-Leiste `z-20 top-16` ohne Kollisionen.
- **Tablet (768 px):** Kategorien-Spalte erscheint (`md:table-cell`), Filter-Leiste wechselt in `sm:flex-row` – ok.
- **Mobil (375 px):** Kategorien-Spalte unsichtbar (BUG-004). Filter-Popover/Command scrollt innerhalb `max-h-[300px]` – ok. Bulk-Leiste `flex-wrap` ok.

### Produktionsreife-Empfehlung

**NICHT BEREIT**

Begründung: BUG-001 (Kritisch) bricht das dokumentierte Berechtigungsmodell und damit die Voraussetzung für PROJ-14. BUG-002 und BUG-003 (Hoch) machen die beiden Kern-Workflows (Einzel- und Massenzuweisung) für den Nutzer unbrauchbar, obwohl die API-Aufrufe technisch erfolgreich sind. Diese drei Bugs müssen vor dem Deployment behoben sein. BUG-004 sollte vor Deployment behoben werden, BUG-005 und BUG-006 können als Folge-Tickets geführt werden.

## Deployment
_Wird von /deploy hinzugefügt_
