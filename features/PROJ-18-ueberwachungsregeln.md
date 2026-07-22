# PROJ-18: Überwachungsregeln & E-Mail-Benachrichtigung bei verdächtigen Kontobewegungen

## Status: Deployed
**Erstellt:** 2026-07-22
**Zuletzt aktualisiert:** 2026-07-22
**Live seit:** 2026-07-22 — QA bestanden (alle 4 Bugs behoben & verifiziert), Build/Lint/Typecheck grün, Browser-Test erfolgreich, nach `main` gepusht (Commit 187edd8).

## Abhängigkeiten
- Benötigt: PROJ-1 (Authentifizierung) — Admin-Rolle für Regelverwaltung
- Benötigt: PROJ-16 (PSD2-Bankabruf) — liefert die neuen Buchungen und den Cron-Auslöser (`src/lib/psd2/sync.ts`)
- Nutzt: KI-Parser (`src/lib/ki-parser.ts`) — Übersetzung von Fließtext-Regeln in strukturiertes Regel-JSON
- Nutzt: KI-Token & Provider aus `app_settings` (`ki_provider`, `ki_token`, verschlüsselt) — analog PDF-Import
- Orientiert an: PROJ-13/PROJ-15 (Kategorisierungsregeln) — Datenmodell & Matching-Muster als Vorbild
- Nutzt: Resend-Mail-Infrastruktur (analog `src/lib/psd2-emails.ts`)

## Kontext
CBS-Finanz ruft über PROJ-16 täglich automatisch die Kontobewegungen der BBBank ab. Bisher werden diese Buchungen lediglich importiert und kategorisiert — es gibt **keine aktive Überwachung auf Auffälligkeiten**. Ein Kassenwart müsste jeden Umsatz manuell durchsehen, um verdächtige Bewegungen (ungewöhnlich hohe Beträge, unbekannte Empfänger, regelmäßig wiederkehrende Kleinbeträge) zu erkennen.

Dieses Feature ergänzt eine **konfigurierbare Überwachung**: Der Kassenwart formuliert Regeln in **natürlicher Sprache** (z. B. *„Benachrichtige mich, wenn regelmäßig ein kleiner Betrag unter 100 € abgebucht wird"*). Die **KI übersetzt** diesen Fließtext in eine strukturierte, überprüfbare Regel, die in einer **Admin-Verwaltungsmaske** editierbar abgelegt wird. Beim täglichen PSD2-Abruf werden alle neuen Buchungen (und relevante zeitliche Muster) gegen die aktiven Regeln geprüft. Trifft eine Regel zu, geht eine **E-Mail-Benachrichtigung** an die **pro Regel definierten Empfänger**.

Ziel ist ein Frühwarnsystem gegen fehlerhafte, betrügerische oder schleichende Belastungen — ohne dass jemand täglich manuell kontrollieren muss.

## User Stories

- Als **Kassenwart** möchte ich eine Überwachungsregel in eigenen Worten formulieren, damit ich keine technische Syntax lernen muss.
- Als **Kassenwart** möchte ich, dass die KI meinen Fließtext in eine strukturierte Regel übersetzt und mir das Ergebnis vor dem Speichern zeigt, damit ich prüfen kann, ob die Regel korrekt verstanden wurde.
- Als **Kassenwart** möchte ich meine Überwachungsregeln in einer Übersicht sehen, aktivieren/deaktivieren, bearbeiten und löschen können, damit ich die Überwachung an geänderte Bedürfnisse anpassen kann.
- Als **Kassenwart** möchte ich pro Regel festlegen, wer per E-Mail benachrichtigt wird, damit z. B. bei großen Beträgen der Vorstand, bei Kleinbeträgen nur ich informiert werde.
- Als **benannter Empfänger** möchte ich eine klare E-Mail erhalten, sobald eine Buchung eine Überwachungsregel auslöst, damit ich zeitnah reagieren kann.
- Als **Kassenwart** möchte ich, dass dieselbe Buchung nur einmal einen Alarm auslöst, damit ich nicht bei jedem Cron-Lauf erneut benachrichtigt werde.
- Als **Kassenwart** möchte ich Regeln für wiederkehrende Muster definieren (z. B. „derselbe Kleinbetrag mehrfach im Monat"), damit ich schleichende Abo-Fallen oder unbemerkte Daueraufträge erkenne.

## Akzeptanzkriterien

### Regel per Fließtext erstellen (KI-Übersetzung)
- [ ] In der Admin-Oberfläche gibt es einen neuen Bereich „Überwachungsregeln"
- [ ] Nur Benutzer mit Admin-Rolle können Überwachungsregeln sehen und verwalten
- [ ] Es gibt ein Eingabefeld für die Regel als Freitext (mehrzeilig)
- [ ] Ein Button „Regel übersetzen" schickt den Freitext an die KI (bestehender `ki-parser`, Provider/Token aus `app_settings`)
- [ ] Die KI übersetzt den Freitext in strukturiertes Regel-JSON (Regeltyp, Kriterien, Schwellwerte, Zeitfenster)
- [ ] Das Übersetzungsergebnis wird dem Benutzer **vor dem Speichern** in verständlicher Form angezeigt (Klartext-Zusammenfassung, was die Regel prüft)
- [ ] Der Benutzer kann die übersetzte Regel akzeptieren, verwerfen oder erneut mit angepasstem Freitext übersetzen lassen
- [ ] Kann die KI den Freitext nicht in eine gültige Regel übersetzen, wird eine verständliche Fehlermeldung angezeigt (keine kryptischen KI-Rohausgaben)
- [ ] Ist kein KI-Token konfiguriert, wird der Benutzer auf die Einstellungen verwiesen (analog PDF-Import)

### Regeltypen
- [ ] **Einzelbuchungs-Regeln** werden unterstützt: Kriterien auf Betrag (Schwellwert/Bereich), Richtung (Ausgang/Eingang), Empfänger/Gegenseite (Textenthält), Verwendungszweck (Textenthält), IBAN der Gegenseite
- [ ] Kriterien können per UND/ODER kombiniert werden (analog PROJ-15)
- [ ] **Muster-/Aggregatregeln** werden unterstützt: erkennen wiederkehrende Buchungen über ein Zeitfenster (z. B. „gleicher/ähnlicher Betrag ≥ N-mal in X Tagen", „Summe an eine Gegenseite überschreitet Y € in Z Tagen")
- [ ] Jede Regel hat: Name, Freitext-Original, strukturierte Bedingung, Regeltyp, Aktiv-Status, Empfängerliste, Erstellzeitpunkt

### Regelverwaltung (CRUD)
- [ ] Die Regelübersicht listet alle Regeln mit Name, Klartext-Zusammenfassung, Regeltyp, Aktiv-Status und Empfängern
- [ ] Regeln können aktiviert/deaktiviert werden (deaktivierte Regeln lösen keine Benachrichtigung aus)
- [ ] Regeln können bearbeitet werden — sowohl das Regel-JSON direkt als auch per erneuter Freitext-Übersetzung
- [ ] Regeln können gelöscht werden
- [ ] Pro Regel können eine oder mehrere E-Mail-Empfänger hinterlegt werden (freie E-Mail-Adressen; Format wird validiert)

### Prüfung beim PSD2-Abruf
- [ ] Nach dem Import neuer Buchungen im PSD2-Cron (`sync.ts`, nach `applyCategorizationRules`) werden die aktiven Überwachungsregeln geprüft
- [ ] Einzelbuchungs-Regeln werden gegen jede **neu importierte** Buchung geprüft
- [ ] Muster-/Aggregatregeln werten das relevante Zeitfenster aus (auch über bereits vorhandene Buchungen hinweg), werden aber nur durch mindestens eine neue Buchung im aktuellen Lauf ausgelöst
- [ ] Ein Regeltreffer erzeugt genau eine Benachrichtigungs-E-Mail an die Empfänger der Regel
- [ ] Die Prüfung läuft mit Service-Role-Rechten im Cron-Kontext (kein Benutzer-Session)
- [ ] Fehler in der Regelprüfung brechen den PSD2-Abruf **nicht** ab (Import bleibt erfolgreich, Fehler wird geloggt)

### Benachrichtigungs-E-Mail
- [ ] Die E-Mail nennt: Name der ausgelösten Regel, was die Regel prüft (Klartext), die betroffene(n) Buchung(en) mit Datum, Betrag, Gegenseite und Verwendungszweck
- [ ] Absender/Reply-To folgen dem bestehenden Muster (`getFromEmail`/`getReplyToEmail`)
- [ ] Alle benutzer-/datenseitigen Werte in der E-Mail werden HTML-escaped (`escapeHtml`)
- [ ] Bei mehreren ausgelösten Regeln in einem Lauf wird pro Regel bzw. pro Empfängerkreis sinnvoll gebündelt (keine E-Mail-Flut)

### Dedup / Log
- [ ] Jede ausgelöste Benachrichtigung wird protokolliert (welche Regel, welche Buchung(en), Zeitpunkt, Empfänger)
- [ ] Dieselbe Kombination aus Regel und Buchung löst **nicht erneut** eine Benachrichtigung aus (auch bei erneutem Cron-Lauf)
- [ ] Bei Muster-Regeln wird eine sinnvolle Dedup-Einheit definiert (z. B. Muster + Zeitfenster), damit ein einmal gemeldetes Muster nicht täglich neu meldet

## Randfälle

- **Was passiert, wenn die KI eine mehrdeutige oder unsinnige Regel liefert?**
  → Die Klartext-Zusammenfassung wird zur Bestätigung angezeigt; der Benutzer muss aktiv akzeptieren. Nichts wird ohne Freigabe scharf geschaltet.

- **Was passiert, wenn kein KI-Token hinterlegt ist?**
  → Freitext-Übersetzung ist deaktiviert, Hinweis auf Einstellungen. Bereits gespeicherte Regeln funktionieren weiter (Prüfung braucht keine KI).

- **Was passiert, wenn eine Regel auf sehr viele Buchungen gleichzeitig zutrifft (z. B. beim initialen 90-Tage-Abruf)?**
  → Beim erstmaligen Backfill/großen Import wird die Benachrichtigung gebündelt oder gedrosselt, damit nicht hunderte E-Mails entstehen (Zusammenfassung statt Einzelmails).

- **Was passiert, wenn dieselbe Buchung erneut im Sync auftaucht (Duplikat-Hash)?**
  → Nur wirklich neu eingefügte Buchungen werden geprüft; bereits bekannte Buchungen lösen keinen erneuten Alarm aus (siehe Dedup).

- **Was passiert, wenn ein Empfänger keine gültige E-Mail-Adresse ist?**
  → Validierung beim Speichern der Regel; ungültige Adressen werden abgelehnt. Schlägt der Versand an einen von mehreren Empfängern fehl, wird das geloggt, die übrigen Empfänger erhalten die Mail trotzdem.

- **Was passiert, wenn die Regelprüfung selbst einen Fehler wirft?**
  → Der PSD2-Import gilt trotzdem als erfolgreich; der Fehler wird geloggt und beim nächsten Lauf erneut versucht. Keine Blockade des Kern-Abrufs.

- **Was passiert bei einer deaktivierten Regel?**
  → Sie wird bei der Prüfung übersprungen, bleibt aber gespeichert und kann jederzeit reaktiviert werden.

- **Was passiert, wenn eine Muster-Regel ein Zeitfenster hat, das über den letzten Abruf hinausreicht?**
  → Das Zeitfenster wird relativ zum Buchungsdatum ausgewertet (nicht nur auf die neuen Buchungen beschränkt), damit wiederkehrende Muster korrekt erkannt werden; die Auslösung erfolgt aber nur, wenn eine neue Buchung Teil des Musters ist.

- **Was passiert, wenn ein Admin eine Regel löscht, zu der es bereits Benachrichtigungs-Logs gibt?**
  → Die Logs bleiben als Historie erhalten (Regelbezug wird auf „gelöscht" gesetzt statt kaskadierend zu löschen), damit nachvollziehbar bleibt, was wann gemeldet wurde.

## Technische Anforderungen

### Sicherheit
- Nur Admin-Rolle darf Überwachungsregeln lesen/erstellen/ändern/löschen (RLS + `requireAdmin()`)
- KI-Token wird ausschließlich verschlüsselt aus `app_settings` geladen (`decrypt`), nie ins Frontend gegeben
- Regelprüfung im Cron läuft über Service-Role-Client, kein Benutzer-Kontext
- E-Mail-Inhalte HTML-escaped; Empfänger-Adressen server-seitig per Zod validiert
- Freitext-Eingabe wird als reine KI-Eingabe behandelt (keine Ausführung), Ergebnis wird strikt als Regel-JSON gegen ein Schema validiert

### Performance
- Regelprüfung fügt sich in den bestehenden täglichen Abruf (< 30 s Ziel aus PROJ-16) ein; Einzelbuchungs-Prüfung in-memory analog `matchRulesForTransaction`
- Aggregat-Abfragen mit Index auf `(iban_gegenseite, booking_date)` bzw. `(amount, booking_date)`
- Dedup-Prüfung über indexierten Eindeutigkeitsschlüssel (Regel + Buchung / Regel + Muster-Fenster)

### Datenmodell (Vorschlag — final durch /architecture)
- Neue Tabelle `ueberwachungsregeln`: `id`, `name`, `freitext_original`, `bedingung jsonb`, `regel_typ` (`einzelbuchung` | `muster`), `empfaenger text[]`, `is_active`, `sort_order`, `erstellt_am`, `erstellt_von`
- Neue Tabelle `ueberwachungs_benachrichtigungen` (Log/Dedup): `id`, `regel_id`, `transaction_id` (nullable bei Muster), `dedup_key`, `versendet_am`, `empfaenger`, unique auf `dedup_key`
- Neues Mail-Modul `src/lib/ueberwachungs-emails.ts` (Blaupause: `src/lib/psd2-emails.ts`)
- Neue KI-Funktion zur Regel-Übersetzung (Blaupause: `parseKiResponse`/`testApiToken` in `ki-parser.ts`)
- Integration in `src/lib/psd2/sync.ts` nach `applyCategorizationRules`

### Nicht-Ziele
- Keine Auslösung beim manuellen PDF-Import (bewusst nur PSD2-Cron, siehe Klärung)
- Keine Echtzeit-/Push-Benachrichtigung (nur E-Mail, im Tages-Rhythmus des Cron)
- Kein Regel-Sharing zwischen Mandanten/Vereinen (Single-Tenant)
- Keine automatische Sperrung/Reaktion auf Buchungen (nur Benachrichtigung, keine Kontosteuerung)
- Keine KI-Auswertung der Buchungen selbst (KI nur für die Regel-Übersetzung, die Prüfung ist deterministisch)

---
<!-- Abschnitte unten werden von nachfolgenden Skills hinzugefügt -->

## Technisches Design (Solution Architect)

### Überblick: Wie die Teile zusammenspielen

```
Kassenwart formuliert Regel als Fließtext
    │
    ▼
"Regel übersetzen"-Button
    │
    ▼
KI-Übersetzung (bestehender ki-parser, neuer Prompt)
    │
    ▼
Klartext-Vorschau ──── Kassenwart prüft & bestätigt
    │
    ▼
Supabase: ueberwachungsregeln (aktiv, mit Empfängerliste)


Täglicher PSD2-Cron (bestehend, PROJ-16)
    │
    ▼
/api/cron/psd2-abruf → fuehreBankAbrufAus()
    │
    ├─► Neue Buchungen in transactions speichern
    ├─► applyCategorizationRules() (bestehend, PROJ-13/15)
    └─► NEU: prüfeUeberwachungsregeln(neueTransaktionIds)
              │
              ├─ Einzelbuchungs-Regeln: jede neue Buchung prüfen
              ├─ Muster-Regeln: Zeitfenster um neue Buchungen auswerten
              ├─ Dedup-Check gegen ueberwachungs_benachrichtigungen
              └─ Treffer → E-Mail an Regel-Empfänger + Log-Eintrag
```

Die Regelprüfung hängt sich als zusätzlicher, fehlertoleranter Schritt an den bestehenden Cron-Ablauf — der PSD2-Import selbst bleibt unverändert und erfolgreich, auch wenn die Überwachung einen Fehler wirft.

---

### A) Komponentenstruktur

```
Admin-Bereich "Überwachungsregeln" [NEU] (eigener Menüpunkt, analog Kategorisierungsregeln)
+-- Regelübersicht
|   +-- Regel-Karte pro Regel:
|   |   +-- Name + Klartext-Zusammenfassung ("Was prüft diese Regel?")
|   |   +-- Typ-Badge ("Einzelbuchung" / "Muster")
|   |   +-- Aktiv/Inaktiv-Schalter
|   |   +-- Empfänger-Liste (E-Mail-Chips)
|   |   +-- Aktionen: Bearbeiten, Löschen
|   +-- Button "Neue Regel erstellen"
|   +-- Leere-Zustand-Hinweis, wenn noch keine Regel existiert
|
+-- Regel-Erstellen/Bearbeiten-Dialog [NEU] (Vorbild: regel-form-dialog.tsx)
|   +-- Freitext-Eingabefeld ("Beschreibe, wann du benachrichtigt werden willst")
|   +-- Button "Regel übersetzen" → ruft KI auf
|   +-- Vorschau-Karte: Klartext-Zusammenfassung der übersetzten Regel
|   |   +-- Bei Muster-Regeln zusätzlich: erkanntes Zeitfenster & Schwellwert in Worten
|   +-- Buttons "Übernehmen", "Erneut übersetzen", "Abbrechen"
|   +-- Empfänger-Eingabe (Mehrfach-E-Mail-Feld mit Validierung)
|   +-- Fehleranzeige bei nicht übersetzbarem Freitext
|
+-- Hinweisbanner "Kein KI-Anbieter konfiguriert" [NEU]
    +-- Erscheint statt des Übersetzen-Buttons, verlinkt auf Einstellungen (analog PDF-Import-Verhalten)
```

Kein neuer Menüpunkt auf Betrachter-Seite — das Feature ist vollständig Admin-only, es gibt keine Betrachter-Ansicht.

---

### B) Datenmodell (was gespeichert wird)

**Neue Tabelle `ueberwachungsregeln`** — eine Zeile pro konfigurierter Überwachungsregel:

| Feld | Bedeutung |
|---|---|
| `name` | Kurzer, vom Kassenwart vergebener Titel |
| `freitext_original` | Der ursprüngliche Fließtext, aus dem die Regel übersetzt wurde (für spätere Bearbeitung/Nachvollziehbarkeit) |
| `regel_typ` | `einzelbuchung` oder `muster` |
| `bedingung` | Die strukturierte, von der KI übersetzte Regel (Kriterien + Verknüpfung bei Einzelbuchung; Zeitfenster + Schwellwert + Kriterien bei Muster) |
| `empfaenger` | Liste der E-Mail-Adressen, die bei Treffer benachrichtigt werden |
| `ist_aktiv` | Ob die Regel gerade geprüft wird |
| `sortierung` | Anzeigereihenfolge in der Übersicht |
| `erstellt_am` / `erstellt_von` | Audit-Angaben |

**Neue Tabelle `ueberwachungs_benachrichtigungen`** — Protokoll jeder ausgelösten Benachrichtigung, dient gleichzeitig als Dedup-Schutz:

| Feld | Bedeutung |
|---|---|
| `regel_id` | Welche Regel hat ausgelöst (bleibt bei Regel-Löschung als Historie erhalten, Verweis wird auf "gelöscht" gesetzt statt die Zeile zu entfernen) |
| `regel_name_stand` | Name der Regel zum Zeitpunkt der Auslösung (bleibt lesbar, auch wenn die Regel später umbenannt/gelöscht wird) |
| `betroffene_buchungen` | Die eine (Einzelbuchung) bzw. mehreren (Muster) Buchungen, die den Treffer ausgelöst haben |
| `dedup_schluessel` | Eindeutiger Fingerabdruck aus Regel + betroffenen Buchungen (bzw. Regel + Muster-Zeitfenster) — verhindert doppelte Benachrichtigung für denselben Fall |
| `ausgeloest_am` | Zeitstempel des Treffers |
| `versendet_an` | Tatsächlich benachrichtigte Empfänger (Snapshot zum Auslösezeitpunkt) |

---

### C) Technische Entscheidungen und Begründungen

**KI-Übersetzung über den bestehenden `ki-parser` statt neuer KI-Anbindung**
Der KI-Parser unterstützt bereits beide Anbieter (OpenAI/Anthropic), liest Provider und Token aus den App-Einstellungen und hat ein robustes JSON-Antwort-Parsing. Für die Regel-Übersetzung wird lediglich ein neuer, eigenständiger Prompt ergänzt — die Infrastruktur (Token-Verschlüsselung, Fehlerbehandlung, Provider-Umschaltung) wird vollständig wiederverwendet. Das spart Aufwand und hält Verhalten konsistent (z. B. dieselbe Fehlermeldung bei ungültigem Token wie beim PDF-Import).

**Getrennter Freitext-zu-Regel-Prompt statt Erweiterung des bestehenden PDF-Prompts**
Der bestehende Prompt ist auf das Erkennen von Buchungen in einem Kontoauszug spezialisiert. Die Regel-Übersetzung braucht ein komplett anderes Zielformat (Kriterien statt Buchungen). Ein eigener, fokussierter Prompt liefert zuverlässigere Ergebnisse als ein Prompt, der zwei Aufgaben gleichzeitig lösen muss.

**Kriterien-Vokabular wird von den Kategorisierungsregeln übernommen und um Zeit/Muster erweitert**
Die bestehenden Einzelkriterien (Betrag/Richtung, Text im Verwendungszweck, Empfänger, IBAN) sind bereits erprobt und decken die Einzelbuchungs-Fälle vollständig ab. Für Muster-Regeln kommt ein neuer Baustein hinzu: "dieselben/ähnlichen Kriterien treffen mindestens N-mal innerhalb von X Tagen zu" bzw. "die Summe der Treffer überschreitet Y € innerhalb von X Tagen". Dadurch bleibt ein einheitliches, dem Kassenwart bereits bekanntes Kriterien-Vokabular erhalten, statt eine komplett neue Regelsprache einzuführen.

**Bestätigungsschritt vor dem Speichern statt automatischer Übernahme**
Da die KI Formulierungen fehlinterpretieren kann, wird die übersetzte Regel immer erst als Klartext-Zusammenfassung gezeigt. Erst nach aktiver Bestätigung durch den Kassenwart wird sie gespeichert bzw. scharf geschaltet. Das verhindert stille Fehlkonfigurationen einer sicherheitsrelevanten Funktion.

**Prüfung im Cron statt als separater, eigener Zeitplan**
Da laut Klärung ausschließlich der PSD2-Abruf Überwachungs-Auslöser sein soll, wird kein zusätzlicher Cron-Job benötigt. Die Prüfung reiht sich unmittelbar nach der bestehenden Kategorisierung ein — an diesem Punkt sind neue Buchungen bereits vollständig gespeichert und dedupliziert (siehe PROJ-16), was die Grundlage für zuverlässiges Regel-Matching ist.

**Regelprüfung fehlertolerant vom Kernimport entkoppelt**
Ein Fehler in der (neueren, weniger erprobten) Überwachungslogik darf den etablierten und geschäftskritischen PSD2-Import nicht gefährden. Die Prüfung läuft in einem eigenen Fehlerblock; scheitert sie, wird das geloggt, der Import selbst bleibt aber erfolgreich und der nächste Cron-Lauf versucht die Überwachung erneut.

**Dedup über einen eindeutigen Schlüssel statt Zeitfenster-Heuristik**
Statt z. B. „nicht innerhalb von 24 Stunden erneut senden" zu prüfen, wird ein eindeutiger Fingerabdruck aus Regel und betroffenen Buchungen (bzw. Regel und Muster-Zeitfenster) gebildet. Das ist robust gegen unregelmäßige Cron-Läufe und verhindert zuverlässig, dass derselbe Fall zweimal meldet — unabhängig davon, wie oft der Cron zwischenzeitlich läuft.

**Bündelung bei Massentreffern (z. B. initialer 90-Tage-Backfill)**
Löst eine Regel in einem einzelnen Lauf sehr viele Treffer aus, wird pro Regel eine gebündelte Zusammenfassungs-E-Mail statt vieler Einzelmails verschickt. Das verhindert ein Überfluten des Empfänger-Postfachs beim erstmaligen Abgleich großer Datenmengen.

**Neues, eigenständiges Mail-Modul statt Erweiterung bestehender Module**
Analog zu `psd2-emails.ts`, `approval-emails.ts` usw. erhält dieses Feature ein eigenes Mail-Modul. Das entspricht dem etablierten Projekt-Muster (ein Modul pro fachlichem Anlass) und hält die Benachrichtigungs-Logik unabhängig von anderen Versandpfaden.

---

### D) Neue API-Endpunkte

| Endpunkt | Zweck |
|---|---|
| `POST /api/admin/ueberwachungsregeln/uebersetzen` | Freitext an die KI senden, strukturierte Regel-Vorschau zurückgeben (noch nicht gespeichert) |
| `GET /api/admin/ueberwachungsregeln` | Liste aller Überwachungsregeln |
| `POST /api/admin/ueberwachungsregeln` | Neue Regel speichern (bereits übersetzte & bestätigte Bedingung + Empfänger) |
| `PATCH /api/admin/ueberwachungsregeln/[id]` | Regel bearbeiten (inkl. Aktiv/Inaktiv-Umschalten) |
| `DELETE /api/admin/ueberwachungsregeln/[id]` | Regel löschen (Benachrichtigungs-Historie bleibt erhalten) |

Die eigentliche Prüfung beim Cron-Lauf läuft **intern** innerhalb von `fuehreBankAbrufAus()` und benötigt keinen eigenen HTTP-Endpunkt.

---

### E) Abhängigkeiten (zu installierende Pakete)

Keine neuen Pakete nötig. Das Feature nutzt ausschließlich bereits vorhandene Bausteine:
- `openai` / `@anthropic-ai/sdk` (bereits installiert) — für die Freitext-Übersetzung
- `resend` (bereits installiert) — für den E-Mail-Versand
- `zod` (bereits installiert) — für Validierung von Empfänger-Adressen und der KI-Antwortstruktur

## QA-Testergebnisse

**Getestet:** 2026-07-22 (Erst-Test) · **Re-Test:** 2026-07-22 (nach Fixes)
**App-URL:** http://localhost:3000
**Tester:** QA-Ingenieur (KI)

> **Re-Test-Ergebnis (nach Behebung):** Alle vier Bugs des Erst-Tests sind behoben. Der komplette Admin-UI-Layer wurde nachgerüstet (Menüpunkt „Überwachung" in den Einstellungen, Regelübersicht, Erstellen/Bearbeiten-Dialog mit Freitext-Übersetzung, Klartext-Vorschau, Empfänger-Eingabe, Aktiv-Schalter, „Kein-KI-Anbieter"-Banner). Die Dedup-Schlüssel (Einzel-Bündel und Muster) nutzen jetzt einen inhaltsbasierten Fingerabdruck der beteiligten Buchungs-IDs statt Datum+Anzahl bzw. Kalendermonat. Die Zeitfenster-Abfrage hat ein explizites `.limit()`.
>
> **Ausgeführte Prüfungen in dieser Umgebung:** `npx tsc --noEmit` → **fehlerfrei**; `npx eslint` auf allen PROJ-18-Dateien → **fehlerfrei**; `npm run build` → **erfolgreich** (alle Routen inkl. `/dashboard/einstellungen` kompiliert). Kein Zirkularimport (ki-parser → ueberwachungsregeln → ueberwachungs-emails/resend, kein Rückverweis). Cross-Browser (Chrome/Firefox/Safari) und Responsiv (375/768/1440px) konnten in dieser Umgebung nicht interaktiv im Browser getestet werden; die UI nutzt durchgängig shadcn/ui + responsive Tailwind-Muster (scrollbarer Dialog `max-h-[90vh]`, `sm:`-Breakpoints, `overflow-x-auto`-Tableiste).

### Zentrale Feststellung: vollständig implementiert

Backend **und** Frontend sind nun vorhanden und greifen sauber ineinander. Der Admin erreicht das Feature über Einstellungen → Tab „Überwachung" (`UeberwachungsregelnListe`), legt Regeln per Freitext + KI-Übersetzung oder manuell an (`UeberwachungsregelFormDialog`), sieht eine Klartext-Vorschau vor dem Speichern, verwaltet Empfänger, schaltet Regeln aktiv/inaktiv und löscht sie. Die serverseitige Prüfung hängt fehlertolerant im PSD2-Cron nach der Kategorisierung.

### Status der Akzeptanzkriterien

#### AK-1: Regel per Fließtext erstellen (KI-Übersetzung)
- [x] Bereich „Überwachungsregeln" in Admin-Oberfläche — Einstellungen-Tab „Überwachung" (`UeberwachungsregelnListe`)
- [x] Nur Admin sehen/verwalten — Tab nur `isAdmin`, API `requireAdmin()` + RLS `is_admin()`
- [x] Freitext-Eingabefeld (mehrzeilig) — `Textarea` (rows=3, maxLength 2000)
- [x] Button „Regel übersetzen" → KI — Button ruft `POST .../uebersetzen`, Lade-/Fehlerzustand vorhanden
- [x] KI übersetzt Freitext in strukturiertes Regel-JSON — `uebersetzeUeberwachungsregel` inkl. striktem Zod-Parsing
- [x] Ergebnis vor dem Speichern anzeigen — Klartext-Vorschaukarte („Was diese Regel prüft") + Live-Preview aus den Formularfeldern
- [x] Akzeptieren/Verwerfen/erneut übersetzen — Vorschlag befüllt editierbare Felder, „Erneut übersetzen"-Button, „Abbrechen"
- [x] Verständliche Fehlermeldung bei nicht übersetzbarem Freitext — API 422 mit Klartext, im Dialog als Alert angezeigt
- [x] Kein KI-Token → Verweis auf Einstellungen — Hinweisbanner mit Link `?tab=integration` statt Übersetzen-Button

#### AK-2: Regeltypen
- [x] Einzelbuchungs-Kriterien (Betrag/Bereich, Richtung, Empfänger, Verwendungszweck, IBAN) — vollständig in `watchCriterionMatches`
- [x] UND/ODER-Verknüpfung — `bedingungMatchesBuchung` (AND=every, OR=some)
- [x] Muster-/Aggregatregeln (Anzahl N in X Tagen / Summe > Y in X Tagen) — `pruefeMusterRegel`
- [x] Regel-Felder (Name, Freitext-Original, Bedingung, Typ, Aktiv, Empfänger, Erstellzeit) — DB-Schema/Typen vollständig

#### AK-3: Regelverwaltung (CRUD)
- [x] Regelübersicht mit Name/Zusammenfassung/Typ/Aktiv/Empfänger — `RegelRow` zeigt alle Felder inkl. Typ-Badge, Inaktiv-Badge, Empfänger-Chips
- [x] Aktivieren/Deaktivieren — `Switch` mit optimistischem Update + Rollback, `PATCH {ist_aktiv}`; Prüfung filtert `ist_aktiv=true`
- [x] Bearbeiten (JSON + Freitext-Neuübersetzung) — Bearbeiten-Dialog befüllt Felder, `PATCH` ersetzt Bedingung atomar
- [x] Löschen — `AlertDialog` mit Bestätigung, `DELETE`, Historie via `ON DELETE SET NULL` erhalten
- [x] Empfänger-Validierung (Format) — Frontend `EMAIL_REGEX` + Backend `empfaengerListeSchema` (Zod email) + DB-CHECK nonempty

#### AK-4: Prüfung beim PSD2-Abruf
- [x] Nach `applyCategorizationRules` im Cron — korrekt in `sync.ts` platziert
- [x] Einzelbuchungs-Regeln gegen jede neu importierte Buchung — bestanden
- [x] Muster-Regeln werten Zeitfenster über Bestand aus, Auslösung nur bei neuer Buchung — bestanden
- [x] Ein Treffer = genau eine E-Mail — Bündelung pro Regel/Lauf (siehe aber BUG-2)
- [x] Service-Role im Cron — Cron und manueller Sync nutzen `createAdminSupabaseClient()`
- [x] Fehler brechen PSD2-Abruf nicht ab — doppelter try/catch (in `pruefeUeberwachungsregeln` je Regel + in `sync.ts`)

#### AK-5: Benachrichtigungs-E-Mail
- [x] Nennt Regelname, Klartext-Prüfung, Buchung(en) mit Datum/Betrag/Gegenseite/Zweck
- [x] From/Reply-To über `getFromEmail`/`getReplyToEmail` (Muster identisch zu psd2-emails)
- [x] Alle datenseitigen Werte HTML-escaped (`escapeHtml` auf allen Feldern)
- [x] Bündelung bei mehreren Treffern (eine Mail pro Regel/Lauf) — bestanden, mit Einschränkung BUG-2

#### AK-6: Dedup / Log
- [x] Jede Benachrichtigung protokolliert (`ueberwachungs_benachrichtigungen`)
- [x] Gleiche Regel+Buchung löst nicht erneut aus — Einzel-Keys `einzel:regel:tx` + Bündel-Key jetzt via `fingerabdruckBuchungen` (SHA-256 der sortierten IDs) statt Datum+Anzahl (BUG-2 behoben)
- [x] Muster-Dedup-Einheit — inhaltsbasierter Fingerabdruck der beteiligten Buchungen `muster:regel:<hash>` statt Kalendermonat (BUG-3 behoben; Tradeoff siehe OBS-1)

### Status der Randfälle
- [x] RF Mehrdeutige/unsinnige KI-Regel → Klartext-Vorschau + separater Speicherschritt; Admin muss aktiv „Regel anlegen" klicken
- [x] RF Kein KI-Token → Übersetzung deaktiviert, gespeicherte Regeln laufen ohne KI (Prüfung deterministisch) — bestanden
- [x] RF Massentreffer (90-Tage-Backfill) → gebündelte Mail statt Einzelmails — bestanden (Einzelbuchung), Bündel-Key jetzt kollisionssicher
- [x] RF Duplikat-Buchung im Sync → nur wirklich neue IDs geprüft (`neueTransaktionIds`) — bestanden
- [x] RF Ungültiger Empfänger → Zod-Validierung lehnt ab; Teilversand isoliert je Empfänger, Fehler geloggt — bestanden
- [x] RF Fehler in Regelprüfung → Import bleibt erfolgreich, Fehler geloggt — bestanden
- [x] RF Deaktivierte Regel → per `ist_aktiv=true`-Filter übersprungen — bestanden
- [x] RF Zeitfenster über letzten Abruf hinaus → relativ zum Buchungsdatum ausgewertet (`ladeBuchungenImZeitraum`) — bestanden
- [x] RF Regel gelöscht mit vorhandenen Logs → `ON DELETE SET NULL` + `regel_name_stand`-Snapshot — bestanden

### Sicherheitsaudit-Ergebnisse
- [x] Authentifizierung: Alle API-Routen über `requireAdmin()` (401 ohne Login)
- [x] Autorisierung: `requireAdmin()` (403 für Nicht-Admins) + RLS `is_admin()` auf beiden Tabellen; Protokoll-Tabelle ohne INSERT-Policy → Schreibzugriff nur Service-Role im Cron
- [x] KI-Token: nur verschlüsselt aus `app_settings`, serverseitig `decrypt`, nie an das Frontend zurückgegeben (nur `vorschlag`)
- [x] Prompt-Injection: KI-Ausgabe wird strikt gegen `ueberwachungsBedingungSchema` validiert, nie ausgeführt — kein ungeprüftes JSON in die DB
- [x] Eingabevalidierung: alle Bodies per Zod, `id`-Param als UUID validiert
- [x] XSS: E-Mail-Inhalte durchgängig HTML-escaped
- [x] Rate Limiting: gemeinsames IP-Limit (20/min) aus `requireAdmin` greift auch für die teure `uebersetzen`-Route
- [i] Hinweis (informativ): Ein Admin kann beliebige externe E-Mail-Adressen als Empfänger hinterlegen; Benachrichtigungen enthalten Finanzdaten (Beträge, Gegenseite, Zweck). Durch Admin-only-Zugriff akzeptables Restrisiko, aber im Betrieb bewusst halten.

### Gefundene Bugs

Alle vier Bugs des Erst-Tests wurden behoben und im Re-Test verifiziert:

#### BUG-1: Komplette Admin-UI für Überwachungsregeln fehlt — BEHOBEN
- **Schweregrad:** Kritisch
- **Fix verifiziert:** `UeberwachungsregelnListe` (Übersicht, Switch, Bearbeiten, Löschen) + `UeberwachungsregelFormDialog` (Freitext, „Regel übersetzen", Klartext-Vorschau, Kriterien-Editor, Muster-Parameter, Empfänger-Eingabe, Aktiv-Checkbox, „Kein-KI-Anbieter"-Banner) eingebunden über Einstellungen-Tab „Überwachung" (nur `isAdmin`). Build kompiliert `/dashboard/einstellungen`.

#### BUG-2: Fragiler Bundle-Dedup-Schlüssel — BEHOBEN
- **Schweregrad:** Mittel
- **Fix verifiziert:** `pruefeEinzelbuchungsRegel` bildet den Bündel-Schlüssel jetzt als `einzel-bundle:${regel.id}:${fingerabdruckBuchungen(treffer-ids)}` (SHA-256 der sortierten Buchungs-IDs). Zwei Läufe am selben Tag mit unterschiedlichen Buchungen erzeugen verschiedene Schlüssel → kein stiller `23505`-Verlust mehr. Einzelbuchung mit genau einem Treffer nutzt weiterhin den `einzel:regel:tx`-Key.

#### BUG-3: Muster-Dedup nur monatlich — BEHOBEN
- **Schweregrad:** Niedrig
- **Fix verifiziert:** `pruefeMusterRegel` nutzt jetzt `muster:${regel.id}:${fingerabdruckBuchungen(passende-ids)}` statt des Kalendermonats. Zwei inhaltlich unterschiedliche Muster im selben Monat werden eigenständig gemeldet. Siehe OBS-1 zum verbleibenden Tradeoff.

#### BUG-4: `.limit()` fehlt bei der Zeitfenster-Abfrage — BEHOBEN
- **Schweregrad:** Niedrig
- **Fix verifiziert:** `ladeBuchungenImZeitraum` nutzt jetzt `.range(...).limit(PAGE)`. Konvention aus `.claude/rules/backend.md` erfüllt.

### Verbleibende Beobachtungen (kein Blocker)

#### OBS-1: Muster-Dedup meldet erneut, wenn das Muster durch neue Buchungen wächst
- **Schweregrad:** Niedrig (Design-Tradeoff)
- **Ort:** `pruefeMusterRegel`, inhaltsbasierter Dedup-Schlüssel
- **Beschreibung:** Da der Schlüssel den Fingerabdruck ALLER im Zeitfenster passenden Buchungen enthält, ändert sich der Schlüssel, sobald eine neue passende Buchung hinzukommt → erneute Benachrichtigung. Für ein laufend wachsendes Muster (z. B. wöchentlich wiederkehrende Kleinbeträge) kann das wiederholte Alarme erzeugen. Kein „tägliches" Melden ohne neue Treffer (nur bei echten neuen Buchungen), daher vertretbar; im Betrieb beobachten, ob eine gröbere Dedup-Einheit (z. B. Fingerabdruck nur der ältesten N Auslöser) gewünscht ist.
- **Priorität:** Im nächsten Sprint bewerten.

#### OBS-2: Tippfehler im KI-Prompt
- **Schweregrad:** Niedrig (kosmetisch)
- **Ort:** `WATCH_RULE_PROMPT` in `src/lib/ki-parser.ts` — „Wähst du" statt „Wählst du". Keine funktionale Auswirkung.
- **Priorität:** Wäre schön.

### Ausgeführte Tests (Re-Test-Umgebung)
- `npx tsc --noEmit` → **fehlerfrei**
- `npx eslint` auf allen PROJ-18-Dateien → **fehlerfrei**
- `npm run build` → **erfolgreich** (alle Routen kompiliert)
- Zirkularimport-Prüfung → kein Zyklus (ki-parser → ueberwachungsregeln → ueberwachungs-emails/resend, kein Rückverweis)

### Nicht ausgeführte Tests (Umgebung)
- Interaktives Cross-Browser (Chrome/Firefox/Safari) und Responsiv (375/768/1440px) im echten Browser — nicht durchführbar; statisch geprüft (shadcn/ui + responsive Tailwind-Muster, scrollbarer Dialog).
- End-to-End-Live-Test des Cron-Triggers mit echtem KI-Token/Resend — nicht durchgeführt (kein Live-Secret in QA).

### Regressionsprüfung
- `ki-parser.ts`: nur additive Ergänzung (neuer Prompt/Funktion), bestehender PDF-Parse-Pfad unberührt — geringes Risiko. Neue transitive Importkette (ki-parser → ueberwachungsregeln → ueberwachungs-emails/Resend) ohne Top-Level-Seiteneffekte (Resend lazy). Kein Zirkularimport erkannt.
- `sync.ts`: fehlertolerant angehängter Schritt, `SyncErgebnis` nur um optionale Felder erweitert — PSD2-Import (PROJ-16) unberührt.
- `types.ts`: rein additiv.
- Migration `030`: neue Tabellen + additiver Index auf `transactions` — keine Änderung an bestehenden Objekten.

### Zusammenfassung
- **Akzeptanzkriterien:** Alle erfüllt — Backend/Logik und der komplette UI-Layer (AK-1 bis AK-6) bestanden. Alle ~32 Unterkriterien bestanden.
- **Gefundene Bugs:** 0 offen. Alle 4 Bugs des Erst-Tests (1 kritisch, 1 mittel, 2 niedrig) behoben und im Re-Test verifiziert. Verbleibend: 2 niedrige Beobachtungen (OBS-1 Dedup-Tradeoff, OBS-2 Prompt-Tippfehler) — kein Blocker.
- **Qualität:** `tsc --noEmit`, `eslint` und `npm run build` fehlerfrei; kein Zirkularimport.
- **Sicherheit:** Bestanden (Admin-only, RLS auf beiden Tabellen, Service-Role-Trennung für den Cron-Insert, Token nur verschlüsselt/serverseitig, HTML-Escaping in Mails, strikte Zod-Validierung der KI-Ausgabe, UUID-Param-Validierung, gemeinsames Rate-Limit über `requireAdmin`). Ein informativer Betriebshinweis (Empfänger können beliebige externe E-Mails sein und erhalten Finanzdaten — durch Admin-only akzeptables Restrisiko).
- **Produktionsreif:** JA
- **Empfehlung:** Deployen. Optional vorab OBS-2 (Tippfehler) korrigieren; OBS-1 im Betrieb beobachten.

## Deployment
_Wird von /deploy hinzugefügt_
