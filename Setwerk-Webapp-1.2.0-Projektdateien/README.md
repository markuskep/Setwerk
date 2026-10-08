# Setwerk – aktuelle Webapp

Dieser Ordner enthält die aktuelle Webapp mit Firebase-Anmeldung und geräteübergreifender Speicherung. Der historische Ordnername `Setwerk-Webapp-1.2.0-Projektdateien` bleibt erhalten, weil Hosting, Tests und die Android-Synchronisierung darauf verweisen.

## Aufbau

- `dist`: direkt bereitstellbarer HTML-, CSS- und JavaScript-Quellcode.
- `tests`: Trainings-, Konto-, Synchronisierungs- und Import-/Exportprüfungen.
- `scripts`: Erzeugung der deutschen und englischen Übungskataloge.

Es gibt keinen zusätzlichen Bundler. Die Hostingkonfiguration steht in `../firebase.json`. Die App lädt die öffentliche Firebase-Konfiguration von `/__/firebase/init.json`; für die vollständige Konto- und Cloudfunktion wird sie über das zugehörige Firebase-Hostingprojekt bereitgestellt.

## Anmeldung und Speicherung

Firebase Authentication verwaltet die Anmeldung, Cloud Firestore den privaten Datenbestand jedes Kontos. Abgeschlossene Einheiten, Vorlagen, eigene Übungen, Einstellungen, Profil und Feedback synchronisieren. Laufende Trainings und Entwürfe bleiben lokal. Auch Gastnutzung und Datei-/Code-Austausch sind möglich.

Bei einem Domainwechsel bleiben lokale Browserdaten an den bisherigen Ursprung gebunden. Vorhandene Gastdaten deshalb vor dem Wechsel sichern. Cloud-Daten gehören zum Firebase-Konto und können nach der Anmeldung auf einem anderen Gerät geladen werden.

Weitere Einrichtung und Grenzen sind in [FIREBASE-SETUP.md](../FIREBASE-SETUP.md) beschrieben. Den aktuellen Android-Quellcode findest du unter [android/](../android/README.md).

## Entwicklung und Prüfung

Im Repository-Hauptverzeichnis:

```sh
npm ci
npm test
```

Für Syntax- und Katalogprüfungen können zusätzlich die Skripte in diesem Ordner verwendet werden. Anwendungsdateien liegen direkt in `dist`; bei Änderungen muss die Cache-Version in `dist/sw.js` entsprechend aktualisiert werden.

Systembenachrichtigungen bei geschlossener App sind in der Web-Version nicht implementiert. Native Android-Benachrichtigungen werden in der Android-App unterstützt und müssen auf einem echten Gerät geprüft werden.
