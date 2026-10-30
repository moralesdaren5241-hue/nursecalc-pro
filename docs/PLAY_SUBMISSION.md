# Google Play submission guide — NurseCalc Pro 1.2.0

This guide gives the answer for every Play Console declaration, based on what the app
**actually does** (verified in code and in the CI build reports), plus the release steps.
Google makes the final decision on every review; nothing here guarantees approval.

Status key: ✅ ready · 🟡 needs your input/action · ⚠️ needs a decision or advice

---

## 1. Facts the answers are based on

| Fact | Evidence |
|---|---|
| No network access: the Android app requests **no permissions at all** (INTERNET is removed) | `android/app/src/main/AndroidManifest.xml`; CI check "no INTERNET permission" in `verify-android.sh` and on the emulator |
| No data leaves the device; no SDKs for analytics, ads, crash reporting or login | Only dependencies: React, Capacitor core/android/app (`package.json`); source audit in `docs/PRIVACY_SECURITY_AUDIT.md` |
| Local storage only for settings, favorites, recents, bookmarks, study progress | `src/storage/store.ts` |
| Calculator inputs and results are never stored | Component state only; store comment and audit |
| Android backup and device transfer disabled | `allowBackup=false`, `data_extraction_rules.xml` |
| No accounts, no purchases, no ads | — |
| targetSdk 36, minSdk 24 | `android/variables.gradle`; CI check on the APK and AAB |

If any of these facts changes in a future version (for example, adding analytics or crash
reporting), the Data safety form and `PRIVACY.md` **must** be updated before release.

---

## 2. Policy → App content declarations

| Declaration | Answer | Status |
|---|---|---|
| **Privacy policy** | `https://github.com/moralesdaren5241-hue/nursecalc-pro/blob/main/PRIVACY.md` (live once merged to `main`) | 🟡 merge to `main` first |
| **App access** | "All functionality is available without special access" (no login) | ✅ |
| **Ads** | "No, my app does not contain ads" | ✅ |
| **Content rating** | Complete the IARC questionnaire — see §3 | ✅ answers below |
| **Target audience and content** | Age groups: **18 and over** only. Not designed for children. See §4 | ✅ |
| **News app** | No | ✅ |
| **Government app** | No | ✅ |
| **Financial features** | "My app doesn't provide any financial features" | ✅ |
| **Health apps** | See §5 | ⚠️ read §5 |
| **Data safety** | See §6 — "No data collected, no data shared" | ✅ |
| **Advertising ID** | "No" — the app does not use the advertising ID (no `AD_ID` permission) | ✅ |
| **Sensitive permissions** (SMS, call log, location, all-files, accessibility, etc.) | None requested — no declarations needed | ✅ |
| **Foreground service / exact alarm / full-screen intent** | None used | ✅ |

---

## 3. Content rating questionnaire (IARC)

- **Category:** "Reference, News, or Educational" (or the closest equivalent Play offers — not a game, not social/communication).
- Violence, fear, sexuality, crude humour, profanity, gambling: **No** to all.
- Controlled substances: the app references **prescription medications only in an educational/clinical-calculation context**; it does not depict or encourage illegal drug, alcohol or tobacco use → answer **No** to depictions of illegal drugs / use of alcohol or tobacco.
- User interaction / user-generated content / chat: **No**.
- Shares user's location with others: **No**.
- Digital purchases: **No**.
- Expected outcome: the lowest rating in each region (e.g. PEGI 3, ESRB Everyone). The result is decided by IARC from your answers.

## 4. Target audience

Choose **18+ only**. The app is a professional/student tool. Selecting under-18 groups would bring the app under the Families policy, which it was not designed for. The app collects no data, so there is no COPPA/children's-data exposure either way, but 18+ is the accurate audience.

## 5. Health apps declaration ⚠️

Every app must complete this form. Based on Google's category definitions (Play Console Help, *Provide information for the Health apps declaration form*):

- Tick **Medical → Clinical Decision Support** — Google lists *drug dosage calculators* and *risk assessment tools* as examples, which describes the medication, infusion and scoring tools.
- Tick **Medical → Medical Reference and Education** — the Learn section, formula library and glossary.
- **Medical Device Apps:** do **not** tick this unless the app is actually regulated as a medical device in a market where you distribute it. The app is designed and described as an educational and calculation aid, not a diagnostic or treatment device, and it makes no regulatory claims.

**Important — regulatory status is not something this project can determine.** Software that calculates
medication doses for individual patients *can* be regulated as a medical device in some jurisdictions
(for example under the EU Medical Device Regulation, and potentially by the US FDA or the Philippine
FDA), depending on intended purpose and claims. Before publishing:

1. Decide which countries to distribute in (Play Console → *Production → Countries/regions*). Starting with fewer countries reduces regulatory exposure.
2. If you distribute in the EU/EEA, UK, US or other regulated markets, consider getting advice from a regulatory professional about whether the intended purpose ("educational and calculation aid for nursing students and nurses") keeps it outside device regulation there.
3. Keep the store listing wording as written in `store/listing.md` — it avoids diagnostic, treatment or "validated/approved" claims.

## 6. Data safety form

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **No** |
| (Follow-up questions about encryption in transit, deletion requests) | Not shown when the answer above is No |

Why "No" is accurate: Google defines *collection* as transmitting data off the device. NurseCalc Pro
stores preferences and study progress only on the device, never transmits anything, and has no
third-party SDKs. On-device storage is not "collection" under the Data safety definitions.

Resulting store label: **"No data collected" · "No data shared with third parties"**.

## 7. Store listing

All text, graphics and screenshots are prepared — see `store/listing.md`, `store/graphics/`, `store/screenshots/`.

🟡 You must add a **support email address** (shown publicly) in the store listing contact details.

## 8. App signing and the release bundle

1. 🟡 Create your private **upload key** and add the four GitHub secrets — `docs/ANDROID_RELEASE.md` §3.
2. Re-run the *Android build, verify & test* workflow (or push to `main`). The **NurseCalcPro-play-bundle** artifact is then a signed `app-release.aab`; the verification report confirms "AAB is signed" and "NOT signed with the public test key".
3. In Play Console, when you create the first release, accept **Play App Signing** (the default). Google holds the app-signing key; you keep the upload key. If you ever lose the upload key, Play support can reset it.

Without the secrets, CI produces an **unsigned** AAB, which Play will not accept.

## 9. Release tracks — the path to production

Personal developer accounts created after **13 November 2023** must complete a closed test before production is unlocked
(Play Console Help, *App testing requirements for new personal developer accounts*):

1. **Internal testing** (optional but recommended): upload the AAB, add yourself, install from the Play link, check it.
2. **Closed testing**: at least **12 testers**, each opted in for **14 consecutive days**. Testers who leave early do not count.
3. **Apply for production** from the Dashboard: describe the test, the feedback you received and what you changed. Review usually takes up to about 7 days.
4. **Production**: choose countries (§5), roll out. Review of the first production release can take several days.

Organisation accounts are exempt from step 2–3 but need a D-U-N-S number.

## 10. Pre-submission checklist

| # | Item | Status |
|---|---|---|
| 1 | targetSdk 36 (required for new apps since 31 Aug 2026) | ✅ verified in CI |
| 2 | Unique, permanent applicationId `com.nursecalcpro.app` | ✅ — **cannot be changed after the first upload** |
| 3 | versionCode 4 / versionName 1.2.0 (increase versionCode for every upload) | ✅ |
| 4 | Release AAB built | ✅ in CI (artifact `NurseCalcPro-play-bundle`) |
| 5 | AAB signed with private upload key | 🟡 add secrets (§8) |
| 6 | Not debuggable, no WebView debugging, no console logging | ✅ verified in CI |
| 7 | No permissions requested | ✅ verified in CI and on emulator |
| 8 | Privacy policy hosted at a public HTTPS URL and linked in the app | 🟡 live after merge to `main` |
| 9 | In-app medical disclaimer | ✅ home, every calculator, About |
| 10 | Data safety form | ✅ answers in §6 |
| 11 | Health apps declaration | ⚠️ answers in §5; regulatory decision is yours |
| 12 | Content rating, target audience, ads, app access | ✅ answers in §2–4 |
| 13 | Store listing text within limits | ✅ `python3 scripts/check-listing.py` |
| 14 | Icon 512, feature graphic 1024×500, ≥2 phone screenshots | ✅ `store/` |
| 15 | Support email | 🟡 yours |
| 16 | Developer account (one-time US$25 fee), identity verification | 🟡 yours |
| 17 | Closed test with 12 testers × 14 days (new personal accounts) | 🟡 yours |
| 18 | Distribution countries chosen | ⚠️ yours (§5) |
| 19 | Independent clinical review of the reference content | ⚠️ recommended before wide release (see README §10) |
| 20 | Uninstall the GitHub sideload test build before installing from Play (different signing key) | 🟡 testers |
