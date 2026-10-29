# Google Play store listing — NurseCalc Pro 1.2.0

Copy each block into Play Console → *Grow users → Store presence → Main store listing*.
Every feature claim below was checked against the app's actual calculators (`src/features/registry.ts`).
Character counts are checked by `scripts/check-listing.py`.

## App name (max 30)

```
NurseCalc Pro
```

## Short description (max 80)

```
Nursing dose, IV, fluid and scoring calculators that show every step. Offline.
```

## Full description (max 4000)

```
NurseCalc Pro is a calculation and study aid for nursing students and nurses. Every result shows the formula, your numbers substituted in, each step of the working and how it was rounded, so you can check the maths rather than trust a black box.

It works completely offline, has no account and no ads, and does not collect any personal or health data.

CALCULATORS (60+ tools in 15 areas)
• Medication: dose from strength on hand (D ÷ H × Q), weight-based mg/kg/dose and mg/kg/day, dose by body surface area, dose range check against a range you enter, dilution (C1V1 = C2V2), reconstitution, insulin volume, heparin and other units-based infusions, supply quantity, percent and ratio strength
• IV therapy: pump rate (mL/hr), gravity drip rate (gtt/min), infusion duration, completion time, volume infused and remaining, sequential bags, dose to pump rate and pump rate to dose (mcg/kg/min, mcg/min, mg/hr and more)
• Body measurements: BMI, body surface area (Mosteller), ideal and adjusted body weight (Devine), weight change, waist-to-height ratio
• Neurological: Glasgow Coma Scale with "not testable" handling
• Fluid balance and renal: intake and output log, urine output in mL/kg/hr, creatinine clearance (Cockcroft–Gault)
• Vital signs: mean arterial pressure, pulse pressure, shock index, pulse deficit, rate from a partial count, °C ↔ °F
• Pediatrics: mg/kg dosing and the 4-2-1 maintenance fluid estimate
• Oxygen: cylinder duration (psi or bar) and oxygen needed for a transfer
• Nutrition: calories from macronutrients, enteral feed rate, percent of target, protein per kg
• Laboratory: glucose and creatinine unit conversion, prescribed dose to volume
• Transfusion and blood loss: transfusion rate, cumulative blood loss as % of estimated blood volume
• Obstetric and newborn: due date and gestational age, APGAR, Bishop score, newborn weight loss, contraction timing
• Emergency: qSOFA, Glasgow-Blatchford score, shock index
• Wound care: area, volume and change since last measurement
• Unit converter for mass, volume, time, temperature, pressure and concentration

BUILT TO PREVENT COMMON CALCULATION ERRORS
• Units are converted for you, and units that cannot be converted (for example mEq and mg) are refused instead of guessed
• "2,5" is rejected with a message rather than read as 25
• mg/kg/day orders always ask for the number of doses — frequency is never assumed
• Insulin, heparin and titrated infusions require a high-alert confirmation and remind you to perform an independent double-check
• Pump rates are rounded once, at the end, to the precision your pump accepts; drip rates show the exact value and whole drops
• Results are never labelled "safe" or "correct"

LEARN
• Practice questions in 13 topics at three levels, with worked explanations
• 20-question mock exam, daily question and review of missed questions
• Formula library with variables, examples, common mistakes and sources, plus a glossary

DESIGNED FOR CLINICAL READABILITY
• Large, high-legibility type, light and dark themes, adjustable text size and reduced-motion option
• Favorites, customizable quick access and search by name or terminology ("gtt/min", "I&O", "mg/kg")

PRIVACY
Calculator inputs are never saved or sent anywhere. Settings, favorites and study progress stay on your device and can be deleted at any time. The Android app requests no permissions.

IMPORTANT
NurseCalc Pro is an educational and calculation aid. It does not provide medical advice and does not replace professional judgement, the prescription, product labelling or your institution's protocols. Always verify calculations independently before acting on them. Clinical reference content is awaiting independent clinical review.
```

## Release notes — version 1.2.0 (max 500)

```
First Google Play release.
• 60+ nursing calculators with formula, substitution and step-by-step working
• Practice questions, mock exam and formula library
• Works fully offline; no account, no ads, no data collection
• Android back button, light/dark themes and adjustable text size
```

## Categorisation

| Field | Value |
|---|---|
| App or game | App |
| Category | Medical |
| Tags (pick up to 5 in Play Console) | Medical reference, Medical education, Nursing, Calculator, Healthcare professionals — choose the closest options Play offers |
| Contains ads | No |
| In-app purchases | No |

## Contact details (Play requires an email address)

| Field | Value |
|---|---|
| Email | **YOUR SUPPORT EMAIL — required, will be shown publicly** |
| Website (optional) | https://github.com/moralesdaren5241-hue/nursecalc-pro (or the GitHub Pages URL once enabled) |
| Phone (optional) | leave blank unless you want it public |

## Privacy policy URL

```
https://github.com/moralesdaren5241-hue/nursecalc-pro/blob/main/PRIVACY.md
```
(Live once this branch is merged to `main` — until then this URL returns 404, and so does the "Read the full privacy policy" link inside the app.)

## Graphics

| Asset | File | Play requirement |
|---|---|---|
| App icon | `store/graphics/play-icon-512.png` | 512 × 512 PNG, full square (Play applies the mask) |
| Feature graphic | `store/graphics/feature-graphic-1024x500.png` | 1024 × 500 JPG/PNG, no alpha |
| Phone screenshots | `store/screenshots/phone-01 … phone-07` | 2–8 images, 1080 × 1920 (9:16) |

Screenshots are real screens of version 1.2.0 rendered at 1080 × 1920 with each calculator's built-in example values (not patient data):
1. Home — quick access and search
2. Drug dose — result with formula, substitution and steps
3. Dose → pump rate — high-alert warning and exact vs pump rate
4. Gravity drip rate — dark theme
5. Glasgow Coma Scale — component documentation (E3 V4 M6 = 13)
6. Calculators directory
7. Learn — progress, daily question, practice topics

Optional (not prepared): 7-inch and 10-inch tablet screenshots. Play does not require them for phone apps, but they improve the listing on tablets.
