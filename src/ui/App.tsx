import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../storage/store';
import { Icon } from './icons';
import { NavCtx, StoreCtx, type Nav, type Route, type Tab } from './nav';
import { CalculatorScreen } from './screens/Calculator';
import { About, CategoryScreen, CustomizeQuick, Directory, Favorites, Home, SettingsScreen } from './screens/Main';
import { FormulaScreen, GlossaryScreen, LearnHome, LibraryScreen, QuizScreen } from './screens/Learn';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'calcs', label: 'Calculators', icon: 'grid' },
  { id: 'learn', label: 'Learn', icon: 'cap' },
  { id: 'favs', label: 'Favorites', icon: 'star' },
  { id: 'settings', label: 'Settings', icon: 'gear' },
];

function routeKey(r: Route): string {
  return JSON.stringify(r);
}

function RouteView({ r }: { r: Route }) {
  switch (r.type) {
    case 'calc': return <CalculatorScreen id={r.id} />;
    case 'category': return <CategoryScreen id={r.id} />;
    case 'quiz': return <QuizScreen mode={r.mode} topic={r.topic} level={r.level} />;
    case 'library': return <LibraryScreen />;
    case 'formula': return <FormulaScreen id={r.id} />;
    case 'glossary': return <GlossaryScreen />;
    case 'customize': return <CustomizeQuick />;
    case 'about': return <About />;
  }
}

function TabRoot({ tab }: { tab: Tab }) {
  switch (tab) {
    case 'home': return <Home />;
    case 'calcs': return <Directory />;
    case 'learn': return <LearnHome />;
    case 'favs': return <Favorites />;
    case 'settings': return <SettingsScreen />;
  }
}

export function App() {
  const store = useAppStore();
  const [tab, setTab] = useState<Tab>('home');
  const [stacks, setStacks] = useState<Record<Tab, Route[]>>({ home: [], calcs: [], learn: [], favs: [], settings: [] });
  const scrollRef = useRef<HTMLDivElement>(null);
  const stack = stacks[tab];

  const popStack = useCallback(() => setStacks((s) => ({ ...s, [tab]: s[tab].slice(0, -1) })), [tab]);
  // Each pushed screen adds a history entry, so the Android system back button and
  // browser back gesture close the current screen instead of leaving the app.
  const push = useCallback((r: Route) => {
    setStacks((s) => ({ ...s, [tab]: [...s[tab], r] }));
    try { history.pushState({ nc: true }, ''); } catch { /* history unavailable */ }
  }, [tab]);
  const back = useCallback(() => {
    try {
      if (history.state && (history.state as { nc?: boolean }).nc) { history.back(); return; }
    } catch { /* fall through */ }
    popStack();
  }, [popStack]);
  const stackLen = stacks[tab].length;
  useEffect(() => {
    const onPop = () => { if (stackLen > 0) popStack(); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [stackLen, popStack]);
  const go = useCallback((t: Tab) => {
    setStacks((s) => (t === tab ? { ...s, [t]: [] } : s)); // re-tapping a tab returns to its root
    setTab(t);
  }, [tab]);
  const nav: Nav = useMemo(() => ({ tab, stack, push, back, go }), [tab, stack, push, back, go]);

  // Theme, text scale and motion preferences
  const { theme, textScale, reduceMotion } = store.settings;
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', theme);
    root.style.setProperty('--scale', String(textScale));
    root.toggleAttribute('data-reduce-motion', reduceMotion);
  }, [theme, textScale, reduceMotion]);

  // Scroll to top and move focus to the new screen's heading on navigation
  const top = stack[stack.length - 1];
  useEffect(() => {
    window.scrollTo(0, 0);
    const h = document.querySelector<HTMLElement>('.topbar h1');
    h?.setAttribute('tabindex', '-1');
    h?.focus({ preventScroll: true });
  }, [tab, top ? routeKey(top) : '', stack.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Android/browser back button support within the app
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && stack.length) back(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stack.length, back]);

  return (
    <StoreCtx.Provider value={store}>
      <NavCtx.Provider value={nav}>
        <a className="skip" href="#screen">Skip to content</a>
        <div className="app" ref={scrollRef}>
          <div id="screen" tabIndex={-1} className="screen" key={`${tab}-${stack.length}`}>
            {top ? <RouteView r={top} /> : <TabRoot tab={tab} />}
          </div>
        </div>
        <nav className="tabbar" aria-label="Main">
          {TABS.map((t) => (
            <button key={t.id} className={`tab ${tab === t.id ? 'on' : ''}`} aria-current={tab === t.id ? 'page' : undefined} onClick={() => go(t.id)}>
              <Icon name={t.icon} size={22} filled={t.id === 'favs' && tab === 'favs'} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      </NavCtx.Provider>
    </StoreCtx.Provider>
  );
}
