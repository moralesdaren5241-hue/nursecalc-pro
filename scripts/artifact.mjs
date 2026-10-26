// Turns dist/index.html into a body-only page for hosting as a claude.ai artifact
// (the host supplies <html>/<head>/<body>). The normal dist/ build is unchanged.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const html = readFileSync('dist/index.html', 'utf8');
const styles = [...html.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map((m) => m[0]).join('\n');
const scripts = [...html.matchAll(/<script[^>]*>[\s\S]*?<\/script>/g)].map((m) => m[0]).join('\n');
const fonts = (html.match(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/) || [''])[0];
const out = `<title>NurseCalc Pro</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="Nursing calculations, scoring tools and practice — offline.">
${fonts}
${styles}
<div id="root"></div>
${scripts}
`;
mkdirSync('artifact', { recursive: true });
writeFileSync('artifact/nursecalc-pro.html', out);
console.log('artifact/nursecalc-pro.html', out.length, 'bytes; styles', styles.length, 'scripts', scripts.length);
