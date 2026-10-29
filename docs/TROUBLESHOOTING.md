# Troubleshooting

## Build and test

| Problem | Fix |
|---|---|
| `npm ci` fails with an engine or lockfile error | Use Node 22+. Don't edit `package-lock.json` by hand; run `npm install` then commit the lockfile |
| UI test times out | `ui.test.tsx` opens every calculator; it is slow by design (timeout 120 s). Close other heavy processes |
| `tsc` errors after editing the registry | Field keys used in `run:` must exist in `fields:`; `noUncheckedIndexedAccess` is on |

## Android

| Problem | Fix |
|---|---|
| Gradle: "Unsupported class file major version" / AGP needs JDK 21 | Install JDK 21 and point Android Studio (*Settings → Build Tools → Gradle → Gradle JDK*) at it |
| "SDK location not found" | Install Android SDK Platform 36 in Android Studio's SDK Manager, or create `android/local.properties` with `sdk.dir=/path/to/Android/sdk` |
| Changes to the web app don't appear in the APK | Run `npm run android:sync` (build + `cap sync`) before Gradle |
| App shows "Update Android System WebView" | The device's WebView is older than 87. Update *Android System WebView* (or Chrome) from Play |
| Install fails: "signatures do not match" | A build signed with a different key is installed (sideload vs Play). Uninstall the old one first |
| CI warning "No upload keystore secret — the AAB will be UNSIGNED" | Add the four `ANDROID_UPLOAD_*` secrets (docs/ANDROID_RELEASE.md §3) and re-run |
| Play Console rejects the AAB as unsigned or signed with a debug key | Only upload the bundle from a run whose report says "AAB is signed" and "NOT signed with the public test key" |
| Play Console: "Version code 4 has already been used" | Increase `versionCode` in `android/app/build.gradle` for every upload |
| Verification fails "versionName matches package.json" | Keep `package.json` `version` and `versionName` identical |

## CI

| Problem | Fix |
|---|---|
| Emulator job fails intermittently at boot | Re-run the job; emulator boot on hosted runners is occasionally slow. Read `emulator.txt` on the `ci-reports` branch first |
| Web workflow fails at *configure-pages* ("Resource not accessible by integration") | Enable Pages: *Settings → Pages → Source: GitHub Actions* |
| Can't find the AAB | *Actions → the run → Artifacts → NurseCalcPro-play-bundle* (kept 90 days) |

## Web app

| Problem | Fix |
|---|---|
| Old version keeps loading after deploy | Bump the cache name in `public/sw.js`; users get it on the next visit (reload twice, or close and reopen the installed app) |
| Blank page in an in-app browser or very old phone | The build targets Chrome 87 / Safari 14; older browsers are not supported |
