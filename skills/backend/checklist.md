# Backend-Implementierungs-Checkliste

## Kern-Checkliste
- [ ] Bestehende Tabellen/APIs via git geprüft, bevor neue erstellt werden
- [ ] Datenbanktabellen in Supabase erstellt
- [ ] Row Level Security bei ALLEN neuen Tabellen aktiviert
- [ ] RLS-Policies für SELECT, INSERT, UPDATE, DELETE erstellt
- [ ] Indizes auf performancekritischen Spalten erstellt
- [ ] Fremdschlüssel mit angemessenem ON DELETE-Verhalten gesetzt
- [ ] Alle geplanten API-Endpunkte in `/src/app/api/` implementiert
- [ ] Authentifizierung verifiziert (kein Zugriff ohne gültige Sitzung)
- [ ] Eingabevalidierung mit Zod bei allen POST/PUT-Anfragen
- [ ] Aussagekräftige Fehlermeldungen mit korrekten HTTP-Statuscodes
- [ ] Keine TypeScript-Fehler in API-Routen
- [ ] Alle Endpunkte manuell getestet
- [ ] Keine hartcodierten Geheimnisse im Quellcode
- [ ] Frontend mit echten API-Endpunkten verbunden
- [ ] Benutzer hat geprüft und genehmigt

## Verifizierung (vor Abschluss ausführen)
- [ ] `npm run build` läuft ohne Fehler durch
- [ ] Alle Akzeptanzkriterien aus der Feature-Spezifikation in der API abgedeckt
- [ ] Alle API-Endpunkte geben korrekte Statuscodes zurück (mit curl oder Browser testen)
- [ ] `features/INDEX.md` Status auf "In Bearbeitung" aktualisiert
- [ ] Code in git committed

## Performance-Checkliste
- [ ] Alle häufig gefilterten Spalten haben Indizes
- [ ] Keine N+1-Abfragen (Supabase Joins statt Schleifen verwenden)
- [ ] Alle Listenabfragen verwenden `.limit()`
- [ ] Zod-Validierung bei allen Schreib-Endpunkten
- [ ] Langsame Abfragen wo angebracht gecacht (optional für MVP)
- [ ] Rate Limiting auf öffentlich zugänglichen APIs (optional für MVP)
