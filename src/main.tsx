import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline support when self-hosted: cache the single-file app with a service worker.
// Fails silently where service workers are unavailable (e.g. inside a preview frame).
try {
  // Inside the native Android/iOS shell the files are already local, so no service worker is needed.
  const nativeShell = 'Capacitor' in window;
  if (!nativeShell && 'serviceWorker' in navigator && window.isSecureContext && !location.hostname.endsWith('claude.ai') && !location.hostname.includes('claudeusercontent')) {
    navigator.serviceWorker.register('sw.js').catch(() => undefined);
  }
} catch {
  /* ignore */
}
