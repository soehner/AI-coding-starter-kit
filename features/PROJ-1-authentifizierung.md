# PROJ-1: Authentifizierung & Benutzerverwaltung

## Status: Deployed
**Erstellt:** 2026-04-10
**Zuletzt aktualisiert:** 2026-04-10
**Produktions-URL:** https://cbs-finanz.vercel.app
**Deployed:** 2026-04-10

## Abhängigkeiten
- Keine (Basis-Feature)

## User Stories
- Als Administrator möchte ich mich mit E-Mail und Passwort einloggen, damit ich auf die Anwendung zugreifen kann.
- Als neuer Benutzer möchte ich meine E-Mail-Adresse verifizieren, damit mein Account aktiviert wird.
- Als eingeloggter Benutzer möchte ich mich ausloggen können, damit meine Session sicher beendet wird.
- Als Administrator möchte ich in der App sehen, welche Rolle ich habe, damit ich weiß, was ich tun darf.
- Als Betrachter möchte ich bei versuchtem Schreibzugriff eine klare Fehlermeldung sehen, damit ich verstehe, dass ich keine Schreibrechte habe.

## Akzeptanzkriterien
- [ ] Login-Seite mit E-Mail + Passwort
- [ ] Nach erfolgreichem Login wird zum Dashboard weitergeleitet
- [ ] Ungültige Zugangsdaten zeigen eine verständliche Fehlermeldung
- [ ] E-Mail-Verifizierung ist für neue Accounts erforderlich (Supabase Auth)
- [ ] "Passwort vergessen"-Funktion sendet Reset-E-Mail
- [ ] Logout-Button ist immer erreichbar (z. B. im Header/Sidebar)
- [ ] Nicht eingeloggte Benutzer werden zur Login-Seite weitergeleitet
- [ ] Session bleibt nach Browser-Refresh bestehen
- [ ] Jeder Benutzer hat eine Rolle: `admin` oder `viewer` (gespeichert in `user_profiles`-Tabelle)

## Randfälle
- Was passiert bei mehrfach falschem Passwort? → Supabase-Standard-Limitierung greift
- Was passiert, wenn der Verifizierungs-Link abläuft? → Benutzer kann neuen Link anfordern
- Was passiert bei bereits verwendeter E-Mail? → Fehlermeldung "E-Mail bereits registriert"
- Was passiert, wenn die Supabase-Session abläuft? → Automatischer Redirect zur Login-Seite

## Technische Anforderungen
- Supabase Auth (Email/Password-Provider)
- Tabelle `user_profiles` mit `id`, `email`, `role` (`admin` | `viewer`), `created_at`
- RLS: Benutzer können nur ihr eigenes Profil lesen
- Admins können alle Profile lesen (für Benutzerverwaltungsseite in PROJ-2)
- Erster Admin-Account muss manuell in Supabase angelegt werden (Bootstrapping)

---
<!-- Abschnitte unten werden von nachfolgenden Skills hinzugefügt -->

## Technisches Design (Solution Architect)

### Komponentenstruktur
```
App (Layout)
+-- Öffentlicher Bereich (kein Login erforderlich)
|   +-- /login
|       +-- LoginFormular
|           +-- E-Mail-Feld
|           +-- Passwort-Feld
|           +-- "Anmelden"-Button
|           +-- "Passwort vergessen?"-Link
|           +-- Fehlermeldung (bei falschen Zugangsdaten)
|
+-- /passwort-vergessen
|   +-- E-Mail-Feld
|   +-- "Reset-Link senden"-Button
|   +-- Bestätigungsmeldung
|
+-- Geschützter Bereich (nur mit Login)
    +-- Layout mit Header/Sidebar
    |   +-- Benutzer-Avatar/Name
    |   +-- Rollen-Badge ("Administrator" / "Betrachter")
    |   +-- "Abmelden"-Button
    |
    +-- Dashboard (Startseite nach Login)
```

### Datenmodell
**Supabase Auth (automatisch verwaltet):**
- Benutzer-ID, E-Mail, verschlüsseltes Passwort, E-Mail-Verifizierungsstatus

**Tabelle `user_profiles`:**
- `id` – verknüpft mit Supabase Auth
- `email` – E-Mail-Adresse
- `role` – "admin" oder "viewer"
- `created_at`

RLS: Benutzer sieht nur eigenes Profil; Admins sehen alle Profile.

### Zugriffsschutz (Next.js Middleware)
| Route | Zugriff | Weiterleitung |
|---|---|---|
| /login | Nur ausgeloggt | → /dashboard |
| /passwort-vergessen | Nur ausgeloggt | → /dashboard |
| /dashboard + alle weiteren | Eingeloggt | → /login |

### Technische Entscheidungen
- **Supabase Auth** – übernimmt E-Mail-Verifizierung, Passwort-Reset und Session komplett
- **Cookie-basierte Session** – bleibt nach Browser-Refresh erhalten, funktioniert serverseitig
- **Eigene `user_profiles`-Tabelle** – Supabase Auth kennt keine eigenen Rollen, daher separat gespeichert
- **Next.js Middleware** – prüft bei jedem Seitenaufruf die Session, leitet bei Bedarf um
- **Erster Admin** – wird manuell im Supabase-Dashboard angelegt (Bootstrapping)

### Neue Pakete
Keine – alle benötigten Pakete (Supabase, shadcn/ui, Zod, react-hook-form) sind bereits installiert.

## QA-Testergebnisse (Re-Test)

**Ersttest:** 2026-04-10
**Re-Test:** 2026-04-10
**App-URL:** http://localhost:3000
**Tester:** QA-Ingenieur (KI)
**Methode:** Statische Code-Analyse + Build-Verifizierung

### Status der Akzeptanzkriterien

#### AK-1: Login-Seite mit E-Mail + Passwort
- [x] Login-Seite unter `/login` vorhanden
- [x] E-Mail-Feld mit Typ `email` und autocomplete="email"
- [x] Passwort-Feld mit Typ `password` und autocomplete="current-password"
- [x] Zod-Validierung fuer E-Mail und Passwort (Pflichtfeld)
- [x] shadcn/ui-Komponenten korrekt verwendet (Card, Form, Input, Button)
- **Ergebnis: BESTANDEN**

#### AK-2: Nach erfolgreichem Login wird zum Dashboard weitergeleitet
- [x] `window.location.assign("/dashboard")` nach erfolgreicher Anmeldung (login-form.tsx Zeile 84)
- [x] Korrekte Verwendung von `window.location.assign` statt `router.push` (Best Practice laut Rules)
- [x] Redirect nur wenn `data.session` vorhanden
- **Ergebnis: BESTANDEN**

#### AK-3: Ungueltige Zugangsdaten zeigen eine verstaendliche Fehlermeldung
- [x] "Invalid login credentials" wird zu "E-Mail oder Passwort ist falsch." uebersetzt
- [x] "Email not confirmed" wird zu verstaendlicher deutscher Meldung uebersetzt
- [x] Fallback-Fehlermeldung fuer unerwartete Fehler vorhanden
- [x] Fehlermeldung wird in Alert-Komponente angezeigt
- **Ergebnis: BESTANDEN**

#### AK-4: E-Mail-Verifizierung ist fuer neue Accounts erforderlich
- [x] Wird von Supabase Auth automatisch verwaltet
- [x] Auth-Callback-Route `/api/auth/callback` implementiert fuer E-Mail-Verifizierungslinks
- [x] Fehlermeldung bei nicht-verifizierter E-Mail implementiert
- **Ergebnis: BESTANDEN**

#### AK-5: "Passwort vergessen"-Funktion sendet Reset-E-Mail
- [x] Link "Passwort vergessen?" auf Login-Seite vorhanden
- [x] Eigene Seite `/passwort-vergessen` mit Formular
- [x] `supabase.auth.resetPasswordForEmail()` korrekt aufgerufen
- [x] Erfolgsmeldung nach Absenden (ohne Angabe ob E-Mail existiert - sicherheitskonform)
- [x] Zurueck-Link zur Login-Seite vorhanden
- **Ergebnis: BESTANDEN**

#### AK-6: Logout-Button ist immer erreichbar
- [x] AppHeader mit Logout-Button im DropdownMenu implementiert
- [x] Header ist in Dashboard-Layout eingebunden (sticky top-0)
- [x] `signOut` ruft `supabase.auth.signOut()` auf und redirectet zu `/login`
- **Ergebnis: BESTANDEN**

#### AK-7: Nicht eingeloggte Benutzer werden zur Login-Seite weitergeleitet
- [x] Next.js Middleware (`middleware.ts`) vorhanden mit korrektem Matcher
- [x] `supabase-middleware.ts` prueft Session mit `getUser()` (sicherer als `getSession()`)
- [x] Redirect zu `/login` fuer nicht-authentifizierte Benutzer auf geschuetzten Routen
- [x] Oeffentliche Routen korrekt definiert: `/login`, `/passwort-vergessen`, `/api/auth/callback`
- **Ergebnis: BESTANDEN**

#### AK-8: Session bleibt nach Browser-Refresh bestehen
- [x] Cookie-basierte Session via `@supabase/ssr` mit `createBrowserClient`
- [x] Server-seitige Session-Refresh in Middleware
- [x] `useAuth` Hook laedt Session bei Initialisierung und lauscht auf `onAuthStateChange`
- **Ergebnis: BESTANDEN**

#### AK-9: Jeder Benutzer hat eine Rolle (admin/viewer) in user_profiles-Tabelle
- [x] TypeScript-Typ `UserRole = "admin" | "viewer"` definiert
- [x] Interface `UserProfile` mit `id, email, role, created_at`
- [x] `useAuth` Hook laedt Profil aus `user_profiles`-Tabelle
- [x] `isAdmin` und `isViewer` Hilfseigenschaften im Hook
- [x] Rollen-Badge im Header angezeigt ("Administrator" / "Betrachter")
- [x] SQL-Migration `001_user_profiles.sql` vorhanden mit Tabelle, RLS-Policies und Auto-Profil-Trigger
- [x] CHECK-Constraint fuer `role` auf `admin` und `viewer` begrenzt
- [x] Indizes auf `role` und `email` erstellt
- **Ergebnis: BESTANDEN** (vorher: TEILWEISE BESTANDEN - BUG-1 behoben)

### Status der Randfaelle

#### RF-1: Mehrfach falsches Passwort
- [x] Supabase-Standard-Rate-Limiting greift serverseitig
- [x] Fehlermeldung wird bei jedem Fehlversuch korrekt angezeigt
- **Ergebnis: BESTANDEN**

#### RF-2: Verifizierungs-Link laeuft ab
- [x] Auth-Callback behandelt Fehler und redirectet zu `/login?error=auth_callback_error`
- [x] Login-Seite wertet `error` Query-Parameter aus via `searchParams` und `callbackError` Prop
- [x] Fehlermeldung "Der Verifizierungslink ist abgelaufen oder ungueltig" wird angezeigt
- **Ergebnis: BESTANDEN** (vorher: NICHT BESTANDEN - BUG-2 behoben)

#### RF-3: Bereits verwendete E-Mail
- [x] Wird von Supabase Auth serverseitig behandelt
- **Ergebnis: BESTANDEN (Supabase-Standardverhalten)**

#### RF-4: Supabase-Session laeuft ab
- [x] Middleware prueft Session bei jedem Request
- [x] `onAuthStateChange` im useAuth-Hook reagiert auf Session-Aenderungen
- **Ergebnis: BESTANDEN**

### Sicherheitsaudit-Ergebnisse

#### Authentifizierung
- [x] Login verwendet `signInWithPassword` (korrekt)
- [x] Middleware verwendet `getUser()` statt `getSession()` (sicherer - validiert JWT serverseitig)
- [x] Auth-Callback verwendet `exchangeCodeForSession` (PKCE-Flow)
- [x] Keine XSS-Vektoren (kein `dangerouslySetInnerHTML`, kein `innerHTML`, kein `eval`)
- [x] Keine hartcodierten Secrets im Quellcode

#### Autorisierung
- [x] RLS aktiviert auf `user_profiles`-Tabelle (Migration vorhanden)
- [x] RLS-Policy: Benutzer sieht nur eigenes Profil (`auth.uid() = id`)
- [x] RLS-Policy: Admins sehen alle Profile (fuer PROJ-2)
- [x] RLS-Policy: Nur Admins koennen Profile aktualisieren
- [x] API-Route `/api/auth/profile` prueft Authentifizierung mit `getUser()` serverseitig
- [x] Profil-Abfrage in API-Route ist auf `.eq("id", user.id)` beschraenkt (zusaetzlich zu RLS)
- [ ] HINWEIS: Keine INSERT-RLS-Policy fuer `user_profiles` - Einfuegen erfolgt ausschliesslich ueber den `handle_new_user` Trigger mit `security definer` (akzeptabel)

#### Eingabevalidierung
- [x] Zod-Validierung fuer Login-Formular (E-Mail + Passwort)
- [x] Zod-Validierung fuer Passwort-Reset-Formular (E-Mail)
- [x] Serverseitige Validierung durch Supabase Auth

#### Rate Limiting
- [x] Supabase Auth hat eingebautes Rate Limiting
- [x] In-Memory Rate Limiting auf `/api/auth/profile` implementiert (30 Req/Min pro IP)
- [ ] HINWEIS: In-Memory Rate Limiting funktioniert nicht bei mehreren Serverinstanzen (Vercel Serverless). Fuer eine Einzelinstanz-App akzeptabel.

#### Secrets
- [x] Umgebungsvariablen korrekt in `.env.local` (gitignored)
- [x] `.env.local.example` mit Dummy-Werten vorhanden
- [x] Nur `NEXT_PUBLIC_` Variablen (Supabase URL + Anon Key) - korrekt fuer Supabase

#### Security Headers
- [x] `next.config.ts` konfiguriert Security Headers fuer alle Routen:
  - X-Frame-Options: DENY
  - X-Content-Type-Options: nosniff
  - Referrer-Policy: origin-when-cross-origin
  - Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
- **Vorher: BUG-3 - jetzt BEHOBEN**

#### Session-Sicherheit
- [x] Cookie-basierte Sessions via `@supabase/ssr`
- [x] Session-Refresh in Middleware implementiert

#### SQL-Injection / Datenbank-Sicherheit
- [x] Supabase-Client verwendet parametrisierte Queries
- [x] `handle_new_user` Trigger mit `security definer` und `set search_path = ''` (verhindert search_path-Angriffe)
- [x] Kein direktes SQL vom Client moeglich

### Cross-Browser-Analyse (statisch)
- [x] Keine browser-spezifischen APIs verwendet
- [x] Tailwind CSS fuer Styling (gute Browser-Kompatibilitaet)
- [x] Standard-HTML-Formularelemente
- [x] `window.location.assign` ist in allen modernen Browsern verfuegbar

### Responsive-Analyse (statisch)
- [x] Login-Formular: `max-w-md` mit `px-4` Padding - responsive
- [x] Dashboard: `grid gap-4 md:grid-cols-2 lg:grid-cols-3` - responsive Grid
- [x] Header: Rollen-Badge mit `hidden sm:inline-flex` - mobile-optimiert
- [x] DropdownMenu zeigt Rolle auf Mobile separat an

### Behobene Bugs (aus Ersttest)

| Bug | Schweregrad | Status |
|-----|-------------|--------|
| BUG-1: Keine DB-Migration fuer user_profiles | Kritisch | BEHOBEN - `supabase/migrations/001_user_profiles.sql` vorhanden |
| BUG-2: Auth-Callback-Fehler nicht angezeigt | Mittel | BEHOBEN - `callbackError` Prop und searchParams implementiert |
| BUG-3: Keine Security Headers | Hoch | BEHOBEN - `next.config.ts` mit allen Headers konfiguriert |
| BUG-4: Kein Rate Limiting auf /api/auth/profile | Niedrig | BEHOBEN - In-Memory Rate Limiting (30 Req/Min) |
| BUG-5: ESLint-Konfiguration defekt | Niedrig | BEHOBEN - `npm run lint` laeuft fehlerfrei |
| BUG-7: Root-Seite doppelter Redirect | Niedrig | BEHOBEN - `/` leitet direkt zu `/login` weiter |

### Verbleibende Bugs

#### BUG-6: Ungenutzter Import in dashboard/page.tsx
- **Schweregrad:** Niedrig
- **Beschreibung:** `import dynamic from "next/dynamic"` in `src/app/dashboard/page.tsx` (Zeile 3) wird nirgendwo verwendet.
- **Auswirkung:** Kein funktionaler Einfluss, aber unsauberer Code. Koennte bei strikteren Lint-Regeln zu Warnungen fuehren.
- **Prioritaet:** Waere schoen

#### BUG-8: useAuth Hook erstellt bei jedem Render einen neuen Supabase-Client
- **Schweregrad:** Niedrig
- **Beschreibung:** In `use-auth.ts` wird `const supabase = createClient()` bei jedem Render-Zyklus aufgerufen. Der `supabase`-Wert ist in den Dependency-Arrays von `useCallback` und `useEffect`, was zu potenziell unnoetigem Re-Rendering fuehren kann.
- **Auswirkung:** Potenziell unnoetiges Re-Rendering und erneutes Laden des Profils. In der Praxis wird `createBrowserClient` von `@supabase/ssr` wahrscheinlich intern gecacht, aber die React-Dependency-Arrays koennten trotzdem zu Problemen fuehren.
- **Prioritaet:** Im naechsten Sprint beheben

#### BUG-9: Fehlende Content Security Policy (CSP)
- **Schweregrad:** Mittel
- **Beschreibung:** Die Security Headers in `next.config.ts` enthalten keine Content-Security-Policy (CSP). CSP ist der wichtigste Header zur Verhinderung von XSS-Angriffen.
- **Reproduktionsschritte:**
  1. Pruefe `next.config.ts` auf CSP-Header
  2. Erwartet: `Content-Security-Policy` Header definiert
  3. Tatsaechlich: Nicht vorhanden
- **Prioritaet:** Vor Deployment beheben (Sicherheit)

### Zusammenfassung
- **Akzeptanzkriterien:** 9/9 bestanden
- **Randfaelle:** 4/4 bestanden
- **Behobene Bugs:** 6 von 7 aus dem Ersttest behoben
- **Neue Bugs:** 2 gefunden (1 mittel, 1 niedrig) + 1 verbleibend aus Ersttest (niedrig)
- **Verbleibende Bugs:** 3 gesamt (0 kritisch, 0 hoch, 1 mittel, 2 niedrig)
- **Sicherheit:** Deutlich verbessert. CSP fehlt noch.
- **Build:** Erfolgreich (TypeScript + ESLint fehlerfrei)
- **Produktionsreif:** BEDINGT JA
- **Empfehlung:** BUG-9 (CSP-Header) sollte vor Produktion ergaenzt werden. BUG-6 und BUG-8 sind nicht blockierend.

## Deployment
_Wird von /deploy hinzugefügt_
