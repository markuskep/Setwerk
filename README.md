# Setwerk

Workout-Webapp für Netlify mit Trainingsvorlagen, Focus Mode, Kalender und optionalem Online-Speicher in einer privaten Google-Tabelle.

## Google-Sheets-Anbindung aktivieren

Die vorhandene Anmeldung verwendet Netlify Identity. Abgeschlossene Einheiten, Vorlagen, eigene Übungen und Einstellungen können geräteübergreifend synchronisiert werden. Laufende Workouts und Entwürfe bleiben lokal.

**Die Verbindung ist erst nach der Kontokonfiguration aktiv.** Folge [GOOGLE-SHEETS-SETUP.md](GOOGLE-SHEETS-SETUP.md): private Tabelle erstellen, [Apps Script](google-sheets/Code.gs) bereitstellen, `SETWERK_SHEETS_URL` und `SETWERK_SHEETS_SECRET` in Netlify setzen, neu deployen. Bestehende lokale Trainings können anschließend im Konto-Menü ausdrücklich übernommen werden.

## Netlify-Deployment

`netlify.toml` in der Repository-Wurzel konfiguriert den GitHub-Deploy:

- Produktionsbranch: `main`
- Basisverzeichnis: Repository-Wurzel
- Build-Befehl: `node --check netlify/functions/workout-store.mjs`
- Publish-Verzeichnis: `Setwerk-Webapp-1.2.0-Projektdateien/dist`
- Functions-Verzeichnis: `netlify/functions`
- Node.js 22; Function-Abhängigkeiten aus dem Root-`package.json`

Für diese Version den GitHub-Deploy verwenden. Ein reiner `dist`-ZIP-Upload enthält keine Server-Function und aktiviert den Online-Speicher nicht.

## Tests

```bash
npm ci
npm test
```

Die Tests prüfen Trainingsabläufe, Import/Export, Anmeldung, lokale Kontospeicher, Offline-Uploads, Versionskonflikte und die Server-/Sheets-Speicherlogik. Google und Netlify werden dabei simuliert; nach Einrichtung ist der Live-Test aus der Anleitung erforderlich.
