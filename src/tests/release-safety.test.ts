// Release-safety suite (v1.2.0 Play release audit).
//
// 1. End-to-end through the registry `run` wiring — the same path the UI uses — so
//    unit conversion (mcg↔mg, lb→kg) is exercised, not just the pure engine.
// 2. Worked examples from the primary sources / standard texts, computed by hand.
// 3. A sweep of EVERY number field of EVERY form calculator with zero, negative,
//    huge, tiny and non-numeric input: the result must be a clear error or a finite
//    value — never NaN/Infinity presented as an answer, never an uncaught crash.
// 4. Reference integrity: every calculator points at a reference that exists.
import { describe, expect, it } from 'vitest';
import type { CalcResult } from '../calculations/core';
import { CALCULATORS } from '../features/registry';
import { DEFAULT_SETTINGS } from '../storage/store';
import { FormValues, type CalcDef } from '../features/types';
import { REFERENCES } from '../references/manifest';
import * as med from '../calculations/medication';
import * as iv from '../calculations/iv';
import * as body from '../calculations/body';
import * as sc from '../calculations/scores';
import * as cl from '../calculations/clinical';
import { isNative, onAndroidBack, syncSystemBars } from '../native';

const calc = (id: string): CalcDef => {
  const d = CALCULATORS.find((c) => c.id === id);
  if (!d) throw new Error(`no calculator ${id}`);
  return d;
};

/** Run a calculator exactly as the UI does (UI wraps run() in try/catch). */
function runUi(id: string, raw: Record<string, string>): CalcResult {
  const def = calc(id);
  try {
    return def.run!(new FormValues({ ...(def.defaults ?? {}), ...raw }), DEFAULT_SETTINGS);
  } catch (e) {
    return { ok: false, errors: [{ message: e instanceof Error ? e.message : String(e) }] };
  }
}
const val = (r: CalcResult) => {
  if (!r.ok) throw new Error('expected ok: ' + r.errors.map((e) => e.message).join('; '));
  return r.value;
};
const errText = (r: CalcResult) => (r.ok ? '' : r.errors.map((e) => e.message).join(' | '));

describe('unit handling end-to-end (registry wiring)', () => {
  it('drug dose converts mcg orders to the strength unit on hand', () => {
    // 500 mcg ordered, 0.25 mg tablets → 0.5 mg ÷ 0.25 mg × 1 = 2 tablets
    const r = runUi('drug-dose', { desired: '500', 'desired@': 'mcg', available: '0.25', 'available@': 'mg', quantity: '1', form: 'tablet(s)' });
    expect(val(r)).toBeCloseTo(2, 12);
  });

  it('drug dose refuses incompatible units (mEq vs mg) instead of guessing', () => {
    const r = runUi('drug-dose', { desired: '20', 'desired@': 'mEq', available: '750', 'available@': 'mg', quantity: '1', form: 'tablet(s)' });
    expect(r.ok).toBe(false);
    expect(errText(r)).toMatch(/Cannot convert/);
  });

  it('weight entered in lb is converted to kg before a per-kg dose (no 2.2× error)', () => {
    // 44 lb = 19.958 kg; × 10 mg/kg/dose = 199.58 mg
    const r = runUi('weight-dose', { weight: '44', 'weight@': 'lb', dosePerKg: '10', doseUnit: 'mg', basis: 'perDose' });
    expect(val(r)).toBeCloseTo(44 * 0.45359237 * 10, 9);
  });

  it('mg/kg/day orders are never divided by an assumed frequency', () => {
    const r = runUi('weight-dose', { weight: '20', 'weight@': 'kg', dosePerKg: '30', doseUnit: 'mg', basis: 'perDay' });
    expect(r.ok).toBe(false);
    expect(errText(r)).toMatch(/doses per day/i);
    expect(val(runUi('weight-dose', { weight: '20', 'weight@': 'kg', dosePerKg: '30', doseUnit: 'mg', basis: 'perDay', dosesPerDay: '3' }))).toBeCloseTo(200, 12);
  });
});

describe('worked examples from primary sources and standard texts (hand-computed)', () => {
  it.each<[string, () => CalcResult, number, number]>([
    // Mosteller (NEJM 1987): √(170 × 70 / 3600) = √3.30556 = 1.81812
    ['Mosteller 170 cm, 70 kg', () => body.bsaMosteller({ heightCm: 170, weightKg: 70 }), Math.sqrt((170 * 70) / 3600), 12],
    // Devine (1974): male 50 + 2.3 × 12 = 77.6 kg at 72 in
    ['Devine male 72 in', () => body.idealBodyWeight({ heightCm: 72 * 2.54, sex: 'male' }), 77.6, 9],
    // Cockcroft–Gault (1976): (140 − 60) × 70 / (72 × 1.0) = 77.78 mL/min
    ['Cockcroft–Gault male 60 y 70 kg SCr 1.0', () => cl.cockcroftGault({ age: 60, weightKg: 70, scrMgDl: 1, sex: 'male', weightLabel: 'actual' }), 5600 / 72, 9],
    // Holliday–Segar (1957): 25 kg → 40 + 20 + 5 = 65 mL/hr
    ['Holliday–Segar 25 kg', () => cl.hollidaySegar({ weightKg: 25 }), 65, 12],
    // E cylinder: (2000 − 200) × 0.28 ÷ 2 = 252 min
    ['E cylinder 2000 psi, 200 reserve, 2 L/min', () => cl.cylinderDuration({ cylinder: 'E', pressurePsi: 2000, reservePsi: 200, flowLMin: 2 }), 252, 9],
    // 1 % w/v = 1 g / 100 mL = 10 mg/mL; 1:1000 = 1 mg/mL
    ['1 % w/v', () => med.percentToMgPerMl(1), 10, 12],
    ['1:1000', () => med.ratioToMgPerMl(1000), 1, 12],
    // Gravity drip: 500 mL × 15 gtt/mL ÷ 240 min = 31.25 gtt/min
    ['Drip 500 mL / 4 h / 15 gtt/mL', () => iv.dripRate({ volumeMl: 500, timeMin: 240, dropFactor: 15 }), 31.25, 12],
    // Pump: 1000 mL ÷ 8 h = 125 mL/hr
    ['Pump 1000 mL / 8 h', () => iv.pumpRate({ volumeMl: 1000, timeHr: 8 }), 125, 12],
    // Norepinephrine-style: 8 mcg/min, 4 mg/250 mL → 0.48 mg/hr ÷ 0.016 mg/mL = 30 mL/hr
    ['8 mcg/min at 4 mg/250 mL', () => iv.rateFromDose({ dose: 8, doseUnit: 'mcg/min', concMgPerMl: 4 / 250 }), 30, 9],
    // Heparin 18 units/kg/hr × 80 kg at 100 units/mL = 14.4 mL/hr
    ['Heparin 18 U/kg/hr × 80 kg @ 100 U/mL', () => med.heparinInfusion({ mode: 'weightBased', concUnitsPerMl: 100, unitsPerKgHr: 18, weightKg: 80 }), 14.4, 9],
    // Insulin U-100: 12 units → 0.12 mL
    ['Insulin 12 units U-100', () => med.insulinVolume({ orderedUnits: 12, concUnitsPerMl: 100 }), 0.12, 12],
    // Glucose 180 mg/dL ÷ 18.016 = 9.991 mmol/L; creatinine 1 mg/dL = 88.42 µmol/L
    ['Glucose 180 mg/dL', () => cl.glucoseConvert({ value: 180, from: 'glu_mgdl' }), 180 / 18.016, 9],
    ['Creatinine 1 mg/dL', () => cl.creatinineConvert({ value: 1, from: 'cr_mgdl' }), 88.42, 9],
  ])('%s', (_n, f, expected, digits) => {
    expect(val(f())).toBeCloseTo(expected, digits);
  });

  it('Naegele: LMP 1 Jan 2026 → EDD 8 Oct 2026 (LMP + 280 days)', () => {
    const r = cl.naegele({ lmp: '2026-01-01', today: '2026-01-01' });
    expect(r.ok && r.display).toBe('2026-10-08');
  });

  it('score ranges match the published maxima', () => {
    const top = (items: sc.ScoreItem[]) => Object.fromEntries(items.map((i) => [i.key, Math.max(...i.options.map((o) => o.points))]));
    const bottom = (items: sc.ScoreItem[]) => Object.fromEntries(items.map((i) => [i.key, Math.min(...i.options.map((o) => o.points))]));
    expect(sc.gcs(top(sc.GCS_ITEMS)).ok && (sc.gcs(top(sc.GCS_ITEMS)) as { total: number }).total).toBe(15);
    expect((sc.gcs(bottom(sc.GCS_ITEMS)) as { total: number }).total).toBe(3);
    expect(val(sc.apgar(top(sc.APGAR_ITEMS), 1) as CalcResult)).toBe(10);
    expect(val(sc.bishop(top(sc.BISHOP_ITEMS)) as CalcResult)).toBe(13);
    expect(val(sc.qsofa(top(sc.QSOFA_ITEMS)) as CalcResult)).toBe(3);
    const gbsMax = sc.glasgowBlatchford({ ureaMmolL: 30, hbGdl: 8, sex: 'male', sbp: 80, pulse: 120, melaena: true, syncope: true, hepatic: true, cardiacFailure: true });
    expect(val(gbsMax as CalcResult)).toBe(23);
    const gbsMin = sc.glasgowBlatchford({ ureaMmolL: 5, hbGdl: 14, sex: 'male', sbp: 120, pulse: 70, melaena: false, syncope: false, hepatic: false, cardiacFailure: false });
    expect(val(gbsMin as CalcResult)).toBe(0);
  });
});

describe('high-risk calculation guards', () => {
  it('a dose above the supplied maximum is flagged critical, never "within range"', () => {
    const r = med.doseRangeCheck({ weightKg: 10, minPerKg: 10, maxPerKg: 15, basis: 'perDose', orderedDose: 200, doseUnit: 'mg' });
    expect(r.ok && r.interpretation).toMatch(/ABOVE/);
    expect(r.ok && r.notes.some((n) => n.severity === 'critical')).toBe(true);
  });

  it('insulin and heparin always carry the high-alert double-check note', () => {
    for (const r of [med.insulinVolume({ orderedUnits: 10, concUnitsPerMl: 100 }), med.heparinInfusion({ mode: 'rateFromDose', concUnitsPerMl: 100, unitsPerHr: 1000 })]) {
      expect(r.ok && r.notes.some((n) => /HIGH-ALERT/.test(n.text))).toBe(true);
    }
  });

  it('non-U-100 insulin warns against a standard U-100 syringe', () => {
    const r = med.insulinVolume({ orderedUnits: 50, concUnitsPerMl: 500 });
    expect(r.ok && r.notes.some((n) => n.severity === 'critical' && /U-100 syringe/.test(n.text))).toBe(true);
  });

  it('pump rates round once, at the end, to the pump precision setting', () => {
    const r = iv.rateFromDose({ dose: 0.05, doseUnit: 'mcg/kg/min', concMgPerMl: 0.064, weightKg: 73, pumpDp: 1 });
    // exact 3.421875 mL/hr → 3.4
    expect(r.ok && r.value).toBeCloseTo((0.05 * 73 * 60) / 1000 / 0.064, 12);
    expect(r.ok && r.display).toBe('3.4');
  });

  it('drip rates are whole drops but expose the exact value', () => {
    const r = iv.dripRate({ volumeMl: 1000, timeMin: 480, dropFactor: 15 });
    expect(r.ok && r.display).toBe('31');
    expect(r.ok && r.extras.find((e) => e.label === 'Exact rate')?.value).toBe('31.25 gtt/min');
  });
});

describe('input sweep: every number field of every form calculator', () => {
  const BAD = ['0', '-5', '1e309', '1e-300', 'abc', '2,5', ''];
  const formCalcs = CALCULATORS.filter((c) => c.run && c.example && c.fields);

  it('covers the form calculators', () => {
    expect(formCalcs.length).toBeGreaterThanOrEqual(45);
  });

  for (const def of formCalcs) {
    const numberFields = (def.fields ?? []).filter((f) => f.kind === 'number');
    it(`${def.id}: example works and no bad input yields a non-finite answer`, () => {
      const base = { ...(def.defaults ?? {}), ...(def.example ?? {}) };
      const ex = runUi(def.id, base);
      expect(ex.ok, `${def.id} example: ${errText(ex)}`).toBe(true);
      expect(Number.isFinite((ex as { value: number }).value) || def.id === 'gcs' || def.id === 'gcs-em').toBe(true);
      for (const f of numberFields) {
        for (const bad of BAD) {
          const r = runUi(def.id, { ...base, [f.key]: bad });
          if (r.ok) {
            expect(Number.isFinite(r.value), `${def.id}.${f.key}=${bad} gave ${r.value}`).toBe(true);
            expect(r.display, `${def.id}.${f.key}=${bad}`).not.toMatch(/NaN|Infinity|∞/);
          } else {
            expect(r.errors.length).toBeGreaterThan(0);
            for (const e of r.errors) expect(e.message.length).toBeGreaterThan(5);
          }
        }
      }
      // Pairwise extremes: one value huge, another tiny, so quotients and products
      // overflow. The engine must refuse rather than show Infinity.
      for (const a of numberFields) {
        for (const b of numberFields) {
          if (a === b) continue;
          const r = runUi(def.id, { ...base, [a.key]: '1e300', [b.key]: '1e-300' });
          if (r.ok) {
            expect(Number.isFinite(r.value), `${def.id}: ${a.key}=1e300, ${b.key}=1e-300 gave ${r.value}`).toBe(true);
            expect(r.display).not.toMatch(/NaN|Infinity|∞/);
            for (const x of r.extras) expect(x.value, `${def.id} extra ${x.label}`).not.toMatch(/NaN|Infinity|∞/);
          }
        }
      }
    });
  }
});

describe('reference integrity', () => {
  it('every calculator reference id exists in the reference manifest', () => {
    const ids = new Set(REFERENCES.map((r) => r.id));
    const missing = CALCULATORS.flatMap((c) => c.refs.filter((r) => !ids.has(r)).map((r) => `${c.id} → ${r}`));
    expect(missing).toEqual([]);
  });

  it('no reference is presented as clinically reviewed without a named reviewer', () => {
    for (const r of REFERENCES) {
      if (r.status === 'reviewed') expect(r.reviewer, r.id).toBeTruthy();
    }
  });
});

describe('native bridge is inert outside the Android shell', () => {
  it('reports non-native and never throws in a browser/test environment', () => {
    expect(isNative()).toBe(false);
    expect(() => syncSystemBars('dark')).not.toThrow();
    const dispose = onAndroidBack(() => true);
    expect(typeof dispose).toBe('function');
    expect(() => dispose()).not.toThrow();
  });
});
