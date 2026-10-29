import { Check, attempt, compact, fmt, note, ok, plausibility, roundTo, type CalcResult } from './core';
import { HIGH_ALERT, VERIFY } from './medication';

const RATE_NOTE = note('info', 'The programmed rate must stay within the prescription, product instructions and institutional protocol.');

export function pumpRate(i: { volumeMl: number; timeHr: number; pumpDp?: number }): CalcResult {
  return attempt(() => {
    new Check().positive('volume', 'Volume', i.volumeMl).positive('time', 'Time', i.timeHr).done();
    const v = i.volumeMl / i.timeHr;
    const dp = i.pumpDp ?? 1;
    return ok({
      value: v, unit: 'mL/hr', display: fmt(roundTo(v, dp), dp),
      formula: 'mL/hr = Total volume (mL) ÷ Time (hr)',
      substitution: `${fmt(i.volumeMl, 2)} mL ÷ ${fmt(i.timeHr, 4)} hr`,
      steps: [`Time converted to hours: ${fmt(i.timeHr, 4)} hr`, `${fmt(i.volumeMl, 2)} ÷ ${fmt(i.timeHr, 4)} = ${fmt(v, 6)} mL/hr`, `Rounded to pump precision (${dp} dp): ${fmt(roundTo(v, dp), dp)} mL/hr`],
      extras: [{ label: 'Exact rate', value: `${fmt(v, 4)} mL/hr` }],
      rounding: `Rounded once, at the end, to ${dp} decimal place(s) — your pump-precision setting. Check what your pump accepts.`,
      notes: compact([plausibility('Rate', v, 0.1, 999, 'mL/hr'), RATE_NOTE]),
    });
  });
}

export const DROP_FACTORS = [10, 15, 20, 60] as const;

export function dripRate(i: { volumeMl: number; timeMin: number; dropFactor: number }): CalcResult {
  return attempt(() => {
    new Check()
      .positive('volume', 'Volume', i.volumeMl)
      .positive('time', 'Time', i.timeMin)
      .positive('dropFactor', 'Drop factor (gtt/mL) — read it from the administration set package', i.dropFactor)
      .done();
    const v = (i.volumeMl * i.dropFactor) / i.timeMin;
    const whole = Math.round(v);
    return ok({
      value: v, unit: 'gtt/min', display: String(whole),
      formula: 'gtt/min = (Volume (mL) × Drop factor (gtt/mL)) ÷ Time (min)',
      substitution: `(${fmt(i.volumeMl, 2)} mL × ${fmt(i.dropFactor, 0)} gtt/mL) ÷ ${fmt(i.timeMin, 2)} min`,
      steps: [
        `Time converted to minutes: ${fmt(i.timeMin, 2)} min`,
        `${fmt(i.volumeMl, 2)} × ${fmt(i.dropFactor, 0)} = ${fmt(i.volumeMl * i.dropFactor, 2)} gtt`,
        `${fmt(i.volumeMl * i.dropFactor, 2)} ÷ ${fmt(i.timeMin, 2)} = ${fmt(v, 4)} gtt/min (exact)`,
        `Whole drops cannot be counted in fractions → ${whole} gtt/min`,
      ],
      extras: [{ label: 'Exact rate', value: `${fmt(v, 2)} gtt/min` }, { label: 'Equivalent flow', value: `${fmt((i.volumeMl / i.timeMin) * 60, 2)} mL/hr` }, { label: 'Drops per 15 s', value: fmt(whole / 4, 1) }],
      rounding: 'Exact value shown; drip setting rounded to the nearest whole drop (round half up). Follow your institution’s rounding rule if different.',
      notes: compact([plausibility('Drip rate', v, 1, 200, 'gtt/min'), note('info', 'Gravity infusions vary with height, position and cannula. Recount drops regularly; use a pump when accuracy matters.'), RATE_NOTE]),
    });
  });
}

export function infusionDuration(i: { volumeMl: number; rateMlHr: number }): CalcResult {
  return attempt(() => {
    new Check().positive('volume', 'Volume', i.volumeMl).positive('rate', 'Rate (mL/hr)', i.rateMlHr).done();
    const h = i.volumeMl / i.rateMlHr;
    const totalMin = Math.round(h * 60);
    return ok({
      value: h, unit: 'hours', display: fmt(h, 2),
      formula: 'Time (hr) = Volume (mL) ÷ Rate (mL/hr)',
      substitution: `${fmt(i.volumeMl, 2)} ÷ ${fmt(i.rateMlHr, 2)}`,
      steps: [`${fmt(i.volumeMl, 2)} ÷ ${fmt(i.rateMlHr, 2)} = ${fmt(h, 4)} hr`, `= ${Math.floor(totalMin / 60)} hr ${totalMin % 60} min`],
      extras: [{ label: 'Hours and minutes', value: `${Math.floor(totalMin / 60)} hr ${totalMin % 60} min` }],
      rounding: 'Hours to 2 dp; hours-minutes rounded to the nearest minute.',
    });
  });
}

/** Parse "HH:MM" (24 h) into minutes since midnight. */
export function parseClock(s: string): number | null {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(s.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function clockText(minutesFromMidnight: number): { clock: string; dayOffset: number } {
  const total = Math.round(minutesFromMidnight);
  const dayOffset = Math.floor(total / 1440);
  const inDay = ((total % 1440) + 1440) % 1440;
  const hh = String(Math.floor(inDay / 60)).padStart(2, '0');
  const mm = String(inDay % 60).padStart(2, '0');
  return { clock: `${hh}:${mm}`, dayOffset };
}

export function completionTime(i: { start: string; volumeMl: number; rateMlHr: number }): CalcResult {
  return attempt(() => {
    const startMin = parseClock(i.start);
    new Check()
      .rule(startMin !== null, 'Start time must be a valid 24-hour time (HH:MM).', 'start')
      .positive('volume', 'Volume', i.volumeMl).positive('rate', 'Rate (mL/hr)', i.rateMlHr).done();
    const durMin = (i.volumeMl / i.rateMlHr) * 60;
    const end = clockText((startMin as number) + durMin);
    const dayTxt = end.dayOffset === 0 ? 'same day' : end.dayOffset === 1 ? 'next day' : `+${end.dayOffset} days`;
    return ok({
      value: durMin, unit: 'minutes', display: `${end.clock}`, displayUnit: dayTxt,
      formula: 'End = Start + (Volume ÷ Rate)',
      substitution: `${i.start} + (${fmt(i.volumeMl, 2)} ÷ ${fmt(i.rateMlHr, 2)} hr)`,
      steps: [`Duration = ${fmt(i.volumeMl / i.rateMlHr, 4)} hr = ${fmt(durMin, 1)} min`, `${i.start} + ${fmt(durMin, 0)} min = ${end.clock} (${dayTxt})`],
      extras: [{ label: 'Finishes', value: `${end.clock} (${dayTxt})` }],
      interpretation: dayTxt,
      rounding: 'Completion time rounded to the nearest minute.',
    });
  });
}

export function volumeInfused(i: { rateMlHr: number; timeHr: number; totalMl?: number }): CalcResult {
  return attempt(() => {
    const c = new Check().nonNegative('rate', 'Rate', i.rateMlHr).nonNegative('time', 'Time running', i.timeHr);
    const hasTotal = i.totalMl !== undefined && !Number.isNaN(i.totalMl);
    if (hasTotal) c.positive('total', 'Total volume hung', i.totalMl);
    c.done();
    const v = i.rateMlHr * i.timeHr;
    const extras = [];
    const steps = [`${fmt(i.rateMlHr, 2)} mL/hr × ${fmt(i.timeHr, 4)} hr = ${fmt(v, 3)} mL`];
    const notes = [];
    if (hasTotal) {
      const rem = (i.totalMl as number) - v;
      steps.push(`Remaining = ${fmt(i.totalMl!, 2)} − ${fmt(v, 3)} = ${fmt(rem, 3)} mL`);
      extras.push({ label: 'Volume remaining', value: `${fmt(Math.max(rem, 0), 1)} mL` });
      if (rem < 0) notes.push(note('warning', 'Calculated infused volume exceeds the volume hung — check the rate, time and total.'));
    }
    return ok({
      value: v, unit: 'mL', display: fmt(v, 1),
      formula: 'Volume infused = Rate (mL/hr) × Time (hr)', substitution: `${fmt(i.rateMlHr, 2)} × ${fmt(i.timeHr, 4)}`,
      steps, extras, notes: [...notes, note('info', 'Read the actual infused volume from the pump history when available.')],
      rounding: 'Displayed to 1 decimal place.',
    });
  });
}

/** Dose rate delivered by an infusion: from mL/hr and concentration. */
export function doseFromRate(i: { rateMlHr: number; concMgPerMl: number; weightKg?: number }): CalcResult {
  return attempt(() => {
    const c = new Check().positive('rate', 'Rate (mL/hr)', i.rateMlHr).positive('conc', 'Concentration', i.concMgPerMl);
    if (i.weightKg !== undefined && !Number.isNaN(i.weightKg)) c.positive('weight', 'Weight', i.weightKg);
    c.done();
    const mgHr = i.rateMlHr * i.concMgPerMl;
    const mcgMin = (mgHr * 1000) / 60;
    const extras = [
      { label: 'mg/hr', value: fmt(mgHr, 4) },
      { label: 'mcg/min', value: fmt(mcgMin, 3) },
    ];
    const steps = [`${fmt(i.rateMlHr, 3)} mL/hr × ${fmt(i.concMgPerMl, 4)} mg/mL = ${fmt(mgHr, 5)} mg/hr`, `mg/hr × 1000 ÷ 60 = ${fmt(mcgMin, 4)} mcg/min`];
    if (i.weightKg) {
      extras.push({ label: 'mcg/kg/min', value: fmt(mcgMin / i.weightKg, 4) });
      extras.push({ label: 'mg/kg/hr', value: fmt(mgHr / i.weightKg, 4) });
      steps.push(`÷ ${fmt(i.weightKg, 2)} kg = ${fmt(mcgMin / i.weightKg, 5)} mcg/kg/min`);
    }
    return ok({
      value: mgHr, unit: 'mg/hr', display: fmt(mgHr, 3),
      formula: 'mg/hr = mL/hr × mg/mL;  mcg/min = mg/hr × 1000 ÷ 60', substitution: `${fmt(i.rateMlHr, 3)} × ${fmt(i.concMgPerMl, 4)}`,
      steps, extras, rounding: 'No intermediate rounding.',
      notes: compact([i.weightKg ? plausibility('Weight', i.weightKg, 0.4, 250, 'kg') : null, VERIFY]),
    });
  });
}

export type DoseRateUnit = 'mcg/kg/min' | 'mcg/min' | 'mg/hr' | 'mg/kg/hr' | 'mg/min';

/** Pump rate (mL/hr) for an ordered dose rate. Concentration in mg/mL. */
export function rateFromDose(i: { dose: number; doseUnit: DoseRateUnit; concMgPerMl: number; weightKg?: number; pumpDp?: number; highAlert?: boolean }): CalcResult {
  return attempt(() => {
    const perKg = i.doseUnit.includes('/kg/');
    const c = new Check().positive('dose', 'Ordered dose rate', i.dose).positive('conc', 'Concentration (mg/mL)', i.concMgPerMl);
    if (perKg) c.positive('weight', 'Weight (required for per-kg orders)', i.weightKg);
    c.done();
    const w = perKg ? (i.weightKg as number) : 1;
    let mgHr: number;
    const steps: string[] = [];
    switch (i.doseUnit) {
      case 'mcg/kg/min': mgHr = (i.dose * w * 60) / 1000; steps.push(`${fmt(i.dose, 4)} mcg/kg/min × ${fmt(w, 2)} kg × 60 min/hr ÷ 1000 mcg/mg = ${fmt(mgHr, 5)} mg/hr`); break;
      case 'mcg/min': mgHr = (i.dose * 60) / 1000; steps.push(`${fmt(i.dose, 4)} mcg/min × 60 ÷ 1000 = ${fmt(mgHr, 5)} mg/hr`); break;
      case 'mg/min': mgHr = i.dose * 60; steps.push(`${fmt(i.dose, 4)} mg/min × 60 = ${fmt(mgHr, 5)} mg/hr`); break;
      case 'mg/kg/hr': mgHr = i.dose * w; steps.push(`${fmt(i.dose, 4)} mg/kg/hr × ${fmt(w, 2)} kg = ${fmt(mgHr, 5)} mg/hr`); break;
      default: mgHr = i.dose; steps.push(`Ordered: ${fmt(mgHr, 5)} mg/hr`);
    }
    const mlHr = mgHr / i.concMgPerMl;
    const dp = i.pumpDp ?? 1;
    steps.push(`${fmt(mgHr, 5)} mg/hr ÷ ${fmt(i.concMgPerMl, 4)} mg/mL = ${fmt(mlHr, 6)} mL/hr`);
    steps.push(`Pump setting (${dp} dp): ${fmt(roundTo(mlHr, dp), dp)} mL/hr`);
    return ok({
      value: mlHr, unit: 'mL/hr', display: fmt(roundTo(mlHr, dp), dp),
      formula: 'mL/hr = dose rate converted to mg/hr ÷ concentration (mg/mL)',
      substitution: `${fmt(i.dose, 4)} ${i.doseUnit}${perKg ? ` × ${fmt(w, 2)} kg` : ''} → ${fmt(mgHr, 4)} mg/hr ÷ ${fmt(i.concMgPerMl, 4)} mg/mL`,
      steps, extras: [{ label: 'Exact rate', value: `${fmt(mlHr, 4)} mL/hr` }, { label: 'Dose rate', value: `${fmt(mgHr, 4)} mg/hr` }],
      rounding: `Rounded only at the end, to ${dp} dp (pump-precision setting).`,
      notes: compact([i.highAlert ? HIGH_ALERT : null, perKg && i.weightKg ? plausibility('Weight', i.weightKg, 0.4, 250, 'kg') : null, note('warning', 'Confirm the concentration on the actual bag/syringe label. Titration limits follow the prescription and protocol.')]),
    });
  });
}

export interface Bag {
  volumeMl: number;
  rateMlHr: number;
}

/** Several bags run one after another: total volume, total time and each bag's end time. */
export function sequentialInfusions(i: { start: string; bags: Bag[] }): CalcResult {
  return attempt(() => {
    const startMin = parseClock(i.start);
    const c = new Check().rule(startMin !== null, 'Start time must be a valid 24-hour time (HH:MM).', 'start').rule(i.bags.length > 0, 'Add at least one bag.');
    i.bags.forEach((b, k) => c.positive(`bag${k}v`, `Bag ${k + 1} volume`, b.volumeMl).positive(`bag${k}r`, `Bag ${k + 1} rate`, b.rateMlHr));
    c.done();
    let t = startMin as number;
    let total = 0;
    const steps: string[] = [];
    const ends: string[] = [];
    i.bags.forEach((b, k) => {
      const dur = (b.volumeMl / b.rateMlHr) * 60;
      t += dur;
      total += b.volumeMl;
      const e = clockText(t);
      const day = e.dayOffset === 0 ? 'same day' : e.dayOffset === 1 ? 'next day' : `+${e.dayOffset} days`;
      steps.push(`Bag ${k + 1}: ${fmt(b.volumeMl, 0)} mL ÷ ${fmt(b.rateMlHr, 2)} mL/hr = ${fmt(dur / 60, 3)} hr → ends ${e.clock} (${day})`);
      ends.push(`Bag ${k + 1} ends ${e.clock} (${day})`);
    });
    const totalMin = Math.round(t - (startMin as number));
    return ok({
      value: total, unit: 'mL total', display: fmt(total, 0),
      formula: 'Each bag: time = volume ÷ rate; bags run back-to-back',
      substitution: i.bags.map((b) => `${fmt(b.volumeMl, 0)}/${fmt(b.rateMlHr, 1)}`).join(' + '),
      steps,
      extras: [{ label: 'Total running time', value: `${Math.floor(totalMin / 60)} hr ${totalMin % 60} min` }, { label: 'Finish times', value: ends.join(' · ') }],
      rounding: 'Times rounded to the nearest minute; volumes exact.',
      notes: [note('info', 'Assumes no pauses, flushes or rate changes between bags. Check the pump’s volume-infused counter.'), RATE_NOTE],
    });
  });
}
