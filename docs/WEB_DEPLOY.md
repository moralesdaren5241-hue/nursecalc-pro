# Web deployment

The web app is a static, single-file build (`npm run build` → `dist/`). It needs no server code,
database, environment variables or API endpoints, and works offline after the first visit
(service worker `public/sw.js`). Any HTTPS static host works.

**Status:** not deployed yet. The included GitHub Pages workflow failed because Pages is not
enabled on the repository (the workflow token is not allowed to enable it).

## Option A — GitHub Pages (workflow included)

1. GitHub → repository **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Merge the release branch to `main` (or run *Actions → Web app (iPhone & browser) → Run workflow*).
3. The workflow runs `npm ci`, `npm test`, `npm run build`, and deploys `dist/` to
   `https://moralesdaren5241-hue.github.io/nursecalc-pro/` (HTTPS is automatic).

Limitation: GitHub Pages cannot send custom headers, so the Content-Security-Policy and other
headers in `public/_headers` are **not** applied there.

## Option B — Netlify or Cloudflare Pages (security headers applied)

| Setting | Value |
|---|---|
| Build command | `npm ci && npm run build` |
| Output / publish directory | `dist` |
| Node version | 22 |
| Environment variables | none |

Both hosts read `dist/_headers` (copied from `public/_headers`): CSP `default-src 'self'`,
`frame-ancestors 'none'`, `nosniff`, `no-referrer`, a restrictive Permissions-Policy, and
`no-cache` for `index.html`, `sw.js` and the manifest so updates arrive promptly. Enable
"Force HTTPS" if the host offers it.

## Routing

The app has one HTML entry point and keeps navigation in memory/history state, so no SPA
rewrite rules are needed. All asset paths are relative, so it works at a domain root or in a
sub-path (as on GitHub Pages).

## Releasing an update

Bump the cache name in `public/sw.js` (e.g. `nursecalc-v1.2.1`) with each release so installed
copies pick up the new version.

## Install on a phone

Open the site → Android Chrome menu **Install app**, or iPhone Safari **Share → Add to Home Screen**.
