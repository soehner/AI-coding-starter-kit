# PROJ-7: Granulare Feature-Berechtigungen für Benutzer

## Status: Deployed
**Erstellt:** 2026-04-10
**Zuletzt aktualisiert:** 2026-04-10

## Abhängigkeiten
- Benötigt: PROJ-1 (Authentifizierung) – Rollen müssen existieren
- Benötigt: PROJ-2 (Benutzerverwaltung) – Berechtigungen werden pro Benutzer in der Benutzerverwaltung gesetzt
- Erweitert: PROJ-5 (Eintragsbearbeitung) und PROJ-6 (Kassenbuch-Export) nutzen diese Berechtigungen

## Beschreibung
Neben den Basis-Rollen (Admin / Betrachter) können Admins für einzelne Benutzer granulare Feature-Berechtigungen aktivieren. Damit ist z. B. möglich, dass ein Betrachter dennoch Einträge bearbeiten oder Excel-Exporte erstellen darf – ohne zum vollen Admin gemacht werden zu müssen.

## User Stories
- Als Administrator möchte ich einem Betrachter erlauben, Buchungen zu bearbeiten, damit er Bemerkungen hinzufügen kann, ohne Admin-Rechte zu erhalten.
- Als Administrator möchte ich einem Betrachter das Recht geben, Excel-Exporte zu erstellen, damit er eigenständig Kassenbücher erstellen kann.
- Als Administrator möchte ich im Benutzerprofil eines Benutzers sehen, welche Feature-Berechtigungen er hat, damit ich den Überblick behalte.
- Als Administrator möchte ich Feature-Berechtigungen per Toggle (An/Aus) aktivieren und deaktivieren.
- Als Benutzer möchte ich nur Features sehen und nutzen können, für die ich berechtigt bin, damit die Oberfläche nicht verwirrend ist (nicht berechtigte Features sind ausgeblendet oder deaktiviert).

## Verfügbare Feature-Berechtigungen

| Berechtigung | Beschreibung | Standard Betrachter | Standard Admin |
|---|---|---|---|
| `edit_transactions` | Buchungen bearbeiten und Bemerkungen hinzufügen | Nein | Ja (implizit) |
| `export_excel` | Kassenbuch als Excel exportieren | Nein | Ja (implizit) |
| `import_statements` | Kontoauszüge hochladen und importieren | Nein | Ja (implizit) |

> Admins haben alle Berechtigungen immer – die granularen Einstellungen gelten nur für Benutzer mit der Basis-Rolle "Betrachter".

## Akzeptanzkriterien
- [ ] In der Benutzerverwaltung (PROJ-2) gibt es pro Betrachter-Benutzer einen Bereich "Feature-Berechtigungen"
- [ ] Jede Berechtigung ist per Toggle (shadcn Switch) aktivierbar
- [ ] Änderungen werden sofort gespeichert (kein separater Speichern-Button nötig)
- [ ] Feature-Berechtigungen sind in Tabelle `user_permissions` gespeichert
- [ ] Server-seitige Prüfung bei jeder berechtigungs-relevanten API-Route
- [ ] Client-seitig: Nicht berechtigte Buttons/Felder sind deaktiviert oder ausgeblendet
- [ ] Admins sehen keine Berechtigung-Toggles für sich selbst (wäre redundant)

## Randfälle
- Was passiert, wenn ein Betrachter `import_statements` hat, aber die Rolle auf Admin geändert wird? → Berechtigungen bleiben gespeichert, sind aber redundant (Admin hat alles)
- Was passiert, wenn ein Admin auf Betrachter downgestuft wird? → Explizit gesetzte Berechtigungen bleiben erhalten
- Was passiert, wenn eine neue Feature-Berechtigung hinzukommt? → Standard ist immer "Nein" für Betrachter

## Technische Anforderungen
- Tabelle `user_permissions`: `user_id` (FK), `edit_transactions` (bool), `export_excel` (bool), `import_statements` (bool), `updated_at`
- 1:1-Beziehung zu `user_profiles`
- API-Route `PATCH /api/admin/users/[id]/permissions` (nur Admins)
- Helper-Funktion `hasPermission(userId, permission)` serverseitig
- RLS: Nur Admins dürfen `user_permissions` schreiben; Benutzer können eigene Zeile lesen

---
<!-- Abschnitte unten werden von nachfolgenden Skills hinzugefügt -->

## Technisches Design (Solution Architect)

### Überblick

Das Feature erweitert die bestehende Benutzerverwaltung (PROJ-2) um eine zweite Berechtigungsebene: Neben der Basis-Rolle (Admin / Betrachter) können Admins einzelne Funktionen für Betrachter freischalten – ohne sie zum vollen Admin zu machen.

### Komponentenstruktur (visueller Baum)

```
Benutzerverwaltungsseite (bestehend, PROJ-2)
└── UsersTable (bestehend – wird erweitert)
    └── TableRow (pro Benutzer)
        ├── [bestehende Spalten: E-Mail, Rolle, Status, Datum, Aktionen]
        └── [NEU] Aufklapp-Bereich: Feature-Berechtigungen
            └── UserPermissionsPanel (neue Komponente)
                ├── Berechtigung: "Buchungen bearbeiten"
                │   └── Switch (An/Aus) + Label + Beschreibung
                ├── Berechtigung: "Excel-Export"
                │   └── Switch (An/Aus) + Label + Beschreibung
                └── Berechtigung: "Kontoauszüge importieren"
                    └── Switch (An/Aus) + Label + Beschreibung
```

**Sichtbarkeitsregeln:**
- Der Aufklapp-Bereich erscheint **nur bei Betrachtern** – bei Admins und beim eigenen Konto wird er ausgeblendet
- Ein Chevron-Icon in der Tabellenzeile zeigt an, ob weitere Einstellungen verfügbar sind

### Datenmodell

**Neue Datenbanktabelle: `user_permissions`**

```
Jeder Betrachter hat genau einen Berechtigungs-Datensatz:
- user_id           → Verweis auf den Benutzer (1:1 mit user_profiles)
- edit_transactions → Buchungen bearbeiten erlaubt? (Ja/Nein, Standard: Nein)
- export_excel      → Excel-Export erlaubt? (Ja/Nein, Standard: Nein)
- import_statements → Kontoauszüge importieren erlaubt? (Ja/Nein, Standard: Nein)
- updated_at        → Zeitstempel der letzten Änderung
```

**Beziehung zur bestehenden Datenbank:**
- 1:1-Beziehung zu `user_profiles` (ON DELETE CASCADE – wird der Benutzer gelöscht, entfällt auch sein Berechtigungs-Datensatz automatisch)
- Der Datensatz wird automatisch beim Anlegen eines neuen Betrachters erstellt (alle Rechte standardmäßig "Nein")

### Technische Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| **UI-Platzierung** | Aufklapp-Zeile in der Benutzertabelle | Keine neue Seite nötig; Kontext bleibt erhalten |
| **Speicherverhalten** | Sofort beim Toggle (kein Speichern-Button) | Weniger Klicks, direktes Feedback |
| **Berechtigungsprüfung** | Zweistufig: Server + Client | Server schützt die Daten; Client blendet unnötige Buttons aus |
| **Eigener Eintrag automatisch** | user_permissions-Zeile beim Benutzer-Anlegen | Kein "fehlender Eintrag"-Problem; konsistente Datenlage |
| **Admin-Überprüfung** | Admins ignorieren user_permissions komplett | Admins haben alles – kein Overhead durch redundante Checks |

### API-Struktur

**Neue Route:** `PATCH /api/admin/users/[id]/permissions`
- Nur Admins dürfen diese Route aufrufen
- Empfängt: welche Berechtigung, welcher Wert (An/Aus)
- Gibt zurück: den aktualisierten Berechtigungs-Datensatz

**Bestehende Routes werden erweitert:**
- `GET /api/admin/users` → liefert künftig auch die `user_permissions` pro Benutzer mit
- `PATCH /api/admin/users/[id]` (Rollenänderung) → keine Änderung nötig, Berechtigungen bleiben beim Rollenwechsel erhalten

**Serverseitige Hilfsfunktion: `hasPermission(userId, permission)`**
- Wird in den API-Routen für Eintragsbearbeitung (PROJ-5) und Excel-Export (PROJ-6) eingebaut
- Prüft: Ist der Benutzer Admin? → erlaubt. Ist Betrachter mit expliziter Berechtigung? → erlaubt. Sonst → 403 Verboten.

### Sicherheitskonzept (Datenbankebene)

**Row Level Security (RLS) auf `user_permissions`:**
- Admins dürfen alle Zeilen lesen und schreiben
- Betrachter dürfen nur die eigene Zeile lesen
- Niemand außer Admins darf Zeilen verändern

### Auswirkungen auf bestehende Features

| Feature | Änderung |
|---|---|
| PROJ-5 (Eintragsbearbeitung) | API prüft zusätzlich `edit_transactions`; "Bearbeiten"-Button für nicht-berechtigte Betrachter ausgeblendet |
| PROJ-6 (Excel-Export) | API prüft zusätzlich `export_excel`; Export-Button für nicht-berechtigte Betrachter ausgeblendet |
| PROJ-3 (PDF-Import) | API prüft zusätzlich `import_statements`; Upload-Zone für nicht-berechtigte Betrachter nicht sichtbar |
| PROJ-2 (Benutzerverwaltung) | `UsersTable`-Komponente erhält aufklappbaren Berechtigungs-Bereich |

### Abhängigkeiten (neue Pakete)

Keine neuen Pakete erforderlich – alle benötigten shadcn/ui-Komponenten (`Switch`, `Collapsible`, `Separator`) sind bereits installiert.

## QA-Testergebnisse

**Getestet:** 2026-04-11
**App-URL:** http://localhost:3000
**Tester:** QA-Ingenieur (KI) - Code-Review + Statische Analyse

### Status der Akzeptanzkriterien

#### AK-1: Feature-Berechtigungen pro Betrachter in Benutzerverwaltung
- [x] `UserPermissionsPanel` Komponente vorhanden (`src/components/user-permissions-panel.tsx`)
- [x] In `UsersTable` als aufklappbarer Bereich integriert (Collapsible)
- [x] Wird nur für Betrachter angezeigt (`canExpand = isViewer && !isCurrentUser && !!onPermissionChange`)
- [x] Chevron-Icon zeigt Aufklapp-Möglichkeit an

#### AK-2: Toggle (shadcn Switch) pro Berechtigung
- [x] Verwendet shadcn `Switch` Komponente
- [x] Alle 3 Berechtigungen mit Label und Beschreibung dargestellt
- [x] Loading-Spinner während Aktualisierung
- [x] Switch deaktiviert während Update läuft

#### AK-3: Sofortiges Speichern ohne separaten Button
- [x] `onCheckedChange` löst direkt API-Aufruf aus
- [x] Kein Speichern-Button vorhanden
- [x] Lokaler State wird nach erfolgreichem API-Aufruf aktualisiert

#### AK-4: Tabelle user_permissions in Datenbank
- [x] Migration `006_user_permissions.sql` vorhanden
- [x] Korrekte Spalten: `user_id`, `edit_transactions`, `export_excel`, `import_statements`, `updated_at`
- [x] 1:1-Beziehung zu `user_profiles` mit `ON DELETE CASCADE`
- [x] Trigger `on_user_profile_created` erstellt automatisch Berechtigungs-Zeile
- [x] Bestehende Benutzer werden nachträglich berücksichtigt (INSERT ... WHERE NOT IN)

#### AK-5: Serverseitige Prüfung bei berechtigungs-relevanten API-Routen
- [x] `requirePermission("edit_transactions")` in `PATCH /api/transactions/[id]`
- [x] `requirePermission("export_excel")` in `GET /api/export/kassenbuch`
- [x] `requirePermission("import_statements")` in `POST /api/admin/import`, `GET /api/admin/import/statements`, `POST /api/admin/import/confirm`
- [x] `requirePermission` prüft Auth + Rolle + explizite Berechtigung
- [x] Admins haben implizit alle Berechtigungen (Kurzschluss-Prüfung)

#### AK-6: Client-seitig nicht berechtigte Buttons/Felder deaktiviert/ausgeblendet
- [x] Export-Button nur sichtbar wenn `hasPermission("export_excel")` (Dashboard, Zeile 301)
- [x] `canEdit` Prop in TransactionTable gesteuert durch `hasPermission("edit_transactions")` (Dashboard, Zeile 319)
- [x] Import-Link im Header nur sichtbar wenn `hasPermission("import_statements")` (AppHeader, Zeile 89)
- [x] Import-Seite leitet um wenn keine Berechtigung (Import-Page, Zeile 76)

#### AK-7: Admins sehen keine Berechtigung-Toggles für sich selbst
- [x] `canExpand` prüft `isViewer && !isCurrentUser` - Admins und eigener Benutzer sind ausgeschlossen

### Status der Randfälle

#### RF-1: Betrachter mit Berechtigung wird auf Admin geändert
- [x] Korrekt: Berechtigungen bleiben in `user_permissions` gespeichert, aber Admin hat implizit alles
- [x] Aufklapp-Bereich verschwindet weil `isViewer` false wird
- [x] API blockiert Berechtigungsänderung für Admins (Zeile 68-76 in permissions/route.ts)

#### RF-2: Admin wird auf Betrachter downgestuft
- [x] Korrekt: `handleRoleChange` ändert nur die Rolle, `user_permissions` bleibt unverändert
- [x] Aufklapp-Bereich erscheint nach Rollenwechsel (lokal aktualisiert)

#### RF-3: Neue Feature-Berechtigung hinzukommt
- [x] Schema mit Default `false` in der Datenbank
- [x] `PermissionKey` Type müsste erweitert werden - aktuelle 3 Berechtigungen korrekt

### Sicherheitsaudit-Ergebnisse

- [x] Authentifizierung: Kein Zugriff ohne Login auf Permissions-API (requireAdmin)
- [x] Autorisierung: Nur Admins können Berechtigungen ändern (requireAdmin + RLS)
- [x] Eingabevalidierung: Zod-Schema `updatePermissionsSchema` validiert `permission` (enum) und `value` (boolean)
- [x] UUID-Validierung: Regex-Prüfung der Benutzer-ID im PATCH-Endpoint
- [x] Rate Limiting: Vorhanden in requireAdmin (20 Requests/Minute) und requirePermission (20 Requests/Minute)
- [x] RLS: 5 Policies auf `user_permissions` (SELECT eigene, SELECT Admin, UPDATE Admin, INSERT Admin, DELETE Admin)
- [x] Trigger-Funktion mit `security definer` und `set search_path = ''` (SQL-Injection-Schutz)
- [ ] BUG: Rate-Limiting basiert auf In-Memory-Map - bei mehreren Serverless-Instanzen nicht wirksam (Schweregrad: Niedrig - Vercel-Edge kann das umgehen, betrifft alle API-Routen gleichermaßen, ist ein bekanntes Pattern)

### Gefundene Bugs

#### BUG-1: Kommentar mit "ae" statt "ä" in admin/users/page.tsx
- **Schweregrad:** Niedrig
- **Reproduktionsschritte:**
  1. Öffne `src/app/dashboard/admin/users/page.tsx`, Zeile 70
  2. Erwartet: Kommentar mit "während" (echtem Umlaut)
  3. Tatsächlich: `// Lade-Zustand waehrend Auth noch laeuft`
- **Priorität:** Im nächsten Sprint beheben

#### BUG-2: Permissions-API verwendet update() statt upsert() als primäre Operation
- **Schweregrad:** Mittel
- **Reproduktionsschritte:**
  1. Lösche manuell die `user_permissions` Zeile eines Betrachters aus der Datenbank
  2. Versuche eine Berechtigung per Toggle zu ändern
  3. Erwartet: Berechtigung wird gesetzt
  4. Tatsächlich: Erster Versuch schlägt fehl (`update` findet keine Zeile, PGRST116), Fallback auf `upsert` funktioniert zwar, aber: Der `upsert` setzt nur die eine geänderte Berechtigung, die anderen bleiben auf den Default-Werten (false). Das ist korrekt, aber der Fehlercode PGRST116 tritt bei `.single()` auf wenn keine Zeile zurückkommt, nicht nur wenn sie fehlt.
- **Details:** Der Fehlerfall wird korrekt behandelt (Fallback auf upsert), aber die primäre Operation sollte direkt `upsert` sein, um den Fehlerfall zu vermeiden. Der Trigger auf `user_profiles` sollte eigentlich sicherstellen, dass die Zeile immer existiert.
- **Priorität:** Im nächsten Sprint beheben

#### BUG-3: useAuth Hook lädt Berechtigungen direkt aus user_permissions statt /api/auth/profile
- **Schweregrad:** Niedrig
- **Reproduktionsschritte:**
  1. Betrachte `src/hooks/use-auth.ts` Zeile 44-58
  2. `fetchPermissions` fragt direkt `user_permissions` Tabelle ab
  3. Gleichzeitig existiert `/api/auth/profile` Route die Berechtigungen mit Admin-Logik flach mappt
  4. Erwartet: Nur eine Quelle der Wahrheit für Client-seitige Berechtigungen
  5. Tatsächlich: Zwei parallele Wege (direkte DB-Abfrage UND API-Route), die aber zum selben Ergebnis führen
- **Details:** Kein funktionaler Bug, aber Redundanz. Die direkte Abfrage funktioniert korrekt dank RLS, aber die `/api/auth/profile` Route bietet bereits die gleichen Daten mit Admin-Override-Logik.
- **Priorität:** Wäre schön (Refactoring)

### Zusammenfassung
- **Akzeptanzkriterien:** 7/7 bestanden
- **Randfälle:** 3/3 bestanden
- **Gefundene Bugs:** 3 gesamt (0 kritisch, 0 hoch, 1 mittel, 2 niedrig)
- **Sicherheit:** Bestanden - alle relevanten Prüfungen (Auth, Autorisierung, RLS, Eingabevalidierung, Rate Limiting) vorhanden
- **Build:** Erfolgreich ohne Fehler
- **Produktionsreif:** JA
- **Empfehlung:** Deployen - die gefundenen Bugs sind nicht blockierend und können im nächsten Sprint behoben werden

## Deployment
_Wird von /deploy hinzugefügt_
