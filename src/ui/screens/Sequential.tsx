import { useState } from 'react';
import { parseNumber } from '../../calculations/core';
import { sequentialInfusions } from '../../calculations/iv';
import type { CalcDef } from '../../features/types';
import { Icon } from '../icons';
import { FavButton, Header } from '../components/common';

interface Row { id: number; vol: string; rate: string }

// Example plan shown on first open, labelled as an example.
const EXAMPLE: Row[] = [{ id: 1, vol: '1000', rate: '125' }, { id: 2, vol: '500', rate: '100' }];

export function SequentialScreen({ def }: { def: CalcDef }) {
  const [start, setStart] = useState('20:00');
  const [rows, setRows] = useState<Row[]>(EXAMPLE);
  const [example, setExample] = useState(true);
  const edit = (id: number, k: 'vol' | 'rate', v: string) => { setExample(false); setRows(rows.map((r) => (r.id === id ? { ...r, [k]: v } : r))); };

  const parse = (s: string) => { const p = parseNumber(s); return p.ok ? p.value : NaN; };
  const rowErr = (s: string) => { const p = parseNumber(s); return s.trim() === '' ? 'Required' : p.ok ? null : p.message; };
  const res = sequentialInfusions({ start, bags: rows.map((r) => ({ volumeMl: parse(r.vol), rateMlHr: parse(r.rate) })) });

  return (
    <>
      <Header title={def.name} sub="B. IV therapy & infusion" right={<FavButton id={def.id} />} />
      <main className="pad stack">
        <p className="lede">{def.description}</p>
        {example && <div className="alert info"><Icon name="info" size={18} /><p>Example plan. Edit the values or add bags; nothing here is saved.</p></div>}
        <section className="card form">
          <div className="field">
            <label htmlFor="seq-start">First bag starts</label>
            <input id="seq-start" type="time" value={start} onChange={(e) => { setExample(false); setStart(e.target.value); }} />
          </div>
          <ol className="bags">
            {rows.map((r, k) => (
              <li key={r.id} className="bag">
                <p className="bag-title">Bag {k + 1}</p>
                <div className="two">
                  <div className="field">
                    <label htmlFor={`seq-v${r.id}`}>Volume</label>
                    <div className="numrow"><input id={`seq-v${r.id}`} inputMode="decimal" value={r.vol} onChange={(e) => edit(r.id, 'vol', e.target.value)} aria-invalid={!!rowErr(r.vol)} /><span className="unit-fixed">mL</span></div>
                    {rowErr(r.vol) && <p className="field-err"><Icon name="alert" size={14} /> {rowErr(r.vol)}</p>}
                  </div>
                  <div className="field">
                    <label htmlFor={`seq-r${r.id}`}>Rate</label>
                    <div className="numrow"><input id={`seq-r${r.id}`} inputMode="decimal" value={r.rate} onChange={(e) => edit(r.id, 'rate', e.target.value)} aria-invalid={!!rowErr(r.rate)} /><span className="unit-fixed">mL/hr</span></div>
                    {rowErr(r.rate) && <p className="field-err"><Icon name="alert" size={14} /> {rowErr(r.rate)}</p>}
                  </div>
                </div>
                {rows.length > 1 && <button type="button" className="linkbtn" onClick={() => { setExample(false); setRows(rows.filter((x) => x.id !== r.id)); }}>Remove bag {k + 1}</button>}
              </li>
            ))}
          </ol>
          <div className="form-actions">
            <button type="button" className="btn ghost" onClick={() => { setExample(false); setRows([...rows, { id: Date.now(), vol: '', rate: '' }]); }}><Icon name="plus" size={18} /> Add bag</button>
            <button type="button" className="btn ghost" onClick={() => { setExample(false); setRows([{ id: Date.now(), vol: '', rate: '' }]); }}>Clear</button>
          </div>
        </section>
        <div aria-live="polite">
          {res.ok ? (
            <section className="result" aria-label={`${def.name} result`}>
              <div className="result-hero">
                <p className="eyebrow">Total volume</p>
                <p className="result-value"><span className="num">{res.display}</span> <span className="result-unit">mL</span></p>
                <p className="result-interp">{res.extras[0]?.value} running time</p>
              </div>
              <div className="card work">
                <h2 className="h3">Bag by bag</h2>
                <ol className="steps">{res.steps.map((st) => <li key={st} className="mono">{st}</li>)}</ol>
                <p className="label">Rounding</p><p>{res.rounding}</p>
              </div>
              <div className="card"><ul className="bullets">{res.notes.map((n) => <li key={n.text}>{n.text}</li>)}</ul></div>
            </section>
          ) : (
            <div className="alert warn"><Icon name="alert" size={18} /><div><p><strong>Can’t calculate yet</strong></p><ul className="bullets">{res.errors.map((e) => <li key={e.message}>{e.message}</li>)}</ul></div></div>
          )}
        </div>
      </main>
    </>
  );
}
