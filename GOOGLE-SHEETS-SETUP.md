# Setwerk: private Google-Tabelle als Online-Speicher einrichten

Die Anbindung ist im Repository vorbereitet. Sie wird erst aktiv, wenn du die private Tabelle, das Apps-Script-Deployment und die zwei Netlify-Umgebungsvariablen eingerichtet hast. Bestehende Workouts werden dabei nicht automatisch einem neuen Account zugeordnet.

## 1. Private Google-Tabelle erstellen

1. Erstelle in Google Sheets eine leere Tabelle, beispielsweise **Setwerk Trainingsdaten**.
2. Lasse unter **Freigeben** den allgemeinen Zugriff auf **Eingeschränkt**. Deine Freunde brauchen keinen direkten Zugriff auf diese Tabelle.
3. Kopiere die Tabellen-ID aus der URL. In `https://docs.google.com/spreadsheets/d/TABELLEN_ID/edit` ist nur `TABELLEN_ID` gemeint.
4. Öffne in der Tabelle **Erweiterungen → Apps Script**.
5. Ersetze den Inhalt von `Code.gs` mit dem gesamten Inhalt der Datei [google-sheets/Code.gs](google-sheets/Code.gs) aus diesem Repository. Speichere das Projekt.

Das Script erstellt beim ersten gültigen Zugriff das Blatt `SetwerkAccounts`. Dort liegen Nutzer-ID, Versionsnummer, Änderungszeit und die Trainingsdaten. Die Daten sind als JSON in Base64-Blöcken gespeichert, um die Zellgröße zu berücksichtigen. Die App stellt daraus Kalender, Vorlagen und Fortschritte dar. Bearbeite diese Blöcke nicht von Hand.

## 2. Script-Eigenschaften setzen

Öffne im Apps-Script-Editor **Projekteinstellungen → Script-Eigenschaften** und trage ein:

| Eigenschaft | Wert |
| --- | --- |
| `SPREADSHEET_ID` | Deine Tabellen-ID aus Schritt 1 |
| `SETWERK_SHEETS_SECRET` | Ein zufällig erzeugter geheimer Schlüssel mit mindestens 32 Zeichen |

Erzeuge den Schlüssel beispielsweise mit deinem Passwortmanager: 64 zufällige Buchstaben und Ziffern. Alternativ kannst du auf deinem eigenen Rechner mit installiertem Node.js ausführen:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Bewahre den Schlüssel auf, du brauchst exakt denselben Wert in Netlify. Er gehört ausschließlich in Script-Eigenschaften und Netlify-Umgebungsvariablen, nicht ins Repository oder in den Browser-Code.

## 3. Script als Web-App bereitstellen

1. Wähle **Bereitstellen → Neue Bereitstellung**.
2. Wähle als Typ **Web-App**.
3. Setze **Ausführen als: Ich** (dein Google-Konto).
4. Setze **Wer hat Zugriff: Jeder** beziehungsweise **Anyone**, einschließlich anonymer Aufrufe. Falls ein verwaltetes Google-Workspace-Konto diese Option sperrt, muss diese Freigabe durch dessen Administration möglich sein; andernfalls funktioniert dieser Server-Zugriff nicht.
5. Stelle die Web-App bereit und genehmige dem von dir eingefügten Script den erforderlichen Tabellenzugriff.
6. Kopiere die Web-App-URL. Sie muss so aussehen: `https://script.google.com/macros/s/DEPLOYMENT_ID/exec`.

Der Web-App-Endpunkt ist öffentlich erreichbar, die Tabelle bleibt privat. Ohne eine gültige, vom Netlify-Server erstellte Signatur liest oder schreibt das Script keine Trainingsdaten. Ein Aufruf der `/exec`-URL im Browser zeigt nur `{"status":405}`; das ist bei diesem API-Endpunkt richtig. Verwende nicht die `/dev`-Test-URL.

Wenn du `Code.gs` später aktualisierst, aktualisiere unter **Bereitstellen → Bereitstellungen verwalten** die bestehende Bereitstellung auf eine neue Version.

## 4. Netlify konfigurieren und neu bereitstellen

In deinem bestehenden Netlify-Projekt:

1. Öffne die **Projektkonfiguration → Umgebungsvariablen**.
2. Erstelle `SETWERK_SHEETS_URL` mit der `/exec`-URL aus Schritt 3.
3. Erstelle `SETWERK_SHEETS_SECRET` mit exakt demselben Schlüssel aus Schritt 2; markiere ihn als geheim, falls diese Option angezeigt wird.
4. Die Variablen müssen für **Functions** und den **Production**-Deploy gelten. Wenn keine getrennten Bereiche angeboten werden, verwende den gemeinsamen Bereich.
5. Prüfe die Build-Einstellungen: Repository `markuskep/Setwerk`, Branch `main`, Basisverzeichnis leer beziehungsweise Repository-Wurzel. Die Datei `netlify.toml` enthält bereits:
   - Build-Befehl: `node --check netlify/functions/workout-store.mjs`
   - Publish-Verzeichnis: `Setwerk-Webapp-1.2.0-Projektdateien/dist`
   - Functions-Verzeichnis: `netlify/functions`
   - Node.js 22 und esbuild für die Function.
6. Löse einen neuen Deploy aus. Netlify installiert dabei die Abhängigkeiten aus dem neuen `package.json` in der Repository-Wurzel und veröffentlicht `workout-store` als Function.

Für diese Version nutze den GitHub-Deploy, nicht den Upload des bisherigen `dist`-ZIPs: In dem ZIP fehlen der Server und seine Abhängigkeiten.

Deine bestehende Netlify-Identity-Anmeldung bleibt für E-Mail und Passwort zuständig. Für einen kleinen Freundeskreis kannst du die Registrierung in Identity auf Einladungen beschränken und deine Freunde dort einladen. Falls Identity im verwendeten Netlify-Projekt nicht aktiv ist, muss es für die Anmeldung zuerst eingerichtet werden.

## 5. Bestehende lokale Daten übernehmen

1. Öffne die aktualisierte App auf dem Gerät, auf dem deine bisherigen Trainings liegen. Schließe bei Bedarf alle Setwerk-Tabs und öffne die App erneut, damit der aktualisierte Offline-Cache aktiv wird.
2. Melde dich mit deinem Account an.
3. Tippe auf **Konto** am Smartphone beziehungsweise deine E-Mail in der Seitenleiste.
4. Wähle **Lokale Trainings in dieses Konto übernehmen**.
5. Warte auf **Online gespeichert**.

Die Übernahme kopiert deine bisherigen Vorlagen, abgeschlossenen Trainings und eigenen Übungen in diesen Account. Die ursprünglichen Daten bleiben im lokalen Gast-Speicher erhalten. Wiederholtes Übernehmen erzeugt keine doppelten Einträge mit derselben ID. Falls derselbe Eintrag inzwischen unterschiedlich bearbeitet wurde, stoppt die Übernahme und zeigt eine Meldung.

Ein noch laufendes Gast-Training muss zuerst im Gast-Modus abgeschlossen werden. Du kannst dich dazu wieder abmelden. Übernimm nur deine eigenen Daten in deinen Account.

## 6. So funktioniert die Synchronisierung

- **Während des Workouts:** Übungen, Satzwerte, Pausen und Entwürfe bleiben im Browser auf diesem Gerät. Ein offenes Training lässt sich auf diesem Gerät fortsetzen, solange dessen lokaler Speicher erhalten bleibt. Es erscheint nicht auf einem anderen Gerät.
- **Nach dem Speichern des abgeschlossenen Trainings:** Die App speichert zuerst lokal und synchronisiert anschließend die fertigen Daten. Feedback und Notizen gehören zur fertigen Einheit.
- **Vorlagen und Einstellungen:** Gespeicherte Änderungen werden außerhalb eines laufenden Workouts übertragen. Während eines Workouts wartet auch deren Übertragung bis zum Abschluss.
- **Ohne Internet:** Fertige Trainings bleiben lokal als ausstehend markiert. Die App versucht die Übertragung beim nächsten Online-Ereignis, beim erneuten Öffnen beziehungsweise Aktivieren der App oder über **Jetzt synchronisieren**. Es gibt keine laufenden Abfragen im Hintergrund.
- **Auf einem anderen Gerät:** Melde dich mit demselben Account an. Neue Online-Daten werden beim Anmelden, beim Zurückkehren zur App und über **Jetzt synchronisieren** geladen, solange gerade kein Workout läuft.
- **Andere Accounts:** Sie verwenden getrennte lokale Speicher und getrennte Zeilen im Online-Speicher. Die Nutzer-ID wird im Netlify-Server aus Identity ermittelt. Der Browser kann keinen fremden Account auswählen.

Technisch wird jeweils ein kompaktes Datenpaket des Accounts synchronisiert, keine Anfrage je Satz. Ein bereits gestarteter Serveraufruf kann noch fertig werden, wenn du unmittelbar danach ein Workout startest; neue Uploads aus dem laufenden Workout werden nicht gestartet.

Der Online-Speicher enthält abgeschlossene Einheiten einschließlich Cardio-Daten, Feedback und Notizen, Vorlagen, eigene Übungen, Sprache und Trainingsziele. PRs und Fortschritte berechnet die App aus diesen Daten. Passwörter und Anmeldetokens werden nicht in Google Sheets gespeichert.

## 7. Konflikte und Datensicherung

Unabhängig auf zwei Geräten hinzugefügte Trainings werden zusammengeführt. Ändern beide Geräte denselben Eintrag unterschiedlich, stoppt der Upload: Es wird keine Version automatisch überschrieben. Öffne dann **Konto**:

- **Lokale Sicherung erstellen & Online-Version laden** lädt die Online-Version und sichert vorher die lokalen Daten als Datei sowie in einem getrennten lokalen Sicherungseintrag.
- **Online-Sicherung erstellen & lokale Änderungen übernehmen** sichert vorher die Online-Daten und behält bei den widersprüchlichen Einträgen deine lokalen Änderungen. Unabhängig hinzugefügte Einträge bleiben erhalten. Auch dieser Upload prüft erneut die Server-Version.

Mit **Datensicherung herunterladen** erhältst du jederzeit eine JSON-Datei. **Sicherung importieren** ergänzt daraus bisher fehlende eigene Übungen, Vorlagen und abgeschlossene Einheiten. Bereits vorhandene, identische Einträge werden ausgelassen. Ein veränderter Eintrag mit derselben ID wird nicht still überschrieben. Ein offenes Workout und Geräteeinstellungen werden aus einer Sicherung nicht importiert. Der bestehende Menüpunkt **Workout importieren** ist weiterhin für einzelne geteilte Vorlagen beziehungsweise Einheiten gedacht.

Lösche den Browser-Speicher erst, wenn ausstehende Daten synchronisiert oder separat gesichert sind. Lokale Sicherungen gehen beim Löschen des Browser-Speichers ebenfalls verloren.

## 8. Verbindung prüfen

1. Melde dich an und prüfe, ob **Konto → Online gespeichert** erscheint.
2. Zeichne eine kurze manuelle Einheit auf und warte auf diesen Status.
3. Öffne einen zweiten Browser oder ein anderes Gerät, melde dich mit demselben Account an und prüfe den Kalender.
4. Melde einen Freund mit einem anderen Account an: Er darf deine Einheiten nicht sehen.
5. Starte ein Workout, gehe offline und schließe es ab. Prüfe, dass es lokal vorhanden bleibt und erst nach Wiederherstellung der Verbindung online erscheint.

| Anzeige/Fehler | Was du prüfen solltest |
| --- | --- |
| Online-Speicher noch nicht eingerichtet | Beide Netlify-Variablen gesetzt, URL endet auf `/exec`, danach neu deployed? |
| Lokal gespeichert · Verbindung fehlt | Netzwerk, Function-Deploy, Script-Berechtigungen und identische geheime Schlüssel prüfen. |
| Bitte erneut anmelden | Identity-Sitzung erneuern; lokale Daten bleiben erhalten. |
| `404` bei `/.netlify/functions/workout-store` | GitHub-Deploy und Repository-Wurzel verwenden; `dist` allein enthält keine Function. |
| Änderungen auf zwei Geräten | Im Konto eine Version wählen; vorherige Version wird gesichert. |
| Online-Speichergrenze erreicht | Das Datenpaket ist größer als 1 MiB. Daten sichern; für größere Historien ist eine echte Datenbank sinnvoll. |
| Lokaler Speicher kann nicht gelesen oder geschrieben werden | Browser-Speicher prüfen und Daten sichern. Beschädigte gespeicherte Daten werden nicht automatisch überschrieben. |

Die Grenze beträgt 1 MiB je Upload, einschließlich etwas Anfrage-Metadaten. Google Apps Script und Netlify haben eigene Nutzungsgrenzen. Diese Lösung verwendet keine Netlify Database und verursacht daher keine aktiven Datenbankstunden. Website-Traffic, Deploys und Function-Ausführung können weiterhin Netlify-Credits verbrauchen. Das Gratis-Kontingent ist deshalb keine Garantie für unbegrenzte Nutzung.

## Entwicklung und Prüfung

Im Repository-Wurzelverzeichnis:

```bash
npm ci
npm test
```

Die automatisierten Tests prüfen lokale Account-Trennung, Upload erst nach Trainingsende, Offline-Speicherung, Zusammenführung, Konflikte, signierte Serveranfragen und die Speicherlogik des Apps Scripts mit simulierten Google-Diensten. Ein echter Google-/Netlify-Test ist erst nach Einrichtung deiner Konten möglich; dafür dient Schritt 8.

Offizielle Referenzen: [Google Apps Script Web-Apps](https://developers.google.com/apps-script/guides/web), [Script-Eigenschaften](https://developers.google.com/apps-script/guides/properties), [Netlify Identity in Functions](https://docs.netlify.com/manage/security/secure-access-to-sites/identity/use-identity-in-functions/), [Netlify Umgebungsvariablen](https://docs.netlify.com/build/environment-variables/overview/).
