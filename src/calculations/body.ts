import { Check, attempt, compact, fmt, note, ok, plausibility, type CalcResult } from './core';

export function bmiCategory(bmi: number): string {
  if (bmi < 18.5) return 'Underweight (WHO adult)';
  if (bmi < 25) return 'Normal range (WHO adult)';
  if (bmi < 30) return 'Pre-obesity / overweight (WHO adult)';
  if (bmi < 35) return 'Obesity class I (WHO adult)';
  if (bmi < 40) return 'Obesity class II (WHO adult)';
  return 'Obesity class III (WHO adult)';
}

export function bmi(i: { weightKg: number; heightM: number; adult: boolean }): CalcResult {
  return attempt(() => {
    new Check().positive('weight', 'Weight', i.weightKg).positive('height', 'Height', i.heightM).done();
    const v = i.weightKg / (i.heightM * i.heightM);
    return ok({
      value: v, unit: 'kg/m²', display: fmt(v, 1),
      formula: 'BMI = Weight (kg) ÷ Height (m)²',
      substitution: `${fmt(i.weightKg, 2)} ÷ (${fmt(i.heightM, 3)})²`,
      steps: [`Height² = ${fmt(i.heightM, 3)} × ${fmt(i.heightM, 3)} = ${fmt(i.heightM * i.heightM, 4)} m²`, `${fmt(i.weightKg, 2)} ÷ ${fmt(i.heightM * i.heightM, 4)} = ${fmt(v, 4)} kg/m²`],
      interpretation: i.adult ? bmiCategory(v) : 'Adult categories not applied (under 18) — use age- and sex-specific growth charts',
      rounding: 'Displayed to 1 decimal place; category uses the unrounded value.',
      notes: compact([
        plausibility('Height', i.heightM, 0.45, 2.3, 'm'),
        plausibility('Weight', i.weightKg, 2, 300, 'kg'),
        note('info', 'BMI does not distinguish fat from muscle, and cut-offs vary by population (e.g. lower thresholds are used for some Asian populations). It is a screening measure, not a diagnosis.'),
        note('info', 'Do not use BMI or other calculated body measures to select medication doses unless the prescription specifies it.'),
      ]),
    });
  });
}

export function bsaMosteller(i: { weightKg: number; heightCm: number }): CalcResult {
  return attempt(() => {
    new Check().positive('weight', 'Weight', i.weightKg).positive('height', 'Height', i.heightCm).done();
    const v = Math.sqrt((i.heightCm * i.weightKg) / 3600);
    return ok({
      value: v, unit: 'm²', display: fmt(v, 2),
      formula: 'BSA (Mosteller) = √[Height (cm) × Weight (kg) ÷ 3600]',
      substitution: `√(${fmt(i.heightCm, 1)} × ${fmt(i.weightKg, 2)} ÷ 3600)`,
      steps: [`${fmt(i.heightCm, 1)} × ${fmt(i.weightKg, 2)} = ${fmt(i.heightCm * i.weightKg, 2)}`, `÷ 3600 = ${fmt((i.heightCm * i.weightKg) / 3600, 5)}`, `√ = ${fmt(v, 4)} m²`],
      rounding: 'Displayed to 2 decimal places.',
      notes: compact([plausibility('Height', i.heightCm, 45, 230, 'cm'), plausibility('Weight', i.weightKg, 2, 300, 'kg')]),
    });
  });
}

/** Devine (1974) ideal body weight. Validated for adults ≥ 152.4 cm (60 in). */
export function idealBodyWeight(i: { heightCm: number; sex: 'male' | 'female'; actualKg?: number }): CalcResult {
  return attempt(() => {
    new Check().positive('height', 'Height', i.heightCm).rule(i.heightCm >= 152.4, 'Devine formula applies only to adults 152.4 cm (5 ft) or taller.', 'height').done();
    const inches = i.heightCm / 2.54;
    const base = i.sex === 'male' ? 50 : 45.5;
    const v = base + 2.3 * (inches - 60);
    const extras = [{ label: 'Height in inches', value: fmt(inches, 2) }];
    const steps = [`${fmt(i.heightCm, 1)} cm ÷ 2.54 = ${fmt(inches, 3)} in`, `${base} + 2.3 × (${fmt(inches, 3)} − 60) = ${fmt(v, 3)} kg`];
    if (i.actualKg !== undefined && !Number.isNaN(i.actualKg)) {
      new Check().positive('actual', 'Actual weight', i.actualKg).done();
      const adj = v + 0.4 * (i.actualKg - v);
      extras.push({ label: 'Adjusted body weight (IBW + 0.4 × (ABW − IBW))', value: `${fmt(adj, 1)} kg` });
      extras.push({ label: 'Actual as % of IBW', value: `${fmt((i.actualKg / v) * 100, 0)} %` });
      steps.push(`AdjBW = ${fmt(v, 2)} + 0.4 × (${fmt(i.actualKg, 2)} − ${fmt(v, 2)}) = ${fmt(adj, 3)} kg`);
    }
    return ok({
      value: v, unit: 'kg', display: fmt(v, 1),
      formula: `IBW (Devine) = ${base} kg + 2.3 kg per inch over 60 in`,
      substitution: `${base} + 2.3 × (${fmt(inches, 2)} − 60)`, steps, extras,
      rounding: 'Displayed to 1 decimal place.',
      notes: [note('info', 'Devine IBW and the 0.4 adjusted-weight factor are conventions used in some drug-dosing references; use the weight specified by the prescription or drug reference.')],
    });
  });
}

export function weightChange(i: { previousKg: number; currentKg: number }): CalcResult {
  return attempt(() => {
    new Check().positive('previous', 'Previous (reference) weight', i.previousKg).positive('current', 'Current weight', i.currentKg).done();
    const diff = i.currentKg - i.previousKg;
    const pct = (diff / i.previousKg) * 100;
    return ok({
      value: pct, unit: '%', display: `${pct > 0 ? '+' : ''}${fmt(pct, 1)}`,
      formula: '% change = (Current − Previous) ÷ Previous × 100',
      substitution: `(${fmt(i.currentKg, 3)} − ${fmt(i.previousKg, 3)}) ÷ ${fmt(i.previousKg, 3)} × 100`,
      steps: [`Difference = ${fmt(diff, 3)} kg`, `${fmt(diff, 3)} ÷ ${fmt(i.previousKg, 3)} × 100 = ${fmt(pct, 3)} %`],
      interpretation: pct < 0 ? `Weight loss of ${fmt(-pct, 1)} %` : pct > 0 ? `Weight gain of ${fmt(pct, 1)} %` : 'No change',
      extras: [{ label: 'Absolute change', value: `${diff > 0 ? '+' : ''}${fmt(diff, 3)} kg` }],
      rounding: 'Displayed to 1 decimal place.',
      notes: [note('info', 'Interpret alongside the time period, hydration status and clinical context.')],
    });
  });
}

export function waistToHeight(i: { waistCm: number; heightCm: number }): CalcResult {
  return attempt(() => {
    new Check().positive('waist', 'Waist circumference', i.waistCm).positive('height', 'Height', i.heightCm).done();
    const v = i.waistCm / i.heightCm;
    return ok({
      value: v, unit: 'ratio', display: fmt(v, 2),
      formula: 'WHtR = Waist (cm) ÷ Height (cm)', substitution: `${fmt(i.waistCm, 1)} ÷ ${fmt(i.heightCm, 1)}`,
      steps: [`${fmt(i.waistCm, 1)} ÷ ${fmt(i.heightCm, 1)} = ${fmt(v, 4)}`],
      interpretation: v >= 0.5 ? 'At or above 0.5 — a commonly used adult screening threshold for central adiposity' : 'Below 0.5 (common adult screening threshold)',
      rounding: 'Displayed to 2 decimal places.',
      notes: [note('info', 'Screening measure only; thresholds vary by guideline and population.')],
    });
  });
}
