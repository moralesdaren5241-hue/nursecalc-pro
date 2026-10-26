// Core result types and the validation layer shared by every calculation.
// Calculation functions are pure: numbers in, a CalcResult out. No UI, no storage.

export type Severity = 'info' | 'warning' | 'critical';

export interface Note {
  severity: Severity;
  text: string;
}

export interface ExtraValue {
  label: string;
  value: string;
}

export interface CalcOk {
  ok: true;
  /** Exact, unrounded value. */
  value: number;
  unit: string;
  /** Value as it should be displayed (rounded per `rounding`). */
  display: string;
  formula: string;
  substitution: string;
  steps: string[];
  rounding: string;
  extras: ExtraValue[];
  notes: Note[];
  /** Neutral, descriptive interpretation (never "safe"/"approved"). */
  interpretation?: string;
}

export interface FieldError {
  field?: string;
  message: string;
}

export interface CalcErr {
  ok: false;
  errors: FieldError[];
}

export type CalcResult = CalcOk | CalcErr;

export class ValidationError extends Error {
  constructor(public errors: FieldError[]) {
    super(errors.map((e) => e.message).join('; '));
  }
}

/** Collects validation problems, then throws once with all of them. */
export class Check {
  private errors: FieldError[] = [];

  finite(field: string, label: string, v: number | undefined | null): this {
    if (v === undefined || v === null || Number.isNaN(v)) {
      this.errors.push({ field, message: `${label} is required. Enter a number.` });
    } else if (!Number.isFinite(v)) {
      this.errors.push({ field, message: `${label} must be a finite number.` });
    }
    return this;
  }

  positive(field: string, label: string, v: number | undefined | null): this {
    const before = this.errors.length;
    this.finite(field, label, v);
    if (this.errors.length === before && (v as number) <= 0) {
      this.errors.push({ field, message: `${label} must be greater than zero.` });
    }
    return this;
  }

  nonNegative(field: string, label: string, v: number | undefined | null): this {
    const before = this.errors.length;
    this.finite(field, label, v);
    if (this.errors.length === before && (v as number) < 0) {
      this.errors.push({ field, message: `${label} cannot be negative.` });
    }
    return this;
  }

  range(field: string, label: string, v: number | undefined | null, min: number, max: number): this {
    const before = this.errors.length;
    this.finite(field, label, v);
    if (this.errors.length === before && ((v as number) < min || (v as number) > max)) {
      this.errors.push({ field, message: `${label} must be between ${min} and ${max}.` });
    }
    return this;
  }

  integer(field: string, label: string, v: number | undefined | null): this {
    const before = this.errors.length;
    this.finite(field, label, v);
    if (this.errors.length === before && !Number.isInteger(v)) {
      this.errors.push({ field, message: `${label} must be a whole number.` });
    }
    return this;
  }

  rule(ok: boolean, message: string, field?: string): this {
    if (!ok) this.errors.push({ field, message });
    return this;
  }

  done(): void {
    if (this.errors.length) throw new ValidationError(this.errors);
  }
}

/** Run a calculation body, converting ValidationError into a CalcErr. */
export function attempt(fn: () => CalcOk): CalcResult {
  try {
    const r = fn();
    // Overflow guard: a valid-looking input set can still produce Infinity/NaN
    // (e.g. 1e308 ÷ 0.000000001). Never present that as a result.
    const bad = !Number.isFinite(r.value) || /NaN|Infinity|∞/.test(r.display) || r.extras.some((e) => /NaN|Infinity|∞/.test(e.value));
    if (bad) return { ok: false, errors: [{ message: 'The result is too large or too small to be meaningful. Check each value for a typing or unit error.' }] };
    return r;
  } catch (e) {
    if (e instanceof ValidationError) return { ok: false, errors: e.errors };
    if (e instanceof Error && e.name === 'UnitError') return { ok: false, errors: [{ message: e.message }] };
    throw e;
  }
}

/** Round half away from zero to `dp` decimals, avoiding binary-float artefacts (1.005 → 1.01). */
export function roundTo(n: number, dp: number): number {
  if (!Number.isFinite(n)) return n;
  const sign = n < 0 ? -1 : 1;
  const shifted = Number(Math.abs(n).toExponential(15)) * Math.pow(10, dp);
  return (sign * Math.round(Number(shifted.toPrecision(15)))) / Math.pow(10, dp);
}

/** Format for display: round, then drop trailing zeros; thousands separators. */
export function fmt(n: number, dp = 2): string {
  const r = roundTo(n, dp);
  return r.toLocaleString('en-US', { maximumFractionDigits: dp, minimumFractionDigits: 0 });
}

export function ok(r: Omit<CalcOk, 'ok' | 'extras' | 'notes'> & Partial<Pick<CalcOk, 'extras' | 'notes'>>): CalcOk {
  return { ok: true, extras: [], notes: [], ...r };
}

export const note = (severity: Severity, text: string): Note => ({ severity, text });

/** Soft plausibility warning — never blocks the calculation. */
export function plausibility(label: string, v: number, lo: number, hi: number, unit: string): Note | null {
  if (v < lo || v > hi) {
    return note('warning', `${label} of ${fmt(v, 3)} ${unit} is outside the usual range (${lo}–${hi} ${unit}). Check for a typing or unit error.`);
  }
  return null;
}

export function compact<T>(xs: (T | null | undefined | false)[]): T[] {
  return xs.filter(Boolean) as T[];
}

export type Parsed = { ok: true; value: number } | { ok: false; message: string };

/**
 * Strict number parsing for clinical input. Never guesses:
 *  - "1,000" / "12,500.5" (comma thousands groups) are accepted.
 *  - "2,5" / "0,25" (comma decimals) are REJECTED with a specific message —
 *    silently stripping the comma would turn 2,5 into 25 (a 10× error).
 *  - Anything else that is not a plain decimal number is rejected.
 */
export function parseNumber(input: string): Parsed {
  const s = input.trim();
  if (s === '') return { ok: false, message: 'Enter a number.' };
  if (/^[-+]?\d{1,3}(,\d{3})+(\.\d*)?$/.test(s)) return { ok: true, value: Number(s.replace(/,/g, '')) };
  if (/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return { ok: true, value: Number(s) };
  if (/^[-+]?\d*,\d+$/.test(s)) return { ok: false, message: 'Use a decimal point, not a comma (write 2.5, not 2,5).' };
  return { ok: false, message: 'Use digits and a decimal point only (e.g. 2.5).' };
}
