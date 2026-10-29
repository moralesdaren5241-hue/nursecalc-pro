// Vital signs, paediatrics, oxygen, nutrition, renal, laboratory, transfusion,
// obstetrics and wound calculations. All pure.
import { Check, attempt, compact, fmt, note, ok, plausibility, type CalcResult } from './core';
import { convert } from './units';
import { dripRate } from './iv';
import { quantityForDose } from './medication';

// ---------------- Vital signs ----------------
function bpCheck(sbp: number, dbp: number) {
  new Check().positive('sbp', 'Systolic BP', sbp).positive('dbp', 'Diastolic BP', dbp)
    .rule(!(sbp > 0 && dbp > 0) || sbp > dbp, 'Systolic must be higher than diastolic. Check the values are not swapped.', 'dbp').done();
}

export function meanArterialPressure(i: { sbp: number; dbp: number }): CalcResult {
  return attempt(() => {
    bpCheck(i.sbp, i.dbp);
    const v = (i.sbp + 2 * i.dbp) / 3;
    return ok({
      value: v, unit: 'mmHg', display: fmt(v, 0),
      formula: 'MAP ≈ (SBP + 2 × DBP) ÷ 3', substitution: `(${fmt(i.sbp, 0)} + 2 × ${fmt(i.dbp, 0)}) ÷ 3`,
      steps: [`2 × ${fmt(i.dbp, 0)} = ${fmt(2 * i.dbp, 0)}`, `${fmt(i.sbp, 0)} + ${fmt(2 * i.dbp, 0)} = ${fmt(i.sbp + 2 * i.dbp, 0)}`, `÷ 3 = ${fmt(v, 2)} mmHg`],
      extras: [{ label: 'Pulse pressure', value: `${fmt(i.sbp - i.dbp, 0)} mmHg` }],
      interpretation: 'Estimated MAP (calculated from cuff values)',
      rounding: 'Displayed to the nearest whole mmHg (exact value in steps).',
      notes: compact([plausibility('Systolic BP', i.sbp, 50, 260, 'mmHg'), note('info', 'This is an estimate. A monitor or arterial line measures MAP directly and may differ. Targets are set by the prescriber/protocol.')]),
    });
  });
}

export function pulsePressure(i: { sbp: number; dbp: number }): CalcResult {
  return attempt(() => {
    bpCheck(i.sbp, i.dbp);
    const v = i.sbp - i.dbp;
    return ok({ value: v, unit: 'mmHg', display: fmt(v, 0), formula: 'PP = SBP − DBP', substitution: `${fmt(i.sbp, 0)} − ${fmt(i.dbp, 0)}`, steps: [`${fmt(i.sbp, 0)} − ${fmt(i.dbp, 0)} = ${fmt(v, 0)} mmHg`], rounding: 'Whole mmHg.', notes: [note('info', 'Interpret in context; no single value diagnoses a condition.')] });
  });
}

export function shockIndex(i: { hr: number; sbp: number }): CalcResult {
  return attempt(() => {
    new Check().positive('hr', 'Heart rate', i.hr).positive('sbp', 'Systolic BP', i.sbp).done();
    const v = i.hr / i.sbp;
    return ok({
      value: v, unit: '', display: fmt(v, 2), formula: 'SI = Heart rate ÷ Systolic BP', substitution: `${fmt(i.hr, 0)} ÷ ${fmt(i.sbp, 0)}`,
      steps: [`${fmt(i.hr, 0)} ÷ ${fmt(i.sbp, 0)} = ${fmt(v, 4)}`],
      interpretation: v > 1 ? 'Above 1.0 — often used as a trigger for closer review in adults' : 'At or below 1.0',
      rounding: 'Displayed to 2 decimal places.',
      notes: [note('warning', 'Shock index does not diagnose shock. Age, medications (e.g. beta-blockers), pregnancy and pain affect it. Use with full assessment and escalation criteria.')],
    });
  });
}

export function pulseDeficit(i: { apical: number; radial: number }): CalcResult {
  return attempt(() => {
    new Check().positive('apical', 'Apical rate', i.apical).nonNegative('radial', 'Radial rate', i.radial)
      .rule(!(i.radial > i.apical), 'Radial rate should not exceed the apical rate — recount simultaneously.', 'radial').done();
    const v = i.apical - i.radial;
    return ok({ value: v, unit: 'beats/min', display: fmt(v, 0), formula: 'Pulse deficit = Apical − Radial (counted simultaneously)', substitution: `${fmt(i.apical, 0)} − ${fmt(i.radial, 0)}`, steps: [`${fmt(i.apical, 0)} − ${fmt(i.radial, 0)} = ${fmt(v, 0)}`], rounding: 'Whole beats.', notes: [note('info', 'Count apical and radial rates at the same time for a full minute (two clinicians).')] });
  });
}

export function rateFromCount(i: { count: number; seconds: number }): CalcResult {
  return attempt(() => {
    new Check().nonNegative('count', 'Beats or breaths counted', i.count).positive('seconds', 'Counting period', i.seconds).done();
    const v = (i.count * 60) / i.seconds;
    return ok({ value: v, unit: 'per minute', display: fmt(v, 0), formula: 'Rate = count × 60 ÷ seconds counted', substitution: `${fmt(i.count, 0)} × 60 ÷ ${fmt(i.seconds, 0)}`, steps: [`${fmt(i.count, 0)} × 60 = ${fmt(i.count * 60, 0)}`, `÷ ${fmt(i.seconds, 0)} = ${fmt(v, 2)} /min`], rounding: 'Nearest whole number.', notes: [note('info', 'A full 60-second count is recommended when the rhythm is irregular and for respiratory rate.')] });
  });
}

export function temperature(i: { value: number; from: 'C' | 'F' }): CalcResult {
  return attempt(() => {
    new Check().finite('temp', 'Temperature', i.value).done();
    const to = i.from === 'C' ? 'F' : 'C';
    const v = convert(i.value, i.from, to);
    return ok({
      value: v, unit: `°${to}`, display: fmt(v, 1),
      formula: i.from === 'C' ? '°F = °C × 9/5 + 32' : '°C = (°F − 32) × 5/9',
      substitution: i.from === 'C' ? `${fmt(i.value, 2)} × 9/5 + 32` : `(${fmt(i.value, 2)} − 32) × 5/9`,
      steps: [`= ${fmt(v, 3)} °${to}`], rounding: 'Displayed to 1 decimal place.',
      notes: compact([plausibility('Temperature', i.from === 'C' ? i.value : convert(i.value, 'F', 'C'), 25, 45, '°C')]),
    });
  });
}

// ---------------- Paediatrics ----------------
export function hollidaySegar(i: { weightKg: number }): CalcResult {
  return attempt(() => {
    new Check().positive('weight', 'Weight', i.weightKg).done();
    const w = i.weightKg;
    const a = Math.min(w, 10) * 4;
    const b = Math.max(Math.min(w - 10, 10), 0) * 2;
    const c = Math.max(w - 20, 0) * 1;
    const v = a + b + c;
    return ok({
      value: v, unit: 'mL/hr', display: fmt(v, 1),
      formula: '4 mL/kg/hr (first 10 kg) + 2 mL/kg/hr (next 10 kg) + 1 mL/kg/hr (each kg above 20)',
      substitution: `${fmt(Math.min(w, 10), 2)}×4 + ${fmt(Math.max(Math.min(w - 10, 10), 0), 2)}×2 + ${fmt(Math.max(w - 20, 0), 2)}×1`,
      steps: [`First 10 kg: ${fmt(a, 2)} mL/hr`, `Next 10 kg: ${fmt(b, 2)} mL/hr`, `Above 20 kg: ${fmt(c, 2)} mL/hr`, `Total: ${fmt(v, 2)} mL/hr`],
      extras: [{ label: 'Per 24 hours', value: `${fmt(v * 24, 0)} mL/day` }],
      interpretation: 'Holliday–Segar maintenance ESTIMATE (educational)',
      rounding: 'Displayed to 1 decimal place.',
      notes: compact([
        plausibility('Weight', w, 0.5, 120, 'kg'),
        note('warning', 'This is a calculated maintenance estimate, not a fluid prescription. It excludes deficits, ongoing losses and boluses, and many current guidelines recommend isotonic fluids and reduced volumes in some patients. Follow the prescribed plan.'),
        w > 70 ? note('info', 'Above about 70–80 kg many protocols cap maintenance at an adult rate; check local guidance.') : null,
      ]),
    });
  });
}

// ---------------- Oxygen ----------------
// Cylinder factors (L/psi) for US-style cylinders. Commonly cited educational values; verify against cylinder labels.
export const CYLINDER_FACTORS: Record<string, number> = { D: 0.16, E: 0.28, M: 1.56, G: 2.41, 'H/K': 3.14 };

export function cylinderDuration(i: { cylinder: string; pressurePsi: number; reservePsi: number; flowLMin: number; customFactor?: number }): CalcResult {
  return attempt(() => {
    const factor = i.cylinder === 'custom' ? i.customFactor : CYLINDER_FACTORS[i.cylinder];
    new Check()
      .rule(i.cylinder === 'custom' || i.cylinder in CYLINDER_FACTORS, 'Select a cylinder size.', 'cylinder')
      .positive('factor', 'Cylinder factor (L/psi)', factor)
      .positive('pressure', 'Gauge pressure', i.pressurePsi)
      .nonNegative('reserve', 'Safe residual (reserve) pressure', i.reservePsi)
      .positive('flow', 'Flow rate (L/min)', i.flowLMin).done();
    new Check().rule(i.pressurePsi > i.reservePsi, 'Gauge pressure is at or below the reserve pressure — the cylinder should be replaced, not used.', 'pressure').done();
    const usable = (i.pressurePsi - i.reservePsi) * (factor as number);
    const min = usable / i.flowLMin;
    return ok({
      value: min, unit: 'minutes', display: fmt(Math.floor(min), 0),
      formula: 'Duration (min) = (Gauge psi − Reserve psi) × Cylinder factor (L/psi) ÷ Flow (L/min)',
      substitution: `(${fmt(i.pressurePsi, 0)} − ${fmt(i.reservePsi, 0)}) × ${factor} ÷ ${fmt(i.flowLMin, 2)}`,
      steps: [`Usable pressure = ${fmt(i.pressurePsi - i.reservePsi, 0)} psi`, `× ${factor} L/psi = ${fmt(usable, 1)} L available`, `÷ ${fmt(i.flowLMin, 2)} L/min = ${fmt(min, 2)} min`],
      extras: [{ label: 'Hours and minutes', value: `${Math.floor(min / 60)} hr ${Math.floor(min % 60)} min` }, { label: 'Usable oxygen', value: `${fmt(usable, 0)} L` }, { label: 'Cylinder factor used', value: `${factor} L/psi (${i.cylinder})` }],
      rounding: 'Rounded DOWN to the whole minute (conservative).',
      notes: [note('warning', 'Estimate only. Factors are for the stated cylinder size; verify against the cylinder label and local policy. Bar/kPa cylinders: use the “litres-based” method.'), note('info', 'Do not infer FiO₂ precisely from low-flow device settings.')],
    });
  });
}

export function cylinderDurationLitres(i: { waterCapacityL: number; pressureBar: number; reserveBar: number; flowLMin: number }): CalcResult {
  return attempt(() => {
    new Check().positive('capacity', 'Water capacity (L)', i.waterCapacityL).positive('pressure', 'Gauge pressure (bar)', i.pressureBar).nonNegative('reserve', 'Reserve (bar)', i.reserveBar).positive('flow', 'Flow (L/min)', i.flowLMin).done();
    new Check().rule(i.pressureBar > i.reserveBar, 'Gauge pressure is at or below the reserve.', 'pressure').done();
    const usable = i.waterCapacityL * (i.pressureBar - i.reserveBar);
    const min = usable / i.flowLMin;
    return ok({
      value: min, unit: 'minutes', display: fmt(Math.floor(min), 0),
      formula: 'Duration = Water capacity (L) × (Gauge − Reserve) (bar) ÷ Flow (L/min)',
      substitution: `${fmt(i.waterCapacityL, 1)} × (${fmt(i.pressureBar, 0)} − ${fmt(i.reserveBar, 0)}) ÷ ${fmt(i.flowLMin, 2)}`,
      steps: [`Usable gas ≈ ${fmt(usable, 0)} L (ideal-gas approximation)`, `÷ ${fmt(i.flowLMin, 2)} = ${fmt(min, 2)} min`],
      extras: [{ label: 'Hours and minutes', value: `${Math.floor(min / 60)} hr ${Math.floor(min % 60)} min` }],
      rounding: 'Rounded DOWN to the whole minute.',
      notes: [note('warning', 'Approximation; many cylinders state their gas content directly on the label — use that when available.')],
    });
  });
}

// ---------------- Nutrition ----------------
export function macroCalories(i: { carbG: number; proteinG: number; fatG: number }): CalcResult {
  return attempt(() => {
    new Check().nonNegative('carb', 'Carbohydrate', i.carbG).nonNegative('protein', 'Protein', i.proteinG).nonNegative('fat', 'Fat', i.fatG).done();
    const c = i.carbG * 4, p = i.proteinG * 4, f = i.fatG * 9;
    const v = c + p + f;
    return ok({
      value: v, unit: 'kcal', display: fmt(v, 0),
      formula: 'kcal = carbohydrate g × 4 + protein g × 4 + fat g × 9',
      substitution: `${fmt(i.carbG, 1)}×4 + ${fmt(i.proteinG, 1)}×4 + ${fmt(i.fatG, 1)}×9`,
      steps: [`Carbohydrate ${fmt(c, 1)} kcal`, `Protein ${fmt(p, 1)} kcal`, `Fat ${fmt(f, 1)} kcal`, `Total ${fmt(v, 1)} kcal`],
      extras: v > 0 ? [{ label: '% from carbohydrate', value: `${fmt((c / v) * 100, 0)} %` }, { label: '% from protein', value: `${fmt((p / v) * 100, 0)} %` }, { label: '% from fat', value: `${fmt((f / v) * 100, 0)} %` }] : [],
      rounding: 'Whole kcal.', notes: [note('info', 'Atwater general factors. Alcohol (7 kcal/g) and fibre are not included.')],
    });
  });
}

export function enteralRate(i: { volumeMl: number; hours: number }): CalcResult {
  return attempt(() => {
    new Check().positive('volume', 'Prescribed feed volume', i.volumeMl).positive('hours', 'Feeding hours', i.hours).rule(i.hours <= 24, 'Feeding hours cannot exceed 24 per day.', 'hours').done();
    const v = i.volumeMl / i.hours;
    return ok({ value: v, unit: 'mL/hr', display: fmt(v, 1), formula: 'Rate = Prescribed volume ÷ Feeding hours', substitution: `${fmt(i.volumeMl, 0)} ÷ ${fmt(i.hours, 2)}`, steps: [`${fmt(i.volumeMl, 0)} ÷ ${fmt(i.hours, 2)} = ${fmt(v, 3)} mL/hr`], rounding: 'Displayed to 1 dp; set the pump per its precision.', notes: [note('info', 'Feed regimen, volume and progression come from the dietitian/prescriber.')] });
  });
}

export function percentOfTarget(i: { actual: number; target: number; unitLabel: string }): CalcResult {
  return attempt(() => {
    new Check().nonNegative('actual', 'Actual intake', i.actual).positive('target', 'Prescribed target', i.target).done();
    const v = (i.actual / i.target) * 100;
    return ok({ value: v, unit: '%', display: fmt(v, 0), formula: '% achieved = Actual ÷ Target × 100', substitution: `${fmt(i.actual, 1)} ÷ ${fmt(i.target, 1)} × 100`, steps: [`${fmt(i.actual, 1)} ${i.unitLabel} ÷ ${fmt(i.target, 1)} ${i.unitLabel} × 100 = ${fmt(v, 2)} %`], extras: [{ label: 'Shortfall', value: `${fmt(Math.max(i.target - i.actual, 0), 1)} ${i.unitLabel}` }], rounding: 'Whole percent.', notes: [] });
  });
}

export function proteinPerKg(i: { proteinG: number; weightKg: number }): CalcResult {
  return attempt(() => {
    new Check().nonNegative('protein', 'Protein intake', i.proteinG).positive('weight', 'Weight', i.weightKg).done();
    const v = i.proteinG / i.weightKg;
    return ok({ value: v, unit: 'g/kg/day', display: fmt(v, 2), formula: 'Protein (g/kg) = Protein (g/day) ÷ Weight (kg)', substitution: `${fmt(i.proteinG, 1)} ÷ ${fmt(i.weightKg, 2)}`, steps: [`= ${fmt(v, 3)} g/kg/day`], rounding: '2 dp.', notes: [note('info', 'Compare with the target set by the dietitian; this tool does not set requirements.')] });
  });
}

// ---------------- Renal ----------------
export function cockcroftGault(i: { age: number; weightKg: number; scrMgDl: number; sex: 'male' | 'female'; weightLabel: string }): CalcResult {
  return attempt(() => {
    new Check().range('age', 'Age (years)', i.age, 18, 120).positive('weight', 'Weight', i.weightKg).positive('scr', 'Serum creatinine', i.scrMgDl).done();
    const base = ((140 - i.age) * i.weightKg) / (72 * i.scrMgDl);
    const v = i.sex === 'female' ? base * 0.85 : base;
    const steps = [`(140 − ${fmt(i.age, 0)}) × ${fmt(i.weightKg, 2)} = ${fmt((140 - i.age) * i.weightKg, 2)}`, `72 × ${fmt(i.scrMgDl, 3)} = ${fmt(72 * i.scrMgDl, 3)}`, `${fmt((140 - i.age) * i.weightKg, 2)} ÷ ${fmt(72 * i.scrMgDl, 3)} = ${fmt(base, 3)} mL/min`];
    if (i.sex === 'female') steps.push(`× 0.85 (female adjustment) = ${fmt(v, 3)} mL/min`);
    return ok({
      value: v, unit: 'mL/min', display: fmt(v, 0),
      formula: 'CrCl = [(140 − age) × weight (kg)] ÷ [72 × SCr (mg/dL)]  × 0.85 if female',
      substitution: `[(140 − ${fmt(i.age, 0)}) × ${fmt(i.weightKg, 1)}] ÷ [72 × ${fmt(i.scrMgDl, 2)}]${i.sex === 'female' ? ' × 0.85' : ''}`,
      steps, extras: [{ label: 'Weight used', value: `${fmt(i.weightKg, 1)} kg (${i.weightLabel})` }, { label: 'SCr used', value: `${fmt(i.scrMgDl, 3)} mg/dL` }],
      interpretation: 'Estimated creatinine clearance (Cockcroft–Gault, 1976) — not eGFR',
      rounding: 'Whole mL/min (not normalised to BSA).',
      notes: [
        note('warning', 'Unreliable when creatinine is changing (acute kidney injury), in pregnancy, at extremes of body size or muscle mass, and in amputees. This is not eGFR (mL/min/1.73 m²) reported by laboratories.'),
        note('info', 'Which weight to use (actual, ideal, adjusted) depends on the drug reference. This tool does not adjust any medication dose.'),
      ],
    });
  });
}

// ---------------- Laboratory ----------------
export function glucoseConvert(i: { value: number; from: 'glu_mgdl' | 'glu_mmol' }): CalcResult {
  return attempt(() => {
    new Check().positive('glucose', 'Glucose', i.value).done();
    const to = i.from === 'glu_mgdl' ? 'glu_mmol' : 'glu_mgdl';
    const v = convert(i.value, i.from, to);
    const toLabel = to === 'glu_mmol' ? 'mmol/L' : 'mg/dL';
    return ok({
      value: v, unit: toLabel, display: fmt(v, to === 'glu_mmol' ? 1 : 0),
      formula: 'mmol/L = mg/dL ÷ 18.016 (glucose molar mass 180.16 g/mol)',
      substitution: i.from === 'glu_mgdl' ? `${fmt(i.value, 1)} ÷ 18.016` : `${fmt(i.value, 2)} × 18.016`,
      steps: [`= ${fmt(v, 3)} ${toLabel}`], rounding: to === 'glu_mmol' ? '1 decimal place (mmol/L).' : 'Whole mg/dL.',
      notes: [note('info', 'Many references round the factor to 18. This tool does not calculate insulin or correction doses.')],
    });
  });
}

export function creatinineConvert(i: { value: number; from: 'cr_mgdl' | 'cr_umol' }): CalcResult {
  return attempt(() => {
    new Check().positive('creatinine', 'Creatinine', i.value).done();
    const to = i.from === 'cr_mgdl' ? 'cr_umol' : 'cr_mgdl';
    const v = convert(i.value, i.from, to);
    const lbl = to === 'cr_umol' ? 'µmol/L' : 'mg/dL';
    return ok({ value: v, unit: lbl, display: fmt(v, to === 'cr_umol' ? 0 : 2), formula: '1 mg/dL creatinine = 88.42 µmol/L', substitution: i.from === 'cr_mgdl' ? `${fmt(i.value, 3)} × 88.42` : `${fmt(i.value, 1)} ÷ 88.42`, steps: [`= ${fmt(v, 4)} ${lbl}`], rounding: to === 'cr_umol' ? 'Whole µmol/L.' : '2 dp.', notes: [] });
  });
}

export function doseToVolume(i: { dose: number; concentration: number; doseUnit: string }): CalcResult {
  return attempt(() => {
    new Check().positive('dose', 'Prescribed dose', i.dose).positive('conc', 'Concentration (required)', i.concentration).done();
    const v = quantityForDose(i.dose, i.concentration, 1);
    return ok({ value: v, unit: 'mL', display: fmt(v, 2), formula: 'Volume (mL) = Dose ÷ Concentration (per mL)', substitution: `${fmt(i.dose, 4)} ${i.doseUnit} ÷ ${fmt(i.concentration, 4)} ${i.doseUnit}/mL`, steps: [`= ${fmt(v, 5)} mL`], rounding: '2 dp; measure to device precision.', notes: [note('critical', 'Concentrated electrolytes (e.g. potassium) are high-alert: use premixed products where available, confirm dilution and rate limits with protocol, and never give undiluted concentrated potassium by IV push. This tool never infers a replacement dose from a lab value.')] });
  });
}

// ---------------- Transfusion & blood loss ----------------
export const BLOOD_VOLUME_ML_PER_KG: Record<string, number> = {
  'Adult male (~70 mL/kg)': 70, 'Adult female (~65 mL/kg)': 65, 'Infant (~80 mL/kg)': 80, 'Term neonate (~85 mL/kg)': 85, 'Preterm neonate (~95 mL/kg)': 95,
};

export function bloodLossPercent(i: { lossMl: number; weightKg: number; mlPerKg: number }): CalcResult {
  return attempt(() => {
    new Check().nonNegative('loss', 'Cumulative estimated blood loss', i.lossMl).positive('weight', 'Weight', i.weightKg).positive('mlPerKg', 'Blood volume estimate (mL/kg)', i.mlPerKg).done();
    const ebv = i.weightKg * i.mlPerKg;
    const v = (i.lossMl / ebv) * 100;
    return ok({
      value: v, unit: '% of EBV', display: fmt(v, 1), formula: '% lost = EBL ÷ (Weight × mL/kg) × 100',
      substitution: `${fmt(i.lossMl, 0)} ÷ (${fmt(i.weightKg, 2)} × ${fmt(i.mlPerKg, 0)}) × 100`,
      steps: [`Estimated blood volume = ${fmt(ebv, 0)} mL`, `${fmt(i.lossMl, 0)} ÷ ${fmt(ebv, 0)} × 100 = ${fmt(v, 2)} %`],
      extras: [{ label: 'Estimated blood volume', value: `${fmt(ebv, 0)} mL` }],
      rounding: '1 dp.', notes: [note('warning', 'Blood-volume figures are approximate population estimates, and visual EBL is often inaccurate — weigh or measure where possible. Escalate per haemorrhage protocol based on the patient, not this number.')],
    });
  });
}

export function transfusionRate(i: { volumeMl: number; minutes: number; dropFactor?: number }): CalcResult {
  return attempt(() => {
    new Check().positive('volume', 'Unit volume', i.volumeMl).positive('time', 'Prescribed duration', i.minutes).done();
    const mlh = (i.volumeMl / i.minutes) * 60;
    const extras = [{ label: 'Duration', value: `${Math.floor(i.minutes / 60)} hr ${Math.round(i.minutes % 60)} min` }];
    if (i.dropFactor !== undefined && !Number.isNaN(i.dropFactor)) {
      const d = dripRate({ volumeMl: i.volumeMl, timeMin: i.minutes, dropFactor: i.dropFactor });
      if (d.ok) extras.push({ label: `Gravity rate (${i.dropFactor} gtt/mL set)`, value: `${d.display} gtt/min (exact ${fmt(d.value, 2)})` });
    }
    return ok({
      value: mlh, unit: 'mL/hr', display: fmt(mlh, 0), formula: 'mL/hr = Volume ÷ Time (min) × 60', substitution: `${fmt(i.volumeMl, 0)} ÷ ${fmt(i.minutes, 0)} × 60`,
      steps: [`= ${fmt(mlh, 3)} mL/hr`], extras, rounding: 'Whole mL/hr.',
      notes: [note('critical', 'The rate must remain within the authorised prescription, the product-specific instructions and institutional protocol (including maximum time from issue). Compatibility checks and transfusion authorisation are never automated by this app.')],
    });
  });
}

// ---------------- Obstetrics ----------------
const DAY = 86_400_000;
function parseDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCMonth() === Number(m[2]) - 1 ? d : null;
}
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function naegele(i: { lmp: string; today: string; cycleDays?: number }): CalcResult {
  return attempt(() => {
    const lmp = parseDate(i.lmp);
    const today = parseDate(i.today);
    const cycle = i.cycleDays ?? 28;
    new Check().rule(!!lmp, 'Enter a valid first day of the last menstrual period (LMP).', 'lmp').rule(!!today, 'Enter a valid assessment date.', 'today').range('cycle', 'Cycle length', cycle, 20, 45).done();
    new Check().rule((today as Date).getTime() >= (lmp as Date).getTime(), 'Assessment date cannot be before the LMP.', 'today')
      .rule(((today as Date).getTime() - (lmp as Date).getTime()) / DAY <= 315, 'More than 45 weeks after the LMP — check the dates.', 'lmp').done();
    const adj = cycle - 28;
    const edd = new Date((lmp as Date).getTime() + (280 + adj) * DAY);
    const gaDays = Math.round(((today as Date).getTime() - (lmp as Date).getTime()) / DAY) - adj;
    return ok({
      value: gaDays, unit: 'days', display: iso(edd), displayUnit: 'EDD',
      formula: 'EDD = LMP + 280 days (Naegele: LMP + 1 year − 3 months + 7 days), adjusted for cycle length',
      substitution: `${i.lmp} + ${280 + adj} days`,
      steps: [`EDD = ${iso(edd)}`, `Gestational age on ${i.today} = ${Math.floor(gaDays / 7)} weeks ${gaDays % 7} days`],
      extras: [{ label: 'Gestational age', value: gaDays >= 0 ? `${Math.floor(gaDays / 7)}w ${gaDays % 7}d` : 'Before conception estimate' }, { label: 'Cycle adjustment', value: `${adj >= 0 ? '+' : ''}${adj} days` }],
      interpretation: `Estimated due date ${iso(edd)}`,
      rounding: 'Whole days.',
      notes: [note('info', 'LMP dating assumes regular cycles and ovulation around day 14; first-trimester ultrasound dating is generally preferred when available. Only ~5 % of births occur on the EDD.')],
    });
  });
}

export function newbornWeightLoss(i: { birthG: number; currentG: number }): CalcResult {
  return attempt(() => {
    new Check().positive('birth', 'Birth weight', i.birthG).positive('current', 'Current weight', i.currentG).done();
    const v = ((i.birthG - i.currentG) / i.birthG) * 100;
    return ok({
      value: v, unit: '%', display: fmt(v, 1), formula: '% loss = (Birth weight − Current) ÷ Birth weight × 100', substitution: `(${fmt(i.birthG, 0)} − ${fmt(i.currentG, 0)}) ÷ ${fmt(i.birthG, 0)} × 100`,
      steps: [`Loss = ${fmt(i.birthG - i.currentG, 0)} g`, `÷ ${fmt(i.birthG, 0)} × 100 = ${fmt(v, 2)} %`],
      interpretation: v < 0 ? `Above birth weight by ${fmt(-v, 1)} %` : `${fmt(v, 1)} % below birth weight`,
      rounding: '1 dp.', notes: compact([plausibility('Birth weight', i.birthG, 400, 6000, 'g'), note('info', 'Compare with your unit’s feeding/weight-loss guideline and age in hours; refer to the midwife/paediatric team per protocol.')]),
    });
  });
}

/** Contractions from start times (HH:MM:SS or HH:MM) and durations (s). */
export function contractions(i: { startTimes: string[]; durationsSec: number[] }): CalcResult {
  return attempt(() => {
    const secs = i.startTimes.map((t) => {
      const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(t.trim());
      return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3] ?? 0) : NaN;
    });
    new Check().rule(secs.length >= 2, 'Enter at least two contraction start times.').rule(secs.every((s) => Number.isFinite(s)), 'Times must be HH:MM or HH:MM:SS.').done();
    // handle crossing midnight
    const fixed = secs.reduce<number[]>((acc, s) => { const prev = acc[acc.length - 1]; let v = s; while (prev !== undefined && v < prev) v += 86400; acc.push(v); return acc; }, []);
    const gaps = fixed.slice(1).map((s, k) => s - (fixed[k] as number));
    const meanGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const validDur = i.durationsSec.filter((d) => Number.isFinite(d) && d > 0);
    const meanDur = validDur.length ? validDur.reduce((a, b) => a + b, 0) / validDur.length : NaN;
    const span = (fixed[fixed.length - 1] as number) - (fixed[0] as number);
    const per10 = span > 0 ? (gaps.length / span) * 600 : NaN;
    return ok({
      value: meanGap / 60, unit: 'min (start to start)', display: fmt(meanGap / 60, 1),
      formula: 'Frequency = time from the start of one contraction to the start of the next',
      substitution: gaps.map((g) => `${fmt(g / 60, 1)}`).join(', ') + ' min',
      steps: gaps.map((g, k) => `Interval ${k + 1}: ${fmt(g / 60, 2)} min`),
      extras: compact([
        { label: 'Contractions per 10 min (observed span)', value: Number.isFinite(per10) ? fmt(per10, 1) : '—' },
        Number.isFinite(meanDur) ? { label: 'Mean duration', value: `${fmt(meanDur, 0)} s` } : null,
      ]),
      rounding: '1 dp.', notes: [note('info', 'Record, report and interpret per obstetric guideline (e.g. over a 10-minute window). This app does not diagnose labour or its complications.')],
    });
  });
}

// ---------------- Wound ----------------
export function woundMeasure(i: { lengthCm: number; widthCm: number; depthCm?: number; prevAreaCm2?: number }): CalcResult {
  return attempt(() => {
    const c = new Check().positive('length', 'Length (head-to-toe)', i.lengthCm).positive('width', 'Width (side-to-side)', i.widthCm);
    if (i.depthCm !== undefined && !Number.isNaN(i.depthCm)) c.nonNegative('depth', 'Depth', i.depthCm);
    if (i.prevAreaCm2 !== undefined && !Number.isNaN(i.prevAreaCm2)) c.positive('prev', 'Previous area', i.prevAreaCm2);
    c.done();
    const area = i.lengthCm * i.widthCm;
    const extras = [];
    const steps = [`Area = ${fmt(i.lengthCm, 2)} × ${fmt(i.widthCm, 2)} = ${fmt(area, 3)} cm²`];
    if (i.depthCm !== undefined && !Number.isNaN(i.depthCm)) {
      const vol = area * i.depthCm;
      steps.push(`Volume ≈ ${fmt(area, 3)} × ${fmt(i.depthCm, 2)} = ${fmt(vol, 3)} cm³`);
      extras.push({ label: 'Approximate volume (L × W × D)', value: `${fmt(vol, 2)} cm³` });
    }
    if (i.prevAreaCm2 && !Number.isNaN(i.prevAreaCm2)) {
      const pct = ((area - i.prevAreaCm2) / i.prevAreaCm2) * 100;
      steps.push(`Change = (${fmt(area, 2)} − ${fmt(i.prevAreaCm2, 2)}) ÷ ${fmt(i.prevAreaCm2, 2)} × 100 = ${fmt(pct, 2)} %`);
      extras.push({ label: 'Area change since previous', value: `${pct > 0 ? '+' : ''}${fmt(pct, 1)} % (${pct < 0 ? 'smaller' : pct > 0 ? 'larger' : 'unchanged'})` });
    }
    return ok({
      value: area, unit: 'cm²', display: fmt(area, 2), formula: 'Area ≈ Length × Width (rectangular approximation)', substitution: `${fmt(i.lengthCm, 2)} × ${fmt(i.widthCm, 2)}`,
      steps, extras, rounding: '2 dp.',
      notes: [note('info', 'Length × width over-estimates irregular wounds (an ellipse is about 0.785 × L × W). Measure the same way each time. Numbers alone do not determine infection, stage or severity.')],
    });
  });
}

export function oxygenConsumption(i: { flowLMin: number; minutes: number }): CalcResult {
  return attempt(() => {
    new Check().positive('flow', 'Flow rate (L/min)', i.flowLMin).positive('time', 'Duration', i.minutes).done();
    const v = i.flowLMin * i.minutes;
    return ok({
      value: v, unit: 'L', display: fmt(v, 0),
      formula: 'Oxygen used (L) = Flow (L/min) × Time (min)', substitution: `${fmt(i.flowLMin, 2)} × ${fmt(i.minutes, 1)}`,
      steps: [`${fmt(i.flowLMin, 2)} L/min × ${fmt(i.minutes, 1)} min = ${fmt(v, 2)} L`],
      extras: [{ label: 'Per hour at this flow', value: `${fmt(i.flowLMin * 60, 0)} L/hr` }],
      rounding: 'Whole litres.',
      notes: [note('info', 'Use this to check a cylinder will last a planned transfer, then add a safety margin per policy. Flow setting does not give a precise FiO₂.')],
    });
  });
}
