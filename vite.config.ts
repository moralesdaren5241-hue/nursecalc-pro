import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Single-file build: the whole app ships as one HTML file, so once loaded it
// needs no network at all. A service worker (public/sw.js) caches it when the
// app is self-hosted, so it opens offline and installs to the home screen.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  // Inline the four font files so the single HTML file has zero network dependencies.
  build: { assetsInlineLimit: 200_000, modulePreload: { polyfill: false } },
  test: { globals: true, environment: 'node', include: ['src/tests/**/*.test.{ts,tsx}'] },
});
