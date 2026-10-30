import { describe, expect, it } from 'vitest';
import { fmt, roundTo, type CalcResult } from '../calculations/core';
import { as, convert, compatible } from '../calculations/units';
import * as med from '../calculations/medication';
import * as iv from '../calculations/iv';
import * as body from '../calculations/body';
import * as sc from '../calculations/scores';
import * as fl from '../calculations/fluids';
import * as cl from '../calculations/clinical';

const val = (r: CalcResult) => {
  if (!r.ok) throw new Error('expected ok: ' + JSON.stringify(r.errors));
  return r.value;
};
const err = (r: CalcResult | { ok: boolean }) => expect(r.ok).toBe(false);

describe('medication — required cases', () => {
  it.each([
    ['500 mg from 250 mg/tablet', { desired: 500, available: 250, quantity: 1, doseUnit: 'mg', quantityUnit: 'tablet(s)' }, 2],
    ['125 mg from 250 mg/5 mL', { desired: 125, available: 250, quantity: 5, doseUnit: 'mg', quantityUnit: 'mL' }, 2.5],
    ['40 mg from 20 mg/mL', { desired: 40, available: 20, quantity: 1, doseUnit: 'mg', quantityUnit: 'mL' }, 2],
  ])('%s', (_n, input, expected) => {
    expect(val(med.basicDose(input))).toBeCloseTo(expected, 10);
  });

  it('distinguishes mg/kg/dose from mg/kg/day', () => {
    const perDose = med.weightBasedDose({ weightKg: 20, dosePerKg: 10, doseUnit: 'mg', basis: 'perDose' });
    const perDay = med.weightBasedDose({ weightKg: 20, dosePerKg: 30, doseUnit: 'mg', basis: 'perDay', dosesPerDay: 3 });
    expect(val(perDose)).toBe(200);
    expect(val(perDay)).toBe(200); // 600 mg/day ÷ 3
    expect(val(med.weightBasedDose({ weightKg: 20, dosePerKg: 10, doseUnit: 'mg', basis: 'perDay', dosesPerDay: 2 }))).toBe(100);
  });

  it('never assumes frequency for per-day orders', () => {
    err(med.weightBasedDose({ weightKg: 20, dosePerKg: 30, doseUnit: 'mg', basis: 'perDay' }));
    err(med.weightBasedDose({ weightKg: 20, dosePerKg: 30, doseUnit: 'mg', basis: 'perDay', dosesPerDay: 2.5 }));
  });

  it('converts mcg to mg before calculating', () => {
    // 250 mcg ordered, 0.5 mg/2 mL available → 1 mL
    expect(val(med.basicDose({ desired: as({ value: 250, unit: 'mcg' }, 'mg'), available: 0.5, quantity: 2, doseUnit: 'mg', quantityUnit: 'mL' }))).toBeCloseTo(1, 12);
  });

  it.each([
    ['zero available (denominator)', { desired: 5, available: 0, quantity: 1 }],
    ['negative desired', { desired: -5, available: 10, quantity: 1 }],
    ['missing quantity', { desired: 5, available: 10, quantity: NaN }],
    ['infinite', { desired: Infinity, available: 10, quantity: 1 }],
  ])('rejects %s', (_n, i) => err(med.basicDose({ ...i, doseUnit: 'mg', quantityUnit: 'mL' })));

  it('flags non-half tablet results', () => {
    const r = med.basicDose({ desired: 100, available: 30, quantity: 1, doseUnit: 'mg', quantityUnit: 'tablet(s)' });
    expect(r.ok && r.notes.some((n) => n.severity === 'warning' && /whole or half/.test(n.text))).toBe(true);
  });

  it('range checker: no reference → "Reference range not provided"', () => {
    const r = med.doseRangeCheck({ weightKg: 10, basis: 'perDose', orderedDose: 150, doseUnit: 'mg' });
    expect(r.ok && r.interpretation).toBe('Reference range not provided');
  });
  it('range checker: per-day comparison and above/below/within', () => {
    const within = med.doseRangeCheck({ weightKg: 10, minPerKg: 40, maxPerKg: 60, basis: 'perDay', orderedDose: 150, dosesPerDay: 3, doseUnit: 'mg' });
    expect(within.ok && within.interpretation).toMatch(/^Within/);
    const above = med.doseRangeCheck({ weightKg: 10, minPerKg: 40, maxPerKg: 60, basis: 'perDay', orderedDose: 250, dosesPerDay: 3, doseUnit: 'mg' });
    expect(above.ok && above.interpretation).toMatch(/^ABOVE/);
    const below = med.doseRangeCheck({ weightKg: 10, minPerKg: 10, maxPerKg: 15, basis: 'perDose', orderedDose: 50, doseUnit: 'mg' });
    expect(below.ok && below.interpretation).toMatch(/^BELOW/);
    // result text never says "safe"
    expect(JSON.stringify(within)).not.toMatch(/\bsafe\b/i);
  });
  it('range checker rejects invalid reference range (min > max)', () => {
    err(med.doseRangeCheck({ weightKg: 10, minPerKg: 60, maxPerKg: 40, basis: 'perDose', orderedDose: 100, doseUnit: 'mg' }));
  });

  it('dilution solves each unknown and rejects impossible dilutions', () => {
    expect(val(med.dilution({ c1: 10, v1: 5, c2: 1, concUnit: 'mg/mL', volUnit: 'mL' }))).toBe(50);
    expect(val(med.dilution({ c1: 10, c2: 2, v2: 100, concUnit: 'mg/mL', volUnit: 'mL' }))).toBe(20);
    err(med.dilution({ c1: 1, v1: 5, c2: 10, concUnit: 'mg/mL', volUnit: 'mL' }));
    err(med.dilution({ c1: 1, concUnit: 'mg/mL', volUnit: 'mL' }));
  });

  it('reconstitution, insulin, heparin, supply, % and ratio', () => {
    expect(val(med.reconstitution({ drugAmount: 1000, finalVolumeMl: 10, doseUnit: 'mg' }))).toBe(100);
    expect(val(med.reconstitution({ drugAmount: 1000, finalVolumeMl: 10, orderedDose: 250, doseUnit: 'mg' }))).toBe(2.5);
    err(med.reconstitution({ drugAmount: 500, finalVolumeMl: 5, orderedDose: 750, doseUnit: 'mg' }));
    expect(val(med.insulinVolume({ orderedUnits: 8, concUnitsPerMl: 100 }))).toBeCloseTo(0.08, 12);
    expect(val(med.heparinInfusion({ mode: 'rateFromDose', concUnitsPerMl: 100, unitsPerHr: 1000 }))).toBe(10);
    expect(val(med.heparinInfusion({ mode: 'doseFromRate', concUnitsPerMl: 100, mlPerHr: 12 }))).toBe(1200);
    expect(val(med.heparinInfusion({ mode: 'weightBased', concUnitsPerMl: 100, unitsPerKgHr: 18, weightKg: 80 }))).toBeCloseTo(14.4, 10);
    expect(val(med.supplyQuantity({ perDose: 2, dosesPerDay: 3, days: 7, unitLabel: 'tablets' }))).toBe(42);
    expect(val(med.percentToMgPerMl(0.9))).toBeCloseTo(9, 12);
    expect(val(med.ratioToMgPerMl(1000))).toBe(1);
    expect(val(med.ratioToMgPerMl(10000))).toBeCloseTo(0.1, 12);
    expect(val(med.bsaDose({ bsa: 1.5, dosePerM2: 100, doseUnit: 'mg' }))).toBe(150);
  });
});

describe('IV — required cases', () => {
  it('1000 mL over 8 h = 125 mL/hr', () => expect(val(iv.pumpRate({ volumeMl: 1000, timeHr: 8 }))).toBe(125));
  it('500 mL over 4 h at 15 gtt/mL = 31.25 gtt/min exact, 31 whole drops', () => {
    const r = iv.dripRate({ volumeMl: 500, timeMin: as({ value: 4, unit: 'hr' }, 'min'), dropFactor: 15 });
    expect(val(r)).toBe(31.25);
    expect(r.ok && r.display).toBe('31');
  });
  it('750 mL at 125 mL/hr = 6 h', () => expect(val(iv.infusionDuration({ volumeMl: 750, rateMlHr: 125 }))).toBe(6));
  it('requires drop factor', () => err(iv.dripRate({ volumeMl: 500, timeMin: 240, dropFactor: NaN })));
  it('rejects zero time', () => err(iv.pumpRate({ volumeMl: 500, timeHr: 0 })));
  it('applies pump precision only at display', () => {
    const r = iv.pumpRate({ volumeMl: 1000, timeHr: 3, pumpDp: 0 });
    expect(r.ok && r.display).toBe('333');
    expect(val(r)).toBeCloseTo(333.3333333, 6);
    const r1 = iv.pumpRate({ volumeMl: 1000, timeHr: 3, pumpDp: 2 });
    expect(r1.ok && r1.display).toBe('333.33');
  });
  it('completion time crosses midnight', () => {
    const r = iv.completionTime({ start: '22:30', volumeMl: 1000, rateMlHr: 125 });
    expect(r.ok && r.display).toBe('06:30');
    expect(r.ok && r.interpretation).toBe('next day');
    const same = iv.completionTime({ start: '08:00', volumeMl: 100, rateMlHr: 50 });
    expect(same.ok && same.display).toBe('10:00');
    err(iv.completionTime({ start: '25:00', volumeMl: 100, rateMlHr: 50 }));
    err(iv.completionTime({ start: '8am', volumeMl: 100, rateMlHr: 50 }));
  });
  it('volume infused and remaining', () => {
    const r = iv.volumeInfused({ rateMlHr: 125, timeHr: 3, totalMl: 1000 });
    expect(val(r)).toBe(375);
    expect(r.ok && r.extras[0]?.value).toBe('625 mL');
  });
  it('mcg/kg/min ↔ mL/hr round trip', () => {
    // 5 mcg/kg/min, 70 kg, 400 mg in 250 mL (1.6 mg/mL) → 13.125 mL/hr
    const r = iv.rateFromDose({ dose: 5, doseUnit: 'mcg/kg/min', concMgPerMl: 1.6, weightKg: 70 });
    expect(val(r)).toBeCloseTo(13.125, 10);
    const back = iv.doseFromRate({ rateMlHr: 13.125, concMgPerMl: 1.6, weightKg: 70 });
    expect(back.ok && back.extras.find((e) => e.label === 'mcg/kg/min')?.value).toBe('5');
    err(iv.rateFromDose({ dose: 5, doseUnit: 'mcg/kg/min', concMgPerMl: 1.6 })); // weight missing
    expect(val(iv.rateFromDose({ dose: 2, doseUnit: 'mg/kg/hr', concMgPerMl: 10, weightKg: 50 }))).toBe(10);
    expect(val(iv.rateFromDose({ dose: 1000, doseUnit: 'mcg/min', concMgPerMl: 1 }))).toBe(60);
  });
});

describe('BMI & body', () => {
  it('60 kg, 1.60 m = 23.4375', () => expect(val(body.bmi({ weightKg: 60, heightM: 1.6, adult: true }))).toBeCloseTo(23.4375, 12));
  it('does not apply adult category to children', () => {
    const r = body.bmi({ weightKg: 30, heightM: 1.3, adult: false });
    expect(r.ok && r.interpretation).toMatch(/not applied/);
  });
  it('categories at boundaries', () => {
    expect(body.bmiCategory(18.49)).toMatch(/Underweight/);
    expect(body.bmiCategory(18.5)).toMatch(/Normal/);
    expect(body.bmiCategory(25)).toMatch(/overweight/);
    expect(body.bmiCategory(30)).toMatch(/class I\b/);
  });
  it('converts lb/in correctly', () => {
    const kg = convert(132, 'lb', 'kg');
    const m = convert(63, 'in', 'm');
    expect(kg).toBeCloseTo(59.874, 3);
    expect(m).toBeCloseTo(1.6002, 4);
  });
  it('Mosteller, Devine, AdjBW, % change, WHtR', () => {
    expect(val(body.bsaMosteller({ weightKg: 70, heightCm: 170 }))).toBeCloseTo(Math.sqrt(170 * 70 / 3600), 12);
    expect(val(body.idealBodyWeight({ heightCm: 182.88, sex: 'male' }))).toBeCloseTo(77.6, 6); // 72 in
    expect(val(body.idealBodyWeight({ heightCm: 152.4, sex: 'female' }))).toBeCloseTo(45.5, 6);
    err(body.idealBodyWeight({ heightCm: 140, sex: 'female' }));
    expect(val(body.weightChange({ previousKg: 80, currentKg: 72 }))).toBeCloseTo(-10, 12);
    expect(val(body.waistToHeight({ waistCm: 85, heightCm: 170 }))).toBe(0.5);
  });
});

describe('scores', () => {
  it.each([
    [{ E: 3, V: 4, M: 6 }, 13],
    [{ E: 4, V: 5, M: 6 }, 15],
    [{ E: 1, V: 1, M: 1 }, 3],
  ])('GCS %j = %i', (sel, total) => {
    const r = sc.gcs(sel);
    expect(r.ok && 'total' in r && r.total).toBe(total);
  });
  it('GCS non-testable component is never scored as normal', () => {
    const r = sc.gcs({ E: 4, V: 'NT', M: 6 });
    expect(r.ok).toBe(true);
    if (r.ok && 'total' in r) {
      expect(r.total).toBeNull();
      expect(r.documentation).toBe('E4 VNT M6');
      expect(r.display).not.toBe('15');
      expect(r.display).not.toBe('11');
    }
  });
  it('GCS requires all components', () => expect(sc.gcs({ E: 4, M: 6 }).ok).toBe(false));
  it('GCS deterioration produces critical note', () => {
    const r = sc.gcs({ E: 3, V: 4, M: 6 }, true);
    expect(r.ok && 'notes' in r && r.notes[0]?.severity).toBe('critical');
  });
  it('APGAR', () => {
    const r = sc.apgar({ appearance: 1, pulse: 2, grimace: 2, activity: 2, respiration: 2 }, 1);
    expect(val(r)).toBe(9);
    expect(sc.apgar({ appearance: 1 }, 1).ok).toBe(false);
  });
  it('qSOFA never claims diagnosis', () => {
    const r = sc.qsofa({ rr: 1, mental: 1, sbp: 0 });
    expect(val(r)).toBe(2);
    expect(r.ok && r.notes.some((n) => /does not diagnose/.test(n.text))).toBe(true);
  });
  it('Bishop', () => expect(val(sc.bishop({ dilation: 2, effacement: 2, station: 2, consistency: 1, position: 1 }))).toBe(8));
  it('Glasgow-Blatchford', () => {
    expect(val(sc.glasgowBlatchford({ ureaMmolL: 5, hbGdl: 14, sex: 'male', sbp: 130, pulse: 80, melaena: false, syncope: false, hepatic: false, cardiacFailure: false }))).toBe(0);
    // urea 9 →3, Hb 11 male →3, SBP 95 →2, pulse 105 →1, melaena →1, syncope →2 = 12
    expect(val(sc.glasgowBlatchford({ ureaMmolL: 9, hbGdl: 11, sex: 'male', sbp: 95, pulse: 105, melaena: true, syncope: true, hepatic: false, cardiacFailure: false }))).toBe(12);
    // female Hb 11 → 1
    expect(val(sc.glasgowBlatchford({ ureaMmolL: 5, hbGdl: 11, sex: 'female', sbp: 130, pulse: 80, melaena: false, syncope: false, hepatic: false, cardiacFailure: false }))).toBe(1);
  });
});

describe('fluids & urine', () => {
  it('2000 in, 1500 out = +500', () => expect(val(fl.fluidBalance({ intakeMl: 2000, outputMl: 1500 }))).toBe(500));
  it('30 mL over 1 h, 60 kg = 0.5 mL/kg/hr', () => expect(val(fl.urineOutput({ volumeMl: 30, hours: 1, weightKg: 60 }))).toBe(0.5));
  it('urine output rejects zero hours and missing weight', () => {
    err(fl.urineOutput({ volumeMl: 30, hours: 0, weightKg: 60 }));
    err(fl.urineOutput({ volumeMl: 30, hours: 1, weightKg: NaN }));
  });
  it('summary separates measured and estimated losses', () => {
    const s = fl.fluidSummary([
      { id: '1', kind: 'in', cat: 'oral', ml: 500, time: '08:00' },
      { id: '2', kind: 'in', cat: 'iv', ml: 1000, time: '09:00' },
      { id: '3', kind: 'out', cat: 'urine', ml: 600, time: '10:00' },
      { id: '4', kind: 'out', cat: 'drainage', ml: 100, time: '11:00', estimated: true },
    ]);
    expect(s).toMatchObject({ intake: 1500, output: 700, measuredOutput: 600, estimatedOutput: 100, net: 800, urine: 600 });
    expect(s.running.map((r) => r.net)).toEqual([500, 1500, 900, 800]);
    expect(() => fl.fluidSummary([{ id: 'x', kind: 'in', cat: 'oral', ml: -5, time: '08:00' }])).toThrow();
  });
});

describe('vitals', () => {
  it('MAP 120/80 ≈ 93.33', () => expect(val(cl.meanArterialPressure({ sbp: 120, dbp: 80 }))).toBeCloseTo(93.3333, 4));
  it('rejects swapped BP', () => err(cl.meanArterialPressure({ sbp: 80, dbp: 120 })));
  it('pulse pressure, shock index, deficit, rate', () => {
    expect(val(cl.pulsePressure({ sbp: 120, dbp: 80 }))).toBe(40);
    expect(val(cl.shockIndex({ hr: 110, sbp: 100 }))).toBeCloseTo(1.1, 12);
    expect(val(cl.pulseDeficit({ apical: 96, radial: 80 }))).toBe(16);
    expect(val(cl.rateFromCount({ count: 18, seconds: 15 }))).toBe(72);
    err(cl.shockIndex({ hr: 100, sbp: 0 }));
  });
  it('temperature both directions', () => {
    expect(val(cl.temperature({ value: 37, from: 'C' }))).toBeCloseTo(98.6, 10);
    expect(val(cl.temperature({ value: 212, from: 'F' }))).toBeCloseTo(100, 10);
  });
});

describe('paediatrics', () => {
  it.each([
    [25, 65],
    [10, 40],
    [15, 50],
    [5, 20],
    [20, 60],
  ])('Holliday–Segar %i kg = %i mL/hr', (w, e) => expect(val(cl.hollidaySegar({ weightKg: w }))).toBeCloseTo(e, 10));
  it('rejects zero weight', () => err(cl.hollidaySegar({ weightKg: 0 })));
});

describe('oxygen', () => {
  it('E cylinder, 2000 psi, 200 reserve, 2 L/min', () => {
    // (2000-200)*0.28/2 = 252 min
    const r = cl.cylinderDuration({ cylinder: 'E', pressurePsi: 2000, reservePsi: 200, flowLMin: 2 });
    expect(val(r)).toBeCloseTo(252, 10);
    expect(r.ok && r.extras.some((e) => e.value.includes('0.28'))).toBe(true);
  });
  it('uses the cylinder-specific factor', () => {
    expect(val(cl.cylinderDuration({ cylinder: 'D', pressurePsi: 2000, reservePsi: 200, flowLMin: 2 }))).toBeCloseTo(144, 10);
  });
  it('rejects pressure below reserve, zero flow, unknown cylinder', () => {
    err(cl.cylinderDuration({ cylinder: 'E', pressurePsi: 150, reservePsi: 200, flowLMin: 2 }));
    err(cl.cylinderDuration({ cylinder: 'E', pressurePsi: 2000, reservePsi: 200, flowLMin: 0 }));
    err(cl.cylinderDuration({ cylinder: 'Z', pressurePsi: 2000, reservePsi: 200, flowLMin: 2 }));
    err(cl.cylinderDuration({ cylinder: 'custom', pressurePsi: 2000, reservePsi: 200, flowLMin: 2 }));
  });
  it('litres method', () => expect(val(cl.cylinderDurationLitres({ waterCapacityL: 2, pressureBar: 137, reserveBar: 7, flowLMin: 2 }))).toBe(130));
});

describe('nutrition, renal, lab, transfusion, obstetric, wound', () => {
  it('macros', () => expect(val(cl.macroCalories({ carbG: 50, proteinG: 20, fatG: 10 }))).toBe(370));
  it('enteral and % target', () => {
    expect(val(cl.enteralRate({ volumeMl: 1200, hours: 20 }))).toBe(60);
    err(cl.enteralRate({ volumeMl: 1200, hours: 25 }));
    expect(val(cl.percentOfTarget({ actual: 1500, target: 2000, unitLabel: 'kcal' }))).toBe(75);
    expect(val(cl.proteinPerKg({ proteinG: 84, weightKg: 70 }))).toBeCloseTo(1.2, 12);
  });
  it('Cockcroft–Gault with female adjustment', () => {
    // (140-60)*70/(72*1) = 77.78; female ×0.85 = 66.11
    expect(val(cl.cockcroftGault({ age: 60, weightKg: 70, scrMgDl: 1, sex: 'male', weightLabel: 'actual' }))).toBeCloseTo(77.7778, 3);
    expect(val(cl.cockcroftGault({ age: 60, weightKg: 70, scrMgDl: 1, sex: 'female', weightLabel: 'actual' }))).toBeCloseTo(66.1111, 3);
    err(cl.cockcroftGault({ age: 10, weightKg: 30, scrMgDl: 0.5, sex: 'male', weightLabel: 'actual' }));
    // µmol/L conversion
    expect(convert(88.4, 'cr_umol', 'cr_mgdl')).toBeCloseTo(1, 10);
  });
  it('glucose', () => {
    expect(val(cl.glucoseConvert({ value: 180.16, from: 'glu_mgdl' }))).toBeCloseTo(10, 10);
    expect(val(cl.glucoseConvert({ value: 5.5, from: 'glu_mmol' }))).toBeCloseTo(99.088, 3);
  });
  it('dose to volume requires concentration', () => {
    expect(val(cl.doseToVolume({ dose: 20, concentration: 2, doseUnit: 'mEq' }))).toBe(10);
    err(cl.doseToVolume({ dose: 20, concentration: NaN, doseUnit: 'mEq' }));
  });
  it('blood loss % and transfusion rate', () => {
    expect(val(cl.bloodLossPercent({ lossMl: 700, weightKg: 70, mlPerKg: 70 }))).toBeCloseTo(14.2857, 3);
    expect(val(cl.transfusionRate({ volumeMl: 300, minutes: 180 }))).toBe(100);
  });
  it('Naegele EDD and GA, invalid dates', () => {
    const r = cl.naegele({ lmp: '2026-01-01', today: '2026-03-01' });
    expect(r.ok && r.display).toBe('2026-10-08');
    expect(val(r)).toBe(59); // 8w 3d
    err(cl.naegele({ lmp: '2026-02-30', today: '2026-03-01' }));
    err(cl.naegele({ lmp: '2026-05-01', today: '2026-03-01' }));
  });
  it('newborn weight loss', () => expect(val(cl.newbornWeightLoss({ birthG: 3500, currentG: 3290 }))).toBeCloseTo(6, 10));
  it('contractions handle midnight', () => {
    const r = cl.contractions({ startTimes: ['23:56', '23:59', '00:02'], durationsSec: [50, 60, 55] });
    expect(val(r)).toBeCloseTo(3, 10);
  });
  it('wound area, volume, % change', () => {
    const r = cl.woundMeasure({ lengthCm: 4, widthCm: 3, depthCm: 0.5, prevAreaCm2: 16 });
    expect(val(r)).toBe(12);
    expect(r.ok && r.extras.map((e) => e.value)).toEqual(['6 cm³', '-25 % (smaller)']);
  });
});

describe('units & numerics', () => {
  it('mass/volume/time conversions', () => {
    expect(convert(1, 'g', 'mcg')).toBe(1_000_000);
    expect(convert(1, 'L', 'uL')).toBe(1_000_000);
    expect(convert(90, 'min', 'hr')).toBe(1.5);
    expect(convert(1, 'day', 's')).toBeCloseTo(86400, 6);
    expect(convert(1, 'g/100mL', 'mg/mL')).toBe(10);
    expect(convert(101.325, 'kPa', 'mmHg')).toBeCloseTo(760, 10);
  });
  it('refuses incompatible units (no silent mass↔volume)', () => {
    expect(compatible('mg', 'mL')).toBe(false);
    expect(() => convert(1, 'mg', 'mL')).toThrow(/different things/);
    expect(() => convert(1, 'mL/hr', 'L/min')).toThrow();
    expect(() => convert(1, 'U', 'mg')).toThrow();
  });
  it('rounding avoids float artefacts', () => {
    expect(roundTo(1.005, 2)).toBe(1.01);
    expect(roundTo(2.675, 2)).toBe(2.68);
    expect(roundTo(-1.005, 2)).toBe(-1.01);
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(roundTo(0.1 + 0.2, 10)).toBe(0.3);
    expect(fmt(1234.5, 1)).toBe('1,234.5');
  });
  it('extremely large values remain finite and are flagged', () => {
    const r = iv.pumpRate({ volumeMl: 1e9, timeHr: 1 });
    expect(r.ok && r.notes.some((n) => n.severity === 'warning')).toBe(true);
    err(iv.pumpRate({ volumeMl: 1e309, timeHr: 1 }));
  });
});
