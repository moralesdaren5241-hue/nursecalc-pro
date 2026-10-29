# Testing report — NurseCalc Pro 1.2.0

Date: 30 October 2026 · Commit tested in CI: see `reports/release-play-1.2.0/RUN.txt` on the `ci-reports` branch.

Only results that were actually produced are listed. Anything not run is in §5.

## 1. Automated tests (local and CI)

| Command | Result |
|---|---|
| `npm ci` | OK |
| `npm audit` | **0 vulnerabilities** (CI fails on high/critical) |
| `npm run typecheck` (`tsc --noEmit`, strict) | 0 errors |
| `npm test` (Vitest 4) | **336 passed, 0 failed** in 5 files |
| `npm run build` | `dist/index.html` 468 kB (185 kB gzip), single file, no external requests |

| Test file | Tests | What it covers |
|---|---|---|
| `calculations.test.ts` | 72 | Table-driven engine cases, invalid inputs, unit mismatches, rounding, midnight crossing |
| `verification.test.ts` | 139 | Hand-derived expected values, score band boundaries, strict number parsing, fuzzing with NaN/±∞/0/1e-9/1e308 |
| `release-safety.test.ts` | 84 | Unit handling through the registry, worked examples, high-risk guards, input sweep of every number field, labelling, reference integrity |
| `questions.test.ts` | 16 | Every learning-question template, answer keys cross-checked against the engine |
| `ui.test.tsx` | 25 | App render, every calculator opened and its example run, search, validation, high-alert gate, settings |

## 2. Android build verification (GitHub Actions, `scripts/ci/verify-android.sh`)

Run [40963732883](https://github.com/moralesdaren5241-hue/nursecalc-pro/actions/runs/40963732883) — **0 failed checks**:

- `app-release.aab` (3.26 MB), `app-release-unsigned.apk`, `app-sideload.apk` produced by Gradle
- applicationId `com.nursecalcpro.app`, versionName 1.2.0, versionCode 4, targetSdk 36, minSdk 24, label "NurseCalc Pro"
- not debuggable; **no INTERNET and no dangerous permissions**; `allowBackup=false`
- web app and WebView-update fallback page bundled; WebView debugging and bridge logging off; no localhost/dev URLs; no remote scripts or fonts
- AAB manifest (bundletool 1.18.3): targetSdk 36, versionName 1.2.0
- sideload APK signature verifies; AAB **unsigned** because no upload key is configured yet (never signed with the public test key)
- Android lint (release): 0 errors, 18 warnings (splash/icon density and themed-icon suggestions — cosmetic)

## 3. Emulator smoke test (release-configured sideload APK, `scripts/ci/emulator-smoke.sh`)

Device: Google API 36 emulator (Android 16), WebView 133. **25 / 25 checks passed:**
install; no permissions granted; cold launch; home, tab bar and disclaimer visible; open Drug dose,
run example → 2.5 mL; back from calculator → Home; back from Settings root → Home (app stays open);
back at Home root exits; relaunch; background → resume with content intact; force-stop → restart;
landscape; system dark mode; no crashes/ANRs in logcat; no web console output in release.
Screenshots: `reports/release-play-1.2.0/screenshots/` on `ci-reports`.

Fix made during this pass: the "app in foreground" check read `dumpsys window windows`, which
no longer prints the focused window on Android 14+, so positive checks always failed and negated
checks passed vacuously. It now reads the resumed activity and returns "unknown" instead of guessing.

## 4. Earlier browser QA (v1.1.0, headless Chromium)

Offline reload via the service worker; every directory entry opened and its example calculated at
320 px (light) and 360 px (dark) with no horizontal overflow or console errors; axe-core WCAG 2.1 AA
scans of 9 screens, 0 violations. Not re-run for 1.2.0 (UI unchanged apart from labels).

## 5. Not tested

| Not tested | Why |
|---|---|
| Physical Android phones and tablets | No device available to this environment; emulator only |
| Signed release AAB installed from Play | No upload key or Play account yet |
| TalkBack screen-reader walkthrough | Needs a device and a manual tester |
| Keyboard overlap on small physical phones | `windowSoftInputMode=adjustResize` is set; not verified on hardware |
| Deployed web app | GitHub Pages not enabled yet |
| Clinical appropriateness of content | Requires a qualified clinical reviewer |
