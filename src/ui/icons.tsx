// Small stroke icon set (24×24, currentColor). Decorative unless labelled.
const P: Record<string, string> = {
  home: 'M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  cap: 'M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5M22 9v6',
  star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z',
  gear: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 010-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 014 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H21a2 2 0 010 4h-.1a1.6 1.6 0 00-1.5 1z',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-4.3-4.3',
  back: 'M15 18l-6-6 6-6',
  chev: 'M9 18l6-6-6-6',
  pill: 'M10.5 20.5a5 5 0 01-7-7l6-6a5 5 0 017 7zM8.5 8.5l7 7',
  drip: 'M8 2h8v8l-4 3-4-3zM12 13v4M12 19.5a1.5 1.5 0 100 .01M10 6h4',
  scale: 'M4 20h16M6 20l2-12h8l2 12M12 8V4M9 4h6',
  brain: 'M9 4a3 3 0 00-3 3 3 3 0 00-2 5 3 3 0 002 5 3 3 0 006 1V4zM15 4a3 3 0 013 3 3 3 0 012 5 3 3 0 01-2 5 3 3 0 01-6 1',
  drop: 'M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z',
  heart: 'M3 12h4l2-4 3 8 2-4h7M20.8 8.6A5 5 0 0012 5a5 5 0 00-8.8 3.6',
  baby: 'M12 4a4 4 0 100 8 4 4 0 000-8zM6 21v-3a6 6 0 0112 0v3M10 8h.01M14 8h.01',
  lungs: 'M12 4v8M12 12c-2 0-3-2-5-2-2 0-3 3-3 6 0 2 1 4 3 4s5-1 5-4zM12 12c2 0 3-2 5-2 2 0 3 3 3 6 0 2-1 4-3 4s-5-1-5-4z',
  apple: 'M12 7c-2-2-7-1-7 5 0 5 3 9 5 9 1 0 1.5-.5 2-.5s1 .5 2 .5c2 0 5-4 5-9 0-6-5-7-7-5zM12 7c0-2 1-4 3-4',
  flask: 'M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3M7 15h10',
  bag: 'M7 3h10v12a5 5 0 01-10 0zM12 20v2M10 8h4M10 11h4',
  mother: 'M12 3a3 3 0 100 6 3 3 0 000-6zM8 21l1-7a3 3 0 016 0l1 7M14 15a2 2 0 104 0 2 2 0 00-4 0',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  ruler: 'M3 17L17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2',
  swap: 'M4 7h14l-3-3M20 17H6l3 3',
  plus: 'M12 5v14M5 12h14',
  x: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12l5 5L20 7',
  alert: 'M12 3l10 18H2zM12 10v5M12 18h.01',
  info: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 11v6M12 7h.01',
  book: 'M4 4h6a3 3 0 013 3v13a2 2 0 00-2-2H4zM20 4h-6a3 3 0 00-3 3v13a2 2 0 012-2h7z',
  bookmark: 'M6 3h12v18l-6-4-6 4z',
  up: 'M12 19V5M5 12l7-7 7 7',
  down: 'M12 5v14M19 12l-7 7-7-7',
  trash: 'M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3',
  clock: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2',
};

export function Icon({ name, size = 22, label, filled = false }: { name: string; size?: number; label?: string; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} focusable="false">
      <path d={P[name] ?? P.info} />
    </svg>
  );
}
