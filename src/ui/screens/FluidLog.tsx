import { useMemo, useState } from 'react';
import { fmt, parseNumber } from '../../calculations/core';
import { FLUID_NOTE, INSENSIBLE_NOTE, INTAKE_LABELS, OUTPUT_LABELS, fluidSummary, urineOutput, type FluidEntry } from '../../calculations/fluids';
import { convert } from '../../calculations/units';
import type { CalcDef } from '../../features/types';
import { Icon } from '../icons';
import { FavButton, Header } from '../components/common';
import { useStore } from '../nav';

// Sample practice case, clearly labelled. Nothing in this log is saved.
const SAMPLE: FluidEntry[] = [
  { id: 's1', kind: 'in', cat: 'oral', ml: 240, time: '08:00' },
  { id: 's2', kind: 'in', cat: 'iv', ml: 500, time: '08:00' },
  { id: 's3', kind: 'out', cat: 'urine', ml: 350, time: '10:00' },
  { id: 's4', kind: 'in', cat: 'flush', ml: 20, time: '12:00' },
  { id: 's5', kind: 'out', cat: 'drainage', ml: 60, time: '12:00', estimated: true },
  { id: 's6', kind: 'in', cat: 'medication', ml: 100, time: '14:00' },
  { id: 's7', kind: 'out', cat: 'urine', ml: 300, time: '14:00' },
];

const nowHHMM = () => new Date().toTimeString().slice(0, 5);

export function FluidLog({ def }: { def: CalcDef }) {
  const s = useStore();
  const [entries, setEntries] = useState<FluidEntry[]>(SAMPLE);
  const [isSample, setIsSample] = useState(true);
  const [kind, setKind] = useState<'in' | 'out'>('in');
  const [cat, setCat] = useState<string>('oral');
  const [ml, setMl] = useState('');
  const [time, setTime] = useState(nowHHMM());
  const [est, setEst] = useState(false);
  const [err, setErr] = useState('');
  const [weight, setWeight] = useState('70');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>(s.settings.weightUnit);
  const [hours, setHours] = useState('6');

  const sum = useMemo(() => fluidSummary(entries), [entries]);
  const num = (s: string) => { const p = parseNumber(s); return p.ok ? p.value : NaN; };
  const wNum = num(weight);
  const kg = wNum > 0 ? convert(wNum, weightUnit, 'kg') : NaN;
  const uo = urineOutput({ volumeMl: sum.urine, hours: num(hours), weightKg: kg });

  const add = () => {
    const p = parseNumber(ml);
    if (ml.trim() === '') return setErr('Enter the volume in mL.');
    if (!p.ok) return setErr(p.message);
    const v = p.value;
    if (v <= 0) return setErr('Volume must be greater than zero.');
    if (v > 5000) return setErr('Single entries over 5,000 mL are unusual — check the value.');
    if (!/^\d{2}:\d{2}$/.test(time)) return setErr('Enter a time as HH:MM.');
    setErr('');
    const base = isSample ? [] : entries;
    setIsSample(false);
    setEntries([...base, { id: String(Date.now()), kind, cat: cat as FluidEntry['cat'], ml: v, time, estimated: kind === 'out' ? est : undefined }]);
    setMl('');
  };

  const cats = kind === 'in' ? INTAKE_LABELS : OUTPUT_LABELS;
  const sorted = [...entries].sort((a, b) => a.time.localeCompare(b.time));
  const maxAbs = Math.max(1, ...sum.running.map((x) => Math.abs(x.net)));

  return (
    <>
      <Header title="Intake & output" sub="E. Fluid balance & renal" right={<FavButton id={def.id} />} />
      <main className="pad stack">
        <div className="alert info"><Icon name="info" size={18} /><p>{isSample ? 'Showing a sample practice case. Your first entry replaces it.' : 'Practice log — kept on this screen only, never saved. Do not enter patient identifiers.'}</p></div>

        <section className="summary-grid" aria-label="Balance summary">
          <div className="stat"><span className="stat-label">Intake</span><span className="stat-val num">{fmt(sum.intake, 0)}<small> mL</small></span></div>
          <div className="stat"><span className="stat-label">Output</span><span className="stat-val num">{fmt(sum.output, 0)}<small> mL</small></span></div>
          <div className={`stat net ${sum.net > 0 ? 'pos' : sum.net < 0 ? 'neg' : ''}`}><span className="stat-label">Net balance</span><span className="stat-val num">{sum.net > 0 ? '+' : ''}{fmt(sum.net, 0)}<small> mL</small></span><span className="stat-sub">{sum.net > 0 ? 'Positive' : sum.net < 0 ? 'Negative' : 'Even'}</span></div>
        </section>
        {sum.estimatedOutput > 0 && <p className="fineprint">Output includes {fmt(sum.estimatedOutput, 0)} mL estimated (not measured) — marked “est.” below. Measured output: {fmt(sum.measuredOutput, 0)} mL.</p>}

        <form className="card form" onSubmit={(e) => { e.preventDefault(); add(); }} noValidate>
          <h2 className="h3">Add entry</h2>
          <div className="seg" role="radiogroup" aria-label="Entry type">
            {(['in', 'out'] as const).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} className={kind === k ? 'on' : ''} onClick={() => { setKind(k); setCat(k === 'in' ? 'oral' : 'urine'); }}>{k === 'in' ? 'Intake' : 'Output'}</button>
            ))}
          </div>
          <div className="field">
            <label htmlFor="fl-cat">Category</label>
            <select id="fl-cat" value={cat} onChange={(e) => setCat(e.target.value)}>
              {Object.entries(cats).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div className="two">
            <div className="field">
              <label htmlFor="fl-ml">Volume</label>
              <div className="numrow"><input id="fl-ml" inputMode="decimal" value={ml} onChange={(e) => setMl(e.target.value)} aria-invalid={!!err} aria-describedby={err ? 'fl-err' : undefined} /><span className="unit-fixed">mL</span></div>
            </div>
            <div className="field">
              <label htmlFor="fl-time">Time</label>
              <input id="fl-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          {kind === 'out' && (
            <label className="toggle" htmlFor="fl-est"><input type="checkbox" id="fl-est" role="switch" checked={est} onChange={(e) => setEst(e.target.checked)} /><span className="switch" aria-hidden="true" /><span>Estimated, not measured</span></label>
          )}
          {err && <p className="field-err" id="fl-err"><Icon name="alert" size={14} /> {err}</p>}
          <div className="form-actions">
            <button className="btn primary" type="submit"><Icon name="plus" size={18} /> Add</button>
            <button className="btn ghost" type="button" onClick={() => { setEntries([]); setIsSample(false); }}>Clear log</button>
          </div>
        </form>

        <section className="card">
          <h2 className="h3">Record and cumulative balance</h2>
          {sorted.length === 0 ? <p className="muted">No entries yet. Add intake or output above.</p> : (
            <div className="table-wrap">
              <table className="iotable">
                <caption className="sr-only">Fluid entries in time order with running balance</caption>
                <thead><tr><th scope="col">Time</th><th scope="col">Entry</th><th scope="col" className="r">mL</th><th scope="col" className="r">Running</th><th scope="col"><span className="sr-only">Remove</span></th></tr></thead>
                <tbody>
                  {sorted.map((e, k) => {
                    const run = sum.running[k]?.net ?? 0;
                    return (
                      <tr key={e.id}>
                        <td className="num">{e.time}</td>
                        <td><span className={`tag ${e.kind}`}>{e.kind === 'in' ? 'IN' : 'OUT'}</span> {(e.kind === 'in' ? INTAKE_LABELS : OUTPUT_LABELS)[e.cat as never]}{e.estimated && <span className="chip">est.</span>}</td>
                        <td className="r num">{e.kind === 'in' ? '+' : '−'}{fmt(e.ml, 0)}</td>
                        <td className="r num">
                          <span className="runbar" aria-hidden="true"><span style={{ width: `${(Math.abs(run) / maxAbs) * 100}%` }} className={run >= 0 ? 'pos' : 'neg'} /></span>
                          {run > 0 ? '+' : ''}{fmt(run, 0)}
                        </td>
                        <td><button className="iconbtn sm" aria-label={`Remove ${e.time} entry`} onClick={() => { setIsSample(false); setEntries(entries.filter((x) => x.id !== e.id)); }}><Icon name="trash" size={16} /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <dl className="kv plain">
            {Object.entries(sum.byCat).map(([k, v]) => <div key={k}><dt>{(INTAKE_LABELS as Record<string, string>)[k] ?? (OUTPUT_LABELS as Record<string, string>)[k]}</dt><dd>{fmt(v, 0)} mL</dd></div>)}
          </dl>
        </section>

        <section className="card form">
          <h2 className="h3">Urine output from this log</h2>
          <div className="two">
            <div className="field">
              <label htmlFor="fl-w">Weight</label>
              <div className="numrow"><input id="fl-w" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
                <select aria-label="Weight unit" id="fl-wu" value={weightUnit} onChange={(e) => setWeightUnit(e.target.value as 'kg' | 'lb')}><option value="kg">kg</option><option value="lb">lb</option></select></div>
            </div>
            <div className="field">
              <label htmlFor="fl-h">Period covered</label>
              <div className="numrow"><input id="fl-h" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} /><span className="unit-fixed">hours</span></div>
            </div>
          </div>
          {uo.ok ? (
            <p className="inline-result"><span className="num">{uo.display}</span> mL/kg/hr <span className="muted">· {uo.extras[0]?.value} · urine total {fmt(sum.urine, 0)} mL</span></p>
          ) : <p className="field-err"><Icon name="alert" size={14} /> {uo.errors[0]?.message}</p>}
        </section>

        <div className="card">
          <h2 className="h3">Interpreting balance</h2>
          <ul className="bullets"><li>{FLUID_NOTE.text}</li><li>{INSENSIBLE_NOTE.text}</li></ul>
        </div>
      </main>
    </>
  );
}
