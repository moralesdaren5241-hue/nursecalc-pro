import { useState } from 'react';
import { fmt, parseNumber } from '../../calculations/core';
import { convert, factorText, searchUnits, unitsOf, type Dimension } from '../../calculations/units';
import { FavButton, Header } from '../components/common';
import { Icon } from '../icons';

const DIMS: { dim: Dimension; name: string; note?: string }[] = [
  { dim: 'mass', name: 'Weight / mass' },
  { dim: 'volume', name: 'Volume' },
  { dim: 'length', name: 'Length' },
  { dim: 'time', name: 'Time' },
  { dim: 'temperature', name: 'Temperature' },
  { dim: 'glucose', name: 'Glucose', note: 'Glucose only (molar mass 180.16 g/mol). Other analytes use different factors.' },
  { dim: 'creatinine', name: 'Creatinine', note: 'Creatinine only (1 mg/dL = 88.4 µmol/L).' },
  { dim: 'pressure', name: 'Pressure' },
  { dim: 'massConc', name: 'Concentration', note: 'Mass per volume only. % here means w/v (g per 100 mL).' },
];

export function Converter() {
  const [dim, setDim] = useState<Dimension>('mass');
  const [from, setFrom] = useState('mg');
  const [to, setTo] = useState('mcg');
  const [value, setValue] = useState('1');
  const [dp, setDp] = useState(4);
  const [q, setQ] = useState('');
  const us = unitsOf(dim);
  const pickDim = (d: Dimension) => {
    const list = unitsOf(d);
    setDim(d);
    setFrom(list[0]!.id);
    setTo((list[1] ?? list[0])!.id);
  };
  const parsed = parseNumber(value);
  const n = parsed.ok ? parsed.value : NaN;
  let out = '';
  let error = '';
  if (!parsed.ok) error = value.trim() === '' ? 'Enter a number to convert.' : parsed.message;
  else if (!Number.isFinite(n)) error = 'Enter a finite number.';
  else if (n < 0 && dim !== 'temperature') error = 'This quantity cannot be negative.';
  else {
    try { out = fmt(convert(n, from, to), dp); } catch (e) { error = (e as Error).message; }
  }
  const matches = q.trim() ? searchUnits(q) : [];
  const meta = DIMS.find((d) => d.dim === dim);
  const lbl = (id: string) => us.find((u) => u.id === id)?.label ?? id;

  return (
    <>
      <Header title="Unit converter" sub="O. Unit conversions" right={<FavButton id="converter" />} />
      <main className="pad stack">
        <div className="field">
          <label htmlFor="cv-search">Find a unit</label>
          <div className="searchbox"><Icon name="search" size={18} /><input id="cv-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. mcg, lb, kPa, mmol" autoComplete="off" /></div>
          {matches.length > 0 && (
            <div className="chips" aria-label="Matching units">
              {matches.slice(0, 10).map((u) => (
                <button key={u.id} className="chipbtn" onClick={() => { const list = unitsOf(u.dim); setDim(u.dim); setFrom(u.id); setTo((list.find((x) => x.id !== u.id) ?? u).id); setQ(''); }}>
                  {u.label} <span className="muted">· {DIMS.find((d) => d.dim === u.dim)?.name ?? u.dim}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="chips scroll" role="tablist" aria-label="Quantity type">
          {DIMS.map((d) => <button key={d.dim} role="tab" aria-selected={dim === d.dim} className={`chipbtn ${dim === d.dim ? 'on' : ''}`} onClick={() => pickDim(d.dim)}>{d.name}</button>)}
        </div>
        <section className="card form">
          <div className="field">
            <label htmlFor="cv-val">Value</label>
            <div className="numrow">
              <input id="cv-val" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
              <select id="cv-from" aria-label="From unit" value={from} onChange={(e) => setFrom(e.target.value)}>{us.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</select>
            </div>
          </div>
          <div className="swaprow">
            <button className="iconbtn" aria-label="Swap units" onClick={() => { setFrom(to); setTo(from); }}><Icon name="swap" /></button>
          </div>
          <div className="field">
            <label htmlFor="cv-to">Convert to</label>
            <select id="cv-to" value={to} onChange={(e) => setTo(e.target.value)}>{us.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</select>
          </div>
          <div aria-live="polite">
            {error ? <p className="field-err"><Icon name="alert" size={14} /> {error}</p> : (
              <p className="inline-result big"><span className="num">{out}</span> {lbl(to)}</p>
            )}
          </div>
          <p className="mono small">{factorText(from, to)}</p>
          <div className="field">
            <label htmlFor="cv-dp">Decimal places shown</label>
            <select id="cv-dp" value={dp} onChange={(e) => setDp(Number(e.target.value))}>{[0, 1, 2, 3, 4, 6].map((d) => <option key={d} value={d}>{d}</option>)}</select>
          </div>
        </section>
        {meta?.note && <div className="alert info"><Icon name="info" size={18} /><p>{meta.note}</p></div>}
        <div className="alert info"><Icon name="info" size={18} /><p>Conversions only happen within one kind of quantity. Mass cannot become volume (mg → mL) without a concentration — use the Drug dose calculator for that.</p></div>
      </main>
    </>
  );
}
