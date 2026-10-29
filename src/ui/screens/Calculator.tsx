import { useEffect, useMemo, useRef, useState } from 'react';
import type { CalcResult, CalcOk } from '../../calculations/core';
import { unit as unitDef } from '../../calculations/units';
import { calcById } from '../../features/registry';
import { FormValues, type CalcDef, type Field } from '../../features/types';
import { refById } from '../../references/manifest';
import { Icon } from '../icons';
import { Disclaimer, FavButton, Header, catOf } from '../components/common';
import { useNav, useStore } from '../nav';
import { FluidLog } from './FluidLog';
import { Converter } from './Converter';
import { PracticeHub } from './Learn';
import { SequentialScreen } from './Sequential';

const ulabel = (id: string) => {
  try { return unitDef(id).label; } catch { return id; }
};

function initialRaw(def: CalcDef, weightUnit: string): Record<string, string> {
  const raw: Record<string, string> = {};
  for (const f of def.fields ?? []) {
    if (f.kind === 'number' && f.units?.length) {
      raw[`${f.key}@`] = f.units.includes(weightUnit) && f.units.includes('kg') ? weightUnit : (f.units[0] as string);
    }
    if (f.kind === 'select') raw[f.key] = f.options[0]?.value ?? '';
  }
  for (const [k, v] of Object.entries(def.defaults ?? {})) {
    // keep the user's preferred weight unit unless the field is kg-only
    if (k.endsWith('@') && v === 'kg' && raw[k] === 'lb') continue;
    raw[k] = v;
  }
  return raw;
}

export function CalculatorScreen({ id }: { id: string }) {
  const def = calcById(id);
  const s = useStore();
  useEffect(() => { if (def) s.touchRecent(def.id); }, [def?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!def) return <><Header title="Not found" /><p className="pad">This calculator does not exist.</p></>;
  if (def.screen === 'fluid') return <FluidLog def={def} />;
  if (def.screen === 'converter') return <Converter />;
  if (def.screen === 'practice') return <PracticeHub />;
  if (def.screen === 'info') return <InfoScreen def={def} />;
  if (def.screen === 'sequential') return <SequentialScreen def={def} />;
  return <CalcForm key={def.id} def={def} />;
}

function InfoScreen({ def }: { def: CalcDef }) {
  const cat = catOf(def);
  return (
    <>
      <Header title={def.name} sub={cat?.name} right={<FavButton id={def.id} />} />
      <main className="pad stack">
        <p className="lede">{def.description}</p>
        <div className="alert info"><Icon name="book" size={18} /><p>Educational summary, awaiting clinical review. Follow your organisation’s protocols and the current edition of the relevant guideline.</p></div>
        {def.info?.map((b) => (
          <section key={b.heading} className="card">
            <h2 className="h3">{b.heading}</h2>
            <ul className="bullets">{b.lines.map((l) => <li key={l}>{l}</li>)}</ul>
          </section>
        ))}
        <RefBlock def={def} />
        <Disclaimer compact />
      </main>
    </>
  );
}

function CalcForm({ def }: { def: CalcDef }) {
  const s = useStore();
  const nav = useNav();
  const [raw, setRaw] = useState<Record<string, string>>(() => initialRaw(def, s.settings.weightUnit));
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<CalcResult | null>(null);
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const resultRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const scoreOnly = (def.fields ?? []).every((f) => f.kind === 'choice' || f.kind === 'toggle' || f.kind === 'select');

  const set = (k: string, v: string) => {
    setRaw((r) => ({ ...r, [k]: v }));
    setFieldErr((e) => { const n = { ...e }; delete n[k]; return n; });
  };

  const visibleFields = (r: Record<string, string>) => (def.fields ?? []).filter((f) => !f.showIf || f.showIf(r));

  const compute = (rawNow: Record<string, string>, scroll: boolean) => {
    const visible = visibleFields(rawNow);
    // Hidden fields are removed so stale values from another mode can never reach the engine.
    const runRaw = { ...rawNow };
    for (const f of def.fields ?? []) if (!visible.includes(f)) { delete runRaw[f.key]; delete runRaw[`${f.key}@`]; }
    const errs: Record<string, string> = {};
    const fv = new FormValues(runRaw);
    for (const f of visible) {
      if (f.kind === 'number') {
        const bad = fv.numError(f.key);
        if (!fv.has(f.key) && !f.optional) errs[f.key] = `Enter ${f.label.toLowerCase()}.`;
        else if (bad) errs[f.key] = bad;
      }
    }
    setFieldErr(errs);
    const scrollToResult = () => {
      if (scroll) requestAnimationFrame(() => { resultRef.current?.scrollIntoView({ behavior: s.settings.reduceMotion ? 'auto' : 'smooth', block: 'start' }); resultRef.current?.focus({ preventScroll: true }); });
    };
    if (Object.keys(errs).length) {
      // Never show a result while any visible input is missing or unreadable.
      const labels = visible.filter((f) => errs[f.key]).map((f) => ('label' in f ? f.label : f.key));
      setResult({ ok: false, errors: labels.map((l, k) => ({ message: `${l}: ${Object.values(errs)[k]}` })) });
      scrollToResult();
      return;
    }
    if (def.highAlert && !confirmed) {
      setResult({ ok: false, errors: [{ message: 'Tick the high-alert confirmation before calculating.' }] });
      return;
    }
    let r: CalcResult;
    try {
      r = def.run!(fv, s.settings);
    } catch (e) {
      r = { ok: false, errors: [{ message: e instanceof Error ? e.message : 'Could not calculate with these inputs.' }] };
    }
    setResult(r);
    scrollToResult();
  };

  // Scoring tools update live once every item is chosen.
  useEffect(() => {
    if (!scoreOnly) return;
    const choicesDone = (def.fields ?? []).every((f) => f.kind !== 'choice' || (raw[f.key] ?? '') !== '');
    if (choicesDone) compute(raw, false); else setResult(null);
  }, [raw]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadExample = () => {
    const next = { ...initialRaw(def, s.settings.weightUnit), ...(def.example ?? {}) };
    setRaw(next);
    setFieldErr({});
    if (!def.highAlert && !scoreOnly) compute(next, true);
    else setResult(null);
  };

  const reset = () => { setRaw(initialRaw(def, s.settings.weightUnit)); setResult(null); setFieldErr({}); setConfirmed(false); };
  const cat = catOf(def);

  return (
    <>
      <Header title={def.name} sub={cat ? `${cat.letter}. ${cat.name}` : undefined} right={<FavButton id={def.id} />} />
      <main className="pad stack">
        <p className="lede">{def.description}</p>
        {def.highAlert && (
          <div className="alert crit" role="alert">
            <Icon name="alert" size={20} />
            <div>
              <p><strong>High-alert medication.</strong> Errors can cause severe harm. Units and concentration are shown explicitly; an independent double-check is required by most policies.</p>
              <label className="confirm">
                <input type="checkbox" id={`${def.id}-confirm`} checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                <span>{def.highAlert}</span>
              </label>
            </div>
          </div>
        )}
        <form ref={formRef} className="form card" noValidate onSubmit={(e) => { e.preventDefault(); compute(raw, true); }}>
          {visibleFields(raw).map((f) => <FieldView key={f.key} f={f} def={def} raw={raw} set={set} err={fieldErr[f.key]} />)}
          {!scoreOnly && (
            <div className="form-actions">
              <button type="submit" className="btn primary">Calculate</button>
              <button type="button" className="btn ghost" onClick={reset}>Clear</button>
              {def.example && <button type="button" className="btn ghost" onClick={loadExample}>Try example</button>}
            </div>
          )}
          {scoreOnly && (
            <div className="form-actions">
              <button type="button" className="btn ghost" onClick={reset}>Clear selections</button>
              {def.example && <button type="button" className="btn ghost" onClick={loadExample}>Try example</button>}
            </div>
          )}
        </form>
        <div ref={resultRef} tabIndex={-1} aria-live="polite" className="result-anchor">
          {result && !result.ok && (
            <div className="alert warn" role="alert">
              <Icon name="alert" size={20} />
              <div>
                <p><strong>Can’t calculate yet</strong></p>
                <ul className="bullets">{result.errors.map((e, k) => <li key={k}>{e.message}</li>)}</ul>
              </div>
            </div>
          )}
          {result && result.ok && <ResultView def={def} r={result} raw={raw} onEdit={() => formRef.current?.scrollIntoView({ behavior: 'smooth' })} onPractice={() => nav.push({ type: 'quiz', mode: 'topic', topic: def.topic ?? 'dosage' })} />}
        </div>
        {!result && <RefBlock def={def} />}
      </main>
    </>
  );
}

function FieldView({ f, def, raw, set, err }: { f: Field; def: CalcDef; raw: Record<string, string>; set: (k: string, v: string) => void; err?: string }) {
  const id = `${def.id}-${f.key}`;
  const help = 'help' in f && f.help ? <p className="help" id={`${id}-help`}>{f.help}</p> : null;
  const errEl = err ? <p className="field-err" id={`${id}-err`}><Icon name="alert" size={14} /> {err}</p> : null;
  const describedBy = [help ? `${id}-help` : '', err ? `${id}-err` : ''].filter(Boolean).join(' ') || undefined;

  if (f.kind === 'choice') {
    const it = f.item;
    const cur = raw[f.key] ?? '';
    return (
      <fieldset className="choice">
        <legend>{it.label}{cur !== '' && <span className="chip strong">{cur === 'NT' ? `${it.short ?? ''}NT` : `${it.short ?? ''}${it.short ? cur : cur + ' pt'}`}</span>}</legend>
        <div className="choice-grid">
          {it.options.map((o) => (
            <label key={o.points} className={`choice-card ${cur === String(o.points) ? 'sel' : ''}`}>
              <input type="radio" name={id} id={`${id}-${o.points}`} checked={cur === String(o.points)} onChange={() => set(f.key, String(o.points))} />
              <span className="pts" aria-hidden="true">{o.points}</span>
              <span><span className="choice-label">{o.label}</span>{o.detail && <span className="choice-detail">{o.detail}</span>}</span>
            </label>
          ))}
          {it.allowNT && (
            <label className={`choice-card nt ${cur === 'NT' ? 'sel' : ''}`}>
              <input type="radio" name={id} id={`${id}-NT`} checked={cur === 'NT'} onChange={() => set(f.key, 'NT')} />
              <span className="pts" aria-hidden="true">NT</span>
              <span><span className="choice-label">Not testable</span><span className="choice-detail">{it.ntLabel}</span></span>
            </label>
          )}
        </div>
      </fieldset>
    );
  }
  if (f.kind === 'toggle') {
    return (
      <div className="field">
        <label className="toggle" htmlFor={id}>
          <input type="checkbox" id={id} role="switch" checked={raw[f.key] === 'true'} onChange={(e) => set(f.key, String(e.target.checked))} aria-describedby={describedBy} />
          <span className="switch" aria-hidden="true" />
          <span>{f.label}</span>
        </label>
        {help}
      </div>
    );
  }
  if (f.kind === 'select') {
    return (
      <div className="field">
        <label htmlFor={id}>{f.label}</label>
        <select id={id} value={raw[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} aria-describedby={describedBy}>
          {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {help}
      </div>
    );
  }
  if (f.kind === 'time' || f.kind === 'date' || f.kind === 'text') {
    return (
      <div className="field">
        <label htmlFor={id}>{f.label}</label>
        <input id={id} type={f.kind === 'text' ? 'text' : f.kind} value={raw[f.key] ?? ''} placeholder={f.kind === 'text' ? f.placeholder : undefined} onChange={(e) => set(f.key, e.target.value)} aria-describedby={describedBy} autoComplete="off" />
        {help}{errEl}
      </div>
    );
  }
  // number
  const units = f.units ?? [];
  return (
    <div className={`field ${err ? 'has-err' : ''}`}>
      <label htmlFor={id}>{f.label}{f.optional && <span className="opt"> (optional)</span>}</label>
      <div className="numrow">
        <input id={id} type="text" inputMode="decimal" enterKeyHint="next" autoComplete="off" value={raw[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} aria-invalid={!!err} aria-describedby={describedBy} />
        {units.length > 1 ? (
          <select aria-label={`${f.label} unit`} id={`${id}-unit`} value={raw[`${f.key}@`] ?? units[0]} onChange={(e) => set(`${f.key}@`, e.target.value)}>
            {units.map((u) => <option key={u} value={u}>{ulabel(u)}</option>)}
          </select>
        ) : (
          <span className="unit-fixed">{units.length === 1 ? ulabel(units[0] as string) : f.unitText ?? ''}</span>
        )}
      </div>
      {help}{errEl}
    </div>
  );
}

function inputSummary(def: CalcDef, raw: Record<string, string>): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  for (const f of (def.fields ?? []).filter((x) => !x.showIf || x.showIf(raw))) {
    const v = raw[f.key] ?? '';
    if (f.kind === 'choice') { if (v) out.push({ label: f.item.label, value: v === 'NT' ? 'Not testable' : `${v} — ${f.item.options.find((o) => String(o.points) === v)?.label ?? ''}` }); continue; }
    if (f.kind === 'toggle') { if (v === 'true') out.push({ label: f.label, value: 'Yes' }); continue; }
    if (v === '') continue;
    if (f.kind === 'select') { out.push({ label: f.label, value: f.options.find((o) => o.value === v)?.label ?? v }); continue; }
    if (f.kind === 'number') { const u = raw[`${f.key}@`]; out.push({ label: f.label, value: `${v} ${u ? ulabel(u) : f.unitText ?? ''}`.trim() }); continue; }
    out.push({ label: f.label, value: v });
  }
  return out;
}

function ResultView({ def, r, raw, onEdit, onPractice }: { def: CalcDef; r: CalcOk; raw: Record<string, string>; onEdit: () => void; onPractice: () => void }) {
  const notes = useMemo(() => [...r.notes].sort((a, b) => rank(a.severity) - rank(b.severity)), [r.notes]);
  const warnCount = r.notes.filter((n) => n.severity !== 'info').length;
  const summary = inputSummary(def, raw);
  return (
    <section className="result" aria-label={`${def.name} result`}>
      <div className="result-hero">
        <p className="eyebrow">{def.name}</p>
        <p className="result-value"><span className="num">{r.display}</span> <span className="result-unit">{r.displayUnit ?? r.unit}</span></p>
        {r.interpretation && <p className="result-interp">{r.interpretation}</p>}
      </div>
      {r.extras.length > 0 && (
        <dl className="kv">{r.extras.map((e) => <div key={e.label}><dt>{e.label}</dt><dd>{e.value}</dd></div>)}</dl>
      )}
      {notes.filter((n) => n.severity !== 'info').map((n, k) => (
        <div key={k} className={`alert ${n.severity === 'critical' ? 'crit' : 'warn'}`} role={n.severity === 'critical' ? 'alert' : undefined}>
          <Icon name="alert" size={18} /><p><strong>{n.severity === 'critical' ? 'Critical: ' : 'Check: '}</strong>{n.text}</p>
        </div>
      ))}
      <div className="card work">
        <h2 className="h3">How this was calculated</h2>
        <p className="label">Formula</p>
        <p className="mono formula">{r.formula}</p>
        <p className="label">Substitution</p>
        <p className="mono">{r.substitution}</p>
        <p className="label">Steps</p>
        <ol className="steps">{r.steps.map((st, k) => <li key={k} className="mono">{st}</li>)}</ol>
        <p className="label">Rounding</p>
        <p>{r.rounding}</p>
      </div>
      <div className="card">
        <h2 className="h3">Inputs used</h2>
        <dl className="kv plain">{summary.map((x) => <div key={x.label}><dt>{x.label}</dt><dd>{x.value}</dd></div>)}</dl>
        <p className="status"><Icon name="check" size={16} /> All required inputs passed validation{warnCount ? ` · ${warnCount} item${warnCount > 1 ? 's' : ''} to check` : ''}.</p>
      </div>
      {notes.some((n) => n.severity === 'info') && (
        <div className="card">
          <h2 className="h3">Safety and context notes</h2>
          <ul className="bullets">{notes.filter((n) => n.severity === 'info').map((n, k) => <li key={k}>{n.text}</li>)}</ul>
        </div>
      )}
      <RefBlock def={def} />
      <div className="row-actions">
        <button className="btn ghost" onClick={onEdit}>Edit inputs</button>
        <button className="btn ghost" onClick={onPractice}><Icon name="cap" size={18} /> Practice this</button>
        <FavButton id={def.id} />
      </div>
      <p className="fineprint">This result is arithmetic only. It is not a judgement that the dose, rate or score is appropriate for a patient.</p>
    </section>
  );
}

export function ReviewChip({ status }: { status: 'awaiting-review' | 'reviewed' }) {
  return status === 'reviewed' ? <span className="chip ok">Clinically reviewed</span> : <span className="chip warn">Awaiting clinical review</span>;
}

const rank = (s: string) => (s === 'critical' ? 0 : s === 'warning' ? 1 : 2);

function RefBlock({ def }: { def: CalcDef }) {
  const nav = useNav();
  const refs = def.refs.map(refById).filter(Boolean);
  if (!refs.length) return null;
  return (
    <div className="card refblock">
      <h2 className="h3">Reference</h2>
      {refs.map((ref) => ref && (
        <button key={ref.id} className="reflink" onClick={() => nav.push({ type: 'formula', id: ref.id })}>
          <span>
            <span className="reflink-name">{ref.name}</span>
            <span className="reflink-src">{ref.source}</span>
          </span>
          <ReviewChip status={ref.status} />
        </button>
      ))}
    </div>
  );
}
