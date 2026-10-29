import { useState } from 'react';
import { ALIASES, CALCULATORS, CATEGORIES, DEFAULT_QUICK, LISTED, calcById, searchCalculators } from '../../features/registry';
import { refById } from '../../references/manifest';
import { TOPICS } from '../../learning/questions';
import { clearAll } from '../../storage/store';
import { Icon } from '../icons';
import { CalcRow, Disclaimer, Empty, Header, SHORT, Tile } from '../components/common';
import { useNav, useStore } from '../nav';
import { DailyCard } from './Learn';

export const VERSION = '1.2.0';
export const PRIVACY_URL = 'https://github.com/moralesdaren5241-hue/nursecalc-pro/blob/main/PRIVACY.md';

function greeting(name: string) {
  const h = new Date().getHours();
  const part = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return name.trim() ? `${part}, ${name.trim()}` : part;
}

function SearchField({ q, setQ, id }: { q: string; setQ: (s: string) => void; id: string }) {
  return (
    <div className="searchbox lg">
      <Icon name="search" size={20} />
      <label htmlFor={id} className="sr-only">Search calculators</label>
      <input id={id} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: gtt/min, GCS, mg/kg, I&O…" autoComplete="off" />
      {q && <button className="iconbtn sm" aria-label="Clear search" onClick={() => setQ('')}><Icon name="x" size={16} /></button>}
    </div>
  );
}

function SearchResults({ q }: { q: string }) {
  const res = searchCalculators(q);
  if (!res.length) return <Empty icon="search" title={`No calculator matches “${q}”`} text="Try an abbreviation (MAP, BMI, GCS) or a unit (mL/hr, gtt/min, mg/kg)." />;
  return <ul className="list-card" aria-label={`${res.length} results`}>{res.map((c) => <CalcRow key={c.id} id={c.id} showCat />)}</ul>;
}

export function Home() {
  const s = useStore();
  const nav = useNav();
  const [q, setQ] = useState('');
  const p = s.progress;
  const lastTopic = TOPICS.find((t) => t.id === p.lastTopic);
  return (
    <>
      <Header title="NurseCalc Pro" back={false} />
      <main className="pad stack">
        <section className="hello">
          <p className="hello-greet">{greeting(s.settings.name)}</p>
          <p className="muted">What do you need to calculate?</p>
        </section>
        <SearchField q={q} setQ={setQ} id="home-search" />
        {q ? <SearchResults q={q} /> : (
          <>
            <section className="stack-sm">
              <div className="section-head"><h2 className="h2">Quick access</h2><button className="linkbtn" onClick={() => nav.push({ type: 'customize' })}>Customize</button></div>
              <div className="tiles">{s.quick.map((id) => <Tile key={id} id={id} />)}</div>
            </section>

            {s.recents.length > 0 && (
              <section className="stack-sm">
                <div className="section-head"><h2 className="h2">Recently used</h2></div>
                <div className="chips scroll">{s.recents.map((id) => { const c = calcById(id); return c ? <button key={id} className="chipbtn" onClick={() => nav.push({ type: 'calc', id })}>{SHORT[id] ?? c.name}</button> : null; })}</div>
              </section>
            )}

            {s.favorites.length > 0 && (
              <section className="stack-sm">
                <div className="section-head"><h2 className="h2">Favorites</h2><button className="linkbtn" onClick={() => nav.go('favs')}>See all</button></div>
                <ul className="list-card">{s.favorites.slice(0, 4).map((id) => <CalcRow key={id} id={id} />)}</ul>
              </section>
            )}

            <DailyCard />

            <section className="card progress-card">
              <div>
                <p className="eyebrow">Study progress</p>
                <p className="big-stat num">{p.answered ? Math.round((p.correct / p.answered) * 100) : 0}<small>%</small></p>
                <p className="muted">{p.answered} questions answered{s.settings.streaks && p.streak ? ` · ${p.streak}-day streak` : ''}</p>
              </div>
              <button className="btn ghost" onClick={() => (lastTopic ? nav.push({ type: 'quiz', mode: 'topic', topic: lastTopic.id }) : nav.go('learn'))}>
                {lastTopic ? `Continue: ${lastTopic.name}` : 'Start learning'}
              </button>
            </section>

            {s.refsViewed.length > 0 && (
              <section className="stack-sm">
                <h2 className="h2">Recently viewed references</h2>
                <ul className="list-card">{s.refsViewed.slice(0, 3).map((id) => { const r = refById(id); return r ? <li key={id}><button className="listbtn" onClick={() => nav.push({ type: 'formula', id })}><Icon name="book" /><span><strong>{r.name}</strong><span className="mono small">{r.expression}</span></span><Icon name="chev" /></button></li> : null; })}</ul>
              </section>
            )}

            <section className="stack-sm">
              <div className="section-head"><h2 className="h2">Categories</h2><button className="linkbtn" onClick={() => nav.go('calcs')}>All calculators</button></div>
              <CategoryGrid />
            </section>
            <Disclaimer />
          </>
        )}
      </main>
    </>
  );
}

function CategoryGrid() {
  const nav = useNav();
  return (
    <ul className="cat-grid">
      {CATEGORIES.map((c) => {
        const n = CALCULATORS.filter((x) => x.category === c.id).length;
        return (
          <li key={c.id}>
            <button className="cat-card" onClick={() => nav.push({ type: 'category', id: c.id })}>
              <span className={`cat-ico cat-${c.id}`} aria-hidden="true"><Icon name={c.icon} size={20} /></span>
              <span className="cat-name"><span className="cat-letter">{c.letter}</span>{c.name}</span>
              <span className="cat-count">{n} {n === 1 ? 'tool' : 'tools'}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function Directory() {
  const [q, setQ] = useState('');
  return (
    <>
      <Header title="Calculators" sub={`${LISTED().length} tools in ${CATEGORIES.length} categories`} back={false} />
      <main className="pad stack">
        <SearchField q={q} setQ={setQ} id="dir-search" />
        {q ? <SearchResults q={q} /> : CATEGORIES.map((c) => (
          <section key={c.id} className="stack-sm">
            <h2 className="h2 cat-head"><span className="cat-letter">{c.letter}</span>{c.name}</h2>
            <ul className="list-card">{CALCULATORS.filter((x) => x.category === c.id).map((x) => <CalcRow key={x.id} id={x.id} />)}</ul>
          </section>
        ))}
      </main>
    </>
  );
}

export function CategoryScreen({ id }: { id: string }) {
  const c = CATEGORIES.find((x) => x.id === id);
  if (!c) return null;
  return (
    <>
      <Header title={c.name} sub={`Category ${c.letter}`} />
      <main className="pad stack">
        <ul className="list-card">{CALCULATORS.filter((x) => x.category === c.id).map((x) => <CalcRow key={x.id} id={x.id} />)}</ul>
      </main>
    </>
  );
}

export function Favorites() {
  const s = useStore();
  const nav = useNav();
  return (
    <>
      <Header title="Favorites" back={false} right={<button className="linkbtn" onClick={() => nav.push({ type: 'customize' })}>Quick access</button>} />
      <main className="pad stack">
        {s.favorites.length === 0 ? (
          <Empty icon="star" title="No favorites yet" text="Tap the star on any calculator to keep it here." action={<button className="btn primary" onClick={() => nav.go('calcs')}>Browse calculators</button>} />
        ) : <ul className="list-card">{s.favorites.map((id) => <CalcRow key={id} id={id} showCat />)}</ul>}
        <section className="stack-sm">
          <div className="section-head"><h2 className="h2">Recent history</h2>{s.recents.length > 0 && <button className="linkbtn" onClick={s.clearHistory}>Clear history</button>}</div>
          {s.recents.length === 0 ? <p className="muted">Calculators you open appear here. Only the calculator name is kept — never your inputs.</p> : <ul className="list-card">{s.recents.map((id) => <CalcRow key={id} id={id} showCat />)}</ul>}
        </section>
      </main>
    </>
  );
}

export function CustomizeQuick() {
  const s = useStore();
  const q = s.quick;
  const move = (k: number, d: number) => {
    const n = [...q];
    const j = k + d;
    if (j < 0 || j >= n.length) return;
    [n[k], n[j]] = [n[j] as string, n[k] as string];
    s.setQuick(n);
  };
  const available = CALCULATORS.filter((c) => !q.includes(c.id) && !ALIASES[c.id]);
  return (
    <>
      <Header title="Quick access" sub="Choose and order home-screen tiles" />
      <main className="pad stack">
        <ul className="list-card">
          {q.map((id, k) => {
            const c = calcById(id);
            return c ? (
              <li key={id} className="reorder">
                <span className="reorder-name">{SHORT[id] ?? c.name}</span>
                <button className="iconbtn sm" aria-label={`Move ${c.name} up`} onClick={() => move(k, -1)} disabled={k === 0}><Icon name="up" size={18} /></button>
                <button className="iconbtn sm" aria-label={`Move ${c.name} down`} onClick={() => move(k, 1)} disabled={k === q.length - 1}><Icon name="down" size={18} /></button>
                <button className="iconbtn sm" aria-label={`Remove ${c.name}`} onClick={() => s.setQuick(q.filter((x) => x !== id))}><Icon name="x" size={18} /></button>
              </li>
            ) : null;
          })}
        </ul>
        <div className="field">
          <label htmlFor="add-quick">Add a tile</label>
          <select id="add-quick" value="" onChange={(e) => e.target.value && s.setQuick([...q, e.target.value])}>
            <option value="">Choose a calculator…</option>
            {available.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <button className="btn ghost" onClick={() => s.setQuick(DEFAULT_QUICK)}>Restore defaults</button>
      </main>
    </>
  );
}

export function SettingsScreen() {
  const s = useStore();
  const nav = useNav();
  const st = s.settings;
  const set = <K extends keyof typeof st>(k: K, v: (typeof st)[K]) => s.setSettings({ ...st, [k]: v });
  const [confirmClear, setConfirmClear] = useState(false);
  return (
    <>
      <Header title="Settings" back={false} />
      <main className="pad stack">
        <section className="card form">
          <h2 className="h3">Personal</h2>
          <div className="field">
            <label htmlFor="set-name">Name for greeting (optional)</label>
            <input id="set-name" value={st.name} maxLength={30} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Ana" autoComplete="off" />
            <p className="help">Stored only on this device. Never enter patient details.</p>
          </div>
        </section>
        <section className="card form">
          <h2 className="h3">Display</h2>
          <div className="field">
            <span className="field-label" id="theme-l">Theme</span>
            <div className="seg" role="radiogroup" aria-labelledby="theme-l">
              {(['system', 'light', 'dark'] as const).map((t) => <button key={t} role="radio" aria-checked={st.theme === t} className={st.theme === t ? 'on' : ''} onClick={() => set('theme', t)}>{t[0]!.toUpperCase() + t.slice(1)}</button>)}
            </div>
          </div>
          <div className="field">
            <label htmlFor="set-text">Text size: {Math.round(st.textScale * 100)}%</label>
            <input id="set-text" type="range" min={0.9} max={1.4} step={0.05} value={st.textScale} onChange={(e) => set('textScale', Number(e.target.value))} />
          </div>
          <label className="toggle" htmlFor="set-motion"><input type="checkbox" id="set-motion" role="switch" checked={st.reduceMotion} onChange={(e) => set('reduceMotion', e.target.checked)} /><span className="switch" aria-hidden="true" /><span>Reduce motion</span></label>
        </section>
        <section className="card form">
          <h2 className="h3">Units and precision</h2>
          <div className="field">
            <label htmlFor="set-w">Default weight unit</label>
            <select id="set-w" value={st.weightUnit} onChange={(e) => set('weightUnit', e.target.value as 'kg' | 'lb')}><option value="kg">kg</option><option value="lb">lb</option></select>
            <p className="help">Pediatric and high-alert tools always require kg.</p>
          </div>
          <div className="field">
            <label htmlFor="set-dp">Infusion pump precision</label>
            <select id="set-dp" value={st.pumpDp} onChange={(e) => set('pumpDp', Number(e.target.value) as 0 | 1 | 2)}><option value={0}>Whole mL/hr</option><option value={1}>0.1 mL/hr</option><option value={2}>0.01 mL/hr</option></select>
            <p className="help">Match the increments your pump accepts. Only the final pump setting is rounded.</p>
          </div>
        </section>
        <section className="card form">
          <h2 className="h3">Learning</h2>
          <label className="toggle" htmlFor="set-streak"><input type="checkbox" id="set-streak" role="switch" checked={st.streaks} onChange={(e) => set('streaks', e.target.checked)} /><span className="switch" aria-hidden="true" /><span>Show study streaks</span></label>
          <button className="btn ghost" onClick={s.resetProgress}>Reset study progress</button>
        </section>
        <section className="card form">
          <h2 className="h3">Privacy and data</h2>
          <p>NurseCalc Pro has no account, no analytics and no network calls. Calculator inputs are never saved or sent anywhere. On this device it keeps only your settings, favorites, recent calculator names and study progress.</p>
          {!confirmClear ? <button className="btn danger" onClick={() => setConfirmClear(true)}>Delete all local data</button> : (
            <div className="alert warn"><Icon name="alert" size={18} /><div><p>This removes settings, favorites, history and progress from this device.</p><div className="form-actions"><button className="btn danger" onClick={() => { clearAll(); location.reload(); }}>Delete</button><button className="btn ghost" onClick={() => setConfirmClear(false)}>Cancel</button></div></div></div>
          )}
        </section>
        <button className="listbtn card" onClick={() => nav.push({ type: 'about' })}><Icon name="info" /><span><strong>About, disclaimer and version</strong><span className="muted">Version {VERSION}</span></span><Icon name="chev" /></button>
      </main>
    </>
  );
}

export function About() {
  return (
    <>
      <Header title="About NurseCalc Pro" sub={`Version ${VERSION}`} />
      <main className="pad stack">
        <Disclaimer />
        <section className="card">
          <h2 className="h3">What this app is</h2>
          <p>A calculation and learning aid for nursing students and nurses. Every result shows its formula, substitution and steps so you can check the working.</p>
          <h2 className="h3">What it is not</h2>
          <ul className="bullets">
            <li>Not a prescribing tool: it never recommends a drug, dose, fluid, electrolyte replacement or transfusion.</li>
            <li>Not a drug reference: maximum doses and reconstitution instructions must come from verified labeling.</li>
            <li>Not a diagnostic tool: scores and numbers never diagnose a condition on their own.</li>
          </ul>
          <h2 className="h3">Clinical content status</h2>
          <p>Formulas are implemented from standard literature and covered by automated arithmetic tests. Every clinical reference is marked “awaiting clinical review” until a qualified reviewer signs it off.</p>
        </section>
        <section className="card" aria-labelledby="privacy-h">
          <h2 className="h3" id="privacy-h">Privacy policy</h2>
          <p>NurseCalc Pro does not collect, transmit or share any personal or health data. It has no account, no analytics, no advertising and no third-party SDKs, and the Android app does not request internet access. Calculator inputs and results stay in memory and are discarded when you leave the screen.</p>
          <p>Only your settings (theme, text size, units, optional greeting name), favorites, recently opened calculator names, formula bookmarks and study progress are stored, on this device only. Delete them at any time in Settings → Privacy and data, or by uninstalling the app.</p>
          <p><a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">Read the full privacy policy</a></p>
        </section>
      </main>
    </>
  );
}
