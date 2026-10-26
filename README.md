# NurseCalc Pro

Offline-capable nursing calculation, scoring and learning app. Every result shows its formula, substitution, steps, rounding rule, safety notes and reference status.

> **Educational and calculation aid.** Results are arithmetic, not clinical approval. All clinical references are marked *awaiting clinical review* until a qualified reviewer signs them off (see "Clinical content status").

---

## 1. Stack and why

| Layer | Choice |
|---|---|
| UI | React 18 + TypeScript (strict, `noUncheckedIndexedAccess`) |
| Build | Vite 5 + `vite-plugin-singlefile` → one self-contained `index.html` |
| Delivery | Installable PWA (manifest + cache-first service worker) |
| Tests | Vitest (unit, table-driven) + Testing Library on jsdom (integration/UI) |
| Storage | `localStorage` for preferences, favorites, recents and study progress only |

The brief prefers React Native + Expo. This build environment cannot run an Android/iOS simulator, so an Expo build could not be verified. A PWA was chosen instead because it can be built and tested here, installs to the home screen on Android and iOS, and runs fully offline. The calculation engine (`src/calculations`), clinical references and learning content contain **no UI code**, so they can be reused unchanged in an Expo app later.

No backend, accounts, analytics or network calls. Fonts (Atkinson Hyperlegible, IBM Plex Mono — SIL OFL, licences in `src/assets/fonts/`) are embedded in the build, so the app makes **no** external requests.

## 2. Run, test, build

```bash
npm install
npm run dev        # local dev server
npm test           # 107 automated tests
npm run typecheck  # strict TypeScript
npm run build      # dist/index.html (single file) + manifest, icon, service worker
node scripts/artifact.mjs   # body-only copy for claude.ai artifact hosting
```

No environment variables are required.

### Android package (Capacitor 6 — project already generated in `android/`)

Requirements on your computer: Node 18+, JDK 17, Android Studio (Android SDK 34).

```bash
npm install
npm run android:sync      # build web app and copy it into android/
npm run android:apk       # debug APK → android/app/build/outputs/apk/debug/app-debug.apk
npm run android:open      # or open in Android Studio and use Build ▸ Build APK(s)
npm run android:release   # release bundle (.aab) for Play — configure signing first
```

Before a Play Store release: change `appId` in `capacitor.config.json` (currently `com.nursecalcpro.app`), set up a signing key, and check Google Play's current target-API requirement (the generated project targets API 34; recent Play policy requires a newer target, which may mean upgrading to Capacitor 7).

**Build status:** the Android project was generated, but `./gradlew assembleDebug` could not run in the build environment because downloading Gradle, the Android SDK and Google Maven was blocked. **No APK has been compiled or installed on a device.**

### Other ways to install

- **Install as an app (works today):** host `dist/` on any HTTPS static host (Netlify, GitHub Pages, Render static site, Cloudflare Pages). Open it on the phone → Chrome menu *Install app* (Android) or Safari *Share → Add to Home Screen* (iOS). The service worker caches it for offline use.
- **iOS:** `npm i @capacitor/ios@6 && npx cap add ios && npx cap open ios`, then build in Xcode on a Mac. Not attempted.

## 3. Architecture

```
src/
  calculations/   pure engine — no UI, no storage
    core.ts         result types, validation layer (Check), rounding, formatting
    units.ts        unit-aware conversions; cross-dimension conversion throws
    medication.ts   dose, weight-based, range check, C1V1, reconstitution, insulin, heparin, supply, %/ratio
    iv.ts           pump rate, drip rate, duration, completion time, volume infused, dose↔rate
    body.ts         BMI, BSA, IBW/AdjBW, weight change, WHtR
    scores.ts       GCS, APGAR, qSOFA, Bishop, Glasgow-Blatchford
    fluids.ts       I&O summary, balance, urine output
    clinical.ts     vitals, pediatrics, oxygen, nutrition, renal, lab, transfusion, obstetric, wound
  features/        calculator registry (form wiring, units offered, search tags) — no formulas
  references/      clinical reference manifest + glossary (reviewable independently of code)
  learning/        seeded question generators, mock exam, daily question
  storage/         local persistence (preferences/progress only)
  ui/              app shell, navigation, screens, components, icons
  tests/           calculations, questions, UI integration
```

Formulas live only in `src/calculations`. Screens never compute; they call the engine through the registry.

## 4. Navigation

Bottom bar: **Home · Calculators · Learn · Favorites · Settings**. Each tab keeps its own stack; re-tapping a tab returns to its root. Global search is on Home and Calculators (name, abbreviation, tags, terminology — e.g. "gtt/min", "drops per minute" and "IV drip" all find the drip-rate calculator).

## 5. Design system

Clinical navy primary, teal accent, cool-grey neutrals; amber for "check", red reserved for critical and high-alert. Full dark palette, theme toggle (system/light/dark), text scaling 90–140 %, reduced-motion option, 44–52 px touch targets, labelled inputs with explicit units, warnings that always carry text and an icon (never colour alone). Fonts: Atkinson Hyperlegible (designed for low-vision legibility) and IBM Plex Mono for formulas and working.

## 6. Calculation functions and units

| Area | Functions (output unit) |
|---|---|
| Medication | `basicDose` (tablet/capsule/mL), `weightBasedDose` (per dose; per-day orders need explicit doses/day), `bsaDose` (mg), `doseRangeCheck` (compares with user-entered range; "Reference range not provided" otherwise), `dilution` (C1V1=C2V2), `reconstitution` (mg/mL, mL), `insulinVolume` (mL), `heparinInfusion` (mL/hr, units/hr), `supplyQuantity`, `percentToMgPerMl`, `ratioToMgPerMl` |
| IV | `pumpRate` (mL/hr, pump precision), `dripRate` (gtt/min exact + whole drops), `infusionDuration` (hr), `completionTime` (clock, crosses midnight), `volumeInfused` (mL + remaining), `doseFromRate` (mg/hr, mcg/min, mcg/kg/min, mg/kg/hr), `rateFromDose` (mL/hr) |
| Body | `bmi` (kg/m²; WHO adult categories only when adult), `bsaMosteller` (m²), `idealBodyWeight` Devine + AdjBW (kg), `weightChange` (%), `waistToHeight` |
| Scores | `gcs` (E/V/M, NT never totalled), `apgar`, `qsofa`, `bishop`, `glasgowBlatchford` |
| Fluids | `fluidSummary` (measured vs estimated output, running balance), `fluidBalance` (mL), `urineOutput` (mL/kg/hr) |
| Vitals | `meanArterialPressure` (estimate), `pulsePressure`, `shockIndex`, `pulseDeficit`, `rateFromCount`, `temperature` |
| Pediatrics | `hollidaySegar` (mL/hr, labelled as estimate) |
| Oxygen | `cylinderDuration` (psi × cylinder factor), `cylinderDurationLitres` (bar × water capacity) |
| Nutrition | `macroCalories`, `enteralRate`, `percentOfTarget`, `proteinPerKg` |
| Renal / lab | `cockcroftGault` (mL/min, µmol/L conversion), `glucoseConvert`, `creatinineConvert`, `doseToVolume` |
| Blood | `bloodLossPercent` (% EBV), `transfusionRate` (mL/hr, gtt/min) |
| Obstetric | `naegele` (EDD, GA), `newbornWeightLoss`, `contractions` |
| Wound | `woundMeasure` (cm², cm³, % change) |
| Conversions | `convert` across mass, volume, length, time, temperature, glucose, creatinine, pressure, concentration |

## 7. Safety layer

- Rejects empty, NaN, infinite, negative (where invalid) and zero-denominator inputs, with messages that say how to fix them. Invalid values are never replaced with zero.
- Units are converted before calculating; mass↔volume, mg↔units, mL/hr↔L/min etc. cannot convert.
- Plausibility warnings (e.g. weight, rate, BSA) flag likely typing or unit errors without blocking.
- High-alert tools (insulin, heparin, titration infusions, electrolyte dose-to-volume) require a confirmation tick, show concentration explicitly and remind about independent double-checks. No correction, sliding-scale, bolus or replacement doses are ever generated.
- Results never say "safe", "correct" or "approved".
- Fluid log and calculator inputs are never stored.

## 8. Tests (last run: **252 passed, 0 failed** — v1.1.0 audit)

- `calculations.test.ts` — 72 table-driven tests, including every case required by the brief (2 tablets, 2.5 mL, 2 mL, 125 mL/hr, 31.25 gtt/min, 6 h, BMI 23.4375, GCS 13/15 and NT handling, +500 mL, MAP 93.33, 4-2-1 = 65 mL/hr, 0.5 mL/kg/hr, oxygen factors/reserve/flow) plus zero denominators, negatives, missing fields, unit mismatches, float precision, rounding, midnight crossing, huge values and invalid reference ranges.
- `questions.test.ts` — every question template generated 300 times; each answer key is computed independently and cross-checked against the engine.
- `verification.test.ts` — 139 tests: 39 values derived by hand/in a separate Python session (not copied from the engine), display-rounding checks, Glasgow-Blatchford band boundaries, strict number parsing, and a fuzz test feeding every engine function NaN/±Infinity/negative/zero/1e-9/1e308 combinations (must never throw or return a non-finite result).
- `ui.test.tsx` — renders the app, search, form validation, GCS cards, high-alert gate, fluid log, converter, favorites persistence, quiz progress, dark theme, and opens **every** form calculator and runs its example.

**Real-browser QA (headless Chromium 131, v1.1.0):** offline reload and cold open via the service worker (app loads, drip-rate example returns 31, embedded font loads); all 63 directory entries opened and their examples calculated at 320 px light and 360 px dark with no horizontal overflow and no console errors; axe-core WCAG 2.1 AA + best-practice scans of 9 screens in both themes — 0 violations; system back button closes the current screen. Script: not shipped (lives in the build sandbox).

Not tested: physical Android/iOS devices, TalkBack/VoiceOver walkthroughs, installed-PWA behaviour on a phone.

## 9. Completed and deferred

**Completed:** all categories A–P with 60+ tools (v1.1 added sequential infusion plan and oxygen-needed-for-transfer); home dashboard (greeting, search, customizable/reorderable quick tiles, recents, favorites, daily question, progress, recently viewed references, categories, disclaimer); learning centre (13 topics, 3 levels, worked explanations, missed-question review, 20-question mock exam, streaks that can be turned off, formula library with bookmarks, glossary); settings (theme, text size, motion, default weight unit, pump precision, progress reset, delete all local data, privacy, about).

**Deferred / limited:**
- NIH Stroke Scale — information only (needs certified-training scoring rules).
- Defibrillation energies — not provided (device- and protocol-specific).
- Age-specific vital-sign tables and growth-chart interpretation — not provided; no single table is presented as authoritative.
- Persistent BMI / wound / trend histories — not stored (privacy-first default).
- Medication-specific renal dosing links and maximum-dose database — none (requires verified drug references).
- Filipino localization — strings are not yet extracted into a translation file.
- Wound / BMI / vital-sign trend history and growth charts — not implemented.
- Native store builds (APK/IPA) — not built.

## 10. Clinical content status

Every entry in `src/references/manifest.ts` carries source, population, version, reviewer and review date fields. All are currently `awaiting-review` with no reviewer. The citations are the standard literature sources for each formula, but they were **not** re-checked against primary documents during this build. Items that especially need reviewer attention: oxygen cylinder factors, blood-volume estimates, Glasgow-Blatchford thresholds, Bishop criteria version, GCS wording, and the CPR reference text. To sign off an entry, set `status: 'reviewed'`, `reviewer` and `lastReview`.

## 11. Audit log — v1.1.0 (2026-10-25)

Defects found and fixed:
1. **Comma decimals misread (critical):** "2,5" was parsed as 25 and "0,25" as 25. Inputs are now parsed strictly; comma decimals are refused with "Use a decimal point, not a comma". Thousands separators ("1,000") still work.
2. **Overflow results:** extreme inputs could return Infinity as a result. A central guard now rejects non-finite results with a fix-it message.
3. **Glasgow-Blatchford:** urea exactly 25 mmol/L scored 6; published table puts 25 in the 4-point band. Fixed.
4. **Field errors did not block results:** a result could show next to "Enter weight". Any missing/unreadable visible input now blocks calculation.
5. **Irrelevant fields:** heparin, titration and custom-cylinder fields showed in every mode; they are now conditional, and hidden values are stripped before calculation.
6. **Duplicated formulas:** transfusion gravity rate re-implemented the drip formula; dose-to-volume, insulin and reconstitution each re-implemented D ÷ H × Q. All now call the shared engine functions.
7. **Learning:** reopening the daily question counted it twice; missed-question review could regenerate a different question when a level filter was used; level fallback was silent. Fixed.
8. **Android back button** closed the app instead of the current screen. Screens now use browser history.
9. **Offline fonts:** fonts loaded from Google; now embedded. Service worker registration was limited to `https:`; now uses `isSecureContext` and is skipped inside the native shell.
10. Review-status chips were hard-coded; they are now derived from the manifest, info screens carry an "awaiting clinical review" banner, and secondary-source cross-checks are shown separately from clinical review.
