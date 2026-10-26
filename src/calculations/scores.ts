import { compact, note, ok, type CalcOk, type Note } from './core';

// A score component is a selected point value, or 'NT' (not testable).
export type Component = number | 'NT' | undefined;

export interface ScoreItem {
  key: string;
  label: string;
  short?: string;
  options: { points: number; label: string; detail?: string }[];
  allowNT?: boolean;
  ntLabel?: string;
}

export interface ScoreOutcome {
  total: number | null;
  max: number;
  missing: string[];
  nt: string[];
}

export function sumScore(items: ScoreItem[], sel: Record<string, Component>): ScoreOutcome {
  const missing: string[] = [];
  const nt: string[] = [];
  let total = 0;
  let max = 0;
  for (const it of items) {
    max += Math.max(...it.options.map((o) => o.points));
    const v = sel[it.key];
    if (v === undefined) missing.push(it.label);
    else if (v === 'NT') nt.push(it.short ?? it.label);
    else {
      if (!it.options.some((o) => o.points === v)) throw new Error(`Invalid value ${v} for ${it.key}`);
      total += v;
    }
  }
  return { total: missing.length || nt.length ? null : total, max, missing, nt };
}

// ---------------- Glasgow Coma Scale (Teasdale & Jennett; 2014 terminology) ----------------
export const GCS_ITEMS: ScoreItem[] = [
  { key: 'E', short: 'E', label: 'Eye opening', allowNT: true, ntLabel: 'NT — eyes closed by local factor (e.g. swelling)', options: [
    { points: 4, label: 'Spontaneous', detail: 'Open before stimulus' },
    { points: 3, label: 'To sound', detail: 'After spoken or shouted request' },
    { points: 2, label: 'To pressure', detail: 'After fingertip pressure' },
    { points: 1, label: 'None', detail: 'No opening, no interfering factor' },
  ] },
  { key: 'V', short: 'V', label: 'Verbal response', allowNT: true, ntLabel: 'NT — factor interfering with communication (e.g. intubated)', options: [
    { points: 5, label: 'Oriented', detail: 'Correctly gives name, place, date' },
    { points: 4, label: 'Confused', detail: 'Not oriented but communicates coherently' },
    { points: 3, label: 'Words', detail: 'Intelligible single words' },
    { points: 2, label: 'Sounds', detail: 'Only moans or groans' },
    { points: 1, label: 'None', detail: 'No audible response, no interfering factor' },
  ] },
  { key: 'M', short: 'M', label: 'Best motor response', allowNT: true, ntLabel: 'NT — paralysed or other limiting factor', options: [
    { points: 6, label: 'Obeys commands', detail: 'Two-part request obeyed' },
    { points: 5, label: 'Localising', detail: 'Brings hand above clavicle to stimulus' },
    { points: 4, label: 'Normal flexion / withdrawal', detail: 'Rapid bending at elbow, not predominantly abnormal' },
    { points: 3, label: 'Abnormal flexion', detail: 'Slow, stereotyped bending at elbow' },
    { points: 2, label: 'Extension', detail: 'Extension at the elbow' },
    { points: 1, label: 'None', detail: 'No movement, no interfering factor' },
  ] },
];

export interface GcsResult extends CalcOk {
  total: number | null;
  documentation: string;
}

export function gcs(sel: { E?: Component; V?: Component; M?: Component }, deterioration = false): GcsResult | { ok: false; errors: { message: string }[] } {
  const out = sumScore(GCS_ITEMS, sel as Record<string, Component>);
  if (out.missing.length) return { ok: false, errors: [{ message: `Select a response for: ${out.missing.join(', ')}.` }] };
  const part = (k: 'E' | 'V' | 'M') => (sel[k] === 'NT' ? `${k}NT` : `${k}${sel[k]}`);
  const documentation = `${part('E')} ${part('V')} ${part('M')}`;
  const notes: Note[] = compact([
    deterioration ? note('critical', 'Acute deterioration reported: escalate immediately per your rapid-response/escalation policy. Do not wait to recalculate.') : null,
    out.nt.length ? note('warning', `Total not calculated: ${out.nt.join(', ')} not testable. Report the components (e.g. ${documentation}). A not-testable component is never scored as normal or as 1.`) : null,
    note('info', 'Communicate the three components, not just the total — the same total can reflect very different patients. Interpret with pupils, limb power, vital signs and trend.'),
  ]);
  const total = out.total;
  return {
    ...ok({
      value: total ?? NaN, unit: total === null ? '' : '/ 15',
      display: total === null ? documentation : String(total),
      formula: 'GCS total = E + V + M (range 3–15)',
      substitution: documentation.replace(/ /g, ' + '),
      steps: [`Eye ${part('E')}`, `Verbal ${part('V')}`, `Motor ${part('M')}`, total === null ? 'Total not summed because a component is not testable.' : `Total = ${total}/15`],
      rounding: 'Integer scoring; no rounding.',
      interpretation: total === null ? 'Components reported; total not applicable' : `Documentation: ${documentation} = ${total}`,
      notes,
    }),
    total, documentation,
  };
}

// ---------------- APGAR (Apgar 1953; AAP/ACOG) ----------------
export const APGAR_ITEMS: ScoreItem[] = [
  { key: 'appearance', label: 'Appearance (colour)', options: [
    { points: 0, label: 'Blue or pale all over' }, { points: 1, label: 'Body pink, extremities blue' }, { points: 2, label: 'Pink all over' }] },
  { key: 'pulse', label: 'Pulse (heart rate)', options: [
    { points: 0, label: 'Absent' }, { points: 1, label: 'Below 100 /min' }, { points: 2, label: '100 /min or more' }] },
  { key: 'grimace', label: 'Grimace (reflex irritability)', options: [
    { points: 0, label: 'No response' }, { points: 1, label: 'Grimace' }, { points: 2, label: 'Cry or active withdrawal' }] },
  { key: 'activity', label: 'Activity (muscle tone)', options: [
    { points: 0, label: 'Limp' }, { points: 1, label: 'Some flexion' }, { points: 2, label: 'Active motion' }] },
  { key: 'respiration', label: 'Respiration', options: [
    { points: 0, label: 'Absent' }, { points: 1, label: 'Weak, irregular or gasping' }, { points: 2, label: 'Good, crying' }] },
];

export function scoreTool(name: string, items: ScoreItem[], sel: Record<string, Component>, extra: { formula: string; interpret: (t: number) => string; notes: Note[] }):
  CalcOk | { ok: false; errors: { message: string }[] } {
  const out = sumScore(items, sel);
  if (out.missing.length) return { ok: false, errors: [{ message: `Select a response for: ${out.missing.join(', ')}.` }] };
  if (out.nt.length) return { ok: false, errors: [{ message: `${name} cannot be totalled with untested items.` }] };
  const t = out.total as number;
  return ok({
    value: t, unit: `/ ${out.max}`, display: String(t),
    formula: extra.formula,
    substitution: items.map((i) => sel[i.key]).join(' + '),
    steps: items.map((i) => `${i.label}: ${sel[i.key]} — ${i.options.find((o) => o.points === sel[i.key])?.label ?? ''}`),
    interpretation: extra.interpret(t),
    rounding: 'Integer scoring; no rounding.',
    notes: extra.notes,
  });
}

export function apgar(sel: Record<string, Component>, minute: number) {
  return scoreTool('APGAR', APGAR_ITEMS, sel, {
    formula: 'APGAR = Appearance + Pulse + Grimace + Activity + Respiration (0–10)',
    interpret: (t) => `${minute}-minute APGAR ${t}/10 (${t >= 7 ? '7–10: reassuring range' : t >= 4 ? '4–6: moderately abnormal range' : '0–3: low range'})`,
    notes: [
      note('critical', 'Do not delay resuscitation to calculate an APGAR score. Follow neonatal resuscitation guidelines.'),
      note('info', 'Usually recorded at 1 and 5 minutes (and every 5 min to 20 min if < 7). The score describes condition at a point in time; it is not used alone to predict outcome or diagnose asphyxia.'),
    ],
  });
}

// ---------------- qSOFA (Seymour/Singer, JAMA 2016) ----------------
export const QSOFA_ITEMS: ScoreItem[] = [
  { key: 'rr', label: 'Respiratory rate ≥ 22 /min', options: [{ points: 0, label: 'No' }, { points: 1, label: 'Yes' }] },
  { key: 'mental', label: 'Altered mentation (GCS < 15)', options: [{ points: 0, label: 'No' }, { points: 1, label: 'Yes' }] },
  { key: 'sbp', label: 'Systolic BP ≤ 100 mmHg', options: [{ points: 0, label: 'No' }, { points: 1, label: 'Yes' }] },
];

export function qsofa(sel: Record<string, Component>) {
  return scoreTool('qSOFA', QSOFA_ITEMS, sel, {
    formula: 'qSOFA = RR ≥ 22 + altered mentation + SBP ≤ 100 (0–3)',
    interpret: (t) => (t >= 2 ? `${t}/3 — meets the ≥ 2 criterion associated with higher risk of poor outcome in adults with suspected infection` : `${t}/3 — below the ≥ 2 criterion (does not rule out sepsis)`),
    notes: [
      note('warning', 'qSOFA does not diagnose or rule out sepsis. It was derived for adults with suspected infection outside the ICU. Escalate based on full assessment and local sepsis pathway.'),
    ],
  });
}

// ---------------- Bishop score (Bishop 1964) ----------------
export const BISHOP_ITEMS: ScoreItem[] = [
  { key: 'dilation', label: 'Cervical dilation', options: [{ points: 0, label: 'Closed' }, { points: 1, label: '1–2 cm' }, { points: 2, label: '3–4 cm' }, { points: 3, label: '≥ 5 cm' }] },
  { key: 'effacement', label: 'Effacement', options: [{ points: 0, label: '0–30 %' }, { points: 1, label: '40–50 %' }, { points: 2, label: '60–70 %' }, { points: 3, label: '≥ 80 %' }] },
  { key: 'station', label: 'Fetal station', options: [{ points: 0, label: '−3' }, { points: 1, label: '−2' }, { points: 2, label: '−1 or 0' }, { points: 3, label: '+1 or +2' }] },
  { key: 'consistency', label: 'Cervical consistency', options: [{ points: 0, label: 'Firm' }, { points: 1, label: 'Medium' }, { points: 2, label: 'Soft' }] },
  { key: 'position', label: 'Cervical position', options: [{ points: 0, label: 'Posterior' }, { points: 1, label: 'Mid-position' }, { points: 2, label: 'Anterior' }] },
];

export function bishop(sel: Record<string, Component>) {
  return scoreTool('Bishop', BISHOP_ITEMS, sel, {
    formula: 'Bishop = dilation + effacement + station + consistency + position (0–13)',
    interpret: (t) => `${t}/13 — thresholds for a “favourable” cervix differ between guidelines; refer to your obstetric protocol`,
    notes: [note('info', 'Original (unmodified) Bishop criteria. Several modified versions exist. Cervical assessment and decisions about induction belong to the obstetric team.')],
  });
}

// ---------------- Glasgow-Blatchford (Blatchford 2000) ----------------
export interface GbsIn {
  ureaMmolL: number; hbGdl: number; sex: 'male' | 'female'; sbp: number; pulse: number;
  melaena: boolean; syncope: boolean; hepatic: boolean; cardiacFailure: boolean;
}

export function glasgowBlatchford(i: GbsIn) {
  const errs: string[] = [];
  for (const [k, v] of Object.entries({ urea: i.ureaMmolL, haemoglobin: i.hbGdl, 'systolic BP': i.sbp, pulse: i.pulse })) {
    if (!Number.isFinite(v) || v <= 0) errs.push(`Enter a positive ${k}.`);
  }
  if (errs.length) return { ok: false as const, errors: errs.map((message) => ({ message })) };
  const parts: [string, number][] = [];
  const u = i.ureaMmolL;
  // Published bands: 6.5–8.0 → 2, 8.0–10.0 → 3, 10.0–25 → 4, >25 → 6 (shared endpoints 8 and 10 take the higher band here).
  parts.push(['Blood urea', u > 25 ? 6 : u >= 10 ? 4 : u >= 8 ? 3 : u >= 6.5 ? 2 : 0]);
  const hb = i.hbGdl;
  parts.push(['Haemoglobin', i.sex === 'male' ? (hb < 10 ? 6 : hb < 12 ? 3 : hb < 13 ? 1 : 0) : (hb < 10 ? 6 : hb < 12 ? 1 : 0)]);
  parts.push(['Systolic BP', i.sbp < 90 ? 3 : i.sbp < 100 ? 2 : i.sbp < 110 ? 1 : 0]);
  parts.push(['Pulse ≥ 100', i.pulse >= 100 ? 1 : 0]);
  parts.push(['Melaena', i.melaena ? 1 : 0]);
  parts.push(['Syncope', i.syncope ? 2 : 0]);
  parts.push(['Hepatic disease', i.hepatic ? 2 : 0]);
  parts.push(['Cardiac failure', i.cardiacFailure ? 2 : 0]);
  const t = parts.reduce((a, [, p]) => a + p, 0);
  return ok({
    value: t, unit: '/ 23', display: String(t),
    formula: 'GBS = urea + Hb + SBP + pulse + melaena + syncope + hepatic + cardiac points',
    substitution: parts.map(([, p]) => p).join(' + '),
    steps: parts.map(([l, p]) => `${l}: ${p}`),
    interpretation: t === 0 ? '0 — lowest-risk group in the derivation study' : `${t} — higher scores indicate greater likelihood of needing intervention`,
    rounding: 'Integer scoring.',
    notes: [note('warning', 'Uses urea in mmol/L and haemoglobin in g/dL. Values exactly at 8.0 or 10.0 mmol/L are scored in the higher band; published tables do not state which band they belong to. Some guidelines use a score ≤ 1 for outpatient consideration — follow local guidance.')],
  });
}
