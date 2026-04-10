# QA-Testergebnisse-Template

Füge diesen Abschnitt am ENDE der Feature-Spezifikation `/features/PROJ-X.md` hinzu:

```markdown
---

## QA-Testergebnisse

**Getestet:** JJJJ-MM-TT
**App-URL:** http://localhost:3000
**Tester:** QA-Ingenieur (KI)

### Status der Akzeptanzkriterien

#### AK-1: [Kriteriumsname]
- [x] Unterkriterium bestanden
- [ ] BUG: Unterkriterium nicht bestanden (beschreibe, was schiefging)

#### AK-2: [Kriteriumsname]
- [x] Alle Unterkriterien bestanden

### Status der Randfälle

#### RF-1: [Randfallname]
- [x] Korrekt behandelt

#### RF-2: [Randfallname]
- [ ] BUG: Nicht behandelt (beschreibe erwartetes vs. tatsächliches Verhalten)

### Sicherheitsaudit-Ergebnisse
- [x] Authentifizierung: Kein Zugriff ohne Login
- [x] Autorisierung: Benutzer können nicht auf Daten anderer Benutzer zugreifen
- [x] Eingabevalidierung: XSS-Versuche blockiert
- [x] Rate Limiting: Übermäßige Anfragen behandelt
- [ ] BUG: [Beschreibung des Sicherheitsproblems]

### Gefundene Bugs

#### BUG-1: [Bug-Titel]
- **Schweregrad:** Kritisch | Hoch | Mittel | Niedrig
- **Reproduktionsschritte:**
  1. Gehe zu [Seite]
  2. Führe [Aktion] aus
  3. Erwartet: [was passieren sollte]
  4. Tatsächlich: [was tatsächlich passiert]
- **Screenshot:** [falls visueller Bug]
- **Priorität:** Vor Deployment beheben | Im nächsten Sprint beheben | Wäre schön

### Zusammenfassung
- **Akzeptanzkriterien:** X/Y bestanden
- **Gefundene Bugs:** N gesamt (K kritisch, H hoch, M mittel, N niedrig)
- **Sicherheit:** [Bestanden / Probleme gefunden]
- **Produktionsreif:** JA / NEIN
- **Empfehlung:** [Deployen / Zuerst Bugs beheben]
```
