// Practice question generators. Each template computes its answer with an
// independent closed-form expression; the test suite cross-checks every template
// against the calculation engine over hundreds of random seeds.
// Values are randomised within educational ranges and are not real patients or
// real drug orders — drug names are deliberately generic ("Drug X").
import { fmt, roundTo } from '../calculations/core';
import * as med from '../calculations/medication';
import * as iv from '../calculations/iv';
import * as body from '../calculations/body';
import * as sc from '../calculations/scores';
import * as fl from '../calculations/fluids';
import * as cl from '../calculations/clinical';

export type Level = 'beginner' | 'intermediate' | 'advanced';

export const TOPICS: { id: string; name: string }[] = [
  { id: 'dosage', name: 'Drug dosage' },
  { id: 'iv', name: 'IV rates' },
  { id: 'weight', name: 'Weight-based' },
  { id: 'pediatric', name: 'Pediatric' },
  { id: 'bmi', name: 'BMI & body' },
  { id: 'gcs', name: 'GCS' },
  { id: 'fluids', name: 'Fluid balance' },
  { id: 'vitals', name: 'Vital signs' },
  { id: 'oxygen', name: 'Oxygen duration' },
  { id: 'nutrition', name: 'Nutrition' },
  { id: 'renal', name: 'Renal' },
  { id: 'obstetric', name: 'Obstetric & newborn' },
  { id: 'conversions', name: 'Unit conversions' },
];

export interface Question {
  id: string;
  topic: string;
  level: Level;
  prompt: string;
  choices: string[];
  answer: number;
  explanation: string[];
  safety?: string;
  calcId?: string;
  /** exact correct numeric answer (for tests) */
  correct: number;
  /** engine-computed value (for tests) */
  engine: number;
  /** answer is checked at this precision */
  dp: number;
}

export type Rng = () => number;
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(r: Rng, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)] as T;
const int = (r: Rng, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
const step = (r: Rng, lo: number, hi: number, s: number) => lo + s * Math.floor(r() * (Math.floor((hi - lo) / s) + 1));

const val = (x: { ok: boolean; value?: number }) => (x.ok ? (x as { value: number }).value : NaN);

interface Draft {
  level: Level;
  prompt: string;
  correct: number;
  distractors: number[];
  unit: string;
  dp: number;
  explanation: string[];
  engine: number;
  safety?: string;
  calcId?: string;
  format?: (n: number) => string;
}

type Template = (r: Rng) => Draft;

const T: Record<string, Template[]> = {
  dosage: [
    (r) => {
      const strength = pick(r, [5, 10, 25, 50, 100, 250, 500]);
      const mult = pick(r, [0.5, 1, 1.5, 2, 3]);
      const ordered = strength * mult;
      return { level: 'beginner', prompt: `Ordered: Drug X ${fmt(ordered)} mg PO. Available: ${strength} mg tablets. How many tablets?`, correct: mult, distractors: [mult * 2, strength / ordered, mult + 1], unit: 'tablet(s)', dp: 2,
        explanation: [`(Desired ÷ Have) × Quantity`, `(${fmt(ordered)} mg ÷ ${strength} mg) × 1 tablet = ${fmt(mult)} tablet(s)`], engine: val(med.basicDose({ desired: ordered, available: strength, quantity: 1, doseUnit: 'mg', quantityUnit: 'tablet(s)' })), calcId: 'drug-dose',
        safety: mult % 1 !== 0 ? 'Confirm the tablet may be split before giving a half tablet.' : undefined };
    },
    (r) => {
      const have = pick(r, [125, 250]);
      const per = 5;
      const ordered = pick(r, [100, 125, 150, 200, 250, 375, 500]);
      const c = (ordered / have) * per;
      return { level: 'beginner', prompt: `Ordered: Drug X ${ordered} mg PO. Available: oral suspension ${have} mg/${per} mL. How many mL?`, correct: c, distractors: [ordered / have, (have / ordered) * per, c * 2], unit: 'mL', dp: 2,
        explanation: [`(${ordered} ÷ ${have}) × ${per} mL = ${fmt(c)} mL`], engine: val(med.basicDose({ desired: ordered, available: have, quantity: per, doseUnit: 'mg', quantityUnit: 'mL' })), calcId: 'drug-dose' };
    },
    (r) => {
      const conc = pick(r, [0.5, 1, 2]); // mg/mL
      const mcg = pick(r, [250, 500, 750, 1000]);
      const c = mcg / 1000 / conc;
      return { level: 'intermediate', prompt: `Ordered: Drug X ${mcg} mcg IV. Available: ${conc} mg/mL. How many mL? (Convert units first.)`, correct: c, distractors: [mcg / conc, (mcg / 100) / conc, c * 10], unit: 'mL', dp: 3,
        explanation: [`${mcg} mcg ÷ 1000 = ${fmt(mcg / 1000, 3)} mg`, `${fmt(mcg / 1000, 3)} mg ÷ ${conc} mg/mL = ${fmt(c, 3)} mL`], engine: val(med.basicDose({ desired: mcg / 1000, available: conc, quantity: 1, doseUnit: 'mg', quantityUnit: 'mL' })), calcId: 'drug-dose',
        safety: 'mg↔mcg errors cause 1000-fold overdoses — always convert before calculating.' };
    },
    (r) => {
      const amount = pick(r, [500, 1000]);
      const vol = pick(r, [2, 5, 10]);
      const ordered = pick(r, [125, 250, 300, 400]);
      const c = ordered / (amount / vol);
      return { level: 'advanced', prompt: `A vial of Drug X ${amount} mg is reconstituted; the label states a final volume of ${vol} mL. Ordered ${ordered} mg. How many mL?`, correct: c, distractors: [ordered / amount, c * 2, (amount / vol) / ordered], unit: 'mL', dp: 2,
        explanation: [`Concentration = ${amount} ÷ ${vol} = ${fmt(amount / vol)} mg/mL`, `${ordered} ÷ ${fmt(amount / vol)} = ${fmt(c)} mL`], engine: val(med.reconstitution({ drugAmount: amount, finalVolumeMl: vol, orderedDose: ordered, doseUnit: 'mg' })), calcId: 'reconstitution' };
    },
    (r) => {
      const units = int(r, 4, 30);
      const c = units / 100;
      return { level: 'intermediate', prompt: `Insulin ${units} units ordered. Concentration U-100 (100 units/mL). What volume in mL?`, correct: c, distractors: [units / 10, units, units / 1000], unit: 'mL', dp: 2,
        explanation: [`${units} units ÷ 100 units/mL = ${fmt(c)} mL (= ${units} unit markings on a U-100 insulin syringe)`], engine: val(med.insulinVolume({ orderedUnits: units, concUnitsPerMl: 100 })), calcId: 'insulin',
        safety: 'Insulin is high-alert: use an insulin syringe/pen and an independent double-check.' };
    },
  ],
  iv: [
    (r) => {
      const v = pick(r, [500, 750, 1000, 1500]);
      const h = pick(r, [4, 6, 8, 10, 12]);
      const c = v / h;
      return { level: 'beginner', prompt: `Infuse ${v} mL over ${h} hours by pump. What rate in mL/hr?`, correct: c, distractors: [v / (h * 60), c * 2, h / v * 1000], unit: 'mL/hr', dp: 1,
        explanation: [`${v} mL ÷ ${h} hr = ${fmt(c, 1)} mL/hr`], engine: val(iv.pumpRate({ volumeMl: v, timeHr: h })), calcId: 'pump-rate' };
    },
    (r) => {
      const v = pick(r, [250, 500, 1000]);
      const h = pick(r, [2, 4, 6, 8]);
      const df = pick(r, [10, 15, 20, 60]);
      const exact = (v * df) / (h * 60);
      const c = Math.round(exact);
      return { level: 'intermediate', prompt: `Infuse ${v} mL over ${h} hours by gravity. Drop factor ${df} gtt/mL. How many gtt/min (whole drops)?`, correct: c, distractors: [Math.round((v * df) / h), Math.round(v / (h * 60)), Math.round(exact * 60 / df)], unit: 'gtt/min', dp: 0,
        explanation: [`(${v} × ${df}) ÷ (${h} × 60 min)`, `= ${v * df} ÷ ${h * 60} = ${fmt(exact, 2)} gtt/min`, `Round to whole drops → ${c} gtt/min`], engine: Math.round(val(iv.dripRate({ volumeMl: v, timeMin: h * 60, dropFactor: df }))), calcId: 'drip-rate' };
    },
    (r) => {
      const rate = pick(r, [50, 75, 100, 125, 150]);
      const v = rate * pick(r, [2, 4, 6, 8]);
      const c = v / rate;
      return { level: 'beginner', prompt: `${v} mL is infusing at ${rate} mL/hr. How many hours will it take?`, correct: c, distractors: [rate / v, c * 60, v / (rate * 2)], unit: 'hours', dp: 2,
        explanation: [`${v} ÷ ${rate} = ${fmt(c)} hours`], engine: val(iv.infusionDuration({ volumeMl: v, rateMlHr: rate })), calcId: 'infusion-duration' };
    },
    (r) => {
      const dose = pick(r, [2, 3, 5, 8, 10]);
      const w = int(r, 50, 100);
      const mg = pick(r, [200, 400, 800]);
      const vol = pick(r, [250, 500]);
      const conc = mg / vol;
      const c = (dose * w * 60) / 1000 / conc;
      return { level: 'advanced', prompt: `Drug X ordered at ${dose} mcg/kg/min for a ${w} kg adult. Bag: ${mg} mg in ${vol} mL. Pump rate in mL/hr?`, correct: c, distractors: [(dose * w) / conc, (dose * w * 60) / conc, c / 60], unit: 'mL/hr', dp: 1,
        explanation: [`Concentration = ${mg} ÷ ${vol} = ${fmt(conc, 3)} mg/mL`, `${dose} × ${w} kg × 60 = ${fmt(dose * w * 60)} mcg/hr = ${fmt((dose * w * 60) / 1000, 3)} mg/hr`, `${fmt((dose * w * 60) / 1000, 3)} ÷ ${fmt(conc, 3)} = ${fmt(c, 2)} mL/hr`], engine: val(iv.rateFromDose({ dose, doseUnit: 'mcg/kg/min', concMgPerMl: conc, weightKg: w })), calcId: 'rate-from-dose',
        safety: 'Vasoactive infusions are high-alert: verify concentration on the bag and double-check pump programming.' };
    },
    (r) => {
      const conc = pick(r, [50, 100]);
      const uh = pick(r, [800, 1000, 1200, 1500]);
      const c = uh / conc;
      return { level: 'intermediate', prompt: `Heparin ${uh} units/hr ordered. Bag concentration ${conc} units/mL. Pump rate?`, correct: c, distractors: [uh * conc / 1000, c * 10, conc / uh], unit: 'mL/hr', dp: 1,
        explanation: [`${uh} ÷ ${conc} = ${fmt(c, 1)} mL/hr`], engine: val(med.heparinInfusion({ mode: 'rateFromDose', concUnitsPerMl: conc, unitsPerHr: uh })), calcId: 'heparin',
        safety: 'Heparin is high-alert. Bolus and titration follow the prescribed protocol.' };
    },
  ],
  weight: [
    (r) => {
      const w = int(r, 8, 40);
      const perDay = pick(r, [20, 30, 40, 60]);
      const n = pick(r, [2, 3, 4]);
      const c = (w * perDay) / n;
      return { level: 'intermediate', prompt: `Order: Drug X ${perDay} mg/kg/DAY in ${n} divided doses. Weight ${w} kg. How many mg PER DOSE?`, correct: c, distractors: [w * perDay, (w * perDay) * n, w * perDay / (n + 1)], unit: 'mg', dp: 1,
        explanation: [`Daily: ${w} × ${perDay} = ${w * perDay} mg/day`, `Per dose: ${w * perDay} ÷ ${n} = ${fmt(c, 1)} mg`], engine: val(med.weightBasedDose({ weightKg: w, dosePerKg: perDay, doseUnit: 'mg', basis: 'perDay', dosesPerDay: n })), calcId: 'weight-dose',
        safety: 'mg/kg/day vs mg/kg/dose confusion multiplies the dose. Read the order basis carefully.' };
    },
    (r) => {
      const lb = step(r, 22, 88, 2);
      const per = pick(r, [5, 10, 15]);
      const kg = lb / 2.20462;
      const c = kg * per;
      return { level: 'advanced', prompt: `A child weighs ${lb} lb. Order: ${per} mg/kg/dose. What is one dose in mg? (1 kg = 2.205 lb)`, correct: c, distractors: [lb * per, c / 2.2, c * 2], unit: 'mg', dp: 0,
        explanation: [`${lb} lb ÷ 2.205 = ${fmt(kg, 2)} kg`, `${fmt(kg, 2)} × ${per} = ${fmt(c, 1)} mg`], engine: val(med.weightBasedDose({ weightKg: kg, dosePerKg: per, doseUnit: 'mg', basis: 'perDose' })), calcId: 'peds-dose',
        safety: 'Dosing with pounds instead of kg gives a 2.2× overdose. Record weight in kg.' };
    },
  ],
  pediatric: [
    (r) => {
      const w = int(r, 3, 45);
      const c = Math.min(w, 10) * 4 + Math.max(Math.min(w - 10, 10), 0) * 2 + Math.max(w - 20, 0);
      return { level: 'intermediate', prompt: `Using the traditional 4-2-1 (Holliday–Segar) estimate, what is the hourly maintenance estimate for a ${w} kg child?`, correct: c, distractors: [w * 4, w * 2, c * 24 / 10], unit: 'mL/hr', dp: 0,
        explanation: [`First 10 kg × 4 = ${Math.min(w, 10) * 4}`, `Next 10 kg × 2 = ${Math.max(Math.min(w - 10, 10), 0) * 2}`, `Remaining × 1 = ${Math.max(w - 20, 0)}`, `Total ${c} mL/hr`], engine: val(cl.hollidaySegar({ weightKg: w })), calcId: 'maintenance-fluid',
        safety: 'An educational estimate — not a fluid prescription.' };
    },
    (r) => {
      const w = int(r, 5, 30);
      const per = pick(r, [10, 15]);
      const c = w * per;
      return { level: 'beginner', prompt: `Order: Drug X ${per} mg/kg/dose for a ${w} kg child. Dose in mg?`, correct: c, distractors: [c / 4, c * 3, w + per], unit: 'mg', dp: 0,
        explanation: [`${w} × ${per} = ${c} mg`], engine: val(med.weightBasedDose({ weightKg: w, dosePerKg: per, doseUnit: 'mg', basis: 'perDose' })), calcId: 'peds-dose',
        safety: 'Always check the result against the maximum dose in a verified paediatric reference.' };
    },
  ],
  bmi: [
    (r) => {
      const h = step(r, 150, 190, 2) / 100;
      const w = int(r, 45, 110);
      const c = w / (h * h);
      return { level: 'beginner', prompt: `Adult: ${w} kg, ${fmt(h * 100)} cm. BMI (kg/m²)?`, correct: c, distractors: [w / h, w / (h * 100) ** 2 * 10000 / 10, c * 1.2], unit: 'kg/m²', dp: 1,
        explanation: [`${fmt(h * 100)} cm = ${fmt(h, 2)} m`, `${w} ÷ ${fmt(h, 2)}² = ${w} ÷ ${fmt(h * h, 4)} = ${fmt(c, 1)}`], engine: val(body.bmi({ weightKg: w, heightM: h, adult: true })), calcId: 'bmi' };
    },
    (r) => {
      const h = step(r, 150, 190, 5);
      const w = int(r, 45, 100);
      const c = Math.sqrt((h * w) / 3600);
      return { level: 'intermediate', prompt: `Using Mosteller, BSA for ${w} kg and ${h} cm?`, correct: c, distractors: [(h * w) / 3600, Math.sqrt(h * w) / 3600 * 100, c * 1.5], unit: 'm²', dp: 2,
        explanation: [`√(${h} × ${w} ÷ 3600) = √${fmt((h * w) / 3600, 4)} = ${fmt(c, 2)} m²`], engine: val(body.bsaMosteller({ weightKg: w, heightCm: h })), calcId: 'bsa' };
    },
  ],
  gcs: [
    (r) => {
      const E = int(r, 1, 4), V = int(r, 1, 5), M = int(r, 1, 6);
      const eL = sc.GCS_ITEMS[0]!.options.find((o) => o.points === E)!.label;
      const vL = sc.GCS_ITEMS[1]!.options.find((o) => o.points === V)!.label;
      const mL = sc.GCS_ITEMS[2]!.options.find((o) => o.points === M)!.label;
      const c = E + V + M;
      const g = sc.gcs({ E, V, M });
      return { level: 'beginner', prompt: `Eyes: ${eL.toLowerCase()}. Verbal: ${vL.toLowerCase()}. Motor: ${mL.toLowerCase()}. GCS total?`, correct: c, distractors: [c + 1, c - 1, c + 2].filter((x) => x >= 3 && x <= 15), unit: '/15', dp: 0,
        explanation: [`E${E} + V${V} + M${M} = ${c}`, `Document as E${E} V${V} M${M} = ${c}`], engine: g.ok && 'total' in g ? (g.total as number) : NaN, calcId: 'gcs',
        safety: 'Report components, not just the total, and escalate any deterioration.' };
    },
  ],
  fluids: [
    (r) => {
      const oral = step(r, 200, 1200, 50), ivf = step(r, 500, 2000, 50), urine = step(r, 400, 2000, 50), drain = step(r, 0, 300, 25);
      const c = oral + ivf - urine - drain;
      return { level: 'beginner', prompt: `Intake: oral ${oral} mL, IV ${ivf} mL. Output: urine ${urine} mL, drain ${drain} mL. Net fluid balance?`, correct: c, distractors: [oral + ivf + urine + drain, c + drain * 2, -c], unit: 'mL', dp: 0,
        explanation: [`Intake ${oral + ivf} mL − Output ${urine + drain} mL = ${c > 0 ? '+' : ''}${c} mL`], engine: val(fl.fluidBalance({ intakeMl: oral + ivf, outputMl: urine + drain })), calcId: 'fluid-balance',
        format: (n) => `${n > 0 ? '+' : ''}${fmt(n, 0)} mL`, safety: 'A positive balance alone does not confirm fluid overload.' };
    },
    (r) => {
      const w = int(r, 40, 100), h = pick(r, [1, 2, 4, 6]), v = step(r, 15, 400, 5);
      const c = v / h / w;
      return { level: 'intermediate', prompt: `Urine ${v} mL over ${h} hour(s); weight ${w} kg. Urine output in mL/kg/hr?`, correct: c, distractors: [v / w, v / h, (v * h) / w], unit: 'mL/kg/hr', dp: 2,
        explanation: [`${v} ÷ ${h} = ${fmt(v / h, 2)} mL/hr`, `÷ ${w} kg = ${fmt(c, 2)} mL/kg/hr`], engine: val(fl.urineOutput({ volumeMl: v, hours: h, weightKg: w })), calcId: 'urine-output' };
    },
  ],
  vitals: [
    (r) => {
      const dbp = int(r, 50, 100), sbp = dbp + int(r, 25, 70);
      const c = (sbp + 2 * dbp) / 3;
      return { level: 'beginner', prompt: `BP ${sbp}/${dbp} mmHg. Estimated MAP?`, correct: c, distractors: [(sbp + dbp) / 2, sbp - dbp, (2 * sbp + dbp) / 3], unit: 'mmHg', dp: 0,
        explanation: [`(${sbp} + 2 × ${dbp}) ÷ 3 = ${sbp + 2 * dbp} ÷ 3 = ${fmt(c, 1)} mmHg`], engine: val(cl.meanArterialPressure({ sbp, dbp })), calcId: 'map' };
    },
    (r) => {
      const hr = int(r, 60, 140), sbp = int(r, 80, 150);
      const c = hr / sbp;
      return { level: 'intermediate', prompt: `HR ${hr}/min, SBP ${sbp} mmHg. Shock index?`, correct: c, distractors: [sbp / hr, c * 10, (hr - sbp) / 100], unit: '', dp: 2,
        explanation: [`${hr} ÷ ${sbp} = ${fmt(c, 2)}`], engine: val(cl.shockIndex({ hr, sbp })), calcId: 'shock-index', safety: 'Shock index supports — never replaces — clinical assessment.' };
    },
  ],
  oxygen: [
    (r) => {
      const cyl = pick(r, ['D', 'E'] as const);
      const f = cl.CYLINDER_FACTORS[cyl] as number;
      const psi = step(r, 800, 2200, 100), flow = pick(r, [2, 4, 6, 10, 15]);
      const c = Math.floor(((psi - 200) * f) / flow);
      return { level: 'intermediate', prompt: `${cyl} cylinder (factor ${f} L/psi) reads ${psi} psi. Reserve 200 psi. Flow ${flow} L/min. Minutes remaining (round down)?`, correct: c, distractors: [Math.floor((psi * f) / flow), Math.floor(((psi - 200) / f) / flow), Math.floor(((psi - 200) * f) / flow / 60)], unit: 'min', dp: 0,
        explanation: [`(${psi} − 200) × ${f} = ${fmt((psi - 200) * f, 1)} L`, `÷ ${flow} L/min = ${fmt(((psi - 200) * f) / flow, 2)} → ${c} min`], engine: Math.floor(val(cl.cylinderDuration({ cylinder: cyl, pressurePsi: psi, reservePsi: 200, flowLMin: flow }))), calcId: 'o2-cylinder' };
    },
  ],
  nutrition: [
    (r) => {
      const c1 = step(r, 20, 300, 5), p = step(r, 5, 100, 5), f = step(r, 5, 80, 5);
      const c = c1 * 4 + p * 4 + f * 9;
      return { level: 'beginner', prompt: `A feed provides ${c1} g carbohydrate, ${p} g protein and ${f} g fat. Total kcal?`, correct: c, distractors: [(c1 + p + f) * 4, c1 * 4 + p * 4 + f * 4, (c1 + p + f) * 9], unit: 'kcal', dp: 0,
        explanation: [`${c1}×4 + ${p}×4 + ${f}×9 = ${c} kcal`], engine: val(cl.macroCalories({ carbG: c1, proteinG: p, fatG: f })), calcId: 'macros' };
    },
    (r) => {
      const v = step(r, 800, 2000, 100), h = pick(r, [16, 18, 20, 22, 24]);
      const c = v / h;
      return { level: 'beginner', prompt: `Prescribed ${v} mL enteral feed over ${h} hours. Rate?`, correct: c, distractors: [v / 24, c * 2, v / (h * 60)], unit: 'mL/hr', dp: 1,
        explanation: [`${v} ÷ ${h} = ${fmt(c, 1)} mL/hr`], engine: val(cl.enteralRate({ volumeMl: v, hours: h })), calcId: 'enteral-rate' };
    },
  ],
  renal: [
    (r) => {
      const age = int(r, 25, 85), w = int(r, 45, 100), scr = pick(r, [0.6, 0.8, 1, 1.2, 1.5, 2]), female = r() < 0.5;
      const c = (((140 - age) * w) / (72 * scr)) * (female ? 0.85 : 1);
      return { level: 'advanced', prompt: `Cockcroft–Gault: ${female ? 'female' : 'male'}, ${age} y, ${w} kg, SCr ${scr} mg/dL. CrCl (mL/min)?`, correct: c, distractors: [((140 - age) * w) / (72 * scr) * (female ? 1 : 0.85), ((140 - age) * w) / scr, ((140 - age) * w) / (72 * scr * 88.4)], unit: 'mL/min', dp: 0,
        explanation: [`(140 − ${age}) × ${w} = ${(140 - age) * w}`, `72 × ${scr} = ${fmt(72 * scr, 1)}`, `${(140 - age) * w} ÷ ${fmt(72 * scr, 1)} = ${fmt(((140 - age) * w) / (72 * scr), 1)}${female ? ' × 0.85' : ''} = ${fmt(c, 1)}`], engine: val(cl.cockcroftGault({ age, weightKg: w, scrMgDl: scr, sex: female ? 'female' : 'male', weightLabel: 'actual' })), calcId: 'crcl',
        safety: 'CrCl is not eGFR, and is unreliable when creatinine is changing.' };
    },
  ],
  obstetric: [
    (r) => {
      const birth = step(r, 2500, 4200, 10), loss = pick(r, [3, 5, 7, 8, 10]);
      const curr = Math.round(birth * (1 - loss / 100));
      const c = ((birth - curr) / birth) * 100;
      return { level: 'beginner', prompt: `Birth weight ${birth} g; now ${curr} g. Percentage weight loss?`, correct: c, distractors: [((birth - curr) / curr) * 100, (birth - curr) / 10, c * 10], unit: '%', dp: 1,
        explanation: [`(${birth} − ${curr}) ÷ ${birth} × 100 = ${fmt(c, 1)} %`], engine: val(cl.newbornWeightLoss({ birthG: birth, currentG: curr })), calcId: 'newborn-loss' };
    },
    (r) => {
      const scores = [int(r, 0, 2), int(r, 0, 2), int(r, 0, 2), int(r, 0, 2), int(r, 0, 2)];
      const c = scores.reduce((a, b) => a + b, 0);
      const names = sc.APGAR_ITEMS.map((it, k) => `${it.label.split(' ')[0]}: ${it.options.find((o) => o.points === scores[k])!.label.toLowerCase()}`);
      return { level: 'beginner', prompt: `APGAR at 1 minute — ${names.join('; ')}. Score?`, correct: c, distractors: [c + 1, c - 1, c + 2].filter((x) => x >= 0 && x <= 10), unit: '/10', dp: 0,
        explanation: scores.map((s, k) => `${sc.APGAR_ITEMS[k]!.label}: ${s}`).concat(`Total ${c}`), engine: val(sc.apgar(Object.fromEntries(sc.APGAR_ITEMS.map((it, k) => [it.key, scores[k]])), 1)), calcId: 'apgar',
        safety: 'Never delay resuscitation to calculate APGAR.' };
    },
  ],
  conversions: [
    (r) => {
      const mg = pick(r, [0.025, 0.1, 0.125, 0.25, 0.5, 1.5]);
      const c = mg * 1000;
      return { level: 'beginner', prompt: `Convert ${mg} mg to mcg.`, correct: c, distractors: [mg / 1000, mg * 100, c * 10], unit: 'mcg', dp: 3,
        explanation: [`1 mg = 1000 mcg → ${mg} × 1000 = ${fmt(c, 3)} mcg`], engine: c, calcId: 'converter' };
    },
    (r) => {
      const lb = int(r, 10, 250);
      const c = lb / 2.20462262;
      return { level: 'beginner', prompt: `Convert ${lb} lb to kg (1 kg = 2.2046 lb).`, correct: c, distractors: [lb * 2.2046, lb / 2, c * 1.1], unit: 'kg', dp: 1,
        explanation: [`${lb} ÷ 2.2046 = ${fmt(c, 1)} kg`], engine: c, calcId: 'converter' };
    },
    (r) => {
      const t = roundTo(36 + r() * 4, 1);
      const c = t * 9 / 5 + 32;
      return { level: 'beginner', prompt: `Convert ${t} °C to °F.`, correct: c, distractors: [(t - 32) * 5 / 9, t * 5 / 9 + 32, t + 32], unit: '°F', dp: 1,
        explanation: [`${t} × 9/5 + 32 = ${fmt(c, 1)} °F`], engine: val(cl.temperature({ value: t, from: 'C' })), calcId: 'temperature' };
    },
    (r) => {
      const g = int(r, 54, 400);
      const c = g / 18.016;
      return { level: 'intermediate', prompt: `Glucose ${g} mg/dL in mmol/L?`, correct: c, distractors: [g * 18, g / 1.8, g / 180], unit: 'mmol/L', dp: 1,
        explanation: [`${g} ÷ 18.016 = ${fmt(c, 1)} mmol/L`], engine: val(cl.glucoseConvert({ value: g, from: 'glu_mgdl' })), calcId: 'glucose' };
    },
  ],
};

function shuffle<T>(r: Rng, xs: T[]): T[] {
  const a = [...xs];
  for (let k = a.length - 1; k > 0; k--) {
    const j = Math.floor(r() * (k + 1));
    [a[k], a[j]] = [a[j] as T, a[k] as T];
  }
  return a;
}

export function generate(topic: string, seed: number, level?: Level): Question {
  const r = mulberry32(seed);
  let templates = T[topic] ?? T.dosage!;
  if (level) {
    const lv = templates.map((t) => ({ t, l: t(mulberry32(seed)).level })).filter((x) => x.l === level).map((x) => x.t);
    if (lv.length) templates = lv;
  }
  const d = pick(r, templates)(r);
  const f = d.format ?? ((n: number) => `${fmt(n, d.dp)}${d.unit ? ' ' + d.unit : ''}`);
  const correctTxt = f(d.correct);
  const seen = new Set([correctTxt]);
  const wrong: string[] = [];
  for (const x of d.distractors) {
    if (!Number.isFinite(x)) continue;
    const t = f(x);
    if (!seen.has(t)) { seen.add(t); wrong.push(t); }
  }
  // pad with near-miss values if distractors collapsed
  let k = 1;
  while (wrong.length < 3 && k < 20) {
    const t = f(d.correct * (1 + 0.25 * k) + (d.dp === 0 ? k : 0));
    if (!seen.has(t)) { seen.add(t); wrong.push(t); }
    k++;
  }
  const choices = shuffle(r, [correctTxt, ...wrong.slice(0, 3)]);
  return {
    id: `${topic}-${seed}`, topic, level: d.level, prompt: d.prompt, choices, answer: choices.indexOf(correctTxt),
    explanation: d.explanation, safety: d.safety, calcId: d.calcId, correct: d.correct, engine: d.engine, dp: d.dp,
  };
}

export const templateCount = (topic: string) => (T[topic] ?? []).length;

/** Whether a topic has at least one template at the given level. */
export function hasLevel(topic: string, level: Level): boolean {
  return (T[topic] ?? []).some((t) => t(mulberry32(1)).level === level);
}
export const allTopicIds = () => Object.keys(T);

export function dailySeed(d = new Date()): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

export function mockExam(seed: number, n = 20): Question[] {
  const r = mulberry32(seed);
  const topics = allTopicIds();
  return Array.from({ length: n }, (_, k) => generate(topics[k % topics.length] as string, Math.floor(r() * 1e9)))
    .map((q, k) => ({ ...q, id: `${q.id}-m${k}` }));
}
