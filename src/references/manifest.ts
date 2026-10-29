// Clinical reference manifest. Content lives here — separate from UI code — so a
// clinical reviewer can audit and update it independently.
//
// HONEST STATUS: the sources below are the original/standard literature citations
// for each formula. They were NOT re-checked against the primary documents during
// this build, and no clinical reviewer has signed off. Every entry is therefore
// marked 'awaiting-review'. The arithmetic is covered by automated tests; clinical
// appropriateness is a separate question that needs a qualified reviewer.

export type VerificationStatus = 'awaiting-review' | 'reviewed';

export interface Reference {
  id: string;
  name: string;
  expression: string;
  variables: string[];
  units: string;
  example: string;
  mistakes: string[];
  limitations: string;
  population: string;
  source: string;
  version?: string;
  status: VerificationStatus;
  /** Secondary-source cross-check done during engineering audit (NOT a clinical review). */
  crossCheck?: string;
  reviewer: string | null;
  lastReview: string | null;
  topic: string; // learning topic id
}

const pending = { status: 'awaiting-review' as const, reviewer: null, lastReview: null };

export const REFERENCES: Reference[] = [
  { id: 'dose-basic', topic: 'dosage', name: 'Basic dose formula (Desired ÷ Have × Quantity)', expression: 'Amount = (D ÷ H) × Q',
    variables: ['D — ordered (desired) dose', 'H — strength available (have)', 'Q — quantity containing H (tablet, mL)'], units: 'D and H in the same unit; result in the unit of Q',
    example: '500 mg ordered; 250 mg tablets → (500 ÷ 250) × 1 = 2 tablets', mistakes: ['Mixing mg and mcg without converting first', 'Using the vial total instead of the concentration per mL', 'Inverting D and H'],
    limitations: 'Arithmetic only. Does not check the dose is appropriate.', population: 'All', source: 'Standard nursing pharmacology texts (dimensional analysis / formula method).', ...pending },
  { id: 'weight-dose', topic: 'weight', name: 'Weight-based dosing', expression: 'Dose = kg × dose/kg (÷ doses per day if per-day order)',
    variables: ['kg — body weight in kilograms', 'dose/kg — ordered per kg per dose OR per day'], units: 'mg/kg/dose vs mg/kg/day are different orders',
    example: '20 kg × 30 mg/kg/day ÷ 3 = 200 mg per dose', mistakes: ['Treating mg/kg/day as mg/kg/dose (3–4× overdose)', 'Using pounds instead of kg (2.2× error)', 'Assuming a frequency'],
    limitations: 'Must be compared with a verified maximum dose.', population: 'Paediatric and adult when ordered per kg', source: 'Standard nursing pharmacology texts.', ...pending },
  { id: 'c1v1', topic: 'dosage', name: 'Dilution (C1V1 = C2V2)', expression: 'C1 × V1 = C2 × V2', variables: ['C1 stock concentration', 'V1 stock volume', 'C2 final concentration', 'V2 final volume'], units: 'Same unit for both C, same for both V',
    example: '10 mg/mL × V1 = 2 mg/mL × 100 mL → V1 = 20 mL', mistakes: ['C2 higher than C1', 'Adding V2 of diluent instead of (V2 − V1)'], limitations: 'Assumes volumes are additive.', population: 'All', source: 'General chemistry / pharmacy calculations.', ...pending },
  { id: 'iv-pump', topic: 'iv', name: 'IV pump rate', expression: 'mL/hr = Volume (mL) ÷ Time (hr)', variables: ['Volume in mL', 'Time in hours'], units: 'mL/hr',
    example: '1000 mL ÷ 8 hr = 125 mL/hr', mistakes: ['Using minutes as hours', 'Rounding before the final step'], limitations: 'Pump precision varies by device.', population: 'All', source: 'Standard nursing texts.', ...pending },
  { id: 'iv-drip', topic: 'iv', name: 'Gravity drip rate', expression: 'gtt/min = (Volume × Drop factor) ÷ Time (min)', variables: ['Volume in mL', 'Drop factor gtt/mL (on giving-set package)', 'Time in minutes'], units: 'gtt/min — whole drops',
    example: '(500 × 15) ÷ 240 = 31.25 → 31 gtt/min', mistakes: ['Using hours instead of minutes', 'Wrong drop factor (macro vs micro set)'], limitations: 'Gravity flow is imprecise; recheck frequently.', population: 'All', source: 'Standard nursing texts.', ...pending },
  { id: 'bmi', topic: 'bmi', name: 'Body mass index', expression: 'BMI = kg ÷ m²', variables: ['Weight kg', 'Height m'], units: 'kg/m²',
    example: '60 ÷ 1.6² = 23.4', mistakes: ['Using cm instead of m', 'Applying adult categories to children'], limitations: 'Screening only; does not measure body fat.', population: 'Adults ≥ 18 for categories (WHO)', source: 'WHO adult BMI classification.', crossCheck: 'Bands < 18.5, 18.5–24.9, 25–29.9, 30–34.9, 35–39.9, ≥ 40 matched a WHO-adapted table on PMC (PMC4976181) (accessed 2026-10-30).', ...pending },
  { id: 'bsa', topic: 'bmi', name: 'BSA — Mosteller', expression: 'BSA = √(cm × kg ÷ 3600)', variables: ['Height cm', 'Weight kg'], units: 'm²', example: '√(170 × 70 ÷ 3600) = 1.82 m²', mistakes: ['Using m for height'], limitations: 'One of several BSA formulas; use the one your protocol specifies.', population: 'Adults and children', source: 'Mosteller RD. N Engl J Med 1987;317:1098.', crossCheck: 'Formula √(cm × kg ÷ 3600) matched the RxList BSA definition; citation matches PubMed 3657876 (Mosteller, NEJM 1987;317:1098) (accessed 2026-10-30).', ...pending },
  { id: 'ibw', topic: 'bmi', name: 'Ideal body weight — Devine', expression: 'Male 50 kg / Female 45.5 kg + 2.3 kg per inch over 60 in; AdjBW = IBW + 0.4(ABW − IBW)', variables: ['Height in inches', 'Sex'], units: 'kg', example: '72 in male → 50 + 2.3 × 12 = 77.6 kg', mistakes: ['Using for height < 60 in'], limitations: 'Not validated below 5 ft; the 0.4 factor is a convention.', population: 'Adults ≥ 152.4 cm', source: 'Devine BJ. Drug Intell Clin Pharm 1974;8:650-655.', crossCheck: 'Male 50 kg / female 45.5 kg + 2.3 kg per inch over 5 ft, and AdjBW = IBW + 0.4 × (ABW − IBW), matched WikEM “Ideal body weight calculator” (accessed 2026-10-30).', ...pending },
  { id: 'gcs', topic: 'gcs', name: 'Glasgow Coma Scale', expression: 'Total = E (1–4) + V (1–5) + M (1–6)', variables: ['Eye opening', 'Verbal response', 'Best motor response'], units: '3–15; report as E_V_M_',
    example: 'E3 V4 M6 = 13', mistakes: ['Reporting only the total', 'Scoring a non-testable component as 1', 'Using a non-standard stimulus'], limitations: 'Total loses information; trend and components matter more.', population: 'Adults and older children (paediatric versions exist for pre-verbal children)', source: 'Teasdale G, Jennett B. Lancet 1974;2:81-84; terminology per glasgowcomascale.org (2014 structured approach).', crossCheck: 'Three components scored E 1–4, V 1–5, M 1–6, reported separately and totalled out of 15, matched GPnotebook “Glasgow coma scale” (accessed 2026-10-30). Descriptor wording follows the 2014 Teasdale structured terminology and was not re-checked line by line.', ...pending },
  { id: 'apgar', topic: 'obstetric', name: 'APGAR score', expression: 'Sum of 5 signs, each 0–2', variables: ['Appearance', 'Pulse', 'Grimace', 'Activity', 'Respiration'], units: '0–10', example: '1+2+2+2+2 = 9', mistakes: ['Delaying resuscitation to score'], limitations: 'Not for predicting long-term outcome alone.', population: 'Newborns at 1 and 5 min', source: 'Apgar V. Curr Res Anesth Analg 1953;32:260-267; AAP/ACOG committee opinion on the Apgar score.', crossCheck: 'Five signs scored 0–2; 7–10 “reassuring”, 4–6 “moderately abnormal”, lower “low”; scored at 1 and 5 min and every 5 min to 20 min if < 7 — matched DONA summary of the AAP/ACOG Apgar statement (accessed 2026-10-30).', ...pending },
  { id: 'fluid-balance', topic: 'fluids', name: 'Fluid balance', expression: 'Net = Intake − Output', variables: ['All measured intake', 'All measured output'], units: 'mL', example: '2000 − 1500 = +500 mL', mistakes: ['Forgetting flushes and medication volumes', 'Mixing estimated and measured losses'], limitations: 'Excludes insensible losses.', population: 'All', source: 'Standard nursing texts.', ...pending },
  { id: 'urine-output', topic: 'fluids', name: 'Urine output per kg', expression: 'mL/kg/hr = mL ÷ hr ÷ kg', variables: ['Urine volume mL', 'Period hr', 'Weight kg'], units: 'mL/kg/hr', example: '30 ÷ 1 ÷ 60 = 0.5 mL/kg/hr', mistakes: ['Not dividing by hours'], limitations: 'Thresholds vary by population/guideline.', population: 'All', source: 'Standard nursing texts; KDIGO AKI guideline (2012) uses mL/kg/h criteria.', ...pending },
  { id: 'map', topic: 'vitals', name: 'Mean arterial pressure (estimate)', expression: 'MAP ≈ (SBP + 2 × DBP) ÷ 3', variables: ['SBP', 'DBP'], units: 'mmHg', example: '(120 + 160) ÷ 3 = 93.3', mistakes: ['Averaging SBP and DBP'], limitations: 'Estimate from cuff values; less accurate at high heart rates.', population: 'All', source: 'Standard physiology texts.', ...pending },
  { id: 'shock-index', topic: 'vitals', name: 'Shock index', expression: 'SI = HR ÷ SBP', variables: ['Heart rate', 'Systolic BP'], units: 'ratio', example: '110 ÷ 100 = 1.1', mistakes: ['Treating SI as diagnostic'], limitations: 'Affected by beta-blockers, pregnancy, age.', population: 'Adults', source: 'Allgöwer M, Burri C. 1967 (original description).', ...pending },
  { id: 'holliday-segar', topic: 'pediatric', name: 'Holliday–Segar maintenance (4-2-1)', expression: '4 mL/kg/hr first 10 kg + 2 next 10 + 1 per kg over 20', variables: ['Weight kg'], units: 'mL/hr', example: '25 kg → 40 + 20 + 5 = 65 mL/hr', mistakes: ['Using as a prescription', 'Applying the 100/50/20 daily rule per hour'], limitations: 'Educational estimate; excludes deficits and losses.', population: 'Children (traditional)', source: 'Holliday MA, Segar WE. Pediatrics 1957;19:823-832.', crossCheck: '4 mL/kg/hr first 10 kg + 2 mL/kg/hr next 10 kg + 1 mL/kg/hr each kg over 20 matched WikEM “Maintenance fluids calculator” (attributed to Holliday & Segar 1957) (accessed 2026-10-30).', ...pending },
  { id: 'o2-cylinder', topic: 'oxygen', name: 'Oxygen cylinder duration', expression: 'min = (psi − reserve) × factor ÷ L/min', variables: ['Gauge pressure psi', 'Reserve psi', 'Cylinder factor L/psi', 'Flow L/min'], units: 'minutes',
    example: 'E: (2000 − 200) × 0.28 ÷ 2 = 252 min', mistakes: ['Using one factor for all cylinders', 'Ignoring reserve pressure'], limitations: 'Factors: D 0.16, E 0.28, M 1.56, G 2.41, H/K 3.14 L/psi (commonly cited; verify against cylinder labels).', population: 'All', source: 'Respiratory-care education texts (commonly cited cylinder factors).', crossCheck: 'Factors D 0.16, E 0.28, M 1.56, G 2.41, H/K 3.14 L/psi matched respiratorytherapyzone.com cylinder-duration page (accessed 2026-10-25).', ...pending },
  { id: 'macros', topic: 'nutrition', name: 'Energy from macronutrients', expression: 'kcal = 4 × carb g + 4 × protein g + 9 × fat g', variables: ['Grams of each'], units: 'kcal', example: '4×50 + 4×20 + 9×10 = 370 kcal', mistakes: ['Using 4 kcal/g for fat'], limitations: 'Atwater general factors.', population: 'All', source: 'Atwater general factors (FAO/WHO).', ...pending },
  { id: 'cockcroft-gault', topic: 'renal', name: 'Creatinine clearance — Cockcroft–Gault', expression: 'CrCl = (140 − age) × kg ÷ (72 × SCr mg/dL) × 0.85 if female', variables: ['Age years', 'Weight kg', 'Serum creatinine mg/dL', 'Sex'], units: 'mL/min',
    example: '(140 − 60) × 70 ÷ 72 = 77.8 mL/min', mistakes: ['Using µmol/L without converting (÷ 88.4)', 'Confusing with eGFR'], limitations: 'Unreliable in AKI, pregnancy, extremes of body composition.', population: 'Adults with stable renal function', source: 'Cockcroft DW, Gault MH. Nephron 1976;16:31-41.', crossCheck: '[(140 − age) × kg × (0.85 if female)] ÷ (72 × SCr mg/dL) matched the University of Washington HIV PrEP clinical calculator (accessed 2026-10-30).', ...pending },
  { id: 'glucose', topic: 'conversions', name: 'Glucose unit conversion', expression: 'mmol/L = mg/dL ÷ 18.016', variables: ['Glucose'], units: 'mg/dL ↔ mmol/L', example: '180 mg/dL ≈ 10.0 mmol/L', mistakes: ['Multiplying instead of dividing'], limitations: '—', population: 'All', source: 'Molar mass of glucose 180.16 g/mol.', crossCheck: 'Factor consistent with Quest Diagnostics SI-unit table (glucose mg/dL × 0.0555 = mmol/L, i.e. ÷ 18.02) (accessed 2026-10-30). Creatinine factor 88.4 matched the same table.', ...pending },
  { id: 'naegele', topic: 'obstetric', name: 'Naegele’s rule', expression: 'EDD = LMP + 280 days (+1 yr − 3 mo + 7 d)', variables: ['First day of LMP', 'Cycle length'], units: 'date', example: 'LMP 1 Jan → EDD 8 Oct', mistakes: ['Using last day of period'], limitations: 'Assumes 28-day cycles; ultrasound dating preferred.', population: 'Pregnancy', source: 'Standard obstetric texts.', crossCheck: 'LMP + 280 days (= +1 year − 3 months + 7 days) matched Wikipedia “Estimated date of delivery” (accessed 2026-10-30). The cycle-length adjustment (± days by which the cycle differs from 28) was NOT found in that source and remains unverified.', ...pending },
  { id: 'bishop', topic: 'obstetric', name: 'Bishop score', expression: 'Sum of 5 cervical items (0–13)', variables: ['Dilation', 'Effacement', 'Station', 'Consistency', 'Position'], units: '0–13', example: '2+2+2+1+1 = 8', mistakes: ['Mixing modified and original criteria'], limitations: 'Several modified versions exist.', population: 'Term pregnancy', source: 'Bishop EH. Obstet Gynecol 1964;24:266-268.', crossCheck: 'Item point values matched the table on Wikipedia “Bishop score” (accessed 2026-10-25).', ...pending },
  { id: 'qsofa', topic: 'emergency', name: 'qSOFA', expression: 'RR ≥ 22 + altered mentation + SBP ≤ 100 (0–3)', variables: ['Respiratory rate', 'Mentation', 'SBP'], units: '0–3', example: '2 criteria → 2', mistakes: ['Using to rule out sepsis'], limitations: 'Prognostic, not diagnostic; low sensitivity.', population: 'Adults with suspected infection outside ICU', source: 'Singer M et al. JAMA 2016;315:801-810 (Sepsis-3); Seymour CW et al. JAMA 2016;315:762-774.', crossCheck: 'RR ≥ 22/min, SBP ≤ 100 mmHg, altered mentation; ≥ 2 of 3 = higher risk, adults with suspected infection outside ICU — matched The Hospitalist summary of Seymour et al. JAMA 2016 (accessed 2026-10-30).', ...pending },
  { id: 'gbs', topic: 'emergency', name: 'Glasgow-Blatchford bleeding score', expression: 'Points for urea, Hb, SBP, pulse, melaena, syncope, hepatic disease, cardiac failure', variables: ['Urea mmol/L', 'Hb g/dL', 'SBP', 'Pulse', 'Findings'], units: '0–23', example: 'See calculator', mistakes: ['Using BUN mg/dL without converting'], limitations: 'Upper GI bleeding only.', population: 'Adults with suspected upper GI bleed', source: 'Blatchford O, Murray WR, Blatchford M. Lancet 2000;356:1318-1321.', crossCheck: 'Bands matched Wikipedia “Glasgow-Blatchford score” (accessed 2026-10-25); urea 25 mmol/L corrected to the 4-point band. Shared endpoints 8.0 and 10.0 are ambiguous in that table.', ...pending },
  { id: 'cpr', topic: 'emergency', name: 'Adult CPR compression reference', expression: 'Rate 100–120 /min; depth 5–6 cm', variables: [], units: '/min, cm', example: '30:2 without advanced airway (adult, per current guidelines)', mistakes: ['Leaning on the chest', 'Long pauses'], limitations: 'Follow the current AHA/ERC/ILCOR guideline and local protocol.', population: 'Adults', source: 'ILCOR / AHA / ERC resuscitation guidelines (check current edition).', crossCheck: 'Adult rate 100–120/min and depth at least 2 in (5 cm) but not more than 2.4 in (6 cm) matched a 2025 AHA guideline summary (cprcart.com) (accessed 2026-10-30). Secondary source — confirm against the current AHA/ERC/ILCOR publication.', ...pending },
  { id: 'wound', topic: 'wound', name: 'Wound area and volume', expression: 'Area ≈ L × W; Volume ≈ L × W × D', variables: ['Length (head-to-toe)', 'Width', 'Depth'], units: 'cm², cm³', example: '4 × 3 = 12 cm²', mistakes: ['Measuring differently each time'], limitations: 'Over-estimates irregular wounds.', population: 'All', source: 'Standard wound-care texts.', ...pending },
  { id: 'blood-volume', topic: 'transfusion', name: 'Estimated blood volume', expression: 'EBV = kg × mL/kg', variables: ['Weight', 'Population estimate'], units: 'mL', example: '70 kg × 70 = 4900 mL', mistakes: ['Using adult values for neonates'], limitations: 'Approximate population averages (adult male ~70, female ~65, infant ~80, term neonate ~85, preterm ~95 mL/kg).', population: 'All', source: 'Standard physiology/anaesthesia texts.', ...pending },
];

export const refById = (id: string) => REFERENCES.find((r) => r.id === id);

export const GLOSSARY: { term: string; def: string }[] = [
  { term: 'gtt', def: 'Drops (Latin guttae). Drip rates are in gtt/min.' },
  { term: 'Drop factor', def: 'Number of drops per mL delivered by a giving set; printed on the package (e.g. 10, 15, 20 macro; 60 micro).' },
  { term: 'mcg', def: 'Microgram = 0.001 mg. Write “mcg”, not “µg”, to avoid misreading.' },
  { term: 'mg/kg/day', def: 'Total amount per kg over 24 h — divide by the number of prescribed doses.' },
  { term: 'mg/kg/dose', def: 'Amount per kg for EACH dose.' },
  { term: 'High-alert medication', def: 'Drug with heightened risk of significant harm when used in error (e.g. insulin, heparin, concentrated electrolytes, opioids).' },
  { term: 'Independent double-check', def: 'A second qualified person verifies the order and calculation separately before administration.' },
  { term: 'MAP', def: 'Mean arterial pressure — average pressure during one cardiac cycle.' },
  { term: 'Insensible loss', def: 'Unmeasured water loss via skin and breathing.' },
  { term: 'Reconstitution', def: 'Adding a diluent to a powder to make a solution; follow the label’s volume and final concentration.' },
  { term: 'Concentration', def: 'Amount of drug per unit volume (e.g. mg/mL) — not the same as the total dose.' },
  { term: 'Titration', def: 'Adjusting an infusion within prescribed limits to reach a target.' },
  { term: 'LMP', def: 'First day of the last menstrual period.' },
  { term: 'EDD', def: 'Estimated date of delivery.' },
  { term: 'CrCl', def: 'Creatinine clearance (mL/min) — an estimate, different from lab-reported eGFR (mL/min/1.73 m²).' },
  { term: 'BSA', def: 'Body surface area in m².' },
  { term: 'U-100', def: 'Insulin concentration of 100 units per mL.' },
  { term: '% w/v', def: 'Grams per 100 mL. 1% = 10 mg/mL.' },
  { term: 'Ratio strength', def: '1:1000 means 1 g in 1000 mL = 1 mg/mL.' },
  { term: 'NT', def: 'Not testable — used in GCS when a component cannot be assessed.' },
];
