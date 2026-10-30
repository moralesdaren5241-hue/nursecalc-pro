import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Single-file build: the whole app ships as one HTML file, so once loaded it
// needs no network at all. A service worker (public/sw.js) caches it when the
// app is self-hosted, so it opens offline and installs to the home screen.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  // Inline the four font files so the single HTML file has zero network dependencies.
  build: {
    assetsInlineLimit: 200_000,
    modulePreload: { polyfill: false },
    // Explicit browser floor (the Vite 5 default). Vite 7's default would require
    // Chrome 107 / Safari 16 and drop older iPhones and Android WebViews.
    // Keep in sync with android.minWebViewVersion in capacitor.config.json.
    target: ['es2020', 'chrome87', 'edge88', 'firefox78', 'safari14'],
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/tests/**/*.test.{ts,tsx}'],
    // The UI suite renders every calculator in one test; it is slow but deterministic.
    testTimeout: 120_000,
  },
});
