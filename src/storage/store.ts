// Local, on-device persistence for preferences and learning progress only.
// Calculator inputs, fluid logs and results are never persisted.
import { useCallback, useEffect, useState } from 'react';
import type { Settings } from '../features/types';
import { DEFAULT_QUICK } from '../features/registry';

const PREFIX = 'nursecalc.v1.';

function read<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(PREFIX + key);
    return s ? { ...(fallback as object), ...JSON.parse(s) } as T : fallback;
  } catch {
    return fallback;
  }
}
function readArr<T>(key: string, fallback: T[]): T[] {
  try {
    const s = localStorage.getItem(PREFIX + key);
    const v = s ? JSON.parse(s) : null;
    return Array.isArray(v) ? v : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, v: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(v));
  } catch {
    /* storage unavailable — app keeps working in memory */
  }
}

export function clearAll() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

export const DEFAULT_SETTINGS: Settings = { theme: 'system', textScale: 1, weightUnit: 'kg', pumpDp: 1, streaks: true, name: '', reduceMotion: false };

export interface Progress {
  answered: number;
  correct: number;
  byTopic: Record<string, { a: number; c: number }>;
  missed: { topic: string; seed: number; level?: string }[];
  lastDay: string;
  streak: number;
  lastTopic: string;
  dailyDone: string;
}
export const EMPTY_PROGRESS: Progress = { answered: 0, correct: 0, byTopic: {}, missed: [], lastDay: '', streak: 0, lastTopic: '', dailyDone: '' };

function usePersisted<T>(key: string, init: () => T): [T, (f: T | ((p: T) => T)) => void] {
  const [v, setV] = useState<T>(init);
  useEffect(() => write(key, v), [key, v]);
  return [v, setV];
}

const todayStr = () => new Date().toISOString().slice(0, 10);

export function useAppStore() {
  const [settings, setSettings] = usePersisted<Settings>('settings', () => read('settings', DEFAULT_SETTINGS));
  const [favorites, setFavorites] = usePersisted<string[]>('favorites', () => readArr('favorites', ['drug-dose', 'gcs']));
  const [recents, setRecents] = usePersisted<string[]>('recents', () => readArr('recents', []));
  const [quick, setQuick] = usePersisted<string[]>('quick', () => readArr('quick', DEFAULT_QUICK));
  const [bookmarks, setBookmarks] = usePersisted<string[]>('bookmarks', () => readArr('bookmarks', []));
  const [refsViewed, setRefsViewed] = usePersisted<string[]>('refsViewed', () => readArr('refsViewed', []));
  const [progress, setProgress] = usePersisted<Progress>('progress', () => read('progress', EMPTY_PROGRESS));

  const toggleFav = useCallback((id: string) => setFavorites((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id])), [setFavorites]);
  const touchRecent = useCallback((id: string) => setRecents((r) => [id, ...r.filter((x) => x !== id)].slice(0, 8)), [setRecents]);
  const toggleBookmark = useCallback((id: string) => setBookmarks((b) => (b.includes(id) ? b.filter((x) => x !== id) : [...b, id])), [setBookmarks]);
  const viewRef = useCallback((id: string) => setRefsViewed((r) => [id, ...r.filter((x) => x !== id)].slice(0, 6)), [setRefsViewed]);

  const recordAnswer = useCallback((topic: string, seed: number, correct: boolean, daily = false, level?: string) => {
    setProgress((p) => {
      const t = p.byTopic[topic] ?? { a: 0, c: 0 };
      const today = todayStr();
      const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
      const streak = p.lastDay === today ? p.streak : p.lastDay === yesterday ? p.streak + 1 : 1;
      const missed = correct ? p.missed.filter((m) => !(m.topic === topic && m.seed === seed)) : [{ topic, seed, level }, ...p.missed.filter((m) => !(m.topic === topic && m.seed === seed))].slice(0, 50);
      return { ...p, answered: p.answered + 1, correct: p.correct + (correct ? 1 : 0), byTopic: { ...p.byTopic, [topic]: { a: t.a + 1, c: t.c + (correct ? 1 : 0) } }, missed, lastDay: today, streak, lastTopic: topic, dailyDone: daily ? today : p.dailyDone };
    });
  }, [setProgress]);

  const clearHistory = useCallback(() => setRecents([]), [setRecents]);
  const resetProgress = useCallback(() => setProgress(EMPTY_PROGRESS), [setProgress]);

  return { settings, setSettings, favorites, toggleFav, recents, touchRecent, clearHistory, quick, setQuick, bookmarks, toggleBookmark, refsViewed, viewRef, progress, recordAnswer, resetProgress };
}

export type AppStore = ReturnType<typeof useAppStore>;
