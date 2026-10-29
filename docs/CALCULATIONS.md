# Calculation reference and validation

NurseCalc Pro is a **calculation aid**. Every result is arithmetic on the numbers entered; it is
never a clinical recommendation. All formulas live in `src/calculations/` (pure functions, no UI);
the screens call them through `src/features/registry.ts`.

> **Status:** formulas are implemented from the standard literature and covered by automated
> tests. **No qualified clinical reviewer has signed off the content.** Every reference in
> `src/references/manifest.ts` is marked `awaiting-review`, and the app says so on every
> calculator. Do not describe the app as clinically validated.

## How results are presented

Every result shows: the value with its unit, the formula, the user's numbers substituted in,
each step, the rounding rule, extra values (e.g. exact rate), and safety notes. High-alert tools
(insulin, heparin/units infusions, titrated infusions, electrolyte dose → volume) require a
confirmation tick and always carry an independent double-check reminder. Results never use the
words "safe", "correct" or "approved".

## Input validation (all calculators)

- Strict number parsing: `2,5` is refused ("use a decimal point") instead of being read as 25; `1,000` is accepted.
- Empty, non-numeric, infinite, negative (where invalid) and zero-denominator inputs are refused with a message naming the field. Invalid values are never replaced with zero.
- Units are converted before calculating; conversions across dimensions (mg ↔ mL, mEq ↔ mg, units ↔ mg, mL/hr ↔ L/min) are impossible by construction and are refused.
- mg/kg/day orders require the number of doses per day — frequency is never assumed.
- Soft plausibility warnings (weight 0.4–250 kg, BSA 0.1–3 m², drip 1–200 gtt/min, pump 0.1–999 mL/hr, temperature 25–45 °C …) flag likely typing or unit errors without blocking.
- A central guard refuses any result that is not a finite number (e.g. 1e300 ÷ 1e-300).

## Rounding

Calculations never round intermediate values. Each result states its rule:

| Result type | Rounding |
|---|---|
| Pump rates (mL/hr) | Once, at the end, to the pump precision in Settings (whole, 0.1 or 0.01 mL/hr); exact value also shown |
| Gravity drip (gtt/min) | Nearest whole drop (round half up); exact value also shown |
| Oxygen cylinder duration | Rounded **down** to the whole minute (conservative) |
| Doses / volumes | 2–3 decimal places for display; measure to device precision |
| Scores | Integer; no rounding |
| Glucose | 1 dp (mmol/L) / whole (mg/dL) |
| BMI | 1 dp; category from the unrounded value |

Rounding is "half away from zero" with a guard against binary floating-point artefacts (1.005 → 1.01).

## Formula verification (v1.2.0 engineering audit)

Each formula below was compared with its primary source or standard reference and with
hand-computed worked examples (in `src/tests/verification.test.ts` and
`src/tests/release-safety.test.ts`). This is an **engineering** check of the arithmetic, not a
clinical review.

| Formula | Source checked against | Result |
|---|---|---|
| D ÷ H × Q, weight-based, BSA dose, C1V1, reconstitution, insulin, units infusions | Standard nursing pharmacology / dimensional analysis | Matches; worked examples pass |
| IV pump, drip rate, duration, completion, dose ↔ rate (mcg/kg/min etc.) | Standard nursing texts | Matches; unit factors (×60, ÷1000) verified |
| BMI and WHO adult categories | WHO adult BMI classification | Matches |
| BSA — Mosteller √(cm × kg ÷ 3600) | Mosteller, NEJM 1987 | Matches |
| IBW — Devine 50 / 45.5 kg + 2.3 kg per inch over 60 in; AdjBW 0.4 | Devine 1974 | Matches; refuses height < 152.4 cm |
| Cockcroft–Gault (140 − age) × kg ÷ (72 × SCr) × 0.85 female | Cockcroft & Gault 1976 | Matches; age limited to 18–120 |
| Holliday–Segar 4-2-1 | Holliday & Segar 1957 | Matches |
| MAP ≈ (SBP + 2 DBP) ÷ 3; shock index HR ÷ SBP | Standard physiology | Matches |
| GCS E1–4, V1–5, M1–6; NT never totalled | Teasdale & Jennett 1974; 2014 structured approach | Matches |
| APGAR 5 × 0–2 | Apgar 1953 | Matches |
| qSOFA RR ≥ 22, altered mentation, SBP ≤ 100 | Singer / Seymour, JAMA 2016 | Matches |
| Bishop (original) 0–13 | Bishop 1964 | Matches |
| Glasgow-Blatchford 0–23 | Blatchford 2000 | Matches; shared band endpoints 8.0 and 10.0 mmol/L scored in the higher band (documented in-app) |
| Naegele EDD = LMP + 280 d (+ cycle − 28) | Standard obstetric texts | Matches; LMP 2026-01-01 → 2026-10-08 |
| Oxygen cylinder factors D 0.16, E 0.28, M 1.56, G 2.41, H/K 3.14 L/psi | Commonly cited respiratory-care values | Matches the common values; **verify against cylinder labels** |
| Glucose ÷ 18.016; creatinine × 88.4 | Molar masses 180.16 and 113.12 g/mol; standard SI factor 88.4 | Matches (creatinine changed from 88.42 — see change 3) |
| Atwater 4/4/9 kcal/g | FAO/WHO | Matches |

No arithmetic errors were found in the existing engine. Changes made in this audit:

1. **Mismatched reference cards (fixed):** 19 tools displayed a *different* formula's reference card
   (e.g. Temperature showed the MAP reference; Heparin and titration showed the pump-rate formula).
   Their reference links were removed; each still shows its own formula, substitution and steps.
2. **Mislabelled results (fixed):** the due date displayed as "2026-10-08 days" and the infusion
   completion time as "06:30 minutes". They now read "2026-10-08 EDD" and "06:30 next day".
   No calculation changed.
3. **Creatinine factor (changed, 30 Oct 2026):** the converter used 88.42 µmol/L per mg/dL while
   citing a molar mass of 113.12 g/mol, which gives 88.40. Laboratory SI-unit tables use **88.4**
   (Quest Diagnostics SI units table). The factor is now 88.4 everywhere (`units.ts`,
   `clinical.ts`, converter note, tests). Effect: 0.02 % — e.g. 1.20 mg/dL → 106 µmol/L either way.
   Cockcroft–Gault takes creatinine in mg/dL; µmol/L input is converted with the same factor.

## Secondary-source cross-check (30 Oct 2026)

An engineering cross-check — **not a clinical review** — compared each named formula with a
published secondary source. Results are recorded in the `crossCheck` field of
`src/references/manifest.ts`; all entries remain `awaiting-review` until a qualified clinician signs off.

| Reference | Source checked | Result |
|---|---|---|
| BSA (Mosteller) | [RxList BSA definition](https://www.rxlist.com/body_surface_area/definition.htm); [PubMed 3657876](https://pubmed.ncbi.nlm.nih.gov/3657876/) | Matches |
| IBW (Devine) + AdjBW 0.4 | [WikEM IBW calculator](https://wikem.org/wiki/Ideal_body_weight_calculator) | Matches |
| Cockcroft–Gault | [UW clinical calculator](https://www.hivprep.uw.edu/page/clinical-calculators/crcl) | Matches |
| Holliday–Segar 4-2-1 | [WikEM maintenance fluids](https://www.wikem.org/wiki/Maintenance_fluids_calculator) | Matches |
| GCS structure (E1–4, V1–5, M1–6) | [GPnotebook GCS](https://gpnotebook.com/en-GB/pages/neurology/glasgow-coma-scale-gcs) | Matches (descriptor wording not re-checked line by line) |
| APGAR bands and timing | [DONA summary of AAP/ACOG statement](https://www.dona.org/a-new-policy-statement-on-the-apgar-score-from-acog-and-aap) | Matches |
| qSOFA | [The Hospitalist summary of Seymour 2016](https://www.the-hospitalist.org/?p=916) | Matches |
| Adult CPR rate/depth | [2025 AHA summary](https://cprcart.com/?p=33303) | Matches (5–6 cm ≈ 2–2.4 in); confirm against the AHA/ERC publication |
| Naegele 280 days | [Wikipedia: Estimated date of delivery](https://en.wikipedia.org/wiki/Estimated_date_of_delivery) | Core rule matches; **cycle-length adjustment not confirmed by this source** |
| WHO adult BMI bands | [PMC4976181 table](https://pmc.ncbi.nlm.nih.gov/articles/PMC4976181/table/tab1) | Matches |
| Glucose / creatinine SI factors | [Quest SI units table](https://www.questdiagnostics.com/dms/Documents/test-center/si_units.pdf) | Glucose matches; creatinine corrected to 88.4 |
| O2 cylinder factors, Bishop, Glasgow-Blatchford | Earlier audit (25 Oct), see manifest | Matches as recorded |

**Not separately cross-checked** (arithmetic identities or not yet looked up): basic dose, weight-based
dose, C1V1, pump rate, drip rate, fluid balance, wound area/volume, Atwater 4/4/9, MAP, shock index,
KDIGO urine-output thresholds, estimated blood volume mL/kg values.

## Test coverage

| Suite | What it proves |
|---|---|
| `calculations.test.ts` | Every required case (2 tablets, 2.5 mL, 31.25 gtt/min, GCS 13, MAP 93.33 …), zero/negative/missing inputs, unit mismatches, rounding, midnight crossing |
| `verification.test.ts` | 39 values derived independently by hand; display rounding; Blatchford band boundaries; strict parsing; fuzzing every engine function with NaN/±Infinity/0/1e-9/1e308 |
| `release-safety.test.ts` | Unit conversion end-to-end through the UI wiring (mcg→mg, lb→kg, mEq vs mg refused); 15 published worked examples; score maxima; high-alert notes; **every number field of every calculator** swept with 0, −5, 1e309, 1e-300, `abc`, `2,5`, blank and pairwise 1e300/1e-300; date/time labels; reference integrity |
| `questions.test.ts` | Every practice question template generated 300×; answer keys computed independently |
| `ui.test.tsx` | Opens every calculator and runs its example; validation, high-alert gate, GCS NT handling |

The sweep was mutation-tested: deliberately breaking the Mosteller constant or removing the
overflow guard makes the suite fail.

## Known limitations of the clinical content

- No drug database: maximum doses, renal adjustment and reconstitution volumes must come from verified product information. The dose-range checker compares only against a range the user enters.
- Holliday–Segar is labelled an educational estimate; it excludes deficits and losses.
- Cockcroft–Gault is not eGFR and is unreliable in AKI, pregnancy and extremes of body size.
- Oxygen cylinder factors are commonly cited US values; cylinders differ.
- Information-only screens (age-related vital signs, neuro scales, CPR, obstetric history) present no calculation and no single table as authoritative.
- Glasgow-Blatchford shared endpoints (8.0, 10.0 mmol/L) are ambiguous in the published table.

## Calculator inventory

Generated from the registry by running each calculator's built-in example; "formula used" is the
formula the app itself displays in the result.

### A. Medication

| Tool (`id`) | Formula used (as shown in the result) | Output unit | Linked reference / source | Notes |
|---|---|---|---|---|
| Drug dose (D/H × Q) (`drug-dose`) | Amount = (Desired ÷ Have) × Quantity | mL | Basic dose formula (Desired ÷ Have × Quantity) — Standard nursing pharmacology texts (dimensional analysis / formula method). |  |
| Weight-based dose (`weight-dose`) | Dose = (Weight (kg) × dose/kg/day) ÷ doses per day | mg per dose | Weight-based dosing — Standard nursing pharmacology texts. |  |
| Dose range checker (`dose-range`) | Range = Weight (kg) × reference dose/kg; compare ordered amount | mg/day | Weight-based dosing — Standard nursing pharmacology texts. |  |
| Dose by body surface area (`bsa-dose`) | Dose = BSA (m²) × dose/m² | mg | BSA — Mosteller — Mosteller RD. N Engl J Med 1987;317:1098. |  |
| Dilution C1V1 = C2V2 (`dilution`) | C1 × V1 = C2 × V2 | mL | Dilution (C1V1 = C2V2) — General chemistry / pharmacy calculations. |  |
| Reconstitution concentration (`reconstitution`) | Volume = Ordered dose ÷ (Drug amount ÷ Final volume) | mL | Basic dose formula (Desired ÷ Have × Quantity) — Standard nursing pharmacology texts (dimensional analysis / formula method). |  |
| Insulin volume (`insulin`) | Volume (mL) = Ordered units ÷ Concentration (units/mL) | mL | Basic dose formula (Desired ÷ Have × Quantity) — Standard nursing pharmacology texts (dimensional analysis / formula method). | High-alert confirmation |
| Heparin / units-based infusion (`heparin`) | mL/hr = (units/kg/hr × kg) ÷ units/mL | mL/hr | — | High-alert confirmation |
| Medication supply quantity (`supply`) | Total = amount per dose × doses per day × days | tablets | — |  |
| Percent & ratio strength (`strength`) | 1:X (g:mL) → mg/mL = 1000 ÷ X | mg/mL | — |  |

### B. IV therapy & infusion

| Tool (`id`) | Formula used (as shown in the result) | Output unit | Linked reference / source | Notes |
|---|---|---|---|---|
| IV pump rate (`pump-rate`) | mL/hr = Total volume (mL) ÷ Time (hr) | mL/hr | IV pump rate — Standard nursing texts. |  |
| Gravity drip rate (`drip-rate`) | gtt/min = (Volume (mL) × Drop factor (gtt/mL)) ÷ Time (min) | gtt/min | Gravity drip rate — Standard nursing texts. |  |
| Infusion duration (`infusion-duration`) | Time (hr) = Volume (mL) ÷ Rate (mL/hr) | hours | IV pump rate — Standard nursing texts. |  |
| Infusion completion time (`completion-time`) | End = Start + (Volume ÷ Rate) | next day | IV pump rate — Standard nursing texts. |  |
| Volume infused / remaining (`volume-infused`) | Volume infused = Rate (mL/hr) × Time (hr) | mL | IV pump rate — Standard nursing texts. |  |
| Sequential infusion plan (`sequential`) | Interactive screen (sequential) | — | IV pump rate — Standard nursing texts. |  |
| Dose → pump rate (titration) (`rate-from-dose`) | mL/hr = dose rate converted to mg/hr ÷ concentration (mg/mL) | mL/hr | — | High-alert confirmation |
| Pump rate → dose delivered (`dose-from-rate`) | mg/hr = mL/hr × mg/mL;  mcg/min = mg/hr × 1000 ÷ 60 | mg/hr | — |  |

### C. Body measurements & BMI

| Tool (`id`) | Formula used (as shown in the result) | Output unit | Linked reference / source | Notes |
|---|---|---|---|---|
| BMI (`bmi`) | BMI = Weight (kg) ÷ Height (m)² | kg/m² | Body mass index — WHO adult BMI classification. |  |
| Body surface area (Mosteller) (`bsa`) | BSA (Mosteller) = √[Height (cm) × Weight (kg) ÷ 3600] | m² | BSA — Mosteller — Mosteller RD. N Engl J Med 1987;317:1098. |  |
| Ideal & adjusted body weight (Devine) (`ibw`) | IBW (Devine) = 50 kg + 2.3 kg per inch over 60 in | kg | Ideal body weight — Devine — Devine BJ. Drug Intell Clin Pharm 1974;8:650-655. |  |
| Weight change % (`weight-change`) | % change = (Current − Previous) ÷ Previous × 100 | % | — |  |
| Waist-to-height ratio (`whtr`) | WHtR = Waist (cm) ÷ Height (cm) | ratio | — |  |

### D. Neurological

| Tool (`id`) | Formula used (as shown in the result) | Output unit | Linked reference / source | Notes |
|---|---|---|---|---|
| Glasgow Coma Scale (`gcs`) | GCS total = E + V + M (range 3–15) | / 15 | Glasgow Coma Scale — Teasdale G, Jennett B. Lancet 1974;2:81-84; terminology per glasgowcomascale.org (2014 structured approach). | Scored by selection |
| Other neuro scales (education) (`neuro-scales`) | Information only — no calculation | — | Glasgow Coma Scale — Teasdale G, Jennett B. Lancet 1974;2:81-84; terminology per glasgowcomascale.org (2014 structured approach). |  |

### E. Fluid balance & renal

| Tool (`id`) | Formula used (as shown in the result) | Output unit | Linked reference / source | Notes |
|---|---|---|---|---|
| Intake & output (fluid balance) (`fluid-balance`) | Interactive screen (fluid) | — | Fluid balance — Standard nursing texts. |  |
| Urine output (mL/kg/hr) (`urine-output`) | UO (mL/kg/hr) = Volume (mL) ÷ Time (hr) ÷ Weight (kg) | mL/kg/hr | Urine output per kg — Standard nursing texts; KDIGO AKI guideline (2012) uses mL/kg/h criteria. |  |
| Creatinine clearance (Cockcroft–Gault) (`crcl`) | CrCl = [(140 − age) × weight (kg)] ÷ [72 × SCr (mg/dL)]  × 0.85 if female | mL/min | Creatinine clearance — Cockcroft–Gault — Cockcroft DW, Gault MH. Nephron 1976;16:31-41. |  |

### F. Vital signs & hemodynamics

| Tool (`id`) | Formula used (as shown in the result) | Output unit | Linked reference / source | Notes |
|---|---|---|---|---|
| Mean arterial pressure (`map`) | MAP ≈ (SBP + 2 × DBP) ÷ 3 | mmHg | Mean arterial pressure (estimate) — Standard physiology texts. |  |
| Pulse pressure (`pulse-pressure`) | PP = SBP − DBP | mmHg | — |  |
| Shock index (`shock-index`) | SI = Heart rate ÷ Systolic BP | — | Shock index — Allgöwer M, Burri C. 1967 (original description). |  |
| Pulse deficit (`pulse-deficit`) | Pulse deficit = Apical − Radial (counted simultaneously) | beats/min | — |  |
| Rate from partial count (`rate-count`) | Rate = count × 60 ÷ seconds counted | per minute | — |  |
| Temperature °C ↔ °F (`temperature`) | °F = °C × 9/5 + 32 | °F | — |  |
| Age-related vital signs (education) (`vital-ranges`) | Information only — no calculation | — | — |  |

### G. Pediatric nursing

| Tool (`id`) | Formula used (as shown in the result) | Output unit | Linked reference / source | Notes |
|---|---|---|---|---|
| Pediatric dose (mg/kg) (`peds-dose`) | Dose = Weight (kg) × dose/kg/dose | mg per dose | Weight-based dosing — Standard nursing pharmacology texts. |  |
| Maintenance fluid estimate (4-2-1) (`maintenance-fluid`) | 4 mL/kg/hr (first 10 kg) + 2 mL/kg/hr (next 10 kg) + 1 mL/kg/hr (each kg above 20) | mL/hr | Holliday–Segar maintenance (4-2-1) — Holliday MA, Segar WE. Pediatrics 1957;19:823-832. |  |

### H. Oxygen therapy

| Tool (`id`) | Formula used (as shown in the result) | Output unit | Linked reference / source | Notes |
|---|---|---|---|---|
| Oxygen cylinder duration (psi) (`o2-cylinder`) | Duration (min) = (Gauge psi − Reserve psi) × Cylinder factor (L/psi) ÷ Flow (L/min) | minutes | Oxygen cylinder duration — Respiratory-care education texts (commonly cited cylinder factors). |  |
| Oxygen cylinder duration (bar/litres) (`o2-cylinder-bar`) | Duration = Water capacity (L) × (Gauge − Reserve) (bar) ÷ Flow (L/min) | minutes | — |  |
| Oxygen needed for a transfer (`o2-consumption`) | Oxygen used (L) = Flow (L/min) × Time (min) | L | — |  |

### I. Nutrition & feeding

| Tool (`id`) | Formula used (as shown in the result) | Output unit | Linked reference / source | Notes |
|---|---|---|---|---|
| Calories from macronutrients (`macros`) | kcal = carbohydrate g × 4 + protein g × 4 + fat g × 9 | kcal | Energy from macronutrients — Atwater general factors (FAO/WHO). |  |
| Enteral feeding rate (`enteral-rate`) | Rate = Prescribed volume ÷ Feeding hours | mL/hr | — |  |
| % of nutrition target achieved (`nutrition-target`) | % achieved = Actual ÷ Target × 100 | % | — |  |
| Protein intake per kg (`protein-kg`) | Protein (g/kg) = Protein (g/day) ÷ Weight (kg) | g/kg/day | — |  |

### J. Laboratory & electrolytes

| Tool (`id`) | Formula used (as shown in the result) | Output unit | Linked reference / source | Notes |
|---|---|---|---|---|
| Blood glucose mg/dL ↔ mmol/L (`glucose`) | mmol/L = mg/dL ÷ 18.016 (glucose molar mass 180.16 g/mol) | mmol/L | Glucose unit conversion — Molar mass of glucose 180.16 g/mol. |  |
| Creatinine mg/dL ↔ µmol/L (`creatinine-convert`) | 1 mg/dL creatinine = 88.4 µmol/L | µmol/L | — |  |
| Prescribed dose → volume (`dose-volume`) | Volume (mL) = Dose ÷ Concentration (per mL) | mL | Basic dose formula (Desired ÷ Have × Quantity) — Standard nursing pharmacology texts (dimensional analysis / formula method). | High-alert confirmation |

### K. Transfusion & blood loss

| Tool (`id`) | Formula used (as shown in the result) | Output unit | Linked reference / source | Notes |
|---|---|---|---|---|
| Transfusion rate (`transfusion-rate`) | mL/hr = Volume ÷ Time (min) × 60 | mL/hr | IV pump rate — Standard nursing texts. |  |
| Cumulative blood loss & % EBV (`blood-loss`) | % lost = EBL ÷ (Weight × mL/kg) × 100 | % of EBV | Estimated blood volume — Standard physiology/anaesthesia texts. |  |

### L. Obstetric & newborn

| Tool (`id`) | Formula used (as shown in the result) | Output unit | Linked reference / source | Notes |
|---|---|---|---|---|
| Due date & gestational age (`edd`) | EDD = LMP + 280 days (Naegele: LMP + 1 year − 3 months + 7 days), adjusted for cycle length | EDD | Naegele’s rule — Standard obstetric texts. |  |
| APGAR score (`apgar`) | APGAR = Appearance + Pulse + Grimace + Activity + Respiration (0–10) | / 10 | APGAR score — Apgar V. Curr Res Anesth Analg 1953;32:260-267; AAP/ACOG committee opinion on the Apgar score. | Scored by selection |
| Newborn weight loss % (`newborn-loss`) | % loss = (Birth weight − Current) ÷ Birth weight × 100 | % | — |  |
| Contraction frequency & duration (`contractions`) | Frequency = time from the start of one contraction to the start of the next | min (start to start) | — |  |
| Bishop score (`bishop`) | Bishop = dilation + effacement + station + consistency + position (0–13) | / 13 | Bishop score — Bishop EH. Obstet Gynecol 1964;24:266-268. | Scored by selection |
| Obstetric history (G/P, GTPAL) (`ob-history`) | Information only — no calculation | — | — |  |

### M. Emergency & critical care

| Tool (`id`) | Formula used (as shown in the result) | Output unit | Linked reference / source | Notes |
|---|---|---|---|---|
| GCS (emergency) (`gcs-em`) | Information only — no calculation | — | Glasgow Coma Scale — Teasdale G, Jennett B. Lancet 1974;2:81-84; terminology per glasgowcomascale.org (2014 structured approach). |  |
| qSOFA (`qsofa`) | qSOFA = RR ≥ 22 + altered mentation + SBP ≤ 100 (0–3) | / 3 | qSOFA — Singer M et al. JAMA 2016;315:801-810 (Sepsis-3); Seymour CW et al. JAMA 2016;315:762-774. | Scored by selection |
| Glasgow-Blatchford score (`gbs`) | GBS = urea + Hb + SBP + pulse + melaena + syncope + hepatic + cardiac points | / 23 | Glasgow-Blatchford bleeding score — Blatchford O, Murray WR, Blatchford M. Lancet 2000;356:1318-1321. |  |
| Shock index & MAP (`shock-index-em`) | Information only — no calculation | — | Shock index — Allgöwer M, Burri C. 1967 (original description). |  |
| Adult CPR & defibrillation reference (`cpr`) | Information only — no calculation | — | Adult CPR compression reference — ILCOR / AHA / ERC resuscitation guidelines (check current edition). |  |

### N. Wound care

| Tool (`id`) | Formula used (as shown in the result) | Output unit | Linked reference / source | Notes |
|---|---|---|---|---|
| Wound area, volume & change (`wound`) | Area ≈ Length × Width (rectangular approximation) | cm² | Wound area and volume — Standard wound-care texts. |  |

### O. Unit conversions

| Tool (`id`) | Formula used (as shown in the result) | Output unit | Linked reference / source | Notes |
|---|---|---|---|---|
| Unit converter (`converter`) | Interactive screen (converter) | — | — |  |

### P. Practice & exams

| Tool (`id`) | Formula used (as shown in the result) | Output unit | Linked reference / source | Notes |
|---|---|---|---|---|
| Practice questions & mock exam (`practice`) | Interactive screen (practice) | — | — |  |
