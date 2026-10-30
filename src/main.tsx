import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { isNative } from './native';
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
  // `window.Capacitor` exists in ordinary browsers too (the web build bundles @capacitor/core),
  // so ask Capacitor whether this is really the native shell.
  const nativeShell = isNative();
  if (!nativeShell && 'serviceWorker' in navigator && window.isSecureContext && !location.hostname.endsWith('claude.ai') && !location.hostname.includes('claudeusercontent')) {
    navigator.serviceWorker.register('sw.js').catch(() => undefined);
  }
} catch {
  /* ignore */
}
