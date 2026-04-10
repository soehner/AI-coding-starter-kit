# Frontend-Implementierungs-Checkliste

Vor dem Markieren des Frontends als abgeschlossen:

## shadcn/ui
- [ ] shadcn/ui für JEDE benötigte UI-Komponente geprüft
- [ ] Keine eigenen Duplikate von shadcn-Komponenten erstellt
- [ ] Fehlende shadcn-Komponenten via `npx shadcn@latest add` installiert

## Bestehender Code
- [ ] Bestehende Projektkomponenten via `git ls-files src/components/` geprüft
- [ ] Bestehende Komponenten wo möglich wiederverwendet

## Design
- [ ] Design-Präferenzen mit dem Benutzer geklärt (falls keine Mockups)
- [ ] Komponentenarchitektur vom Solution Architect befolgt

## Implementierung
- [ ] Alle geplanten Komponenten implementiert
- [ ] Alle Komponenten verwenden Tailwind CSS (keine Inline-Styles, keine CSS-Module)
- [ ] Ladezustände implementiert (Spinner/Skeleton während Datenabfragen)
- [ ] Fehlerzustände implementiert (benutzerfreundliche Fehlermeldungen)
- [ ] Leere Zustände implementiert ("Noch keine Daten"-Nachrichten)

## Qualität
- [ ] Responsiv: Mobil (375px), Tablet (768px), Desktop (1440px)
- [ ] Barrierefreiheit: Semantisches HTML, ARIA-Labels, Tastaturnavigation
- [ ] TypeScript: Keine Fehler (`npm run build` läuft durch)
- [ ] ESLint: Keine Warnungen (`npm run lint`)

## Verifizierung (vor Abschluss ausführen)
- [ ] `npm run build` läuft ohne Fehler durch
- [ ] Alle Akzeptanzkriterien aus der Feature-Spezifikation in der UI abgedeckt
- [ ] `features/INDEX.md` Status auf "In Bearbeitung" aktualisiert

## Abschluss
- [ ] Benutzer hat die UI im Browser geprüft und genehmigt
- [ ] Code in git committed
