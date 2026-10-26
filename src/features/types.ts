import type { CalcResult } from '../calculations/core';
import type { ScoreItem } from '../calculations/scores';
import { parseNumber } from '../calculations/core';
import { convert } from '../calculations/units';

export type CategoryId = 'med' | 'iv' | 'body' | 'neuro' | 'fluid' | 'vitals' | 'peds' | 'o2' | 'nutrition' | 'lab' | 'blood' | 'ob' | 'emergency' | 'wound' | 'convert' | 'practice';

export interface Category {
  id: CategoryId;
  letter: string;
  name: string;
  icon: string;
}

/** Optional visibility rule: hidden fields are not rendered, validated or passed to the engine. */
export type FieldBase = { showIf?: (raw: Record<string, string>) => boolean };

export type Field = FieldBase & (
  | { kind: 'number'; key: string; label: string; units?: string[]; unitText?: string; optional?: boolean; help?: string; step?: string }
  | { kind: 'select'; key: string; label: string; options: { value: string; label: string }[]; help?: string }
  | { kind: 'toggle'; key: string; label: string; help?: string }
  | { kind: 'time'; key: string; label: string; help?: string }
  | { kind: 'date'; key: string; label: string; help?: string }
  | { kind: 'text'; key: string; label: string; placeholder?: string; help?: string }
  | { kind: 'choice'; key: string; item: ScoreItem });

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  textScale: number;
  weightUnit: 'kg' | 'lb';
  pumpDp: 0 | 1 | 2;
  streaks: boolean;
  name: string;
  reduceMotion: boolean;
}

export interface CalcDef {
  id: string;
  name: string;
  category: CategoryId;
  description: string;
  tags: string[];
  fields?: Field[];
  run?: (v: FormValues, s: Settings) => CalcResult;
  /** Non-form screens */
  screen?: 'fluid' | 'converter' | 'practice' | 'info' | 'sequential';
  info?: { heading: string; lines: string[] }[];
  highAlert?: string; // confirmation text
  refs: string[];
  topic?: string; // practice topic
  example?: Record<string, string>;
  defaults?: Record<string, string>;
}

/** Raw form state → typed accessors. Empty numeric fields become NaN so validation catches them. */
export class FormValues {
  constructor(private raw: Record<string, string>) {}
  str(key: string): string {
    return this.raw[key] ?? '';
  }
  bool(key: string): boolean {
    return this.raw[key] === 'true';
  }
  unitOf(key: string): string {
    return this.raw[`${key}@`] ?? '';
  }
  has(key: string): boolean {
    return (this.raw[key] ?? '').trim() !== '';
  }
  /** Number in the entered unit (NaN when blank or not a valid number — never guessed). */
  num(key: string): number {
    const p = parseNumber(this.raw[key] ?? '');
    return p.ok ? p.value : NaN;
  }
  /** Why a non-blank entry could not be read, or null. */
  numError(key: string): string | null {
    if (!this.has(key)) return null;
    const p = parseNumber(this.raw[key] ?? '');
    return p.ok ? null : p.message;
  }
  /** Number converted to `to`. Throws UnitError on incompatible units. */
  n(key: string, to: string): number {
    const v = this.num(key);
    const u = this.unitOf(key) || to;
    return Number.isNaN(v) ? NaN : convert(v, u, to);
  }
  /** Optional number: undefined when blank. */
  opt(key: string, to?: string): number | undefined {
    if (!this.has(key)) return undefined;
    return to ? this.n(key, to) : this.num(key);
  }
  choice(key: string): number | 'NT' | undefined {
    const s = this.raw[key];
    if (s === undefined || s === '') return undefined;
    return s === 'NT' ? 'NT' : Number(s);
  }
}
