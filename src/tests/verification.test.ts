// Independent verification suite (audit pass 2).
// Expected values here were derived by hand / in a separate Python session,
// not copied from engine output. Boundary cases follow the published tables
// cross-checked during the audit (see references manifest `crossCheck`).
import { describe, expect, it } from 'vitest';
import { parseNumber, type CalcResult } from '../calculations/core';
import { FormValues } from '../features/types';
import * as med from '../calculations/medication';
import * as iv from '../calculations/iv';
import * as body from '../calculations/body';
import * as sc from '../calculations/scores';
import * as fl from '../calculations/fluids';
import * as cl from '../calculations/clinical';

const v = (r: CalcResult | { ok: boolean }) => {
  if (!r.ok) throw new Error('expected ok: ' + JSON.stringify((r as { errors: unknown }).errors));
  return (r as { value: number }).value;
};
const disp = (r: CalcResult) => (r.ok ? r.display : `ERR ${r.errors.map((e) => e.message).join('|')}`);

describe('hand-derived values', () => {
  it.each<[string, () => CalcResult, number, number]>([
    ['0.125 mg from 0.25 mg tablets', () => med.basicDose({ desired: 0.125, available: 0.25, quantity: 1, doseUnit: 'mg', quantityUnit: 'tablet(s)' }), 0.5, 12],
    ['3.5 kg × 15 mg/kg/dose', () => med.weightBasedDose({ weightKg: 3.5, dosePerKg: 15, doseUnit: 'mg', basis: 'perDose' }), 52.5, 12],
    ['BSA 1.73 × 75 mg/m²', () => med.bsaDose({ bsa: 1.73, dosePerM2: 75, doseUnit: 'mg' }), 129.75, 10],
    ['C1V1: 50 mg/mL → 5 mg/mL × 200 mL', () => med.dilution({ c1: 50, c2: 5, v2: 200, concUnit: 'mg/mL', volUnit: 'mL' }), 20, 12],
    ['Recon 500 mg / 2.5 mL, 300 mg', () => med.reconstitution({ drugAmount: 500, finalVolumeMl: 2.5, orderedDose: 300, doseUnit: 'mg' }), 1.5, 12],
    ['U-500, 35 units', () => med.insulinVolume({ orderedUnits: 35, concUnitsPerMl: 500 }), 0.07, 12],
    ['Heparin 25 U/kg/hr × 60 kg @ 50 U/mL', () => med.heparinInfusion({ mode: 'weightBased', concUnitsPerMl: 50, unitsPerKgHr: 25, weightKg: 60 }), 30, 12],
    ['2% w/v', () => med.percentToMgPerMl(2), 20, 12],
    ['1:10,000', () => med.ratioToMgPerMl(10000), 0.1, 12],
    ['250 mL over 0.5 h', () => iv.pumpRate({ volumeMl: 250, timeHr: 0.5 }), 500, 12],
    ['1000 mL 10 h 20 gtt/mL', () => iv.dripRate({ volumeMl: 1000, timeMin: 600, dropFactor: 20 }), 33.333333333333336, 9],
    ['microdrip 100 mL 60 min', () => iv.dripRate({ volumeMl: 100, timeMin: 60, dropFactor: 60 }), 100, 12],
    ['1000 mL at 80 mL/hr', () => iv.infusionDuration({ volumeMl: 1000, rateMlHr: 80 }), 12.5, 12],
    ['0.1 mcg/kg/min × 80 kg, 4 mg/250 mL', () => iv.rateFromDose({ dose: 0.1, doseUnit: 'mcg/kg/min', concMgPerMl: 4 / 250, weightKg: 80 }), 30, 9],
    ['1 mg/min at 2 mg/mL', () => iv.rateFromDose({ dose: 1, doseUnit: 'mg/min', concMgPerMl: 2 }), 30, 12],
    ['BMI 90 kg 1.8 m', () => body.bmi({ weightKg: 90, heightM: 1.8, adult: true }), 27.777777777777775, 10],
    ['Mosteller 180 cm 80 kg', () => body.bsaMosteller({ weightKg: 80, heightCm: 180 }), 2, 12],
    ['Devine female 65 in', () => body.idealBodyWeight({ heightCm: 65 * 2.54, sex: 'female' }), 57, 9],
    ['Weight 50 → 55 kg', () => body.weightChange({ previousKg: 50, currentKg: 55 }), 10, 9],
    ['MAP 150/90', () => cl.meanArterialPressure({ sbp: 150, dbp: 90 }), 110, 12],
    ['MAP 117/76', () => cl.meanArterialPressure({ sbp: 117, dbp: 76 }), 89.66666666666667, 9],
    ['Shock index 120/80', () => cl.shockIndex({ hr: 120, sbp: 80 }), 1.5, 12],
    ['104 °F', () => cl.temperature({ value: 104, from: 'F' }), 40, 9],
    ['Holliday–Segar 8 kg', () => cl.hollidaySegar({ weightKg: 8 }), 32, 12],
    ['Holliday–Segar 18 kg', () => cl.hollidaySegar({ weightKg: 18 }), 56, 12],
    ['Holliday–Segar 60 kg', () => cl.hollidaySegar({ weightKg: 60 }), 100, 12],
    ['Holliday–Segar 10.5 kg', () => cl.hollidaySegar({ weightKg: 10.5 }), 41, 12],
    ['M cyl 2000 psi 6 L/min', () => cl.cylinderDuration({ cylinder: 'M', pressurePsi: 2000, reservePsi: 200, flowLMin: 6 }), 468, 9],
    ['H/K 2200 psi 15 L/min', () => cl.cylinderDuration({ cylinder: 'H/K', pressurePsi: 2200, reservePsi: 200, flowLMin: 15 }), 418.6666666666667, 9],
    ['Macros 100/30/20 g', () => cl.macroCalories({ carbG: 100, proteinG: 30, fatG: 20 }), 700, 12],
    ['CG female 80 y 50 kg 1.4 mg/dL', () => cl.cockcroftGault({ age: 80, weightKg: 50, scrMgDl: 1.4, sex: 'female', weightLabel: 'actual' }), 25.297619047619047, 9],
    ['Glucose 90 mg/dL', () => cl.glucoseConvert({ value: 90, from: 'glu_mgdl' }), 4.995559502664299, 9],
    ['Creatinine 120 µmol/L', () => cl.creatinineConvert({ value: 120, from: 'cr_umol' }), 1.3574660633484164 /* 120 ÷ 88.4 */, 9],
    ['EBL 1500 mL, 60 kg × 70', () => cl.bloodLossPercent({ lossMl: 1500, weightKg: 60, mlPerKg: 70 }), 35.714285714285715, 9],
    ['Transfusion 250 mL / 120 min', () => cl.transfusionRate({ volumeMl: 250, minutes: 120 }), 125, 12],
    ['Newborn 3000 → 2700 g', () => cl.newbornWeightLoss({ birthG: 3000, currentG: 2700 }), 10, 9],
    ['Wound 5.2 × 3.1 cm', () => cl.woundMeasure({ lengthCm: 5.2, widthCm: 3.1 }), 16.12, 9],
    ['Urine 45 mL / 3 h / 15 kg', () => fl.urineOutput({ volumeMl: 45, hours: 3, weightKg: 15 }), 1, 12],
    ['Pulse pressure 140/90', () => cl.pulsePressure({ sbp: 140, dbp: 90 }), 50, 12],
  ])('%s', (_n, f, expected, digits) => {
    expect(v(f())).toBeCloseTo(expected, digits);
  });

  it('display rounding is applied once, at the end', () => {
    expect(disp(iv.dripRate({ volumeMl: 1000, timeMin: 600, dropFactor: 20 }))).toBe('33');
    expect(disp(iv.pumpRate({ volumeMl: 1000, timeHr: 7, pumpDp: 1 }))).toBe('142.9');
    expect(disp(iv.pumpRate({ volumeMl: 1000, timeHr: 7, pumpDp: 0 }))).toBe('143');
    expect(disp(cl.cylinderDuration({ cylinder: 'H/K', pressurePsi: 2200, reservePsi: 200, flowLMin: 15 }))).toBe('418'); // rounded down, conservative
    expect(disp(body.bmi({ weightKg: 90, heightM: 1.8, adult: true }))).toBe('27.8');
  });

  it('Naegele: leap-day LMP, gestational age, cycle adjustment', () => {
    const r = cl.naegele({ lmp: '2024-02-29', today: '2024-06-01' });
    expect(disp(r)).toBe('2024-12-05');
    expect(v(r)).toBe(93); // 13w 2d
    const r35 = cl.naegele({ lmp: '2025-12-15', today: '2026-01-15', cycleDays: 35 });
    expect(disp(r35)).toBe('2026-09-28');
    expect(v(r35)).toBe(31 - 7);
  });

  it('completion time crosses midnight and multiple days', () => {
    expect(disp(iv.completionTime({ start: '23:45', volumeMl: 500, rateMlHr: 200 }))).toBe('02:15');
    const twoDays = iv.completionTime({ start: '06:00', volumeMl: 1000, rateMlHr: 20 }); // 50 h
    expect(disp(twoDays)).toBe('08:00');
    expect(twoDays.ok && twoDays.interpretation).toBe('+2 days');
  });
});

describe('Glasgow-Blatchford boundaries (published table)', () => {
  const base = { ureaMmolL: 5, hbGdl: 14, sex: 'male' as const, sbp: 130, pulse: 80, melaena: false, syncope: false, hepatic: false, cardiacFailure: false };
  it.each([[6.4, 0], [6.5, 2], [7.9, 2], [8, 3], [9.9, 3], [10, 4], [25, 4], [25.1, 6]])('urea %s → %s', (u, p) => {
    expect(v(sc.glasgowBlatchford({ ...base, ureaMmolL: u }))).toBe(p);
  });
  it.each([['male', 13, 0], ['male', 12.9, 1], ['male', 12, 1], ['male', 11.9, 3], ['male', 10, 3], ['male', 9.9, 6], ['female', 12, 0], ['female', 11.9, 1], ['female', 10, 1], ['female', 9.9, 6]] as const)('%s Hb %s → %s', (sex, hb, p) => {
    expect(v(sc.glasgowBlatchford({ ...base, sex, hbGdl: hb }))).toBe(p);
  });
  it.each([[110, 0], [109, 1], [100, 1], [99, 2], [90, 2], [89, 3]])('SBP %s → %s', (sbp, p) => {
    expect(v(sc.glasgowBlatchford({ ...base, sbp }))).toBe(p);
  });
  it('maximum 23', () => {
    expect(v(sc.glasgowBlatchford({ ureaMmolL: 30, hbGdl: 8, sex: 'male', sbp: 80, pulse: 120, melaena: true, syncope: true, hepatic: true, cardiacFailure: true }))).toBe(23);
  });
});

describe('number parsing (locale safety)', () => {
  it.each([
    ['2.5', 2.5], ['.5', 0.5], ['5.', 5], ['1,000', 1000], ['12,500.5', 12500.5], [' 40 ', 40], ['-3', -3], ['1e3', 1000],
  ])('accepts %s', (s, n) => {
    const p = parseNumber(s);
    expect(p.ok && p.value).toBe(n);
  });
  it.each(['2,5', '0,25', '1,00', '1,0000', '2.5.1', 'abc', '5 mg', '', '1,000,00', '--1'])('rejects "%s" instead of guessing', (s) => {
    expect(parseNumber(s).ok).toBe(false);
  });
  it('comma decimal gets a specific message', () => {
    const p = parseNumber('2,5');
    expect(!p.ok && p.message).toMatch(/decimal point/);
  });
  it('FormValues never turns 2,5 into 25', () => {
    expect(Number.isNaN(new FormValues({ a: '2,5' }).num('a'))).toBe(true);
  });
});

describe('robustness: no engine function throws or returns a non-finite OK result', () => {
  const bad = [NaN, Infinity, -Infinity, -1, 0, 1e-9, 1e12, 1e308, 5];
  const pickN = (k: number) => bad[k % bad.length] as number;
  const fns: [string, (a: number, b: number, c: number, d: number) => CalcResult][] = [
    ['basicDose', (a, b, c) => med.basicDose({ desired: a, available: b, quantity: c, doseUnit: 'mg', quantityUnit: 'mL' })],
    ['weightBasedDose', (a, b, c) => med.weightBasedDose({ weightKg: a, dosePerKg: b, doseUnit: 'mg', basis: 'perDay', dosesPerDay: c })],
    ['bsaDose', (a, b) => med.bsaDose({ bsa: a, dosePerM2: b, doseUnit: 'mg' })],
    ['doseRangeCheck', (a, b, c, d) => med.doseRangeCheck({ weightKg: a, minPerKg: b, maxPerKg: c, basis: 'perDose', orderedDose: d, doseUnit: 'mg' })],
    ['dilution', (a, b, c) => med.dilution({ c1: a, v1: b, c2: c, concUnit: 'mg/mL', volUnit: 'mL' })],
    ['reconstitution', (a, b, c) => med.reconstitution({ drugAmount: a, finalVolumeMl: b, orderedDose: c, doseUnit: 'mg' })],
    ['insulinVolume', (a, b) => med.insulinVolume({ orderedUnits: a, concUnitsPerMl: b })],
    ['heparinInfusion', (a, b, c) => med.heparinInfusion({ mode: 'weightBased', concUnitsPerMl: a, unitsPerKgHr: b, weightKg: c })],
    ['supplyQuantity', (a, b, c) => med.supplyQuantity({ perDose: a, dosesPerDay: b, days: c, unitLabel: 'tablets' })],
    ['percentToMgPerMl', (a) => med.percentToMgPerMl(a)],
    ['ratioToMgPerMl', (a) => med.ratioToMgPerMl(a)],
    ['pumpRate', (a, b) => iv.pumpRate({ volumeMl: a, timeHr: b })],
    ['dripRate', (a, b, c) => iv.dripRate({ volumeMl: a, timeMin: b, dropFactor: c })],
    ['infusionDuration', (a, b) => iv.infusionDuration({ volumeMl: a, rateMlHr: b })],
    ['completionTime', (a, b) => iv.completionTime({ start: '12:00', volumeMl: a, rateMlHr: b })],
    ['volumeInfused', (a, b, c) => iv.volumeInfused({ rateMlHr: a, timeHr: b, totalMl: c })],
    ['doseFromRate', (a, b, c) => iv.doseFromRate({ rateMlHr: a, concMgPerMl: b, weightKg: c })],
    ['rateFromDose', (a, b, c) => iv.rateFromDose({ dose: a, doseUnit: 'mcg/kg/min', concMgPerMl: b, weightKg: c })],
    ['sequentialInfusions', (a, b, c, d) => iv.sequentialInfusions({ start: '08:00', bags: [{ volumeMl: a, rateMlHr: b }, { volumeMl: c, rateMlHr: d }] })],
    ['bmi', (a, b) => body.bmi({ weightKg: a, heightM: b, adult: true })],
    ['bsaMosteller', (a, b) => body.bsaMosteller({ weightKg: a, heightCm: b })],
    ['idealBodyWeight', (a, b) => body.idealBodyWeight({ heightCm: a, sex: 'male', actualKg: b })],
    ['weightChange', (a, b) => body.weightChange({ previousKg: a, currentKg: b })],
    ['waistToHeight', (a, b) => body.waistToHeight({ waistCm: a, heightCm: b })],
    ['fluidBalance', (a, b) => fl.fluidBalance({ intakeMl: a, outputMl: b })],
    ['urineOutput', (a, b, c) => fl.urineOutput({ volumeMl: a, hours: b, weightKg: c })],
    ['meanArterialPressure', (a, b) => cl.meanArterialPressure({ sbp: a, dbp: b })],
    ['pulsePressure', (a, b) => cl.pulsePressure({ sbp: a, dbp: b })],
    ['shockIndex', (a, b) => cl.shockIndex({ hr: a, sbp: b })],
    ['pulseDeficit', (a, b) => cl.pulseDeficit({ apical: a, radial: b })],
    ['rateFromCount', (a, b) => cl.rateFromCount({ count: a, seconds: b })],
    ['temperature', (a) => cl.temperature({ value: a, from: 'C' })],
    ['hollidaySegar', (a) => cl.hollidaySegar({ weightKg: a })],
    ['cylinderDuration', (a, b, c) => cl.cylinderDuration({ cylinder: 'E', pressurePsi: a, reservePsi: b, flowLMin: c })],
    ['cylinderDurationLitres', (a, b, c, d) => cl.cylinderDurationLitres({ waterCapacityL: a, pressureBar: b, reserveBar: c, flowLMin: d })],
    ['oxygenConsumption', (a, b) => cl.oxygenConsumption({ flowLMin: a, minutes: b })],
    ['macroCalories', (a, b, c) => cl.macroCalories({ carbG: a, proteinG: b, fatG: c })],
    ['enteralRate', (a, b) => cl.enteralRate({ volumeMl: a, hours: b })],
    ['percentOfTarget', (a, b) => cl.percentOfTarget({ actual: a, target: b, unitLabel: 'kcal' })],
    ['proteinPerKg', (a, b) => cl.proteinPerKg({ proteinG: a, weightKg: b })],
    ['cockcroftGault', (a, b, c) => cl.cockcroftGault({ age: a, weightKg: b, scrMgDl: c, sex: 'male', weightLabel: 'actual' })],
    ['glucoseConvert', (a) => cl.glucoseConvert({ value: a, from: 'glu_mgdl' })],
    ['creatinineConvert', (a) => cl.creatinineConvert({ value: a, from: 'cr_umol' })],
    ['doseToVolume', (a, b) => cl.doseToVolume({ dose: a, concentration: b, doseUnit: 'mEq' })],
    ['bloodLossPercent', (a, b, c) => cl.bloodLossPercent({ lossMl: a, weightKg: b, mlPerKg: c })],
    ['transfusionRate', (a, b, c) => cl.transfusionRate({ volumeMl: a, minutes: b, dropFactor: c })],
    ['newbornWeightLoss', (a, b) => cl.newbornWeightLoss({ birthG: a, currentG: b })],
    ['woundMeasure', (a, b, c, d) => cl.woundMeasure({ lengthCm: a, widthCm: b, depthCm: c, prevAreaCm2: d })],
    ['glasgowBlatchford', (a, b, c, d) => sc.glasgowBlatchford({ ureaMmolL: a, hbGdl: b, sex: 'male', sbp: c, pulse: d, melaena: false, syncope: false, hepatic: false, cardiacFailure: false }) as CalcResult],
  ];
  it.each(fns)('%s', (_n, f) => {
    for (let k = 0; k < bad.length ** 2; k++) {
      const args = [pickN(k), pickN(Math.floor(k / bad.length)), pickN(k + 3), pickN(k * 7 + 1)] as const;
      let r: CalcResult;
      expect(() => { r = f(...args); }).not.toThrow();
      if (r!.ok) {
        expect(Number.isFinite(r!.value), `${_n}(${args.join(', ')}) returned ${r!.value}`).toBe(true);
        expect(r!.display).not.toMatch(/NaN|Infinity/);
      }
    }
  });
});

describe('features added in audit', () => {
  it('sequential infusions: totals and per-bag finish times across midnight', () => {
    const r = iv.sequentialInfusions({ start: '20:00', bags: [{ volumeMl: 1000, rateMlHr: 125 }, { volumeMl: 500, rateMlHr: 100 }] });
    expect(v(r)).toBe(1500);
    expect(r.ok && r.extras.map((e) => e.value)).toEqual(['13 hr 0 min', 'Bag 1 ends 04:00 (next day) · Bag 2 ends 09:00 (next day)']);
    expect(iv.sequentialInfusions({ start: '20:00', bags: [] }).ok).toBe(false);
  });
  it('oxygen consumption', () => {
    expect(v(cl.oxygenConsumption({ flowLMin: 4, minutes: 90 }))).toBe(360);
  });
  it('transfusion gravity rate uses the shared drip-rate formula', () => {
    const r = cl.transfusionRate({ volumeMl: 300, minutes: 180, dropFactor: 15 });
    const drip = iv.dripRate({ volumeMl: 300, timeMin: 180, dropFactor: 15 });
    expect(r.ok && r.extras.find((e) => e.label.startsWith('Gravity'))?.value).toContain(drip.ok ? drip.display : 'x');
  });
});
