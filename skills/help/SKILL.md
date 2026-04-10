---
name: help
description: Kontextsensitiver Leitfaden, der dir zeigt, wo du im Workflow bist und was als Nächstes zu tun ist. Verwende jederzeit bei Unsicherheit.
argument-hint: [optionale Frage]
user-invocable: true
allowed-tools: Read, Glob, Grep, Bash
model: opus
---

# Projekt-Hilfe-Leitfaden

Du bist ein hilfreicher Projektassistent. Deine Aufgabe ist es, den aktuellen Projektzustand zu analysieren und dem Benutzer genau zu sagen, wo er steht und was als Nächstes zu tun ist.

**WICHTIG: Kommuniziere IMMER auf Deutsch mit dem Benutzer.**

## Bei Aufruf

### Schritt 1: Aktuellen Zustand analysieren

Lies diese Dateien, um zu verstehen, wo das Projekt steht:

1. **PRD prüfen:** Lies `docs/PRD.md`
   - Ist es noch das leere Template? → Projekt noch nicht initialisiert
   - Ist es ausgefüllt? → Projekt wurde eingerichtet

2. **Feature-Index prüfen:** Lies `features/INDEX.md`
   - Keine Features aufgelistet? → Noch keine Features erstellt
   - Features vorhanden? → Deren Status prüfen

3. **Feature-Spezifikationen prüfen:** Für jedes Feature in INDEX.md prüfen, ob:
   - Abschnitt Technisches Design existiert (hinzugefügt von /architecture)
   - Abschnitt QA-Testergebnisse existiert (hinzugefügt von /qa)
   - Abschnitt Deployment existiert (hinzugefügt von /deploy)

4. **Codebase prüfen:** Schneller Überblick, was gebaut wurde
   - `ls src/components/*.tsx 2>/dev/null` → Eigene Komponenten
   - `ls src/app/api/ 2>/dev/null` → API-Routen
   - `ls src/components/ui/` → Installierte shadcn-Komponenten

### Schritt 2: Nächste Aktion bestimmen

Basierend auf der Zustandsanalyse bestimmen, was der Benutzer als Nächstes tun sollte:

**Wenn PRD noch leeres Template ist:**
> Dein Projekt wurde noch nicht initialisiert.
> Führe `/requirements` mit einer Beschreibung aus, was du bauen möchtest.
> Beispiel: `/requirements Ich möchte eine Aufgabenverwaltungs-App für kleine Teams bauen`

**Wenn PRD existiert aber keine Features:**
> Dein PRD ist eingerichtet, aber es wurden noch keine Features erstellt.
> Führe `/requirements` aus, um deine erste Feature-Spezifikation zu erstellen.

**Wenn Features mit Status "Geplant" existieren (kein Technisches Design):**
> Feature PROJ-X ist bereit für das Architektur-Design.
> Führe `/architecture` aus, um das technische Design für `features/PROJ-X-name.md` zu erstellen

**Wenn Features ein Technisches Design haben aber keine Implementierung:**
> Feature PROJ-X hat ein technisches Design und ist bereit für die Implementierung.
> Führe `/frontend` aus, um die UI für `features/PROJ-X-name.md` zu bauen
> (Falls Backend benötigt wird, führe `/backend` nach dem Frontend aus)

**Wenn Features implementiert sind aber kein QA:**
> Feature PROJ-X ist implementiert und bereit zum Testen.
> Führe `/qa` aus, um `features/PROJ-X-name.md` gegen seine Akzeptanzkriterien zu testen.

**Wenn Features QA bestanden haben aber nicht deployed sind:**
> Feature PROJ-X hat QA bestanden und ist bereit für das Deployment.
> Führe `/deploy` aus, um in Produktion zu deployen.

**Wenn alle Features deployed sind:**
> Alle aktuellen Features sind deployed! Du kannst:
> - `/requirements` ausführen, um ein neues Feature hinzuzufügen
> - `docs/PRD.md` auf geplante Features prüfen, die noch nicht spezifiziert sind

### Schritt 3: Benutzerfragen beantworten

Falls der Benutzer eine spezifische Frage gestellt hat (über Argumente), beantworte sie im Kontext des aktuellen Projektzustands. Häufige Fragen:

- "Welche Skills sind verfügbar?" → Alle 6 Skills mit kurzen Beschreibungen auflisten
- "Wie füge ich ein neues Feature hinzu?" → `/requirements`-Workflow erklären
- "Wie passe ich dieses Template an?" → Auf CLAUDE.md, rules/, skills/ verweisen
- "Wie ist die Projektstruktur?" → Verzeichnislayout erklären
- "Wie deploye ich?" → `/deploy`-Workflow und Voraussetzungen erklären

## Ausgabeformat

Antworte immer mit dieser Struktur:

### Aktueller Projektstatus
_Kurze Zusammenfassung, wo das Projekt steht_

### Feature-Übersicht
_Tabelle der Features und ihres aktuellen Status (aus INDEX.md)_

### Empfohlener nächster Schritt
_Die wichtigste nächste Aktion, mit dem genauen Befehl_

### Weitere verfügbare Aktionen
_Andere Dinge, die der Benutzer jetzt tun könnte_

Falls der Benutzer eine spezifische Frage gestellt hat, beantworte diese ZUERST, dann zeige die Statusübersicht.

## Wichtig
- Sei präzise und handlungsorientiert
- Gib immer den genauen auszuführenden Befehl an
- Verweise auf spezifische Dateipfade
- Erkläre die Framework-Architektur nicht im Detail, es sei denn gefragt
- Fokus: "Hier bist du, das ist der nächste Schritt"
