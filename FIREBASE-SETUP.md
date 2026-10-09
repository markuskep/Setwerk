# Setwerk: Firebase login and cloud data

Website: https://setwerk-cb1e0.web.app
Branch: firebase-migration

## Services

- Authentication: email/password registration and sign-in; password reset.
- Firestore: default database in production mode. For a new database use Frankfurt (europe-west3).
- Firestore Rules: publish the exact contents of firestore.rules. Do not enable public test-mode rules.
- Public Firebase configuration is loaded from /__/firebase/init.json. Register a Web app in Project settings if this endpoint does not provide the project configuration.

The GitHub deploy checks tests and attempts to configure these services using the existing deployment service account. Its job summary reports any project-owner steps still required. If the deployment account lacks database or rules permissions, create the database and publish the rules in the Firebase console using your owner account. No private keys need to be pasted into chat or into website files.

## Data and offline behavior

Each Firebase UID owns users/{uid}/state/main. It stores a JSON payload, an increasing revision, and a server timestamp. Firebase Security Rules permit only the owner to get/create/update it, require the next revision and deny listing, deletion and access to other paths.

Completed workouts, templates, custom exercises, goals and language synchronize. Active workouts and drafts stay local. Firestore reads require the server; the application retains its own per-account offline cache and pending uploads. Transaction revision checks and three-way merging prevent silent overwrites from two devices. Conflicts retain recoverable backups.

The JSON payload is limited to 800,000 UTF-8 bytes to stay below Firestore's document limit. Larger data remains local and can be exported using the account backup action. A later migration to one document per workout can remove this snapshot limit.

## Existing data and accounts

Accounts and cloud data from the former backend are not automatically migrated. Firebase accounts must be created separately. Local guest workouts can be imported explicitly through Account > Import guest workouts. Account backup files can also be imported. Never import another person's account data. Android 1.4.0 uses the same Firebase project and snapshot format as the webapp. Its account backup panel also offers explicit recovery of local records from older Android accounts.

Firebase local account keys use setwerk.firebase.account.v1.{uid}; guest storage remains setwerk.v1. Existing legacy account caches are preserved for data recovery.

## Verification

Application tests run with npm test. Emulator tests verify registration/sign-in, cross-device workout retrieval, owner access, rejection of anonymous/other-account access, stale revisions and malformed updates.

Run emulator tests:
npm install --prefix .firebase-test --no-package-lock --ignore-scripts firebase@12.4.0 @firebase/rules-unit-testing@5.0.0 firebase-tools@14.20.0
NODE_PATH=.firebase-test/node_modules .firebase-test/node_modules/.bin/firebase emulators:exec --only firestore,auth --project demo-setwerk "node --test --test-concurrency=1 firebase/tests/*.test.cjs"

For future manual deployment of rules and indexes as the project owner:
firebase deploy --only firestore --project setwerk-cb1e0
## Account settings

The top-right DE/EN switch replaces the sidebar language selector. Account opens an anchored menu with Account details, Sign out and Delete account. Profiles use the optional `profile` field in the existing private snapshot (`name`, a cropped 192-pixel JPEG as a data URL capped at 100,000 characters). Older snapshots without a profile remain valid. The display name is also updated in Firebase Authentication; passwords are never saved in the application snapshot or local storage.

Password changes and account deletion reauthenticate with the current password. Deletion waits for local synchronization requests to finish, replaces the cloud payload with a data-free `{"deleted":true}` marker using the existing private rules, deletes the Firebase Authentication user, and removes this account's cache and conflict backups on the current device. The technical Firestore document retains only its UID path, revision, timestamp and deletion marker; it contains no workouts, name, email or picture. Other clients recognize the marker and do not restore cached workouts. If Authentication deletion fails, the previous payload is restored when possible and the local cache is retained. Guest workouts and other accounts remain untouched. Downloaded backups and offline copies on other devices cannot be erased remotely.

CI also exercises the desktop/mobile account menu, real image resizing, profile updates, language switching, password form validation and deletion confirmation in Chromium with a local Firebase transport fixture. Firebase emulator tests separately exercise the real Authentication SDK and Firestore rules for profile retrieval, password changes and deletion.


## Account colors

The signed-in profile menu includes Colors: Default, Cherry, Orange and Black & White. Appearance is stored separately at `users/{uid}/preferences/appearance` with `theme` and a server timestamp. Rules permit only the owner to read or write one of the four supported values. Workout snapshots keep their existing format, so Android 1.4.0 remains compatible. The webapp caches appearance per account, applies choices immediately, and retries pending selections after reconnection. Guests use Default.
