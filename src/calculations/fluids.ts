import { Check, attempt, compact, fmt, note, ok, plausibility, type CalcResult } from './core';

export type IntakeCat = 'oral' | 'enteral' | 'iv' | 'medication' | 'flush' | 'otherIn';
export type OutputCat = 'urine' | 'vomit' | 'drainage' | 'otherOut';

export const INTAKE_LABELS: Record<IntakeCat, string> = {
  oral: 'Oral fluids', enteral: 'Enteral feeding', iv: 'IV fluids', medication: 'Medication fluids', flush: 'Flushes', otherIn: 'Other documented intake',
};
export const OUTPUT_LABELS: Record<OutputCat, string> = {
  urine: 'Urine', vomit: 'Vomit', drainage: 'Drainage', otherOut: 'Other measured losses',
};

export interface FluidEntry {
  id: string;
  kind: 'in' | 'out';
  cat: IntakeCat | OutputCat;
  ml: number;
  time: string; // HH:MM
  estimated?: boolean; // estimated rather than measured
}

export interface FluidSummary {
  intake: number;
  output: number;
  measuredOutput: number;
  estimatedOutput: number;
  net: number;
  byCat: Record<string, number>;
  /** cumulative net after each entry, sorted by time */
  running: { time: string; net: number }[];
  urine: number;
}

export function fluidSummary(entries: FluidEntry[]): FluidSummary {
  for (const e of entries) {
    if (!Number.isFinite(e.ml) || e.ml < 0) throw new Error(`Invalid volume ${e.ml}`);
  }
  const byCat: Record<string, number> = {};
  let intake = 0, output = 0, measuredOutput = 0, estimatedOutput = 0, urine = 0;
  for (const e of entries) {
    byCat[e.cat] = (byCat[e.cat] ?? 0) + e.ml;
    if (e.kind === 'in') intake += e.ml;
    else {
      output += e.ml;
      if (e.estimated) estimatedOutput += e.ml; else measuredOutput += e.ml;
      if (e.cat === 'urine') urine += e.ml;
    }
  }
  const sorted = [...entries].sort((a, b) => a.time.localeCompare(b.time));
  let run = 0;
  const running = sorted.map((e) => { run += e.kind === 'in' ? e.ml : -e.ml; return { time: e.time, net: run }; });
  return { intake, output, measuredOutput, estimatedOutput, net: intake - output, byCat, running, urine };
}

export function fluidBalance(i: { intakeMl: number; outputMl: number }): CalcResult {
  return attempt(() => {
    new Check().nonNegative('intake', 'Total intake', i.intakeMl).nonNegative('output', 'Total output', i.outputMl).done();
    const v = i.intakeMl - i.outputMl;
    return ok({
      value: v, unit: 'mL', display: `${v > 0 ? '+' : ''}${fmt(v, 0)}`,
      formula: 'Net balance = Total intake − Total output',
      substitution: `${fmt(i.intakeMl, 0)} − ${fmt(i.outputMl, 0)}`,
      steps: [`${fmt(i.intakeMl, 0)} mL − ${fmt(i.outputMl, 0)} mL = ${v > 0 ? '+' : ''}${fmt(v, 0)} mL`],
      interpretation: v > 0 ? 'Positive balance (intake exceeded measured output)' : v < 0 ? 'Negative balance (measured output exceeded intake)' : 'Even balance',
      rounding: 'Whole mL.',
      notes: [FLUID_NOTE, INSENSIBLE_NOTE],
    });
  });
}

export const FLUID_NOTE = note('info', 'A positive balance does not by itself confirm fluid overload, nor a negative balance dehydration. Fluid management depends on the full assessment and the prescribed plan.');
export const INSENSIBLE_NOTE = note('info', 'Insensible losses (breathing, sweat) are not measured and are not included unless you record an estimate.');

export function urineOutput(i: { volumeMl: number; hours: number; weightKg: number }): CalcResult {
  return attempt(() => {
    new Check().nonNegative('volume', 'Urine volume', i.volumeMl).positive('hours', 'Collection period', i.hours).positive('weight', 'Weight', i.weightKg).done();
    const perHr = i.volumeMl / i.hours;
    const v = perHr / i.weightKg;
    return ok({
      value: v, unit: 'mL/kg/hr', display: fmt(v, 2),
      formula: 'UO (mL/kg/hr) = Volume (mL) ÷ Time (hr) ÷ Weight (kg)',
      substitution: `${fmt(i.volumeMl, 1)} ÷ ${fmt(i.hours, 2)} ÷ ${fmt(i.weightKg, 2)}`,
      steps: [`${fmt(i.volumeMl, 1)} mL ÷ ${fmt(i.hours, 2)} hr = ${fmt(perHr, 3)} mL/hr`, `${fmt(perHr, 3)} ÷ ${fmt(i.weightKg, 2)} kg = ${fmt(v, 4)} mL/kg/hr`],
      extras: [{ label: 'Hourly urine output', value: `${fmt(perHr, 1)} mL/hr` }],
      rounding: 'Displayed to 2 decimal places.',
      notes: compact([plausibility('Weight', i.weightKg, 0.4, 250, 'kg'), note('info', 'Thresholds for low urine output depend on age, population and the guideline in use (e.g. KDIGO criteria use 6- and 12-hour periods). Report and interpret within the clinical picture.')]),
    });
  });
}
