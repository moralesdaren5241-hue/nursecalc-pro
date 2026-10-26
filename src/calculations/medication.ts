import { Check, attempt, compact, fmt, note, ok, plausibility, roundTo, type CalcResult } from './core';

export const VERIFY = note('info', 'Verify against the prescription, the product label and your facility policy. Arithmetic does not confirm that a dose is appropriate for the patient.');
export const HIGH_ALERT = note('critical', 'HIGH-ALERT MEDICATION: perform an independent double-check of the order, concentration, units and pump programming before administration.');

const weightNote = (kg: number) => plausibility('Weight', kg, 0.4, 250, 'kg');

/** The one shared dose→quantity expression: (D ÷ H) × Q. Every volume-for-dose calculation uses it. */
export function quantityForDose(desired: number, have: number, quantity: number): number {
  return (desired / have) * quantity;
}

// ---------- 8.1 / 8.2 / 8.3 Basic dose: (D / H) × Q ----------
export interface BasicDoseIn {
  desired: number; // in doseUnit
  available: number; // in doseUnit (same unit as desired — converted by caller)
  quantity: number; // amount of the form that contains `available`
  doseUnit: string;
  quantityUnit: string; // 'tablet(s)', 'capsule(s)', 'mL'
}

export function basicDose(i: BasicDoseIn): CalcResult {
  return attempt(() => {
    new Check()
      .positive('desired', 'Desired (ordered) dose', i.desired)
      .positive('available', 'Available dose (strength on hand)', i.available)
      .positive('quantity', 'Available quantity', i.quantity)
      .done();
    const value = quantityForDose(i.desired, i.available, i.quantity);
    const solid = /tablet|capsule/i.test(i.quantityUnit);
    const dp = solid ? 2 : 2;
    const notes = [VERIFY];
    if (solid) {
      const isHalfStep = Math.abs(value * 2 - Math.round(value * 2)) < 1e-9;
      if (!isHalfStep) notes.unshift(note('warning', 'Result is not a whole or half unit. Check the order and strength, and confirm whether this product may be split before administering.'));
      if (value > 4) notes.unshift(note('warning', `${fmt(value)} ${i.quantityUnit} is an unusually large number of solid units — re-check the strength on hand.`));
    }
    return ok({
      value, unit: i.quantityUnit, display: fmt(value, dp),
      formula: 'Amount = (Desired ÷ Have) × Quantity',
      substitution: `(${fmt(i.desired, 4)} ${i.doseUnit} ÷ ${fmt(i.available, 4)} ${i.doseUnit}) × ${fmt(i.quantity, 4)} ${i.quantityUnit}`,
      steps: [
        `Units check: desired and available are both in ${i.doseUnit}, so they cancel.`,
        `${fmt(i.desired, 4)} ÷ ${fmt(i.available, 4)} = ${fmt(i.desired / i.available, 6)}`,
        `${fmt(i.desired / i.available, 6)} × ${fmt(i.quantity, 4)} = ${fmt(value, 6)} ${i.quantityUnit}`,
      ],
      rounding: `Displayed to ${dp} decimal places; no intermediate rounding. Measure to the precision of your device.`,
      notes,
    });
  });
}

// ---------- 8.4 Weight-based ----------
export type DoseBasis = 'perDose' | 'perDay';

export interface WeightDoseIn {
  weightKg: number;
  dosePerKg: number;
  doseUnit: string; // mg, mcg, U
  basis: DoseBasis;
  /** Required for per-day orders — never assumed. */
  dosesPerDay?: number;
}

export function weightBasedDose(i: WeightDoseIn): CalcResult {
  return attempt(() => {
    const c = new Check().positive('weight', 'Weight', i.weightKg).positive('dosePerKg', 'Dose per kg', i.dosePerKg);
    if (i.basis === 'perDay') {
      c.positive('dosesPerDay', 'Number of prescribed doses per day', i.dosesPerDay).integer('dosesPerDay', 'Number of doses per day', i.dosesPerDay);
    }
    c.done();
    const basisText = i.basis === 'perDose' ? `${i.doseUnit}/kg/dose` : `${i.doseUnit}/kg/day`;
    const total = i.weightKg * i.dosePerKg;
    const extras = [];
    let value: number;
    const steps = [`${fmt(i.weightKg, 3)} kg × ${fmt(i.dosePerKg, 4)} ${basisText} = ${fmt(total, 4)} ${i.doseUnit} ${i.basis === 'perDose' ? 'per dose' : 'per day'}`];
    if (i.basis === 'perDay') {
      value = total / (i.dosesPerDay as number);
      steps.push(`${fmt(total, 4)} ${i.doseUnit}/day ÷ ${i.dosesPerDay} doses = ${fmt(value, 4)} ${i.doseUnit} per dose`);
      extras.push({ label: 'Total daily dose', value: `${fmt(total, 3)} ${i.doseUnit}/day` });
    } else {
      value = total;
      if (i.dosesPerDay) {
        extras.push({ label: 'Total daily dose (at the frequency entered)', value: `${fmt(total * i.dosesPerDay, 3)} ${i.doseUnit}/day` });
        steps.push(`${fmt(total, 4)} × ${i.dosesPerDay} doses/day = ${fmt(total * i.dosesPerDay, 4)} ${i.doseUnit}/day`);
      }
    }
    extras.unshift({ label: 'Order basis', value: basisText });
    return ok({
      value, unit: `${i.doseUnit} per dose`, display: fmt(value, 3),
      formula: i.basis === 'perDose' ? 'Dose = Weight (kg) × dose/kg/dose' : 'Dose = (Weight (kg) × dose/kg/day) ÷ doses per day',
      substitution: i.basis === 'perDose' ? `${fmt(i.weightKg, 3)} × ${fmt(i.dosePerKg, 4)}` : `(${fmt(i.weightKg, 3)} × ${fmt(i.dosePerKg, 4)}) ÷ ${i.dosesPerDay}`,
      steps, extras,
      rounding: 'Displayed to 3 decimal places; no intermediate rounding.',
      notes: compact([weightNote(i.weightKg), note('warning', 'No maximum dose is checked here. Compare against a verified drug reference — weight-based results can exceed adult maximums.'), VERIFY]),
    });
  });
}

// ---------- mg/m² ----------
export function bsaDose(i: { bsa: number; dosePerM2: number; doseUnit: string }): CalcResult {
  return attempt(() => {
    new Check().positive('bsa', 'Body surface area', i.bsa).positive('dosePerM2', 'Dose per m²', i.dosePerM2).done();
    const value = i.bsa * i.dosePerM2;
    return ok({
      value, unit: i.doseUnit, display: fmt(value, 3),
      formula: 'Dose = BSA (m²) × dose/m²',
      substitution: `${fmt(i.bsa, 3)} m² × ${fmt(i.dosePerM2, 4)} ${i.doseUnit}/m²`,
      steps: [`${fmt(i.bsa, 3)} × ${fmt(i.dosePerM2, 4)} = ${fmt(value, 4)} ${i.doseUnit}`],
      rounding: 'Displayed to 3 decimal places.',
      notes: compact([plausibility('BSA', i.bsa, 0.1, 3, 'm²'), note('warning', 'Use only when the order is explicitly written per m². Many BSA-dosed drugs are high-alert; follow protocol caps and independent checks.'), VERIFY]),
    });
  });
}

// ---------- 8.5 Safe dose range checker ----------
export interface RangeIn {
  weightKg: number;
  minPerKg?: number;
  maxPerKg?: number;
  basis: DoseBasis;
  orderedDose: number; // per administration
  dosesPerDay?: number;
  doseUnit: string;
}

export function doseRangeCheck(i: RangeIn): CalcResult {
  return attempt(() => {
    const c = new Check().positive('weight', 'Weight', i.weightKg).positive('orderedDose', 'Ordered dose', i.orderedDose);
    const hasMin = i.minPerKg !== undefined && !Number.isNaN(i.minPerKg);
    const hasMax = i.maxPerKg !== undefined && !Number.isNaN(i.maxPerKg);
    if (hasMin) c.nonNegative('minPerKg', 'Reference minimum', i.minPerKg);
    if (hasMax) c.positive('maxPerKg', 'Reference maximum', i.maxPerKg);
    if (hasMin && hasMax) c.rule((i.minPerKg as number) <= (i.maxPerKg as number), 'Reference minimum must not be greater than the maximum. Check the reference range.', 'maxPerKg');
    if (i.basis === 'perDay') c.positive('dosesPerDay', 'Doses per day (dosing interval)', i.dosesPerDay).integer('dosesPerDay', 'Doses per day', i.dosesPerDay);
    c.done();

    const orderedCompared = i.basis === 'perDay' ? i.orderedDose * (i.dosesPerDay as number) : i.orderedDose;
    const unitTxt = i.basis === 'perDay' ? `${i.doseUnit}/day` : `${i.doseUnit}/dose`;
    const steps: string[] = [];
    if (i.basis === 'perDay') steps.push(`Ordered daily total = ${fmt(i.orderedDose, 4)} ${i.doseUnit} × ${i.dosesPerDay} = ${fmt(orderedCompared, 4)} ${i.doseUnit}/day`);
    const extras = [{ label: 'Ordered amount compared', value: `${fmt(orderedCompared, 3)} ${unitTxt}` }];

    if (!hasMin && !hasMax) {
      return ok({
        value: orderedCompared, unit: unitTxt, display: fmt(orderedCompared, 3),
        formula: 'Range = Weight × reference dose/kg',
        substitution: 'No reference range entered',
        steps, extras,
        rounding: 'Displayed to 3 decimal places.',
        interpretation: 'Reference range not provided',
        notes: [note('warning', 'Reference range not provided. Enter the min/max from a verified drug reference to compare. No conclusion can be drawn about this dose.'), VERIFY],
      });
    }
    const lo = hasMin ? i.weightKg * (i.minPerKg as number) : undefined;
    const hi = hasMax ? i.weightKg * (i.maxPerKg as number) : undefined;
    if (lo !== undefined) steps.push(`Minimum = ${fmt(i.weightKg, 3)} kg × ${fmt(i.minPerKg as number, 4)} = ${fmt(lo, 4)} ${unitTxt}`);
    if (hi !== undefined) steps.push(`Maximum = ${fmt(i.weightKg, 3)} kg × ${fmt(i.maxPerKg as number, 4)} = ${fmt(hi, 4)} ${unitTxt}`);
    extras.push({ label: 'Supplied reference range', value: `${lo !== undefined ? fmt(lo, 3) : '—'} to ${hi !== undefined ? fmt(hi, 3) : '—'} ${unitTxt}` });

    const eps = 1e-9;
    let interpretation: string;
    const notes = [];
    if (hi !== undefined && orderedCompared > hi + eps) {
      interpretation = 'ABOVE the supplied reference range';
      notes.push(note('critical', 'Ordered dose exceeds the maximum you entered. Do not administer — clarify the order with the prescriber/pharmacist.'));
    } else if (lo !== undefined && orderedCompared < lo - eps) {
      interpretation = 'BELOW the supplied reference range';
      notes.push(note('warning', 'Ordered dose is below the minimum you entered. Clarify the order before administering.'));
    } else {
      interpretation = 'Within the supplied reference range';
      notes.push(note('info', 'Within the range you entered. This does not confirm the dose is appropriate — check indication, route, renal/hepatic function and maximum single and daily doses.'));
    }
    notes.push(VERIFY);
    return ok({
      value: orderedCompared, unit: unitTxt, display: fmt(orderedCompared, 3),
      formula: 'Range = Weight (kg) × reference dose/kg; compare ordered amount',
      substitution: `${fmt(i.weightKg, 3)} kg × (${hasMin ? fmt(i.minPerKg as number, 4) : '—'} to ${hasMax ? fmt(i.maxPerKg as number, 4) : '—'}) ${i.doseUnit}/kg/${i.basis === 'perDay' ? 'day' : 'dose'}`,
      steps, extras, interpretation, notes,
      rounding: 'Comparison uses unrounded values.',
    });
  });
}

// ---------- 8.6 Dilution C1V1 = C2V2 ----------
export interface DilutionIn {
  c1?: number; v1?: number; c2?: number; v2?: number;
  concUnit: string; volUnit: string;
}

export function dilution(i: DilutionIn): CalcResult {
  return attempt(() => {
    const keys = ['c1', 'v1', 'c2', 'v2'] as const;
    const missing = keys.filter((k) => i[k] === undefined || Number.isNaN(i[k] as number));
    const c = new Check().rule(missing.length === 1, 'Leave exactly one of C1, V1, C2, V2 blank — that is the value to solve for.');
    c.done();
    for (const k of keys) if (!missing.includes(k)) c.positive(k, k.toUpperCase(), i[k]);
    c.done();
    const { c1, v1, c2, v2 } = i;
    const m = missing[0];
    let value = 0;
    let sub = '';
    if (m === 'c1') { value = ((c2 as number) * (v2 as number)) / (v1 as number); sub = `C1 = (${fmt(c2!, 4)} × ${fmt(v2!, 4)}) ÷ ${fmt(v1!, 4)}`; }
    if (m === 'v1') { value = ((c2 as number) * (v2 as number)) / (c1 as number); sub = `V1 = (${fmt(c2!, 4)} × ${fmt(v2!, 4)}) ÷ ${fmt(c1!, 4)}`; }
    if (m === 'c2') { value = ((c1 as number) * (v1 as number)) / (v2 as number); sub = `C2 = (${fmt(c1!, 4)} × ${fmt(v1!, 4)}) ÷ ${fmt(v2!, 4)}`; }
    if (m === 'v2') { value = ((c1 as number) * (v1 as number)) / (c2 as number); sub = `V2 = (${fmt(c1!, 4)} × ${fmt(v1!, 4)}) ÷ ${fmt(c2!, 4)}`; }
    const C1 = m === 'c1' ? value : (c1 as number);
    const C2 = m === 'c2' ? value : (c2 as number);
    const V1 = m === 'v1' ? value : (v1 as number);
    const V2 = m === 'v2' ? value : (v2 as number);
    new Check()
      .rule(C2 <= C1 + 1e-12, 'Final concentration (C2) cannot be higher than the stock concentration (C1) when diluting.')
      .rule(V1 <= V2 + 1e-12, 'Stock volume (V1) cannot be larger than the final volume (V2).')
      .done();
    const unitOut = m === 'c1' || m === 'c2' ? i.concUnit : i.volUnit;
    const extras = [{ label: 'Diluent to add (V2 − V1)', value: `${fmt(V2 - V1, 3)} ${i.volUnit}` }];
    return ok({
      value, unit: unitOut, display: fmt(value, 3),
      formula: 'C1 × V1 = C2 × V2', substitution: sub,
      steps: [`${sub} = ${fmt(value, 6)} ${unitOut}`, `Diluent = ${fmt(V2, 4)} − ${fmt(V1, 4)} = ${fmt(V2 - V1, 4)} ${i.volUnit}`],
      extras, rounding: 'Displayed to 3 decimal places.',
      notes: [note('info', 'Both concentrations must use the same unit and both volumes the same unit (enforced). Confirm compatible diluent from the product label.'), VERIFY],
    });
  });
}

// ---------- Reconstitution ----------
export function reconstitution(i: { drugAmount: number; finalVolumeMl: number; orderedDose?: number; doseUnit: string }): CalcResult {
  return attempt(() => {
    const c = new Check().positive('drugAmount', 'Amount of drug in vial', i.drugAmount).positive('finalVolume', 'Final volume after reconstitution', i.finalVolumeMl);
    if (i.orderedDose !== undefined && !Number.isNaN(i.orderedDose)) c.positive('orderedDose', 'Ordered dose', i.orderedDose).rule(i.orderedDose <= i.drugAmount, 'Ordered dose is more than the vial contains. Check the order or use additional vials per policy.', 'orderedDose');
    c.done();
    const conc = i.drugAmount / i.finalVolumeMl;
    const steps = [`Concentration = ${fmt(i.drugAmount, 4)} ${i.doseUnit} ÷ ${fmt(i.finalVolumeMl, 4)} mL = ${fmt(conc, 6)} ${i.doseUnit}/mL`];
    const extras = [{ label: 'Final concentration', value: `${fmt(conc, 4)} ${i.doseUnit}/mL` }];
    let value = conc;
    let unitOut = `${i.doseUnit}/mL`;
    if (i.orderedDose !== undefined && !Number.isNaN(i.orderedDose)) {
      value = quantityForDose(i.orderedDose, conc, 1);
      unitOut = 'mL';
      steps.push(`Volume = ${fmt(i.orderedDose, 4)} ${i.doseUnit} ÷ ${fmt(conc, 6)} ${i.doseUnit}/mL = ${fmt(value, 6)} mL`);
    }
    return ok({
      value, unit: unitOut, display: fmt(value, unitOut === 'mL' ? 2 : 4),
      formula: unitOut === 'mL' ? 'Volume = Ordered dose ÷ (Drug amount ÷ Final volume)' : 'Concentration = Drug amount ÷ Final volume',
      substitution: steps[steps.length - 1] as string, steps, extras,
      rounding: 'No intermediate rounding.',
      notes: [note('warning', 'Use the FINAL volume stated on the manufacturer label (it may exceed the diluent volume because of powder displacement). This app does not supply reconstitution instructions.'), VERIFY],
    });
  });
}

// ---------- Insulin (high-alert) ----------
export function insulinVolume(i: { orderedUnits: number; concUnitsPerMl: number }): CalcResult {
  return attempt(() => {
    new Check().positive('orderedUnits', 'Ordered insulin dose (units)', i.orderedUnits).positive('conc', 'Insulin concentration (units/mL)', i.concUnitsPerMl).done();
    const ml = quantityForDose(i.orderedUnits, i.concUnitsPerMl, 1);
    const extras = [{ label: 'Concentration', value: `U-${fmt(i.concUnitsPerMl, 0)} (${fmt(i.concUnitsPerMl, 0)} units/mL)` }];
    const notes = [HIGH_ALERT];
    if (i.concUnitsPerMl === 100) extras.push({ label: 'On a U-100 insulin syringe', value: `${fmt(i.orderedUnits, 2)} unit markings` });
    else notes.push(note('critical', 'Non-U-100 concentration: do not measure with a standard U-100 syringe unless policy and the product specifically allow it. Use the dedicated device.'));
    notes.push(note('warning', 'This tool does not calculate correction or sliding-scale doses. Use the prescribed protocol.'));
    return ok({
      value: ml, unit: 'mL', display: fmt(ml, 3),
      formula: 'Volume (mL) = Ordered units ÷ Concentration (units/mL)',
      substitution: `${fmt(i.orderedUnits, 2)} units ÷ ${fmt(i.concUnitsPerMl, 2)} units/mL`,
      steps: [`${fmt(i.orderedUnits, 2)} ÷ ${fmt(i.concUnitsPerMl, 2)} = ${fmt(ml, 5)} mL`],
      extras, rounding: 'Displayed to 3 decimal places.', notes,
    });
  });
}

// ---------- Heparin / any units-based infusion (high-alert) ----------
export type HeparinMode = 'rateFromDose' | 'doseFromRate' | 'weightBased';

export function heparinInfusion(i: { mode: HeparinMode; concUnitsPerMl: number; unitsPerHr?: number; mlPerHr?: number; unitsPerKgHr?: number; weightKg?: number; pumpDp?: number }): CalcResult {
  return attempt(() => {
    const c = new Check().positive('conc', 'Concentration (units/mL)', i.concUnitsPerMl);
    if (i.mode === 'rateFromDose') c.positive('unitsPerHr', 'Ordered units/hr', i.unitsPerHr);
    if (i.mode === 'doseFromRate') c.positive('mlPerHr', 'Pump rate (mL/hr)', i.mlPerHr);
    if (i.mode === 'weightBased') c.positive('unitsPerKgHr', 'Ordered units/kg/hr', i.unitsPerKgHr).positive('weight', 'Weight', i.weightKg);
    c.done();
    const dp = i.pumpDp ?? 1;
    const notes = compact([HIGH_ALERT, i.weightKg ? weightNote(i.weightKg) : null, note('warning', 'Bolus doses, titration and aPTT/anti-Xa adjustments must follow the prescribed protocol — not calculated here.')]);
    if (i.mode === 'doseFromRate') {
      const uh = (i.mlPerHr as number) * i.concUnitsPerMl;
      return ok({
        value: uh, unit: 'units/hr', display: fmt(uh, 1),
        formula: 'units/hr = mL/hr × concentration (units/mL)',
        substitution: `${fmt(i.mlPerHr!, 2)} mL/hr × ${fmt(i.concUnitsPerMl, 2)} units/mL`,
        steps: [`${fmt(i.mlPerHr!, 2)} × ${fmt(i.concUnitsPerMl, 2)} = ${fmt(uh, 4)} units/hr`],
        rounding: 'Displayed to 1 decimal place.', notes,
      });
    }
    const uh = i.mode === 'weightBased' ? (i.unitsPerKgHr as number) * (i.weightKg as number) : (i.unitsPerHr as number);
    const mlh = uh / i.concUnitsPerMl;
    const steps = [];
    if (i.mode === 'weightBased') steps.push(`${fmt(i.unitsPerKgHr!, 3)} units/kg/hr × ${fmt(i.weightKg!, 2)} kg = ${fmt(uh, 4)} units/hr`);
    steps.push(`${fmt(uh, 4)} units/hr ÷ ${fmt(i.concUnitsPerMl, 2)} units/mL = ${fmt(mlh, 6)} mL/hr`);
    steps.push(`Pump setting rounded to ${dp} dp: ${fmt(roundTo(mlh, dp), dp)} mL/hr`);
    return ok({
      value: mlh, unit: 'mL/hr', display: fmt(roundTo(mlh, dp), dp),
      formula: i.mode === 'weightBased' ? 'mL/hr = (units/kg/hr × kg) ÷ units/mL' : 'mL/hr = units/hr ÷ units/mL',
      substitution: i.mode === 'weightBased' ? `(${fmt(i.unitsPerKgHr!, 3)} × ${fmt(i.weightKg!, 2)}) ÷ ${fmt(i.concUnitsPerMl, 2)}` : `${fmt(uh, 2)} ÷ ${fmt(i.concUnitsPerMl, 2)}`,
      steps, extras: [{ label: 'Dose rate', value: `${fmt(uh, 2)} units/hr` }, { label: 'Exact rate', value: `${fmt(mlh, 4)} mL/hr` }],
      rounding: `Pump rate rounded to ${dp} decimal place(s) per your pump-precision setting.`, notes,
    });
  });
}

// ---------- Supply ----------
export function supplyQuantity(i: { perDose: number; dosesPerDay: number; days: number; unitLabel: string }): CalcResult {
  return attempt(() => {
    new Check().positive('perDose', 'Amount per dose', i.perDose).positive('dosesPerDay', 'Doses per day', i.dosesPerDay).positive('days', 'Number of days', i.days).done();
    const v = i.perDose * i.dosesPerDay * i.days;
    return ok({
      value: v, unit: i.unitLabel, display: fmt(v, 2),
      formula: 'Total = amount per dose × doses per day × days',
      substitution: `${fmt(i.perDose, 3)} × ${fmt(i.dosesPerDay, 2)} × ${fmt(i.days, 2)}`,
      steps: [`${fmt(i.perDose, 3)} × ${fmt(i.dosesPerDay, 2)} = ${fmt(i.perDose * i.dosesPerDay, 3)} per day`, `× ${fmt(i.days, 2)} days = ${fmt(v, 3)} ${i.unitLabel}`],
      rounding: 'Exact; round up to whole dispensable units per pharmacy policy.',
      notes: [VERIFY],
    });
  });
}

// ---------- % and ratio strength ----------
export function percentToMgPerMl(percent: number): CalcResult {
  return attempt(() => {
    new Check().positive('percent', 'Percentage strength', percent).rule(percent <= 100, 'A w/v percentage above 100% is not possible for a solution. Check the value.', 'percent').done();
    const v = percent * 10;
    return ok({
      value: v, unit: 'mg/mL', display: fmt(v, 4),
      formula: 'mg/mL = % (w/v) × 10   (1% w/v = 1 g/100 mL = 10 mg/mL)',
      substitution: `${fmt(percent, 4)} × 10`,
      steps: [`${fmt(percent, 4)} g per 100 mL = ${fmt(percent * 1000, 4)} mg per 100 mL`, `÷ 100 mL = ${fmt(v, 4)} mg/mL`],
      rounding: 'Displayed to 4 decimal places.',
      notes: [note('info', 'Applies to weight/volume (w/v) percentages only — not w/w or v/v.')],
    });
  });
}

export function ratioToMgPerMl(ratioDenominator: number): CalcResult {
  return attempt(() => {
    new Check().positive('ratio', 'Ratio denominator (1:X)', ratioDenominator).done();
    const v = 1000 / ratioDenominator;
    return ok({
      value: v, unit: 'mg/mL', display: fmt(v, 4),
      formula: '1:X (g:mL) → mg/mL = 1000 ÷ X',
      substitution: `1000 ÷ ${fmt(ratioDenominator, 2)}`,
      steps: [`1:${fmt(ratioDenominator, 2)} = 1 g in ${fmt(ratioDenominator, 2)} mL = 1000 mg in ${fmt(ratioDenominator, 2)} mL`, `= ${fmt(v, 4)} mg/mL`],
      extras: [{ label: 'Equivalent percentage (w/v)', value: `${fmt(v / 10, 4)} %` }],
      rounding: 'Displayed to 4 decimal places.',
      notes: [note('warning', 'Ratio expressions are error-prone; many organisations now label products in mg/mL. Always read the concentration on the actual product.')],
    });
  });
}
