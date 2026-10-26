import { createContext, useContext } from 'react';
import type { AppStore } from '../storage/store';

export type Tab = 'home' | 'calcs' | 'learn' | 'favs' | 'settings';

export type Route =
  | { type: 'calc'; id: string }
  | { type: 'category'; id: string }
  | { type: 'quiz'; mode: 'topic' | 'daily' | 'mock' | 'missed'; topic?: string; level?: string }
  | { type: 'library' }
  | { type: 'formula'; id: string }
  | { type: 'glossary' }
  | { type: 'customize' }
  | { type: 'about' };

export interface Nav {
  tab: Tab;
  stack: Route[];
  push: (r: Route) => void;
  back: () => void;
  go: (t: Tab) => void;
}

export const NavCtx = createContext<Nav | null>(null);
export const StoreCtx = createContext<AppStore | null>(null);

export function useNav(): Nav {
  const n = useContext(NavCtx);
  if (!n) throw new Error('NavCtx missing');
  return n;
}
export function useStore(): AppStore {
  const s = useContext(StoreCtx);
  if (!s) throw new Error('StoreCtx missing');
  return s;
}
