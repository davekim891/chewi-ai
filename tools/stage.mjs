// Stages the public site into a directory and fails if index.html references anything missing.
// Used by .github/workflows/deploy.yml: node tools/stage.mjs _site
import { cpSync, mkdirSync, rmSync, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(process.argv[2] || '_site');
const PUBLIC = ['index.html', 'CNAME', 'css', 'fonts', 'assets', 'js/holo.js', 'js/hero-image.js', 'js/bike.js', 'js/manifest.js', 'js/hand.js', 'js/scenes.js', 'js/colors.js', 'js/grasp-layout.js'];
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

const files = [];
(function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : files.push(p.slice(out.length + 1).replace(/\\/g, '/')); } })(out);
console.log(files.sort().join('\n'));
console.log(`\n${files.length} files staged, ${refs.length} references checked`);
if (missing.length) { console.error('MISSING in staged site: ' + missing.join(', ')); process.exit(1); }
