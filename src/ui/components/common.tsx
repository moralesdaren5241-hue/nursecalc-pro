import type { ReactNode } from 'react';
import { Icon } from '../icons';
import { CATEGORIES, calcById } from '../../features/registry';
import type { CalcDef } from '../../features/types';
import { useNav, useStore } from '../nav';

export function Header({ title, sub, back = true, right }: { title: string; sub?: string; back?: boolean; right?: ReactNode }) {
  const nav = useNav();
  return (
    <header className="topbar">
      {back && nav.stack.length > 0 ? (
        <button className="iconbtn" onClick={nav.back} aria-label="Back"><Icon name="back" /></button>
      ) : <span className="brandmark" aria-hidden="true">N</span>}
      <div className="topbar-text">
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {right}
    </header>
  );
}

export function FavButton({ id }: { id: string }) {
  const s = useStore();
  const on = s.favorites.includes(id);
  return (
    <button className={`iconbtn fav ${on ? 'on' : ''}`} onClick={(e) => { e.stopPropagation(); s.toggleFav(id); }} aria-pressed={on} aria-label={on ? 'Remove from favorites' : 'Add to favorites'}>
      <Icon name="star" filled={on} />
    </button>
  );
}

export function catOf(c: CalcDef) {
  return CATEGORIES.find((x) => x.id === c.category);
}

export function CalcRow({ id, showCat = false }: { id: string; showCat?: boolean }) {
  const nav = useNav();
  const s = useStore();
  const c = calcById(id);
  if (!c) return null;
  const cat = catOf(c);
  const recent = s.recents.includes(c.id);
  return (
    <li className="calcrow">
      <button className="calcrow-main" onClick={() => nav.push({ type: 'calc', id })}>
        <span className={`cat-ico cat-${c.category}`} aria-hidden="true"><Icon name={cat?.icon ?? 'info'} size={20} /></span>
        <span className="calcrow-text">
          <span className="calcrow-name">{id !== c.id ? CALC_LABEL(id) : c.name}{c.highAlert && <span className="chip chip-crit">High-alert</span>}{recent && <span className="chip">Recent</span>}</span>
          <span className="calcrow-desc">{showCat && cat ? `${cat.name} · ` : ''}{c.description}</span>
          <span className="calcrow-tags">{c.tags.slice(0, 3).join(' · ')}</span>
        </span>
      </button>
      <FavButton id={c.id} />
    </li>
  );
}

const CALC_LABEL = (id: string) => ({ 'gcs-em': 'GCS (emergency)', 'shock-index-em': 'Shock index' } as Record<string, string>)[id] ?? id;

export function Tile({ id }: { id: string }) {
  const nav = useNav();
  const c = calcById(id);
  if (!c) return null;
  const cat = catOf(c);
  return (
    <button className="tile" onClick={() => nav.push({ type: 'calc', id: c.id })}>
      <span className={`cat-ico cat-${c.category}`} aria-hidden="true"><Icon name={cat?.icon ?? 'info'} size={20} /></span>
      <span className="tile-name">{SHORT[c.id] ?? c.name}</span>
    </button>
  );
}

export const SHORT: Record<string, string> = {
  'drug-dose': 'Drug dose', 'pump-rate': 'IV pump rate', 'drip-rate': 'Drip rate', 'bmi': 'BMI', 'gcs': 'GCS', 'fluid-balance': 'Fluid balance',
  'urine-output': 'Urine output', 'map': 'MAP', 'peds-dose': 'Pediatric dose', 'o2-cylinder': 'O₂ cylinder', 'weight-dose': 'Weight-based', 'apgar': 'APGAR',
  'rate-from-dose': 'Titration', 'maintenance-fluid': 'Maintenance', 'converter': 'Converter', 'heparin': 'Heparin', 'insulin': 'Insulin', 'edd': 'Due date',
};

export function Disclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <aside className={`disclaimer ${compact ? 'compact' : ''}`} role="note">
      <Icon name="info" size={18} />
      <p><strong>Educational and calculation aid.</strong> Results are arithmetic, not clinical approval. Verify every calculation against the prescription, product label, validated references and your facility’s protocols. Clinical content is awaiting independent clinical review.</p>
    </aside>
  );
}

export function Empty({ icon, title, text, action }: { icon: string; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <Icon name={icon} size={28} />
      <p className="empty-title">{title}</p>
      <p>{text}</p>
      {action}
    </div>
  );
}
