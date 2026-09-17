// Stages the public site into a directory and fails if index.html references anything missing.
// Used by .github/workflows/deploy.yml: node tools/stage.mjs _site
import { cpSync, mkdirSync, rmSync, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findLeaks, contactEndpointProblem } from './stage-guard.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(process.argv[2] || '_site');
// CNAME is added only when PUBLISH_CNAME=1 (set it once chewi.ai's DNS points at GitHub Pages);
// with the file present, Pages serves the site only on the custom domain.
const PUBLIC = ['index.html', ...(process.env.PUBLISH_CNAME === '1' ? ['CNAME'] : []), 'css', 'fonts', 'assets', 'js/holo.js', 'js/fit.js', 'js/hero-mesh.js', 'js/bike.js', 'js/hand.js', 'js/scenes.js', 'js/colors.js', 'js/grasp-layout.js', 'js/contact.js'];
const EXCLUDE = ['assets/og.svg', 'assets/hero-fallback.svg'];

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'js'), { recursive: true });
for (const p of PUBLIC) cpSync(join(root, p), join(out, p), { recursive: true });
for (const p of EXCLUDE) rmSync(join(out, p), { force: true });

// Every local src/href in index.html must resolve inside the staged tree.
const html = readFileSync(join(out, 'index.html'), 'utf8');
const refs = [...html.matchAll(/(?:src|href|poster)="([^"#?]+)/g)].map((m) => m[1])
  .filter((u) => !/^(https?:|mailto:|data:|\/$)/.test(u));
const missing = refs.filter((u) => !existsSync(join(out, u)));
// Every relative import inside the staged modules must resolve too.
for (const f of readdirSync(join(out, 'js'))) {
  const src = readFileSync(join(out, 'js', f), 'utf8');
  for (const m of src.matchAll(/from\s+'\.\/([^']+)'/g)) if (!existsSync(join(out, 'js', m[1]))) missing.push('js/' + m[1] + ' (imported by js/' + f + ')');
}

const TEXT_EXT = new Set(['.html', '.css', '.js', '.json', '.svg', '.txt']);
const files = [];
const textFiles = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    const rel = p.slice(out.length + 1).replace(/\\/g, '/');
    files.push(rel);
    const dot = rel.lastIndexOf('.');
    const ext = dot >= 0 ? rel.slice(dot).toLowerCase() : '';
    if (TEXT_EXT.has(ext)) textFiles.push({ path: rel, text: readFileSync(p, 'utf8') });
  }
})(out);
console.log(files.sort().join('\n'));
console.log(`\n${files.length} files staged, ${refs.length} references checked`);

const leaks = findLeaks(textFiles);
if (leaks.length) { console.error('ADDRESS LEAK in staged site: ' + leaks.join(', ')); process.exit(1); }
const contactJs = existsSync(join(out, 'js/contact.js')) ? readFileSync(join(out, 'js/contact.js'), 'utf8') : '';
const endpointProblem = contactEndpointProblem(html, contactJs);
if (endpointProblem) { console.error(endpointProblem); process.exit(1); }
if (missing.length) { console.error('MISSING in staged site: ' + missing.join(', ')); process.exit(1); }
