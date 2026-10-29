// Unit-aware conversion layer. Every unit belongs to exactly one dimension, and
// conversion between dimensions is impossible by construction (throws UnitError).
// Mass and volume, concentration and dose, per-minute and per-hour rates are
// different dimensions and never convert silently.

export type Dimension =
  | 'mass'
  | 'volume'
  | 'length'
  | 'time'
  | 'pressure'
  | 'activity' // units (U) — insulin, heparin
  | 'milliequivalent'
  | 'amount' // mmol
  | 'massConc' // mass per volume
  | 'glucose'
  | 'creatinine'
  | 'temperature'
  | 'volumeRate' // mL/hr etc.
  | 'flow'; // L/min oxygen

export interface UnitDef {
  id: string;
  label: string;
  dim: Dimension;
  /** Multiply by this to reach the dimension's base unit. */
  toBase: number;
  /** For affine units (temperature): base = value*toBase + offset. */
  offset?: number;
  aliases?: string[];
}

const U = (id: string, label: string, dim: Dimension, toBase: number, aliases: string[] = [], offset?: number): UnitDef => ({
  id, label, dim, toBase, aliases, offset,
});

// Base units: mass=mg, volume=mL, length=cm, time=min, pressure=mmHg, activity=U,
// mEq, mmol, massConc=mg/mL, glucose=mg/dL, creatinine=mg/dL, temperature=°C,
// volumeRate=mL/hr, flow=L/min.
export const UNITS: UnitDef[] = [
  U('mcg', 'mcg', 'mass', 0.001, ['µg', 'ug', 'microgram']),
  U('mg', 'mg', 'mass', 1, ['milligram']),
  U('g', 'g', 'mass', 1000, ['gram']),
  U('kg', 'kg', 'mass', 1_000_000, ['kilogram']),
  U('lb', 'lb', 'mass', 453_592.37, ['pound', 'lbs']),
  U('uL', 'µL', 'volume', 0.001, ['microliter', 'ul']),
  U('mL', 'mL', 'volume', 1, ['ml', 'cc', 'milliliter']),
  U('L', 'L', 'volume', 1000, ['liter', 'litre']),
  U('mm', 'mm', 'length', 0.1, ['millimeter']),
  U('cm', 'cm', 'length', 1, ['centimeter']),
  U('m', 'm', 'length', 100, ['meter', 'metre']),
  U('in', 'in', 'length', 2.54, ['inch', 'inches']),
  U('s', 'seconds', 'time', 1 / 60, ['sec', 'second']),
  U('min', 'minutes', 'time', 1, ['minute']),
  U('hr', 'hours', 'time', 60, ['hour', 'h']),
  U('day', 'days', 'time', 1440, ['d']),
  U('mmHg', 'mmHg', 'pressure', 1),
  U('kPa', 'kPa', 'pressure', 760 / 101.325),
  U('U', 'units', 'activity', 1, ['unit', 'units', 'IU']),
  U('mEq', 'mEq', 'milliequivalent', 1),
  U('mmol', 'mmol', 'amount', 1),
  U('mcg/mL', 'mcg/mL', 'massConc', 0.001),
  U('mg/mL', 'mg/mL', 'massConc', 1),
  U('g/L', 'g/L', 'massConc', 1), // 1 g/L = 1 mg/mL
  U('g/100mL', '% w/v (g/100 mL)', 'massConc', 10, ['percent', '%']),
  U('glu_mgdl', 'mg/dL', 'glucose', 1),
  U('glu_mmol', 'mmol/L', 'glucose', 18.016), // glucose molar mass 180.16 g/mol
  U('cr_mgdl', 'mg/dL', 'creatinine', 1),
  U('cr_umol', 'µmol/L', 'creatinine', 1 / 88.4), // 88.4 µmol/L per mg/dL (standard SI factor; creatinine 113.12 g/mol → 88.40)
  U('C', '°C', 'temperature', 1, ['celsius']),
  U('F', '°F', 'temperature', 5 / 9, ['fahrenheit'], -32 * (5 / 9)),
  U('mL/hr', 'mL/hr', 'volumeRate', 1),
  U('mL/min', 'mL/min', 'volumeRate', 60),
  U('L/min', 'L/min', 'flow', 1),
];

const byId = new Map(UNITS.map((u) => [u.id, u]));

export class UnitError extends Error {
  name = 'UnitError';
}

export function unit(id: string): UnitDef {
  const u = byId.get(id);
  if (!u) throw new UnitError(`Unknown unit "${id}".`);
  return u;
}

export function compatible(a: string, b: string): boolean {
  return unit(a).dim === unit(b).dim;
}

export function convert(value: number, from: string, to: string): number {
  const f = unit(from);
  const t = unit(to);
  if (f.dim !== t.dim) {
    throw new UnitError(`Cannot convert ${f.label} (${f.dim}) to ${t.label} (${t.dim}) — these measure different things.`);
  }
  if (from === to) return value;
  const base = value * f.toBase + (f.offset ?? 0);
  return (base - (t.offset ?? 0)) / t.toBase;
}

/** Describe the factor used, e.g. "1 g = 1,000 mg". */
export function factorText(from: string, to: string): string {
  const f = unit(from);
  const t = unit(to);
  if (f.dim === 'temperature') {
    return from === 'C' ? '°F = °C × 9/5 + 32' : '°C = (°F − 32) × 5/9';
  }
  const factor = convert(1, from, to);
  const pretty = Number(factor.toPrecision(10)).toLocaleString('en-US', { maximumSignificantDigits: 10 });
  return `1 ${f.label} = ${pretty} ${t.label}`;
}

export function unitsOf(dim: Dimension): UnitDef[] {
  return UNITS.filter((u) => u.dim === dim);
}

export function searchUnits(q: string): UnitDef[] {
  const s = q.trim().toLowerCase();
  if (!s) return UNITS;
  return UNITS.filter(
    (u) => u.label.toLowerCase().includes(s) || u.id.toLowerCase().includes(s) || (u.aliases ?? []).some((a) => a.toLowerCase().includes(s)),
  );
}

export interface Quantity {
  value: number;
  unit: string;
}

/** Convert a user-entered quantity into the unit a formula needs. */
export function as(q: Quantity, to: string): number {
  return convert(q.value, q.unit, to);
}
