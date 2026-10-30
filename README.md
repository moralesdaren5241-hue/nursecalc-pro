# NurseCalc Pro

Offline-capable nursing calculation, scoring and learning app. Every result shows its formula, substitution, steps, rounding rule, safety notes and reference status.

> **Educational and calculation aid.** Results are arithmetic, not clinical approval. All clinical references are marked *awaiting clinical review* until a qualified reviewer signs them off (see "Clinical content status").

---

## 1. Stack

| Layer | Choice |
|---|---|
| UI | React 18 + TypeScript (strict, `noUncheckedIndexedAccess`) |
| Build | Vite 7 + `vite-plugin-singlefile` → one self-contained `index.html` (JS target Chrome 87 / Safari 14) |
| Web delivery | Installable PWA (manifest + cache-first service worker), static hosting |
| Android | Capacitor 8 (`com.nursecalcpro.app`), minSdk 24, target/compile SDK 36, AGP 8.13, Gradle 8.14, JDK 21 |
| Tests | Vitest 4 (unit, table-driven, hand-derived verification, fuzz) + Testing Library on jsdom (UI) |
| Storage | `localStorage` for preferences, favorites, recents and study progress only |

No backend, accounts, analytics, ads, crash reporting or network calls. The Android app requests
**no permissions** (not even INTERNET). Fonts (Atkinson Hyperlegible, IBM Plex Mono — SIL OFL,
licences in `src/assets/fonts/`) are embedded, so the app makes no external requests.

## 2. Run, test, build

Requires Node 22+.

```bash
npm ci
npm run dev        # local dev server
npm test           # 336 automated tests
npm run typecheck  # strict TypeScript
npm run build      # dist/index.html (single file) + manifest, icons, service worker, _headers
npm audit          # dependency audit (CI fails on high/critical)
```

No environment variables are required (see `.env.example`).

### Android

Full guide: **[docs/ANDROID_RELEASE.md](docs/ANDROID_RELEASE.md)** (upload key, GitHub secrets, local builds, versioning).

```bash
npm run android:sync      # web build + copy into android/
cd android
./gradlew bundleRelease   # Play upload bundle (signed only if an upload key is configured)
./gradlew assembleSideload  # test APK signed with the public test key
```

Every push to `main` / `release/**` builds the AAB and APKs in GitHub Actions, verifies them
(`scripts/ci/verify-android.sh`) and runs an emulator smoke test on Android 16 / API 36
(`scripts/ci/emulator-smoke.sh`). Reports and screenshots go to the `ci-reports` branch.

### Web

Guide: **[docs/WEB_DEPLOY.md](docs/WEB_DEPLOY.md)** — GitHub Pages (workflow included), Netlify or Cloudflare Pages.

### Documentation

| Document | Contents |
|---|---|
| [docs/CALCULATIONS.md](docs/CALCULATIONS.md) | Every calculator's formula, units, rounding, validation, source cross-checks |
| [docs/TESTING.md](docs/TESTING.md) | Test report: what ran, results, what was not tested |
| [docs/PRIVACY_SECURITY_AUDIT.md](docs/PRIVACY_SECURITY_AUDIT.md) | Privacy/security findings and data inventory |
| [PRIVACY.md](PRIVACY.md) | Privacy policy (linked in the app and the Play listing) |
| [docs/PLAY_SUBMISSION.md](docs/PLAY_SUBMISSION.md) | Play Console declarations, health-app notes, release tracks, checklist |
| [store/listing.md](store/listing.md) | Store listing text; graphics and screenshots in `store/` |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Common build/install problems |

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

## 8. Tests

**336 tests, 0 failures** (v1.2.0, 30 Oct 2026). Details and the device-level results: [docs/TESTING.md](docs/TESTING.md).

- `calculations.test.ts` — table-driven engine tests: required cases, zero denominators, negatives, missing fields, unit mismatches, float precision, rounding, midnight crossing, huge values.
- `verification.test.ts` — values derived by hand / in a separate Python session (not copied from the engine), display rounding, score band boundaries, strict number parsing, and a fuzz test (NaN/±Infinity/negative/zero/1e-9/1e308) that must never throw or return a non-finite result.
- `questions.test.ts` — every question template generated repeatedly; answer keys computed independently and cross-checked against the engine.
- `release-safety.test.ts` — unit handling end-to-end through the registry, hand-computed worked examples, high-risk guards (mcg vs mg, per-dose vs per-day, concentration units), an input sweep of every number field of every calculator, result labelling, reference integrity, and native-bridge inertness outside Android.
- `ui.test.tsx` — renders the app and opens **every** form calculator and runs its example; search, validation, GCS, high-alert gate, fluid log, converter, favorites, quiz, dark theme.

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
- iOS (IPA) — not built; the web app installs to the iPhone home screen instead.

## 10. Clinical content status

Every entry in `src/references/manifest.ts` carries source, population, version, reviewer and review date fields. All are currently `awaiting-review` with no reviewer. The citations are the standard literature sources for each formula, but they were **not** re-checked against primary documents. On 30 Oct 2026, 11 named formulas were cross-checked against published secondary sources (each entry's `crossCheck` field; table in docs/CALCULATIONS.md) — an engineering check, not a clinical review. Items that especially need reviewer attention: oxygen cylinder factors, blood-volume estimates, Glasgow-Blatchford thresholds, Bishop criteria version, GCS wording, and the CPR reference text. To sign off an entry, set `status: 'reviewed'`, `reviewer` and `lastReview`.

## 11. Known issues and limitations (v1.2.0)

- **No clinical sign-off.** All references are `awaiting-review`. Do not market the app as clinically validated.
- **Unsigned AAB until you add the upload key** — CI produces an unsigned bundle without the GitHub secrets (docs/ANDROID_RELEASE.md §3).
- **Privacy-policy link returns 404 until this branch is merged to `main`** (the URL points at `main`).
- **Web app not deployed** — GitHub Pages is not enabled on the repository yet (docs/WEB_DEPLOY.md). GitHub Pages cannot send the security headers in `public/_headers`.
- Naegele cycle-length adjustment and blood-volume mL/kg values are not confirmed by a cited source.
- Tested on the Android 16 emulator only; not on physical phones, tablets or with TalkBack.
- English only.

## 12. Audit log — v1.1.0 (2026-10-25)

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
