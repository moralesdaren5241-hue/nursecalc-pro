import { useEffect, useMemo, useState } from 'react';
import { dailySeed, generate, hasLevel, mockExam, TOPICS, type Level, type Question } from '../../learning/questions';
import { GLOSSARY, REFERENCES, refById } from '../../references/manifest';
import { calcById } from '../../features/registry';
import { Icon } from '../icons';
import { Empty, Header } from '../components/common';
import { useNav, useStore } from '../nav';

const pct = (c: number, a: number) => (a ? Math.round((c / a) * 100) : 0);
const today = () => new Date().toISOString().slice(0, 10);

export function LearnHome() {
  return (
    <>
      <Header title="Learn" sub="Nursing mathematics study centre" back={false} />
      <PracticeBody />
    </>
  );
}

export function PracticeHub() {
  return (
    <>
      <Header title="Practice & exams" sub="P. Practice and examinations" />
      <PracticeBody />
    </>
  );
}

function PracticeBody() {
  const nav = useNav();
  const s = useStore();
  const p = s.progress;
  const [level, setLevel] = useState<'' | Level>('');
  return (
    <main className="pad stack">
      <section className="card progress-card" aria-label="Study progress">
        <div>
          <p className="eyebrow">Progress</p>
          <p className="big-stat num">{pct(p.correct, p.answered)}<small>%</small></p>
          <p className="muted">{p.correct} of {p.answered} answered correctly</p>
        </div>
        {s.settings.streaks && <div className="streak"><span className="num">{p.streak}</span><span>day streak</span></div>}
      </section>

      <DailyCard />

      <section className="stack-sm">
        <div className="section-head">
          <h2 className="h2">Practice by topic</h2>
          <label className="sr-only" htmlFor="lv">Difficulty</label>
          <select id="lv" className="compact-select" value={level} onChange={(e) => setLevel(e.target.value as Level | '')}>
            <option value="">All levels</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
          </select>
        </div>
        <ul className="topic-grid">
          {TOPICS.map((t) => {
            const bt = p.byTopic[t.id];
            return (
              <li key={t.id}>
                <button className="topic" onClick={() => nav.push({ type: 'quiz', mode: 'topic', topic: t.id, level: level || undefined })}>
                  <span className="topic-name">{t.name}</span>
                  <span className="meter" aria-hidden="true"><span style={{ width: `${bt ? pct(bt.c, bt.a) : 0}%` }} /></span>
                  <span className="topic-meta">{bt ? `${pct(bt.c, bt.a)}% · ${bt.a} done` : 'Not started'}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="list-card">
        <button className="listbtn" onClick={() => nav.push({ type: 'quiz', mode: 'mock' })}><Icon name="clock" /><span><strong>Mock exam</strong><span className="muted">20 mixed questions, scored at the end</span></span><Icon name="chev" /></button>
        <button className="listbtn" onClick={() => nav.push({ type: 'quiz', mode: 'missed' })}><Icon name="alert" /><span><strong>Review missed questions</strong><span className="muted">{p.missed.length} waiting</span></span><Icon name="chev" /></button>
        <button className="listbtn" onClick={() => nav.push({ type: 'library' })}><Icon name="book" /><span><strong>Formula library</strong><span className="muted">{REFERENCES.length} formulas with worked examples</span></span><Icon name="chev" /></button>
        <button className="listbtn" onClick={() => nav.push({ type: 'glossary' })}><Icon name="search" /><span><strong>Glossary</strong><span className="muted">{GLOSSARY.length} terms</span></span><Icon name="chev" /></button>
      </section>

      {s.bookmarks.length > 0 && (
        <section className="stack-sm">
          <h2 className="h2">Bookmarked formulas</h2>
          <ul className="list-card">{s.bookmarks.map((id) => { const r = refById(id); return r ? <li key={id}><button className="listbtn" onClick={() => nav.push({ type: 'formula', id })}><Icon name="bookmark" /><span><strong>{r.name}</strong><span className="mono small">{r.expression}</span></span><Icon name="chev" /></button></li> : null; })}</ul>
        </section>
      )}
    </main>
  );
}

export function DailyCard() {
  const nav = useNav();
  const s = useStore();
  const seed = dailySeed();
  const topic = TOPICS[seed % TOPICS.length]!.id;
  const q = useMemo(() => generate(topic, seed), [topic, seed]);
  const done = s.progress.dailyDone === today();
  return (
    <section className="card daily">
      <p className="eyebrow">Daily question · {TOPICS.find((t) => t.id === topic)?.name}</p>
      <p className="daily-q">{q.prompt}</p>
      <button className="btn primary" onClick={() => nav.push({ type: 'quiz', mode: 'daily' })}>{done ? 'Review today’s answer' : 'Answer'}</button>
    </section>
  );
}

function buildQuestions(mode: string, topic: string | undefined, level: Level | undefined, missed: { topic: string; seed: number; level?: string }[]): Question[] {
  if (mode === 'daily') { const seed = dailySeed(); return [generate(TOPICS[seed % TOPICS.length]!.id, seed)]; }
  if (mode === 'mock') return mockExam(Date.now() % 1e9);
  if (mode === 'missed') return missed.slice(0, 10).map((m) => generate(m.topic, m.seed, m.level as Level | undefined));
  const base = Math.floor(Math.random() * 1e9);
  return Array.from({ length: 10 }, (_, k) => generate(topic ?? 'dosage', base + k * 101, level));
}

export function QuizScreen({ mode, topic, level }: { mode: 'topic' | 'daily' | 'mock' | 'missed'; topic?: string; level?: string }) {
  const s = useStore();
  const nav = useNav();
  const [qs] = useState(() => buildQuestions(mode, topic, level as Level | undefined, s.progress.missed));
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<(number | null)[]>(() => qs.map(() => null));
  const [finished, setFinished] = useState(false);
  const exam = mode === 'mock';
  const title = mode === 'daily' ? 'Daily question' : mode === 'mock' ? 'Mock exam' : mode === 'missed' ? 'Missed questions' : TOPICS.find((t) => t.id === topic)?.name ?? 'Practice';

  if (!qs.length) return <><Header title={title} /><main className="pad"><Empty icon="check" title="Nothing to review" text="Questions you answer incorrectly appear here so you can try them again." action={<button className="btn primary" onClick={() => nav.back()}>Back to Learn</button>} /></main></>;

  const seedOf = (q: Question) => Number(q.id.split('-')[1]);
  const choose = (k: number) => {
    if (picked[i] !== null) return;
    const q = qs[i]!;
    const next = [...picked]; next[i] = k; setPicked(next);
    // The daily question counts once per day; reopening it is review only.
    if (!(mode === 'daily' && s.progress.dailyDone === today())) s.recordAnswer(q.topic, seedOf(q), k === q.answer, mode === 'daily', mode === 'topic' ? level : undefined);
  };
  const score = picked.filter((p, k) => p === qs[k]!.answer).length;

  if (finished) {
    return (
      <>
        <Header title={title} />
        <main className="pad stack">
          <section className="card result-hero center">
            <p className="eyebrow">Score</p>
            <p className="result-value"><span className="num">{score}</span> <span className="result-unit">/ {qs.length}</span></p>
            <p className="result-interp">{pct(score, qs.length)}%</p>
          </section>
          {exam && qs.map((q, k) => (
            <section key={q.id} className={`card review ${picked[k] === q.answer ? 'ok' : 'bad'}`}>
              <p className="eyebrow">{k + 1}. {picked[k] === q.answer ? 'Correct' : 'Incorrect'}</p>
              <p>{q.prompt}</p>
              <p><strong>Answer:</strong> {q.choices[q.answer]}{picked[k] !== q.answer && picked[k] !== null && <span className="muted"> · you chose {q.choices[picked[k] as number]}</span>}</p>
              <ol className="steps">{q.explanation.map((e) => <li key={e} className="mono">{e}</li>)}</ol>
            </section>
          ))}
          <div className="form-actions"><button className="btn primary" onClick={() => nav.back()}>Done</button></div>
        </main>
      </>
    );
  }

  const q = qs[i]!;
  const sel = picked[i];
  const reveal = sel !== null && !exam;
  const calc = q.calcId ? calcById(q.calcId) : undefined;
  return (
    <>
      <Header title={title} sub={`Question ${i + 1} of ${qs.length} · ${q.level}`} />
      <main className="pad stack">
        {mode === 'topic' && level && topic && !hasLevel(topic, level as Level) && <div className="alert info"><Icon name="info" size={18} /><p>No {level} questions exist for this topic yet, so questions from all levels are shown.</p></div>}
        <div className="qprogress" aria-hidden="true"><span style={{ width: `${((i + (sel !== null ? 1 : 0)) / qs.length) * 100}%` }} /></div>
        <section className="card">
          <p className="qprompt">{q.prompt}</p>
          <div className="answers" role="radiogroup" aria-label="Answer choices">
            {q.choices.map((c, k) => {
              const state = reveal ? (k === q.answer ? 'right' : k === sel ? 'wrong' : '') : sel === k ? 'picked' : '';
              return (
                <button key={k} role="radio" aria-checked={sel === k} className={`answer ${state}`} onClick={() => choose(k)} disabled={sel !== null && !exam}>
                  <span className="answer-letter" aria-hidden="true">{'ABCD'[k]}</span>
                  <span className="num">{c}</span>
                  {state === 'right' && <span className="sr-only"> (correct answer)</span>}
                  {state === 'wrong' && <span className="sr-only"> (your answer, incorrect)</span>}
                  {state === 'right' && <Icon name="check" size={18} />}
                  {state === 'wrong' && <Icon name="x" size={18} />}
                </button>
              );
            })}
          </div>
        </section>
        {reveal && (
          <section className={`card feedback ${sel === q.answer ? 'ok' : 'bad'}`} aria-live="polite">
            <p className="feedback-title">{sel === q.answer ? 'Correct' : `Not quite — the answer is ${q.choices[q.answer]}`}</p>
            {sel !== q.answer && <p className="muted">Common causes: a missed unit conversion, an inverted ratio, or rounding too early. Compare your working with the steps below.</p>}
            <ol className="steps">{q.explanation.map((e) => <li key={e} className="mono">{e}</li>)}</ol>
            {q.safety && <p className="safety"><Icon name="alert" size={16} /> {q.safety}</p>}
            {calc && <button className="btn ghost" onClick={() => nav.push({ type: 'calc', id: calc.id })}>Open the {calc.name} calculator</button>}
          </section>
        )}
        <div className="form-actions">
          {i > 0 && exam && <button className="btn ghost" onClick={() => setI(i - 1)}>Previous</button>}
          {i < qs.length - 1 ? (
            <button className="btn primary" disabled={sel === null} onClick={() => setI(i + 1)}>Next question</button>
          ) : (
            <button className="btn primary" disabled={sel === null} onClick={() => (qs.length === 1 && !exam ? nav.back() : setFinished(true))}>{qs.length === 1 && !exam ? 'Done' : 'See results'}</button>
          )}
        </div>
        <p className="fineprint">Practice values are invented for education and are not real patients or real drug orders.</p>
      </main>
    </>
  );
}

export function LibraryScreen() {
  const nav = useNav();
  const [q, setQ] = useState('');
  const list = REFERENCES.filter((r) => (r.name + r.expression + r.topic + r.variables.join(' ')).toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <Header title="Formula library" sub={`${REFERENCES.length} formulas`} />
      <main className="pad stack">
        <div className="searchbox"><Icon name="search" size={18} /><input aria-label="Search formulas" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search formulas" /></div>
        {list.length === 0 ? <Empty icon="search" title="No formulas found" text="Try a shorter word such as “drip” or “MAP”." /> : (
          <ul className="list-card">{list.map((r) => <li key={r.id}><button className="listbtn" onClick={() => nav.push({ type: 'formula', id: r.id })}><span><strong>{r.name}</strong><span className="mono small">{r.expression}</span></span><Icon name="chev" /></button></li>)}</ul>
        )}
      </main>
    </>
  );
}

export function FormulaScreen({ id }: { id: string }) {
  const s = useStore();
  const nav = useNav();
  const r = refById(id);
  useEffect(() => { if (r) s.viewRef(r.id); }, [r?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!r) return <><Header title="Not found" /><p className="pad">Formula not found.</p></>;
  const on = s.bookmarks.includes(r.id);
  const topicName = TOPICS.find((t) => t.id === r.topic);
  return (
    <>
      <Header title={r.name} sub="Formula library" right={<button className={`iconbtn fav ${on ? 'on' : ''}`} aria-pressed={on} aria-label={on ? 'Remove bookmark' : 'Bookmark formula'} onClick={() => s.toggleBookmark(r.id)}><Icon name="bookmark" filled={on} /></button>} />
      <main className="pad stack">
        <section className="card">
          <p className="mono formula big">{r.expression}</p>
          <p className="label">Variables</p>
          <ul className="bullets">{r.variables.map((v) => <li key={v}>{v}</li>)}</ul>
          <p className="label">Units</p><p>{r.units}</p>
          <p className="label">Worked example</p><p className="mono">{r.example}</p>
        </section>
        <section className="card">
          <h2 className="h3">Common mistakes</h2>
          <ul className="bullets">{r.mistakes.map((m) => <li key={m}>{m}</li>)}</ul>
          <h2 className="h3">Limitations</h2>
          <p>{r.limitations}</p>
          <p className="label">Applicable population</p><p>{r.population}</p>
        </section>
        <section className="card">
          <h2 className="h3">Source and verification</h2>
          <p>{r.source}</p>
          <dl className="kv plain">
            <div><dt>Status</dt><dd>{r.status === 'reviewed' ? <span className="chip ok">Clinically reviewed</span> : <span className="chip warn">Awaiting clinical review</span>}</dd></div>
            <div><dt>Reviewer</dt><dd>{r.reviewer ?? 'Not yet assigned'}</dd></div>
            <div><dt>Last review</dt><dd>{r.lastReview ?? '—'}</dd></div>
          </dl>
          {r.crossCheck && <p className="fineprint"><strong>Engineering cross-check:</strong> {r.crossCheck} This is not a clinical review.</p>}
          {r.status !== 'reviewed' && <p className="fineprint">Citation recorded from the standard literature; not yet checked against the primary source by a clinical reviewer. Do not treat this entry as an authoritative reference.</p>}
        </section>
        {topicName && <button className="btn primary" onClick={() => nav.push({ type: 'quiz', mode: 'topic', topic: r.topic })}>Practice {topicName.name.toLowerCase()} questions</button>}
      </main>
    </>
  );
}

export function GlossaryScreen() {
  const [q, setQ] = useState('');
  const list = GLOSSARY.filter((g) => (g.term + g.def).toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.term.localeCompare(b.term));
  return (
    <>
      <Header title="Glossary" />
      <main className="pad stack">
        <div className="searchbox"><Icon name="search" size={18} /><input aria-label="Search glossary" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search terms" /></div>
        <dl className="glossary">{list.map((g) => <div key={g.term}><dt>{g.term}</dt><dd>{g.def}</dd></div>)}</dl>
        {list.length === 0 && <Empty icon="search" title="No matching terms" text="Try another spelling or abbreviation." />}
      </main>
    </>
  );
}
