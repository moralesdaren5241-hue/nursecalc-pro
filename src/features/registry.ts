// Calculator registry: maps form fields to the pure calculation engine.
// No formulas live here — only input wiring, unit choices and metadata.
import * as med from '../calculations/medication';
import * as iv from '../calculations/iv';
import * as body from '../calculations/body';
import * as sc from '../calculations/scores';
import * as fl from '../calculations/fluids';
import * as cl from '../calculations/clinical';
import type { CalcDef, Category, Field } from './types';

export const CATEGORIES: Category[] = [
  { id: 'med', letter: 'A', name: 'Medication', icon: 'pill' },
  { id: 'iv', letter: 'B', name: 'IV therapy & infusion', icon: 'drip' },
  { id: 'body', letter: 'C', name: 'Body measurements & BMI', icon: 'scale' },
  { id: 'neuro', letter: 'D', name: 'Neurological', icon: 'brain' },
  { id: 'fluid', letter: 'E', name: 'Fluid balance & renal', icon: 'drop' },
  { id: 'vitals', letter: 'F', name: 'Vital signs & hemodynamics', icon: 'heart' },
  { id: 'peds', letter: 'G', name: 'Pediatric nursing', icon: 'baby' },
  { id: 'o2', letter: 'H', name: 'Oxygen therapy', icon: 'lungs' },
  { id: 'nutrition', letter: 'I', name: 'Nutrition & feeding', icon: 'apple' },
  { id: 'lab', letter: 'J', name: 'Laboratory & electrolytes', icon: 'flask' },
  { id: 'blood', letter: 'K', name: 'Transfusion & blood loss', icon: 'bag' },
  { id: 'ob', letter: 'L', name: 'Obstetric & newborn', icon: 'mother' },
  { id: 'emergency', letter: 'M', name: 'Emergency & critical care', icon: 'bolt' },
  { id: 'wound', letter: 'N', name: 'Wound care', icon: 'ruler' },
  { id: 'convert', letter: 'O', name: 'Unit conversions', icon: 'swap' },
  { id: 'practice', letter: 'P', name: 'Practice & exams', icon: 'cap' },
];

// ---- field helpers ----
const DOSE_UNITS = ['mcg', 'mg', 'g', 'U', 'mEq', 'mmol'];
const MASS = ['mcg', 'mg', 'g'];
const num = (key: string, label: string, extra: Partial<Extract<Field, { kind: 'number' }>> = {}): Field => ({ kind: 'number', key, label, ...extra });
const weight = (key = 'weight', label = 'Weight', kgOnly = false): Field => num(key, label, { units: kgOnly ? ['kg'] : ['kg', 'lb'] });
const sel = (key: string, label: string, options: [string, string][], help?: string): Field => ({ kind: 'select', key, label, options: options.map(([value, l]) => ({ value, label: l })), help });
const choices = (items: sc.ScoreItem[]): Field[] => items.map((item) => ({ kind: 'choice', key: item.key, item }));
const choiceMap = (v: { choice: (k: string) => number | 'NT' | undefined }, items: sc.ScoreItem[]) => Object.fromEntries(items.map((i) => [i.key, v.choice(i.key)]));
const FORM_OPTS: [string, string][] = [['tablet(s)', 'Tablet(s)'], ['capsule(s)', 'Capsule(s)'], ['mL', 'mL (solution / suspension / injection)']];
const DOSE_RATE_OPTS: [string, string][] = [['mcg/kg/min', 'mcg/kg/min'], ['mcg/min', 'mcg/min'], ['mg/min', 'mg/min'], ['mg/hr', 'mg/hr'], ['mg/kg/hr', 'mg/kg/hr']];

export const CALCULATORS: CalcDef[] = [
  // ---------------- A. Medication ----------------
  {
    id: 'drug-dose', name: 'Drug dose (D/H × Q)', category: 'med', topic: 'dosage', refs: ['dose-basic'],
    description: 'Tablets, capsules, oral liquids and injections from strength on hand.',
    tags: ['dosage', 'desired over have', 'tablets', 'capsule', 'oral', 'injection', 'suspension', 'liquid', 'dimensional analysis', 'dose calculation', 'how many tablets', 'mL to give'],
    fields: [num('desired', 'Desired (ordered) dose', { units: DOSE_UNITS }), num('available', 'Strength on hand (have)', { units: DOSE_UNITS }), num('quantity', 'Quantity containing that strength', { help: 'e.g. 1 tablet, or 5 mL for 250 mg/5 mL' }), sel('form', 'Form', FORM_OPTS)],
    defaults: { 'desired@': 'mg', 'available@': 'mg', quantity: '1', form: 'tablet(s)' },
    example: { desired: '125', 'desired@': 'mg', available: '250', 'available@': 'mg', quantity: '5', form: 'mL' },
    run: (v) => {
      const avU = v.unitOf('available');
      return med.basicDose({ desired: v.n('desired', avU), available: v.num('available'), quantity: v.num('quantity'), doseUnit: avU, quantityUnit: v.str('form') });
    },
  },
  {
    id: 'weight-dose', name: 'Weight-based dose', category: 'med', topic: 'weight', refs: ['weight-dose'],
    description: 'mg/kg/dose or mg/kg/day orders, with total daily dose.',
    tags: ['mg/kg', 'per kilogram', 'mg/kg/day', 'mg/kg/dose', 'weight based', 'daily dose', 'divided doses'],
    fields: [weight(), num('dosePerKg', 'Ordered dose per kg'), sel('doseUnit', 'Dose unit', [['mg', 'mg'], ['mcg', 'mcg'], ['U', 'units']]), sel('basis', 'Order is written as…', [['perDose', 'per kg PER DOSE'], ['perDay', 'per kg PER DAY (total)']]), num('dosesPerDay', 'Number of prescribed doses per day', { optional: true, help: 'Required for per-day orders. Not assumed.' })],
    defaults: { 'weight@': 'kg', doseUnit: 'mg', basis: 'perDose' },
    example: { weight: '20', 'weight@': 'kg', dosePerKg: '30', doseUnit: 'mg', basis: 'perDay', dosesPerDay: '3' },
    run: (v) => med.weightBasedDose({ weightKg: v.n('weight', 'kg'), dosePerKg: v.num('dosePerKg'), doseUnit: v.str('doseUnit'), basis: v.str('basis') as med.DoseBasis, dosesPerDay: v.opt('dosesPerDay') }),
  },
  {
    id: 'dose-range', name: 'Dose range checker', category: 'med', topic: 'weight', refs: ['weight-dose'],
    description: 'Compare an ordered dose with a reference range you enter from a verified source.',
    tags: ['safe dose', 'safe dose range', 'SDR', 'maximum dose', 'therapeutic range', 'check order'],
    fields: [weight('weight', 'Weight', true), sel('basis', 'Reference range is…', [['perDose', 'per kg per dose'], ['perDay', 'per kg per day']]), num('min', 'Reference minimum (per kg)', { optional: true }), num('max', 'Reference maximum (per kg)', { optional: true }), num('ordered', 'Ordered dose (each administration)'), sel('doseUnit', 'Unit', [['mg', 'mg'], ['mcg', 'mcg'], ['U', 'units']]), num('dosesPerDay', 'Doses per day (from the dosing interval)', { optional: true, help: 'e.g. every 8 h = 3' })],
    defaults: { 'weight@': 'kg', basis: 'perDay', doseUnit: 'mg' },
    example: { weight: '10', 'weight@': 'kg', basis: 'perDay', min: '40', max: '60', ordered: '150', doseUnit: 'mg', dosesPerDay: '3' },
    run: (v) => med.doseRangeCheck({ weightKg: v.n('weight', 'kg'), minPerKg: v.opt('min'), maxPerKg: v.opt('max'), basis: v.str('basis') as med.DoseBasis, orderedDose: v.num('ordered'), dosesPerDay: v.opt('dosesPerDay'), doseUnit: v.str('doseUnit') }),
  },
  {
    id: 'bsa-dose', name: 'Dose by body surface area', category: 'med', topic: 'dosage', refs: ['bsa'],
    description: 'Only when the order is written per m².', tags: ['mg/m2', 'm²', 'BSA dosing', 'chemotherapy'],
    fields: [num('bsa', 'Body surface area', { unitText: 'm²' }), num('dosePerM2', 'Ordered dose per m²'), sel('doseUnit', 'Unit', [['mg', 'mg'], ['mcg', 'mcg'], ['U', 'units']])],
    defaults: { doseUnit: 'mg' }, example: { bsa: '1.5', dosePerM2: '100', doseUnit: 'mg' },
    run: (v) => med.bsaDose({ bsa: v.num('bsa'), dosePerM2: v.num('dosePerM2'), doseUnit: v.str('doseUnit') }),
  },
  {
    id: 'dilution', name: 'Dilution C1V1 = C2V2', category: 'med', topic: 'dosage', refs: ['c1v1'],
    description: 'Leave one value blank to solve for it.', tags: ['dilute', 'stock solution', 'c1v1', 'concentration', 'diluent'],
    fields: [num('c1', 'C1 — stock concentration', { optional: true, units: ['mg/mL', 'mcg/mL', 'g/100mL'] }), num('v1', 'V1 — stock volume', { optional: true, units: ['mL', 'L'] }), num('c2', 'C2 — final concentration', { optional: true, units: ['mg/mL', 'mcg/mL', 'g/100mL'] }), num('v2', 'V2 — final volume', { optional: true, units: ['mL', 'L'] })],
    defaults: { 'c1@': 'mg/mL', 'c2@': 'mg/mL', 'v1@': 'mL', 'v2@': 'mL' },
    example: { c1: '10', 'c1@': 'mg/mL', c2: '2', 'c2@': 'mg/mL', v2: '100', 'v2@': 'mL', 'v1@': 'mL' },
    run: (v) => {
      const cu = v.unitOf('c1') || 'mg/mL';
      const vu = v.unitOf('v1') || 'mL';
      return med.dilution({ c1: v.opt('c1', cu), v1: v.opt('v1', vu), c2: v.opt('c2', cu), v2: v.opt('v2', vu), concUnit: cu, volUnit: vu });
    },
  },
  {
    id: 'reconstitution', name: 'Reconstitution concentration', category: 'med', topic: 'dosage', refs: ['dose-basic'],
    description: 'Concentration and volume from the label’s final reconstituted volume.', tags: ['reconstitute', 'powder', 'vial', 'diluent', 'displacement'],
    fields: [num('amount', 'Drug in vial', { units: MASS.concat('U') }), num('finalVol', 'Final volume after reconstitution (from label)', { units: ['mL'] }), num('ordered', 'Ordered dose (optional)', { optional: true, units: MASS.concat('U') })],
    defaults: { 'amount@': 'mg', 'finalVol@': 'mL', 'ordered@': 'mg' },
    example: { amount: '1', 'amount@': 'g', finalVol: '10', 'finalVol@': 'mL', ordered: '250', 'ordered@': 'mg' },
    run: (v) => {
      const u = v.unitOf('amount') === 'U' ? 'U' : 'mg';
      return med.reconstitution({ drugAmount: v.n('amount', u), finalVolumeMl: v.num('finalVol'), orderedDose: v.opt('ordered', u), doseUnit: u });
    },
  },
  {
    id: 'insulin', name: 'Insulin volume', category: 'med', topic: 'dosage', refs: ['dose-basic'],
    description: 'High-alert: units ordered → mL at the stated concentration.', tags: ['insulin', 'units', 'U-100', 'syringe', 'high alert'],
    highAlert: 'I have confirmed the insulin type, ordered units and concentration against the order and label, and will arrange an independent double-check.',
    fields: [num('units', 'Ordered dose', { unitText: 'units' }), sel('conc', 'Concentration on the label', [['100', 'U-100 (100 units/mL)'], ['200', 'U-200 (200 units/mL)'], ['300', 'U-300 (300 units/mL)'], ['500', 'U-500 (500 units/mL)']])],
    defaults: { conc: '100' }, example: { units: '8', conc: '100' },
    run: (v) => med.insulinVolume({ orderedUnits: v.num('units'), concUnitsPerMl: Number(v.str('conc')) }),
  },
  {
    id: 'heparin', name: 'Heparin / units-based infusion', category: 'med', topic: 'iv', refs: ['iv-pump'],
    description: 'High-alert: units/hr ↔ mL/hr, including units/kg/hr.', tags: ['heparin', 'units/hr', 'units per hour', 'anticoagulant', 'high alert', 'units/kg/hr'],
    highAlert: 'I have confirmed the drug, bag concentration (units/mL), ordered dose and weight, and will have the pump programming independently double-checked.',
    fields: [sel('mode', 'Calculate', [['rateFromDose', 'mL/hr from ordered units/hr'], ['weightBased', 'mL/hr from units/kg/hr'], ['doseFromRate', 'units/hr from current mL/hr']]), num('conc', 'Concentration', { unitText: 'units/mL' }), { ...num('uh', 'Ordered dose', { unitText: 'units/hr' }), showIf: (r) => r.mode === 'rateFromDose' }, { ...num('ukh', 'Ordered dose', { unitText: 'units/kg/hr' }), showIf: (r) => r.mode === 'weightBased' }, { ...weight('weight', 'Weight', true), showIf: (r) => r.mode === 'weightBased' }, { ...num('mlh', 'Current pump rate', { unitText: 'mL/hr' }), showIf: (r) => r.mode === 'doseFromRate' }],
    defaults: { mode: 'rateFromDose', 'weight@': 'kg' }, example: { mode: 'weightBased', conc: '100', ukh: '18', weight: '80', 'weight@': 'kg' },
    run: (v, s) => med.heparinInfusion({ mode: v.str('mode') as med.HeparinMode, concUnitsPerMl: v.num('conc'), unitsPerHr: v.opt('uh'), unitsPerKgHr: v.opt('ukh'), weightKg: v.opt('weight', 'kg'), mlPerHr: v.opt('mlh'), pumpDp: s.pumpDp }),
  },
  {
    id: 'supply', name: 'Medication supply quantity', category: 'med', topic: 'dosage', refs: ['dose-basic'],
    description: 'Total tablets or mL needed for a course.', tags: ['supply', 'dispense', 'how many tablets for', 'course', 'days supply'],
    fields: [num('perDose', 'Amount per dose'), sel('unitLabel', 'Unit', [['tablets', 'tablets'], ['capsules', 'capsules'], ['mL', 'mL']]), num('perDay', 'Doses per day'), num('days', 'Days')],
    defaults: { unitLabel: 'tablets' }, example: { perDose: '2', unitLabel: 'tablets', perDay: '3', days: '7' },
    run: (v) => med.supplyQuantity({ perDose: v.num('perDose'), dosesPerDay: v.num('perDay'), days: v.num('days'), unitLabel: v.str('unitLabel') }),
  },
  {
    id: 'strength', name: 'Percent & ratio strength', category: 'med', topic: 'conversions', refs: ['c1v1'],
    description: '% w/v or 1:X ratio → mg/mL.', tags: ['percent', 'percentage', '% w/v', 'ratio', '1:1000', '1:10000', 'concentration conversion'],
    fields: [sel('type', 'Strength expressed as', [['pct', 'Percentage (% w/v)'], ['ratio', 'Ratio 1:X (g:mL)']]), num('val', 'Value (the % or the X in 1:X)')],
    defaults: { type: 'pct' }, example: { type: 'ratio', val: '1000' },
    run: (v) => (v.str('type') === 'pct' ? med.percentToMgPerMl(v.num('val')) : med.ratioToMgPerMl(v.num('val'))),
  },

  // ---------------- B. IV ----------------
  {
    id: 'pump-rate', name: 'IV pump rate', category: 'iv', topic: 'iv', refs: ['iv-pump'],
    description: 'mL/hr from volume and time, rounded to your pump precision.', tags: ['mL/hr', 'ml per hour', 'infusion pump', 'pump rate', 'IV rate', 'flow rate'],
    fields: [num('volume', 'Volume to infuse', { units: ['mL', 'L'] }), num('time', 'Over', { units: ['hr', 'min'] })],
    defaults: { 'volume@': 'mL', 'time@': 'hr' }, example: { volume: '1000', 'volume@': 'mL', time: '8', 'time@': 'hr' },
    run: (v, s) => iv.pumpRate({ volumeMl: v.n('volume', 'mL'), timeHr: v.n('time', 'hr'), pumpDp: s.pumpDp }),
  },
  {
    id: 'drip-rate', name: 'Gravity drip rate', category: 'iv', topic: 'iv', refs: ['iv-drip'],
    description: 'Drops per minute for a gravity set.', tags: ['gtt/min', 'drops per minute', 'IV drip', 'drip rate', 'gravity', 'drop factor', 'macrodrip', 'microdrip'],
    fields: [num('volume', 'Volume', { units: ['mL', 'L'] }), num('time', 'Over', { units: ['hr', 'min'] }), sel('df', 'Drop factor (on the set package)', [['', 'Select…'], ['10', '10 gtt/mL'], ['15', '15 gtt/mL'], ['20', '20 gtt/mL'], ['60', '60 gtt/mL (micro)']])],
    defaults: { 'volume@': 'mL', 'time@': 'hr', df: '' }, example: { volume: '500', 'volume@': 'mL', time: '4', 'time@': 'hr', df: '15' },
    run: (v) => iv.dripRate({ volumeMl: v.n('volume', 'mL'), timeMin: v.n('time', 'min'), dropFactor: v.str('df') ? Number(v.str('df')) : NaN }),
  },
  {
    id: 'infusion-duration', name: 'Infusion duration', category: 'iv', topic: 'iv', refs: ['iv-pump'],
    description: 'How long a volume takes at a rate.', tags: ['how long', 'time to infuse', 'duration', 'hours'],
    fields: [num('volume', 'Volume', { units: ['mL', 'L'] }), num('rate', 'Rate', { unitText: 'mL/hr' })],
    defaults: { 'volume@': 'mL' }, example: { volume: '750', 'volume@': 'mL', rate: '125' },
    run: (v) => iv.infusionDuration({ volumeMl: v.n('volume', 'mL'), rateMlHr: v.num('rate') }),
  },
  {
    id: 'completion-time', name: 'Infusion completion time', category: 'iv', topic: 'iv', refs: ['iv-pump'],
    description: 'Clock time an infusion finishes (handles midnight).', tags: ['finish time', 'end time', 'when will it finish', 'completion'],
    fields: [{ kind: 'time', key: 'start', label: 'Start time' }, num('volume', 'Volume', { units: ['mL', 'L'] }), num('rate', 'Rate', { unitText: 'mL/hr' })],
    defaults: { 'volume@': 'mL' }, example: { start: '22:30', volume: '1000', 'volume@': 'mL', rate: '125' },
    run: (v) => iv.completionTime({ start: v.str('start'), volumeMl: v.n('volume', 'mL'), rateMlHr: v.num('rate') }),
  },
  {
    id: 'volume-infused', name: 'Volume infused / remaining', category: 'iv', topic: 'iv', refs: ['iv-pump'],
    description: 'Volume delivered so far and what is left.', tags: ['volume remaining', 'how much infused', 'left in bag'],
    fields: [num('rate', 'Rate', { unitText: 'mL/hr' }), num('time', 'Running for', { units: ['hr', 'min'] }), num('total', 'Total hung (optional)', { optional: true, units: ['mL', 'L'] })],
    defaults: { 'time@': 'hr', 'total@': 'mL' }, example: { rate: '125', time: '3', 'time@': 'hr', total: '1000', 'total@': 'mL' },
    run: (v) => iv.volumeInfused({ rateMlHr: v.num('rate'), timeHr: v.n('time', 'hr'), totalMl: v.opt('total', 'mL') }),
  },
  {
    id: 'sequential', name: 'Sequential infusion plan', category: 'iv', topic: 'iv', refs: ['iv-pump'], screen: 'sequential',
    description: 'Several bags back-to-back: total volume, total time, each bag’s finish time.', tags: ['sequential', 'consecutive bags', 'running total', 'next bag', 'infusion schedule', 'IV plan'],
  },
  {
    id: 'rate-from-dose', name: 'Dose → pump rate (titration)', category: 'iv', topic: 'iv', refs: ['iv-pump'],
    description: 'mcg/kg/min, mcg/min, mg/hr, mg/kg/hr → mL/hr.', tags: ['mcg/kg/min', 'mcg/min', 'mg/kg/hr', 'vasopressor', 'vasoactive', 'titration', 'drip calculation', 'critical care infusion'],
    highAlert: 'I have confirmed the drug, the concentration on the actual bag/syringe, the dose units (mcg vs mg, per min vs per hr) and the weight, and will have an independent double-check.',
    fields: [num('dose', 'Ordered dose rate'), sel('doseUnit', 'Dose unit', DOSE_RATE_OPTS), num('drug', 'Drug in bag/syringe', { units: MASS }), num('bagVol', 'Total volume', { units: ['mL', 'L'] }), { ...weight('weight', 'Weight', true), showIf: (r) => (r.doseUnit ?? '').includes('/kg/') }],
    defaults: { doseUnit: 'mcg/kg/min', 'drug@': 'mg', 'bagVol@': 'mL', 'weight@': 'kg' },
    example: { dose: '5', doseUnit: 'mcg/kg/min', drug: '400', 'drug@': 'mg', bagVol: '250', 'bagVol@': 'mL', weight: '70', 'weight@': 'kg' },
    run: (v, s) => iv.rateFromDose({ dose: v.num('dose'), doseUnit: v.str('doseUnit') as iv.DoseRateUnit, concMgPerMl: v.n('drug', 'mg') / v.n('bagVol', 'mL'), weightKg: v.opt('weight', 'kg'), pumpDp: s.pumpDp, highAlert: true }),
  },
  {
    id: 'dose-from-rate', name: 'Pump rate → dose delivered', category: 'iv', topic: 'iv', refs: ['iv-pump'],
    description: 'What dose a running infusion is delivering.', tags: ['dose per hour', 'mg/hr', 'mcg/min delivered', 'check infusion'],
    fields: [num('rate', 'Current rate', { unitText: 'mL/hr' }), num('drug', 'Drug in bag/syringe', { units: MASS }), num('bagVol', 'Total volume', { units: ['mL', 'L'] }), num('weight', 'Weight (optional)', { optional: true, units: ['kg'] })],
    defaults: { 'drug@': 'mg', 'bagVol@': 'mL', 'weight@': 'kg' }, example: { rate: '13.1', drug: '400', 'drug@': 'mg', bagVol: '250', 'bagVol@': 'mL', weight: '70', 'weight@': 'kg' },
    run: (v) => iv.doseFromRate({ rateMlHr: v.num('rate'), concMgPerMl: v.n('drug', 'mg') / v.n('bagVol', 'mL'), weightKg: v.opt('weight', 'kg') }),
  },

  // ---------------- C. Body ----------------
  {
    id: 'bmi', name: 'BMI', category: 'body', topic: 'bmi', refs: ['bmi'],
    description: 'Body mass index with WHO adult category.', tags: ['body mass index', 'obesity', 'overweight', 'weight height'],
    fields: [weight(), num('height', 'Height', { units: ['cm', 'm', 'in'] }), { kind: 'toggle', key: 'adult', label: 'Patient is an adult (18 years or older)', help: 'Adult categories are never applied to children.' }],
    defaults: { 'weight@': 'kg', 'height@': 'cm', adult: 'true' }, example: { weight: '60', 'weight@': 'kg', height: '160', 'height@': 'cm', adult: 'true' },
    run: (v) => body.bmi({ weightKg: v.n('weight', 'kg'), heightM: v.n('height', 'm'), adult: v.bool('adult') }),
  },
  {
    id: 'bsa', name: 'Body surface area (Mosteller)', category: 'body', topic: 'bmi', refs: ['bsa'],
    description: 'BSA in m².', tags: ['BSA', 'Mosteller', 'm2', 'surface area'],
    fields: [weight(), num('height', 'Height', { units: ['cm', 'm', 'in'] })],
    defaults: { 'weight@': 'kg', 'height@': 'cm' }, example: { weight: '70', 'weight@': 'kg', height: '170', 'height@': 'cm' },
    run: (v) => body.bsaMosteller({ weightKg: v.n('weight', 'kg'), heightCm: v.n('height', 'cm') }),
  },
  {
    id: 'ibw', name: 'Ideal & adjusted body weight (Devine)', category: 'body', topic: 'bmi', refs: ['ibw'],
    description: 'Devine IBW; adjusted weight if actual weight entered.', tags: ['IBW', 'ideal body weight', 'adjusted body weight', 'ABW', 'lean weight', 'Devine'],
    fields: [num('height', 'Height', { units: ['cm', 'in', 'm'] }), sel('sex', 'Sex (formula variable)', [['female', 'Female'], ['male', 'Male']]), num('actual', 'Actual weight (optional)', { optional: true, units: ['kg', 'lb'] })],
    defaults: { 'height@': 'cm', sex: 'female', 'actual@': 'kg' }, example: { height: '175', 'height@': 'cm', sex: 'male', actual: '110', 'actual@': 'kg' },
    run: (v) => body.idealBodyWeight({ heightCm: v.n('height', 'cm'), sex: v.str('sex') as 'male' | 'female', actualKg: v.opt('actual', 'kg') }),
  },
  {
    id: 'weight-change', name: 'Weight change %', category: 'body', topic: 'bmi', refs: ['bmi'],
    description: 'Percentage weight loss or gain.', tags: ['weight loss', 'weight gain', 'percent change', 'malnutrition'],
    fields: [num('prev', 'Previous / usual weight', { units: ['kg', 'lb', 'g'] }), num('curr', 'Current weight', { units: ['kg', 'lb', 'g'] })],
    defaults: { 'prev@': 'kg', 'curr@': 'kg' }, example: { prev: '80', 'prev@': 'kg', curr: '72', 'curr@': 'kg' },
    run: (v) => body.weightChange({ previousKg: v.n('prev', 'kg'), currentKg: v.n('curr', 'kg') }),
  },
  {
    id: 'whtr', name: 'Waist-to-height ratio', category: 'body', topic: 'bmi', refs: ['bmi'],
    description: 'Central adiposity screening.', tags: ['waist', 'WHtR', 'abdominal'],
    fields: [num('waist', 'Waist circumference', { units: ['cm', 'in'] }), num('height', 'Height', { units: ['cm', 'in', 'm'] })],
    defaults: { 'waist@': 'cm', 'height@': 'cm' }, example: { waist: '85', 'waist@': 'cm', height: '170', 'height@': 'cm' },
    run: (v) => body.waistToHeight({ waistCm: v.n('waist', 'cm'), heightCm: v.n('height', 'cm') }),
  },

  // ---------------- D. Neuro ----------------
  {
    id: 'gcs', name: 'Glasgow Coma Scale', category: 'neuro', topic: 'gcs', refs: ['gcs'],
    description: 'E + V + M with non-testable handling.', tags: ['GCS', 'consciousness', 'coma', 'level of consciousness', 'LOC', 'neuro check', 'neuro obs'],
    fields: [...choices(sc.GCS_ITEMS), { kind: 'toggle', key: 'deteriorating', label: 'Acute deterioration reported (e.g. drop of 2 or more, new motor change)' }],
    example: { E: '3', V: '4', M: '6' },
    run: (v) => sc.gcs({ E: v.choice('E'), V: v.choice('V'), M: v.choice('M') }, v.bool('deteriorating')),
  },
  {
    id: 'neuro-scales', name: 'Other neuro scales (education)', category: 'neuro', topic: 'gcs', refs: ['gcs'], screen: 'info',
    description: 'Overview of pupils, AVPU and NIHSS — not scored here.', tags: ['NIHSS', 'stroke scale', 'AVPU', 'pupils', 'PERRLA'],
    info: [
      { heading: 'AVPU', lines: ['Alert, Voice, Pain, Unresponsive — a rapid screen often used in early warning scores. Anything below “A” warrants a full GCS.'] },
      { heading: 'Pupils', lines: ['Record size (mm), shape, equality and reaction to light for each eye. A new unequal or non-reactive pupil is an emergency — escalate.'] },
      { heading: 'NIH Stroke Scale', lines: ['15-item, 0–42 scale used by certified assessors in acute stroke.', 'Not implemented as a calculator in this release: correct scoring depends on certified training and item-specific rules. Use your stroke team’s official form.'] },
    ],
  },

  // ---------------- E. Fluids & renal ----------------
  {
    id: 'fluid-balance', name: 'Intake & output (fluid balance)', category: 'fluid', topic: 'fluids', refs: ['fluid-balance'], screen: 'fluid',
    description: 'Time-stamped I&O log, net and cumulative balance, urine mL/kg/hr.', tags: ['I&O', 'intake and output', 'fluid chart', 'net balance', 'cumulative balance', '24 hour'],
  },
  {
    id: 'urine-output', name: 'Urine output (mL/kg/hr)', category: 'fluid', topic: 'fluids', refs: ['urine-output'],
    description: 'Weight-based hourly urine output.', tags: ['UO', 'urine', 'oliguria', 'mL/kg/hr', 'renal monitoring', 'catheter'],
    fields: [num('volume', 'Urine volume', { units: ['mL', 'L'] }), num('time', 'Collection period', { units: ['hr', 'min'] }), weight()],
    defaults: { 'volume@': 'mL', 'time@': 'hr', 'weight@': 'kg' }, example: { volume: '30', 'volume@': 'mL', time: '1', 'time@': 'hr', weight: '60', 'weight@': 'kg' },
    run: (v) => fl.urineOutput({ volumeMl: v.n('volume', 'mL'), hours: v.n('time', 'hr'), weightKg: v.n('weight', 'kg') }),
  },
  {
    id: 'crcl', name: 'Creatinine clearance (Cockcroft–Gault)', category: 'fluid', topic: 'renal', refs: ['cockcroft-gault'],
    description: 'Estimated CrCl in mL/min — not eGFR.', tags: ['CrCl', 'Cockcroft', 'Gault', 'renal function', 'kidney', 'creatinine'],
    fields: [num('age', 'Age', { unitText: 'years' }), weight('weight', 'Weight used'), sel('weightType', 'Weight type (per drug reference)', [['actual', 'Actual'], ['ideal', 'Ideal'], ['adjusted', 'Adjusted']]), num('scr', 'Serum creatinine', { units: ['cr_mgdl', 'cr_umol'] }), sel('sex', 'Sex (formula variable)', [['female', 'Female'], ['male', 'Male']])],
    defaults: { 'weight@': 'kg', weightType: 'actual', 'scr@': 'cr_umol', sex: 'female' }, example: { age: '60', weight: '70', 'weight@': 'kg', weightType: 'actual', scr: '1', 'scr@': 'cr_mgdl', sex: 'male' },
    run: (v) => cl.cockcroftGault({ age: v.num('age'), weightKg: v.n('weight', 'kg'), scrMgDl: v.n('scr', 'cr_mgdl'), sex: v.str('sex') as 'male' | 'female', weightLabel: v.str('weightType') }),
  },

  // ---------------- F. Vitals ----------------
  {
    id: 'map', name: 'Mean arterial pressure', category: 'vitals', topic: 'vitals', refs: ['map'],
    description: 'Estimated MAP and pulse pressure from BP.', tags: ['MAP', 'mean arterial', 'blood pressure', 'perfusion pressure'],
    fields: [num('sbp', 'Systolic BP', { units: ['mmHg', 'kPa'] }), num('dbp', 'Diastolic BP', { units: ['mmHg', 'kPa'] })],
    defaults: { 'sbp@': 'mmHg', 'dbp@': 'mmHg' }, example: { sbp: '120', 'sbp@': 'mmHg', dbp: '80', 'dbp@': 'mmHg' },
    run: (v) => cl.meanArterialPressure({ sbp: v.n('sbp', 'mmHg'), dbp: v.n('dbp', 'mmHg') }),
  },
  {
    id: 'pulse-pressure', name: 'Pulse pressure', category: 'vitals', topic: 'vitals', refs: ['map'], description: 'SBP − DBP.', tags: ['PP', 'pulse pressure', 'widened', 'narrowed'],
    fields: [num('sbp', 'Systolic BP', { unitText: 'mmHg' }), num('dbp', 'Diastolic BP', { unitText: 'mmHg' })], example: { sbp: '120', dbp: '80' },
    run: (v) => cl.pulsePressure({ sbp: v.num('sbp'), dbp: v.num('dbp') }),
  },
  {
    id: 'shock-index', name: 'Shock index', category: 'vitals', topic: 'vitals', refs: ['shock-index'], description: 'HR ÷ SBP.', tags: ['SI', 'shock', 'hemorrhage', 'deterioration'],
    fields: [num('hr', 'Heart rate', { unitText: '/min' }), num('sbp', 'Systolic BP', { unitText: 'mmHg' })], example: { hr: '110', sbp: '100' },
    run: (v) => cl.shockIndex({ hr: v.num('hr'), sbp: v.num('sbp') }),
  },
  {
    id: 'pulse-deficit', name: 'Pulse deficit', category: 'vitals', topic: 'vitals', refs: ['map'], description: 'Apical − radial rate.', tags: ['apical radial', 'atrial fibrillation', 'pulse deficit'],
    fields: [num('apical', 'Apical rate', { unitText: '/min' }), num('radial', 'Radial rate', { unitText: '/min' })], example: { apical: '96', radial: '80' },
    run: (v) => cl.pulseDeficit({ apical: v.num('apical'), radial: v.num('radial') }),
  },
  {
    id: 'rate-count', name: 'Rate from partial count', category: 'vitals', topic: 'vitals', refs: ['map'], description: 'Beats or breaths counted over seconds → per minute.', tags: ['heart rate', 'respiratory rate', 'count 15 seconds', 'pulse'],
    fields: [num('count', 'Beats or breaths counted'), sel('seconds', 'Counted over', [['15', '15 s'], ['30', '30 s'], ['60', '60 s']])], defaults: { seconds: '30' }, example: { count: '18', seconds: '15' },
    run: (v) => cl.rateFromCount({ count: v.num('count'), seconds: Number(v.str('seconds')) }),
  },
  {
    id: 'temperature', name: 'Temperature °C ↔ °F', category: 'vitals', topic: 'conversions', refs: ['map'], description: 'Convert body temperature.', tags: ['fever', 'celsius', 'fahrenheit', 'temp'],
    fields: [num('t', 'Temperature'), sel('from', 'Entered in', [['C', '°C'], ['F', '°F']])], defaults: { from: 'C' }, example: { t: '38.5', from: 'C' },
    run: (v) => cl.temperature({ value: v.num('t'), from: v.str('from') as 'C' | 'F' }),
  },
  {
    id: 'vital-ranges', name: 'Age-related vital signs (education)', category: 'vitals', topic: 'vitals', refs: [], screen: 'info',
    description: 'Why this app does not show universal “normal” ranges.', tags: ['normal vital signs', 'pediatric vital signs', 'reference ranges'],
    info: [
      { heading: 'Why no universal ranges?', lines: ['“Normal” heart rate, respiratory rate and blood pressure vary with age, setting and the reference used (e.g. PALS tables, national early-warning scores, institutional charts).', 'This release does not present a single table as authoritative. Use the chart your organisation has adopted (e.g. NEWS2 for adults, a paediatric early-warning chart for children).'] },
      { heading: 'Good practice', lines: ['Look at trends, not single values.', 'Count respiratory rate for a full 60 seconds.', 'Escalate on your organisation’s trigger thresholds and on clinical concern even when numbers look acceptable.'] },
    ],
  },

  // ---------------- G. Peds ----------------
  {
    id: 'peds-dose', name: 'Pediatric dose (mg/kg)', category: 'peds', topic: 'pediatric', refs: ['weight-dose'],
    description: 'Weight-based dose — kg only.', tags: ['pediatric', 'paediatric', 'child dose', 'mg/kg', 'kids'],
    fields: [weight('weight', 'Weight', true), num('dosePerKg', 'Ordered dose per kg'), sel('doseUnit', 'Dose unit', [['mg', 'mg'], ['mcg', 'mcg']]), sel('basis', 'Order is written as…', [['perDose', 'per kg PER DOSE'], ['perDay', 'per kg PER DAY (total)']]), num('dosesPerDay', 'Prescribed doses per day', { optional: true })],
    defaults: { 'weight@': 'kg', doseUnit: 'mg', basis: 'perDose' }, example: { weight: '12', 'weight@': 'kg', dosePerKg: '15', doseUnit: 'mg', basis: 'perDose' },
    run: (v) => med.weightBasedDose({ weightKg: v.n('weight', 'kg'), dosePerKg: v.num('dosePerKg'), doseUnit: v.str('doseUnit'), basis: v.str('basis') as med.DoseBasis, dosesPerDay: v.opt('dosesPerDay') }),
  },
  {
    id: 'maintenance-fluid', name: 'Maintenance fluid estimate (4-2-1)', category: 'peds', topic: 'pediatric', refs: ['holliday-segar'],
    description: 'Holliday–Segar hourly estimate — educational.', tags: ['maintenance fluids', 'Holliday Segar', '4-2-1', '100-50-20', 'pediatric fluids'],
    fields: [weight('weight', 'Weight', true)], defaults: { 'weight@': 'kg' }, example: { weight: '25', 'weight@': 'kg' },
    run: (v) => cl.hollidaySegar({ weightKg: v.n('weight', 'kg') }),
  },

  // ---------------- H. Oxygen ----------------
  {
    id: 'o2-cylinder', name: 'Oxygen cylinder duration (psi)', category: 'o2', topic: 'oxygen', refs: ['o2-cylinder'],
    description: 'Minutes remaining using a cylinder-specific factor.', tags: ['oxygen tank', 'cylinder', 'O2 duration', 'how long will oxygen last', 'E cylinder', 'D cylinder', 'transport'],
    fields: [sel('cyl', 'Cylinder size', [['', 'Select…'], ['D', 'D (0.16 L/psi)'], ['E', 'E (0.28 L/psi)'], ['M', 'M (1.56 L/psi)'], ['G', 'G (2.41 L/psi)'], ['H/K', 'H/K (3.14 L/psi)'], ['custom', 'Other — enter factor']]), { ...num('factor', 'Cylinder factor (from the cylinder label or supplier)', { unitText: 'L/psi' }), showIf: (r) => r.cyl === 'custom' }, num('psi', 'Gauge pressure', { unitText: 'psi' }), num('reserve', 'Safe residual pressure', { unitText: 'psi', help: 'Commonly 200 psi; use your policy.' }), num('flow', 'Flow rate', { unitText: 'L/min' })],
    defaults: { cyl: '', reserve: '200' }, example: { cyl: 'E', psi: '2000', reserve: '200', flow: '2' },
    run: (v) => cl.cylinderDuration({ cylinder: v.str('cyl'), customFactor: v.opt('factor'), pressurePsi: v.num('psi'), reservePsi: v.num('reserve'), flowLMin: v.num('flow') }),
  },
  {
    id: 'o2-cylinder-bar', name: 'Oxygen cylinder duration (bar/litres)', category: 'o2', topic: 'oxygen', refs: ['o2-cylinder'],
    description: 'For cylinders labelled with water capacity and bar.', tags: ['bar', 'kPa', 'litres', 'oxygen cylinder', 'water capacity'],
    fields: [num('cap', 'Water capacity', { unitText: 'L' }), num('bar', 'Gauge pressure', { unitText: 'bar' }), num('reserve', 'Reserve', { unitText: 'bar' }), num('flow', 'Flow rate', { unitText: 'L/min' })],
    defaults: { reserve: '7' }, example: { cap: '2', bar: '137', reserve: '7', flow: '2' },
    run: (v) => cl.cylinderDurationLitres({ waterCapacityL: v.num('cap'), pressureBar: v.num('bar'), reserveBar: v.num('reserve'), flowLMin: v.num('flow') }),
  },

  {
    id: 'o2-consumption', name: 'Oxygen needed for a transfer', category: 'o2', topic: 'oxygen', refs: ['o2-cylinder'],
    description: 'Litres used at a flow rate over a time.', tags: ['oxygen consumption', 'litres', 'transfer', 'transport oxygen', 'flow time'],
    fields: [num('flow', 'Flow rate', { unitText: 'L/min' }), num('time', 'Duration', { units: ['min', 'hr'] })], defaults: { 'time@': 'min' }, example: { flow: '4', time: '90', 'time@': 'min' },
    run: (v) => cl.oxygenConsumption({ flowLMin: v.num('flow'), minutes: v.n('time', 'min') }),
  },

  // ---------------- I. Nutrition ----------------
  {
    id: 'macros', name: 'Calories from macronutrients', category: 'nutrition', topic: 'nutrition', refs: ['macros'],
    description: '4-4-9 kcal/g.', tags: ['calories', 'kcal', 'carbohydrate', 'protein', 'fat', 'energy'],
    fields: [num('carb', 'Carbohydrate', { unitText: 'g' }), num('protein', 'Protein', { unitText: 'g' }), num('fat', 'Fat', { unitText: 'g' })], example: { carb: '50', protein: '20', fat: '10' },
    run: (v) => cl.macroCalories({ carbG: v.num('carb'), proteinG: v.num('protein'), fatG: v.num('fat') }),
  },
  {
    id: 'enteral-rate', name: 'Enteral feeding rate', category: 'nutrition', topic: 'nutrition', refs: ['macros'],
    description: 'Pump rate from prescribed volume and hours.', tags: ['tube feeding', 'NG feed', 'PEG', 'enteral', 'feed rate'],
    fields: [num('volume', 'Prescribed volume', { units: ['mL', 'L'] }), num('hours', 'Feeding period', { unitText: 'hours' })], defaults: { 'volume@': 'mL' }, example: { volume: '1200', 'volume@': 'mL', hours: '20' },
    run: (v) => cl.enteralRate({ volumeMl: v.n('volume', 'mL'), hours: v.num('hours') }),
  },
  {
    id: 'nutrition-target', name: '% of nutrition target achieved', category: 'nutrition', topic: 'nutrition', refs: ['macros'],
    description: 'Actual vs prescribed target.', tags: ['target', 'goal', 'percent achieved', 'intake'],
    fields: [num('actual', 'Actual intake'), num('target', 'Prescribed target'), sel('unit', 'Unit', [['kcal', 'kcal'], ['g protein', 'g protein'], ['mL', 'mL']])], defaults: { unit: 'kcal' }, example: { actual: '1500', target: '2000', unit: 'kcal' },
    run: (v) => cl.percentOfTarget({ actual: v.num('actual'), target: v.num('target'), unitLabel: v.str('unit') }),
  },
  {
    id: 'protein-kg', name: 'Protein intake per kg', category: 'nutrition', topic: 'nutrition', refs: ['macros'],
    description: 'g/kg/day from daily protein.', tags: ['protein', 'g/kg'],
    fields: [num('protein', 'Protein per day', { unitText: 'g' }), weight()], defaults: { 'weight@': 'kg' }, example: { protein: '84', weight: '70', 'weight@': 'kg' },
    run: (v) => cl.proteinPerKg({ proteinG: v.num('protein'), weightKg: v.n('weight', 'kg') }),
  },

  // ---------------- J. Lab ----------------
  {
    id: 'glucose', name: 'Blood glucose mg/dL ↔ mmol/L', category: 'lab', topic: 'conversions', refs: ['glucose'],
    description: 'Convert glucose units.', tags: ['glucose', 'blood sugar', 'CBG', 'mmol', 'mg/dl', 'hypoglycemia'],
    fields: [num('g', 'Glucose value'), sel('from', 'Entered in', [['glu_mgdl', 'mg/dL'], ['glu_mmol', 'mmol/L']])], defaults: { from: 'glu_mgdl' }, example: { g: '180', from: 'glu_mgdl' },
    run: (v) => cl.glucoseConvert({ value: v.num('g'), from: v.str('from') as 'glu_mgdl' | 'glu_mmol' }),
  },
  {
    id: 'creatinine-convert', name: 'Creatinine mg/dL ↔ µmol/L', category: 'lab', topic: 'renal', refs: ['cockcroft-gault'],
    description: 'Serum creatinine units.', tags: ['creatinine', 'umol', 'SCr'],
    fields: [num('c', 'Creatinine'), sel('from', 'Entered in', [['cr_mgdl', 'mg/dL'], ['cr_umol', 'µmol/L']])], defaults: { from: 'cr_umol' }, example: { c: '1.2', from: 'cr_mgdl' },
    run: (v) => cl.creatinineConvert({ value: v.num('c'), from: v.str('from') as 'cr_mgdl' | 'cr_umol' }),
  },
  {
    id: 'dose-volume', name: 'Prescribed dose → volume', category: 'lab', topic: 'dosage', refs: ['dose-basic'],
    description: 'Volume for a prescribed dose at a stated concentration (incl. electrolytes).', tags: ['electrolyte', 'potassium', 'mEq', 'mmol', 'concentration', 'dose to volume'],
    highAlert: 'I have confirmed the product, concentration and prescribed dose. I understand this tool does not determine replacement doses or rates.',
    fields: [num('dose', 'Prescribed dose'), sel('unit', 'Dose unit', [['mg', 'mg'], ['mcg', 'mcg'], ['mEq', 'mEq'], ['mmol', 'mmol'], ['U', 'units']]), num('conc', 'Concentration (per mL, same unit)', { help: 'Required — read it from the product label.' })],
    defaults: { unit: 'mEq' }, example: { dose: '20', unit: 'mEq', conc: '2' },
    run: (v) => cl.doseToVolume({ dose: v.num('dose'), concentration: v.num('conc'), doseUnit: v.str('unit') }),
  },

  // ---------------- K. Blood ----------------
  {
    id: 'transfusion-rate', name: 'Transfusion rate', category: 'blood', topic: 'iv', refs: ['iv-pump'],
    description: 'mL/hr (and gtt/min) for a prescribed duration.', tags: ['blood transfusion', 'PRBC', 'packed cells', 'platelets', 'FFP', 'blood rate'],
    fields: [num('volume', 'Unit volume', { unitText: 'mL' }), num('time', 'Prescribed duration', { units: ['hr', 'min'] }), sel('df', 'Blood set drop factor (optional)', [['', 'Not using gravity'], ['10', '10 gtt/mL'], ['15', '15 gtt/mL'], ['20', '20 gtt/mL']])],
    defaults: { 'time@': 'hr', df: '' }, example: { volume: '300', time: '3', 'time@': 'hr', df: '15' },
    run: (v) => cl.transfusionRate({ volumeMl: v.num('volume'), minutes: v.n('time', 'min'), dropFactor: v.str('df') ? Number(v.str('df')) : undefined }),
  },
  {
    id: 'blood-loss', name: 'Cumulative blood loss & % EBV', category: 'blood', topic: 'fluids', refs: ['blood-volume'],
    description: 'Sum EBL entries and compare with estimated blood volume.', tags: ['EBL', 'estimated blood loss', 'hemorrhage', 'PPH', 'blood volume'],
    fields: [{ kind: 'text', key: 'losses', label: 'Blood loss entries (mL, comma-separated)', placeholder: 'e.g. 150, 200, 80' }, weight(), sel('pop', 'Blood volume estimate', Object.entries(cl.BLOOD_VOLUME_ML_PER_KG).map(([k, n]) => [String(n), k]))],
    defaults: { 'weight@': 'kg', pop: '65' }, example: { losses: '300, 250, 150', weight: '70', 'weight@': 'kg', pop: '65' },
    run: (v) => {
      const parts = v.str('losses').split(/[,;\s]+/).filter(Boolean).map(Number);
      const bad = parts.length === 0 || parts.some((p) => !Number.isFinite(p) || p < 0);
      return cl.bloodLossPercent({ lossMl: bad ? NaN : parts.reduce((a, b) => a + b, 0), weightKg: v.n('weight', 'kg'), mlPerKg: Number(v.str('pop')) });
    },
  },

  // ---------------- L. OB ----------------
  {
    id: 'edd', name: 'Due date & gestational age', category: 'ob', topic: 'obstetric', refs: ['naegele'],
    description: 'Naegele’s rule from LMP.', tags: ['EDD', 'EDC', 'due date', 'Naegele', 'LMP', 'AOG', 'age of gestation', 'gestational age', 'pregnancy wheel'],
    fields: [{ kind: 'date', key: 'lmp', label: 'First day of last menstrual period' }, { kind: 'date', key: 'today', label: 'Assessment date' }, num('cycle', 'Usual cycle length', { optional: true, unitText: 'days' })],
    defaults: { today: new Date().toISOString().slice(0, 10), cycle: '28' }, example: { lmp: '2026-01-01', today: '2026-03-01', cycle: '28' },
    run: (v) => cl.naegele({ lmp: v.str('lmp'), today: v.str('today'), cycleDays: v.opt('cycle') }),
  },
  {
    id: 'apgar', name: 'APGAR score', category: 'ob', topic: 'obstetric', refs: ['apgar'],
    description: 'Newborn assessment at 1 and 5 minutes.', tags: ['APGAR', 'newborn', 'neonate', 'delivery room'],
    fields: [sel('minute', 'Time after birth', [['1', '1 minute'], ['5', '5 minutes'], ['10', '10 minutes']]), ...choices(sc.APGAR_ITEMS)],
    defaults: { minute: '1' }, example: { minute: '1', appearance: '1', pulse: '2', grimace: '2', activity: '2', respiration: '2' },
    run: (v) => sc.apgar(choiceMap(v, sc.APGAR_ITEMS), Number(v.str('minute'))),
  },
  {
    id: 'newborn-loss', name: 'Newborn weight loss %', category: 'ob', topic: 'obstetric', refs: ['naegele'],
    description: 'Percent change from birth weight.', tags: ['newborn weight', 'neonatal weight loss', 'breastfeeding'],
    fields: [num('birth', 'Birth weight', { units: ['g', 'kg'] }), num('curr', 'Current weight', { units: ['g', 'kg'] })], defaults: { 'birth@': 'g', 'curr@': 'g' }, example: { birth: '3500', 'birth@': 'g', curr: '3290', 'curr@': 'g' },
    run: (v) => cl.newbornWeightLoss({ birthG: v.n('birth', 'g'), currentG: v.n('curr', 'g') }),
  },
  {
    id: 'contractions', name: 'Contraction frequency & duration', category: 'ob', topic: 'obstetric', refs: ['naegele'],
    description: 'From start times (handles midnight).', tags: ['contractions', 'labor', 'labour', 'frequency', 'duration', 'uterine'],
    fields: [{ kind: 'text', key: 'starts', label: 'Start times (HH:MM or HH:MM:SS, comma-separated)', placeholder: '14:02, 14:06, 14:09:30' }, { kind: 'text', key: 'durs', label: 'Durations in seconds (optional, comma-separated)', placeholder: '50, 60, 55' }],
    example: { starts: '14:02, 14:06, 14:09:30, 14:13', durs: '50, 60, 55, 60' },
    run: (v) => cl.contractions({ startTimes: v.str('starts').split(',').map((s) => s.trim()).filter(Boolean), durationsSec: v.str('durs').split(',').map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n)) }),
  },
  {
    id: 'bishop', name: 'Bishop score', category: 'ob', topic: 'obstetric', refs: ['bishop'], description: 'Cervical assessment score (original criteria).', tags: ['Bishop', 'cervix', 'induction', 'ripening'],
    fields: choices(sc.BISHOP_ITEMS), example: { dilation: '2', effacement: '2', station: '2', consistency: '1', position: '1' },
    run: (v) => sc.bishop(choiceMap(v, sc.BISHOP_ITEMS)),
  },
  {
    id: 'ob-history', name: 'Obstetric history (G/P, GTPAL)', category: 'ob', topic: 'obstetric', refs: [], screen: 'info',
    description: 'Reference for gravidity/parity notation.', tags: ['GTPAL', 'gravida', 'para', 'G P', 'obstetric score'],
    info: [
      { heading: 'Gravida (G)', lines: ['Number of pregnancies, including the current one, regardless of outcome.'] },
      { heading: 'Para (P)', lines: ['Number of pregnancies reaching viability (definition of the threshold varies by country, often 20 or 24 weeks). Twins count as one.'] },
      { heading: 'GTPAL', lines: ['G — gravida; T — term births; P — preterm births; A — abortions/miscarriages before viability; L — living children.', 'Example: G3 T1 P1 A0 L2 — third pregnancy, one term and one preterm birth, two living children.'] },
    ],
  },

  // ---------------- M. Emergency ----------------
  { ...{ id: 'gcs-em', name: 'GCS (emergency)', category: 'emergency' as const, description: 'Opens the Glasgow Coma Scale.', tags: ['GCS', 'trauma', 'head injury'], refs: ['gcs'], screen: 'info' as const, info: [] } },
  {
    id: 'qsofa', name: 'qSOFA', category: 'emergency', topic: 'emergency', refs: ['qsofa'], description: 'Bedside prompt in suspected infection — not diagnostic.', tags: ['sepsis', 'qSOFA', 'infection', 'Sepsis-3'],
    fields: choices(sc.QSOFA_ITEMS), example: { rr: '1', mental: '0', sbp: '1' }, run: (v) => sc.qsofa(choiceMap(v, sc.QSOFA_ITEMS)),
  },
  {
    id: 'gbs', name: 'Glasgow-Blatchford score', category: 'emergency', topic: 'emergency', refs: ['gbs'], description: 'Upper GI bleeding risk score.', tags: ['GI bleed', 'Blatchford', 'GBS', 'melena', 'haematemesis', 'hematemesis'],
    fields: [num('urea', 'Blood urea', { unitText: 'mmol/L' }), num('hb', 'Haemoglobin', { unitText: 'g/dL' }), sel('sex', 'Sex (score variable)', [['female', 'Female'], ['male', 'Male']]), num('sbp', 'Systolic BP', { unitText: 'mmHg' }), num('pulse', 'Pulse', { unitText: '/min' }), { kind: 'toggle', key: 'melaena', label: 'Melaena' }, { kind: 'toggle', key: 'syncope', label: 'Presented with syncope' }, { kind: 'toggle', key: 'hepatic', label: 'Hepatic disease' }, { kind: 'toggle', key: 'cardiac', label: 'Cardiac failure' }],
    defaults: { sex: 'female' }, example: { urea: '9', hb: '11', sex: 'male', sbp: '95', pulse: '105', melaena: 'true', syncope: 'true' },
    run: (v) => sc.glasgowBlatchford({ ureaMmolL: v.num('urea'), hbGdl: v.num('hb'), sex: v.str('sex') as 'male' | 'female', sbp: v.num('sbp'), pulse: v.num('pulse'), melaena: v.bool('melaena'), syncope: v.bool('syncope'), hepatic: v.bool('hepatic'), cardiacFailure: v.bool('cardiac') }),
  },
  { ...{ id: 'shock-index-em', name: 'Shock index & MAP', category: 'emergency' as const, description: 'Opens the hemodynamic calculators.', tags: ['shock', 'MAP'], refs: ['shock-index'], screen: 'info' as const, info: [] } },
  {
    id: 'cpr', name: 'Adult CPR & defibrillation reference', category: 'emergency', topic: 'emergency', refs: ['cpr'], screen: 'info',
    description: 'Compression targets; defibrillation is protocol-specific.', tags: ['CPR', 'BLS', 'ACLS', 'compressions', 'defibrillation', 'code', 'arrest'],
    info: [
      { heading: 'Adult chest compressions', lines: ['Rate 100–120 per minute.', 'Depth about 5–6 cm, allow full recoil, minimise interruptions.', '30 compressions : 2 breaths without an advanced airway (adult).', 'Source: ILCOR/AHA/ERC adult BLS guidance — confirm against the current edition used by your organisation.'] },
      { heading: 'Defibrillation', lines: ['Energy levels depend on the device (biphasic waveform settings vary by manufacturer) and the current guideline.', 'Not provided here: follow your device’s labelled settings and your ALS/ACLS protocol.'] },
      { heading: 'Compression timer tip', lines: ['110 compressions per minute ≈ just under 2 per second.'] },
    ],
  },

  // ---------------- N. Wound ----------------
  {
    id: 'wound', name: 'Wound area, volume & change', category: 'wound', topic: 'wound', refs: ['wound'],
    description: 'L × W (× D) approximations and % change.', tags: ['wound', 'pressure injury', 'ulcer', 'measurement', 'healing'],
    fields: [num('length', 'Length (head-to-toe)', { units: ['cm', 'mm', 'in'] }), num('width', 'Width (side-to-side)', { units: ['cm', 'mm', 'in'] }), num('depth', 'Depth (optional)', { optional: true, units: ['cm', 'mm', 'in'] }), num('prev', 'Previous area (optional)', { optional: true, unitText: 'cm²' })],
    defaults: { 'length@': 'cm', 'width@': 'cm', 'depth@': 'cm' }, example: { length: '4', 'length@': 'cm', width: '3', 'width@': 'cm', depth: '0.5', 'depth@': 'cm', prev: '16' },
    run: (v) => cl.woundMeasure({ lengthCm: v.n('length', 'cm'), widthCm: v.n('width', 'cm'), depthCm: v.opt('depth', 'cm'), prevAreaCm2: v.opt('prev') }),
  },

  // ---------------- O / P ----------------
  { id: 'converter', name: 'Unit converter', category: 'convert', refs: [], screen: 'converter', description: 'Weight, volume, length, time, temperature, glucose, pressure, concentration.', tags: ['convert', 'conversion', 'mg to mcg', 'lb to kg', 'kg to lb', 'inches to cm', 'mmHg kPa', 'units'] },
  { id: 'practice', name: 'Practice questions & mock exam', category: 'practice', refs: [], screen: 'practice', description: 'Randomised drills with worked explanations.', tags: ['quiz', 'exam', 'NCLEX', 'board exam', 'drill', 'practice', 'review'] },
];

// Emergency shortcuts redirect to their primary calculator.
export const ALIASES: Record<string, string> = { 'gcs-em': 'gcs', 'shock-index-em': 'shock-index' };

export const LISTED = () => CALCULATORS.filter((c) => !ALIASES[c.id]);

export const calcById = (id: string) => CALCULATORS.find((c) => c.id === (ALIASES[id] ?? id));

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9%/²µ]+/g, ' ').trim();

/** Search by name, abbreviation, tags and description; ranks name hits first. */
export function searchCalculators(q: string): CalcDef[] {
  const s = norm(q);
  if (!s) return [];
  const words = s.split(' ');
  const scored = CALCULATORS.filter((c) => !ALIASES[c.id]).map((c) => {
    const name = norm(c.name);
    const tags = c.tags.map(norm);
    const desc = norm(c.description);
    let score = 0;
    if (name.includes(s)) score += 10;
    if (tags.some((t) => t === s)) score += 9;
    if (tags.some((t) => t.includes(s))) score += 6;
    for (const w of words) {
      if (name.includes(w)) score += 3;
      if (tags.some((t) => t.includes(w))) score += 2;
      if (desc.includes(w)) score += 1;
    }
    const allWords = words.every((w) => name.includes(w) || tags.some((t) => t.includes(w)) || desc.includes(w));
    return { c, score: allWords ? score : 0 };
  });
  return scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score).map((x) => x.c);
}

export const DEFAULT_QUICK = ['drug-dose', 'pump-rate', 'drip-rate', 'bmi', 'gcs', 'fluid-balance', 'urine-output', 'map', 'peds-dose', 'o2-cylinder'];
