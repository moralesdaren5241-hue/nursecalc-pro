# Privacy and security audit — v1.2.0 (29 Oct 2026)

Scope: the web app (`src/`), the Android project (`android/`), dependencies, build/CI pipeline.
Method: source review (all storage and network APIs), dependency audit, manifest and bundle
inspection of the built APK/AAB in CI, emulator checks.

## Findings and actions

| # | Area | Finding | Action | Status |
|---|---|---|---|---|
| 1 | Signing | Release builds were signed with the **public** test keystore committed to the repo (password in `build.gradle`). Anyone could sign a lookalike update for sideloaded installs, and it cannot be used for Play | Release signing now reads a private upload key from CI secrets or a git-ignored `keystore.properties`; unsigned otherwise. The test key is limited to `debug` and a separate non-debuggable `sideload` build. CI fails if a release-signed build carries the test key's fingerprint | Fixed |
| 2 | Permissions | Manifest requested `INTERNET`, which the offline app does not need | Removed (explicit `tools:node="remove"`). CI and emulator verify the installed app holds no permissions | Fixed |
| 3 | Backup | `allowBackup=true` let Android copy WebView storage to the user's Google account / new device, contradicting "stored on this device only" | `allowBackup=false`, `fullBackupContent=false`, `dataExtractionRules` excluding everything | Fixed |
| 4 | Attack surface | Unused `FileProvider` with `grantUriPermissions` | Removed with its paths file | Fixed |
| 5 | Debugging | WebView remote debugging and bridge console logging | `webContentsDebuggingEnabled=false`, `loggingBehavior: "none"`; release not debuggable — all verified in CI | Verified |
| 6 | Dependencies | `npm audit`: 1 critical (tar), 1 critical (tinypool), 1 high (sharp/libvips), moderates (esbuild dev server) — all in **dev tooling**; shipped code had 0 | Removed unused `@capacitor/assets` (sharp), Vite 5→7, Vitest 1→4, updated tar. `npm audit` now **0 vulnerabilities**; CI fails on high/critical | Fixed |
| 7 | Network | Source review: no `fetch`, XHR, WebSocket, beacon, dynamic import, remote script/font, analytics or ads. Only URL in the app is the privacy-policy link (opens the browser) | None needed; CI checks the bundle has no remote `<script>/<link>` and no dev-server URLs | Verified |
| 8 | Storage | One module (`src/storage/store.ts`) writes `localStorage` under `nursecalc.v1.*`: settings, optional greeting name, favorites, quick access, recents, bookmarks, recently viewed references, study progress. Calculator inputs, results, fluid logs and infusion plans are never persisted | Disclosed in-app (Settings and About) and in `PRIVACY.md`; "Delete all local data" clears it | Verified |
| 9 | Patient data | No patient identifier fields; greeting-name help text says never to enter patient details | Policy repeats the warning | OK |
| 10 | Mixed content / cleartext | `allowMixedContent=false`; no HTTP endpoints; app has no network permission | — | OK |
| 11 | Secrets | No API keys or secrets in the client. `.gitignore` now blocks `keystore.properties`, `*.jks`, `*.keystore` (except the public test key), `.env*` | CI restores the upload key only into the runner temp dir and deletes it afterwards | Fixed |
| 12 | Old WebViews | Vite 7 would have raised the JS baseline to Chrome 107; devices with older WebViews would show a blank screen | Build target pinned to Chrome 87 / Safari 14; Capacitor shows an "update Android System WebView" page below WebView 87 | Fixed |
| 13 | Web hosting | GitHub Pages cannot set security headers | `public/_headers` provides a CSP and hardening headers for hosts that support it (Netlify, Cloudflare Pages) | Added |

## Data inventory (for Play Data safety)

| Data | Collected (leaves device)? | Stored on device? | Shared? |
|---|---|---|---|
| Calculator inputs/results | No | No (memory only) | No |
| Settings, favorites, recents, bookmarks | No | Yes, app-private | No |
| Optional greeting name | No | Yes, app-private | No |
| Study progress | No | Yes, app-private | No |
| Device identifiers, location, contacts, files, health records | Not accessed | — | — |

Data safety answer: **no data collected, no data shared**.

## Residual items

- The public test keystore remains in the repository so existing testers can keep upgrading sideloaded builds. If you no longer need that, delete `android/app/nursecalc-test.keystore`, switch the `sideload`/`debug` build types to a private key, and ask testers to reinstall.
- `localStorage` on the device is not encrypted beyond Android's app sandbox and device encryption. It holds no health or patient data, so this is proportionate.
- No independent penetration test was performed.
