// Thin bridge to the native Android shell (Capacitor). Every function is a no-op
// in a browser and in tests, so the web build and the native build share one code path.
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import type { Settings } from './features/types';

type Theme = Settings['theme'];

export const isNative = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

/** Keep status/navigation-bar icons readable against the app's chosen theme. */
export function syncSystemBars(theme: Theme): void {
  if (!isNative()) return;
  const style = theme === 'dark' ? SystemBarsStyle.Dark : theme === 'light' ? SystemBarsStyle.Light : SystemBarsStyle.Default;
  SystemBars.setStyle({ style }).catch(() => undefined);
}

/**
 * Android hardware/gesture back button. `handler` returns true when it handled the
 * press inside the app; otherwise the app exits (the platform's expected behaviour
 * at the root of the Home tab).
 * Returns a cleanup function.
 */
export function onAndroidBack(handler: () => boolean): () => void {
  if (!isNative()) return () => undefined;
  let removed = false;
  let remove: (() => void) | undefined;
  CapApp.addListener('backButton', () => {
    if (!handler()) CapApp.exitApp().catch(() => undefined);
  })
    .then((h) => {
      if (removed) h.remove().catch(() => undefined);
      else remove = () => { h.remove().catch(() => undefined); };
    })
    .catch(() => undefined);
  return () => {
    removed = true;
    remove?.();
  };
}
