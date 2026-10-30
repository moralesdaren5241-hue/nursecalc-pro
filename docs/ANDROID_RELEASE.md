# Android build and release

NurseCalc Pro's Android app is the web app (React, single-file Vite build) packaged with
**Capacitor 8**. The whole app is bundled inside the APK/AAB and runs offline; Capacitor
serves it locally to the system WebView.

| Setting | Value | Where |
|---|---|---|
| applicationId | `com.nursecalcpro.app` (permanent once uploaded to Play) | `android/app/build.gradle`, `capacitor.config.json` |
| App name | NurseCalc Pro | `android/app/src/main/res/values/strings.xml` |
| versionCode / versionName | 4 / 1.2.0 | `android/app/build.gradle` (versionName must match `package.json`; CI checks) |
| minSdk / targetSdk / compileSdk | 24 / 36 / 36 | `android/variables.gradle` |
| Toolchain | AGP 8.13.0, Gradle 8.14.3, JDK 21 | `android/build.gradle`, wrapper |
| Permissions | none | `AndroidManifest.xml` |
| Minimum System WebView | 87 (older devices see an "update WebView" page) | `capacitor.config.json` |

## 1. Build types

| Build type | Signed with | Use |
|---|---|---|
| `release` | your **private upload key** (from env vars or `android/keystore.properties`); **unsigned** if none is configured | Google Play upload (`app-release.aab`) |
| `sideload` | the **public** test key `android/app/nursecalc-test.keystore` | APKs for testers via GitHub Releases. Same code and settings as release, not debuggable |
| `debug` | public test key | Local development only |

The public test key is committed on purpose so sideloaded test builds upgrade each other. Its password is public, so it gives no protection and must never sign a Play upload. Play-installed and sideloaded builds have different signatures: testers must uninstall the sideload build before installing from Play.

## 2. Build in GitHub Actions (recommended)

Every push to `main` or `release/**`, every pull request, and a manual run (*Actions → Android build, verify & test → Run workflow*) does:

1. `npm ci`, `npm audit --audit-level=high`, typecheck, all tests, web build
2. `cap sync`, then Gradle `bundleRelease assembleRelease assembleSideload lintRelease`
3. `scripts/ci/verify-android.sh` — fails the build unless: targetSdk 36, minSdk 24, versionName matches, label correct, not debuggable, no INTERNET or dangerous permissions, backup disabled, web app bundled, WebView debugging and console logging off, no dev-server URLs, and correct signing (signed with the upload key when configured — and never with the test key — otherwise unsigned)
4. `scripts/ci/emulator-smoke.sh` on an API 36 emulator — install, launch, calculate, back button, background/resume, restart, rotation, dark mode, crash scan
5. Reports and screenshots are committed to the **`ci-reports`** branch under `reports/<branch>/`
6. On `main` only, the sideload APK is published as a GitHub Release for testers

Artifacts on each run (*Actions → run → Artifacts*, kept 90 days):
- `NurseCalcPro-play-bundle` → `app-release.aab` (upload this to Play once signed)
- `NurseCalcPro-release-apk` → release APK (signed or `-unsigned`)
- `NurseCalcPro-sideload-apk` → `app-sideload.apk` (install on a phone for testing)
- `android-report` → verification report, lint report, manifest dumps

## 3. Create the upload key (one time) 🔑

Do this on your own computer. **Never commit the `.jks` file or its passwords.** Keep two backups
(e.g. a password manager plus an offline copy). With Play App Signing, a lost upload key can be
reset by Play support, but it is slow — don't lose it.

```bash
# Requires a JDK (keytool). Choose strong passwords when prompted.
keytool -genkeypair -v \
  -keystore nursecalc-upload.jks \
  -alias upload \
  -keyalg RSA -keysize 4096 -validity 10000 \
  -dname "CN=NurseCalc Pro, O=<your name or business>, C=<2-letter country code>"
```

### Option A — let GitHub Actions sign (recommended)

Add four repository secrets (*GitHub → Settings → Secrets and variables → Actions → New repository secret*):

| Secret | Value |
|---|---|
| `ANDROID_UPLOAD_KEYSTORE_BASE64` | the keystore file, base64-encoded (commands below) |
| `ANDROID_UPLOAD_STORE_PASSWORD` | keystore password |
| `ANDROID_UPLOAD_KEY_ALIAS` | `upload` |
| `ANDROID_UPLOAD_KEY_PASSWORD` | key password (same as store password if you pressed Enter) |

```bash
base64 -w0 nursecalc-upload.jks          # Linux
base64 -i nursecalc-upload.jks           # macOS
# Windows PowerShell:
[Convert]::ToBase64String([IO.File]::ReadAllBytes("nursecalc-upload.jks"))
```

Then run the workflow again. The verification report should show
`PASS  AAB is signed (jar verified)` and `PASS  release APK NOT signed with the public test key`.
The keystore is written to the runner's temp folder only for the build and deleted afterwards.

### Option B — sign locally

Create `android/keystore.properties` (git-ignored):

```properties
storeFile=/absolute/path/to/nursecalc-upload.jks
storePassword=...
keyAlias=upload
keyPassword=...
```

## 4. Build locally

Prerequisites: Node 22+, **JDK 21**, Android Studio Otter (2025.2.1) or newer with Android SDK Platform 36.

```bash
npm ci
npm test                    # all tests must pass
npm run android:sync        # web build + copy into android/
cd android
./gradlew bundleRelease     # → app/build/outputs/bundle/release/app-release.aab
./gradlew assembleSideload  # → app/build/outputs/apk/sideload/app-sideload.apk (test APK)
./gradlew assembleDebug     # → debug APK
# or: npm run android:open  (Android Studio)
```

Install a test build on a phone with USB debugging: `adb install -r app/build/outputs/apk/sideload/app-sideload.apk`.

## 5. Releasing a new version

1. Bump `version` in `package.json`, `VERSION` in `src/ui/screens/Main.tsx`, the cache name in `public/sw.js`, and `versionName` **and** `versionCode` (+1) in `android/app/build.gradle`.
2. Update `store/listing.md` release notes.
3. Push; check the workflow is green and read `reports/main/android-verify.txt` and `emulator.txt` on the `ci-reports` branch.
4. Download `NurseCalcPro-play-bundle` and upload it in Play Console to the testing track, then promote.

## 6. Upgrading Capacitor / Android SDK

Follow the official Capacitor upgrade guide, then run `npx cap sync android`. Google raises the required target SDK each year (usually by 31 August); update `targetSdkVersion`/`compileSdkVersion` in `android/variables.gradle` and the check in `scripts/ci/verify-android.sh`.
