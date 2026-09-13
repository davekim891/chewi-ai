// Renders the hero's static images from the same geometry and camera as js/hero.js, without a browser.
// Outputs: assets/hero-fallback.svg (no-WebGL fallback) and assets/og.svg (source for og.jpg).
// Run: node tools/render-static.mjs
import { writeFileSync } from 'node:fs';
import { buildFrame, buildCrank, buildPedal, buildGrid, PATCHES, COLORS, J, pedalOffsets } from '../js/bike.js';

// Same constants as hero.js
const ORBIT_PERIOD = 40, BOB_PERIOD = 13, AZ0 = 0.65, EL0 = 0.35, RADIUS = 2.6, FOV = 34;
const TARGET = [0.52, 0.42, 0];
const T = 12; // reveal complete, same frame as the verification probes

// ---- vector helpers ----
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const rotZ = (p, t) => [p[0] * Math.cos(t) - p[1] * Math.sin(t), p[0] * Math.sin(t) + p[1] * Math.cos(t), p[2]];
const rotX = (p, t) => [p[0], p[1] * Math.cos(t) - p[2] * Math.sin(t), p[1] * Math.sin(t) + p[2] * Math.cos(t)];
function rotToAxis(p, axis) { // rotate +z onto axis (unit), like Quaternion.setFromUnitVectors
  const z = [0, 0, 1], a = norm(axis), v = cross(z, a), c = dot(z, a);
  if (c < -0.9999) return [-p[0], p[1], -p[2]];
  const k = 1 / (1 + c);
  const vx = cross(v, p);
  return add(add(p, vx), [k * (v[1] * vx[2] - v[2] * vx[1]), k * (v[2] * vx[0] - v[0] * vx[2]), k * (v[0] * vx[1] - v[1] * vx[0])]);
}

function camera(W, H) {
  const az = AZ0 + (2 * Math.PI * T) / ORBIT_PERIOD;
  const el = EL0 + 0.08 * Math.sin((2 * Math.PI * T) / BOB_PERIOD);
  const pos = [TARGET[0] + RADIUS * Math.cos(el) * Math.sin(az), TARGET[1] + RADIUS * Math.sin(el), TARGET[2] + RADIUS * Math.cos(el) * Math.cos(az)];
  const f = norm(sub(TARGET, pos));
  const r = norm(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  const F = 1 / Math.tan((FOV * Math.PI) / 360);
  const aspect = W / H;
  return {
    pos,
    project(p) {
      const d = sub(p, pos);
      const z = dot(d, f);
      const x = (F / aspect) * (dot(d, r) / z);
      const y = F * (dot(d, u) / z);
      return [((x + 1) / 2) * W, ((1 - y) / 2) * H, z];
    },
  };
}

// ---- scene at time T ----
const theta = -0.25 * T;
const off = pedalOffsets(0);
const parents = {
  frame: (p) => p,
  crank: (p) => add(J.BB, rotZ(p, theta)),
  pedalL: (p) => add(J.BB, add(rotZ(off.pedalL, theta), p)),
  pedalR: (p) => add(J.BB, add(rotZ(off.pedalR, theta), p)),
};

function segsToWorld(arr, xf) {
  const out = [];
  for (let i = 0; i < arr.length; i += 6) out.push([xf([arr[i], arr[i + 1], arr[i + 2]]), xf([arr[i + 3], arr[i + 4], arr[i + 5]])]);
  return out;
}
const wire = [
  ...segsToWorld(buildFrame(), parents.frame),
  ...segsToWorld(buildCrank(), parents.crank),
  ...segsToWorld(buildPedal(), parents.pedalL),
  ...segsToWorld(buildPedal(), parents.pedalR),
];
const grid = segsToWorld(buildGrid(), parents.frame);

function shapeSamples(s) { // local-space point loops per shape, before mesh rotation
  const loops = [];
  const circle = (r, n, fn) => Array.from({ length: n }, (_, i) => fn((i / n) * Math.PI * 2, r));
  switch (s.type) {
    case 'torusArc': {
      const n = 18, outer = [], inner = [];
      for (let i = 0; i <= n; i++) { const a = (i / n) * s.arc; outer.push([(s.radius + s.tube) * Math.cos(a), (s.radius + s.tube) * Math.sin(a), 0]); inner.push([(s.radius - s.tube) * Math.cos(a), (s.radius - s.tube) * Math.sin(a), 0]); }
      loops.push({ pts: [...outer, ...inner.reverse()], mode: 'fill' });
      break;
    }
    case 'ring': loops.push({ pts: circle((s.inner + s.outer) / 2, 32, (a, r) => [r * Math.cos(a), r * Math.sin(a), 0]), mode: 'stroke', width: s.outer - s.inner }); break;
    case 'disc': loops.push({ pts: circle(s.radius, 24, (a, r) => [r * Math.cos(a), r * Math.sin(a), 0]), mode: 'fill' }); break;
    case 'cylinder': {
      const pts = [];
      for (const y of [-s.length / 2, s.length / 2]) for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; pts.push([s.radius * Math.cos(a), y, s.radius * Math.sin(a)]); }
      loops.push({ pts, mode: 'hull' });
      break;
    }
    case 'sphere': {
      const pts = [], sc = s.scale || [1, 1, 1];
      for (let j = 1; j < 8; j++) for (let i = 0; i < 16; i++) { const ph = (j / 8) * Math.PI, th = (i / 16) * Math.PI * 2; pts.push([s.radius * Math.sin(ph) * Math.cos(th) * sc[0], s.radius * Math.cos(ph) * sc[1], s.radius * Math.sin(ph) * Math.sin(th) * sc[2]]); }
      loops.push({ pts, mode: 'hull' });
      break;
    }
  }
  return loops;
}
function meshToWorld(p, patch) {
  let q = p;
  if (patch.shape.axis) q = rotToAxis(q, patch.shape.axis);
  else if (patch.rotation) { const [rx, , rz] = patch.rotation; if (rx) q = rotX(q, rx); if (rz) q = rotZ(q, rz); }
  return parents[patch.parent](add(patch.position, q));
}
function hull(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
const smoothstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const f1 = (n) => n.toFixed(1);

// ---- render the stage into an SVG group ----
function renderStage(W, H, ox = 0, oy = 0) {
  const cam = camera(W, H);
  const P = (p) => { const [x, y, z] = cam.project(p); return [x + ox, y + oy, z]; };
  let out = '';
  const path = (segs) => segs.map(([a, b]) => { const A = P(a), B = P(b); return `M${f1(A[0])} ${f1(A[1])}L${f1(B[0])} ${f1(B[1])}`; }).join('');
  out += `<path d="${path(grid)}" stroke="#4da3ff" stroke-opacity="0.07" stroke-width="1" fill="none"/>`;
  const wirePath = path(wire);
  out += `<path d="${wirePath}" stroke="#3a9bff" stroke-opacity="0.11" stroke-width="6" stroke-linecap="round" fill="none"/>`;
  out += `<path d="${wirePath}" stroke="#bfe6ff" stroke-opacity="0.92" stroke-width="1.3" stroke-linecap="round" fill="none"/>`;

  const labels = [];
  for (const patch of PATCHES) {
    const color = COLORS[patch.kind];
    for (const loop of shapeSamples(patch.shape)) {
      const pts2 = loop.pts.map((p) => P(meshToWorld(p, patch)));
      const poly = loop.mode === 'hull' ? hull(pts2) : pts2;
      const d = poly.map((p, i) => `${i ? 'L' : 'M'}${f1(p[0])} ${f1(p[1])}`).join('') + 'Z';
      if (loop.mode === 'stroke') {
        const zc = pts2[0][2];
        const px = (loop.width * (1 / Math.tan((FOV * Math.PI) / 360)) * H) / (2 * zc);
        out += `<path d="${d}" stroke="${color}" stroke-opacity="0.75" stroke-width="${f1(Math.max(2, px))}" fill="none"/>`;
      } else {
        out += `<path d="${d}" fill="${color}" fill-opacity="0.45" stroke="${color}" stroke-opacity="0.9" stroke-width="1"/>`;
      }
    }
    const aw = parents[patch.parent](patch.anchor);
    let facing = 1;
    if (patch.facing === 'signed') {
      const nw = patch.parent === 'frame' ? patch.normal : patch.normal; // pedal frames are level, normals unchanged
      facing = smoothstep(-0.2, 0.3, dot(norm(nw), norm(sub(cam.pos, aw))));
    }
    const [ax, ay] = P(aw);
    const tw = Math.max(patch.kind.length * 7.4, patch.id.length * 6.3) + 18, th = 34;
    labels.push({ patch, color, ax, ay, op: facing, w: tw, h: th,
      x: clamp(patch.offset[0] < 0 ? ax + patch.offset[0] - tw : ax + patch.offset[0], ox + 6, ox + W - tw - 6),
      y: clamp(patch.offset[1] < 0 ? ay + patch.offset[1] - th : ay + patch.offset[1], oy + 6, oy + H - th - 6) });
  }
  // same separation pass as hero.js
  for (let it = 0; it < 4; it++) {
    for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
      const a = labels[i], b = labels[j];
      if (a.op < 0.05 || b.op < 0.05) continue;
      const oxp = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) + 6;
      const oyp = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) + 6;
      if (oxp <= 0 || oyp <= 0) continue;
      if (oyp <= oxp) { const s = (a.y <= b.y ? -1 : 1) * (oyp / 2); a.y += s; b.y -= s; }
      else { const s = (a.x <= b.x ? -1 : 1) * (oxp / 2); a.x += s; b.x -= s; }
    }
    for (const r of labels) { r.x = clamp(r.x, ox + 6, ox + W - r.w - 6); r.y = clamp(r.y, oy + 6, oy + H - r.h - 6); }
  }
  for (const l of labels) {
    if (l.op < 0.05) continue;
    const cx = clamp(l.ax, l.x, l.x + l.w), cy = clamp(l.ay, l.y, l.y + l.h);
    out += `<g opacity="${f1(l.op)}">`;
    out += `<line x1="${f1(l.ax)}" y1="${f1(l.ay)}" x2="${f1(cx)}" y2="${f1(cy)}" stroke="${l.color}" stroke-opacity="0.7" stroke-width="1"/>`;
    out += `<rect x="${f1(l.x)}" y="${f1(l.y)}" width="${f1(l.w)}" height="${l.h}" rx="4" fill="#0b0d10" fill-opacity="0.86" stroke="${l.color}" stroke-width="1"/>`;
    out += `<text x="${f1(l.x + 8)}" y="${f1(l.y + 14)}" font-family="JetBrains Mono, Consolas, Menlo, monospace" font-size="11" font-weight="600" letter-spacing="1.5" fill="${l.color}">${l.patch.kind}</text>`;
    out += `<text x="${f1(l.x + 8)}" y="${f1(l.y + 27)}" font-family="JetBrains Mono, Consolas, Menlo, monospace" font-size="10" fill="#8b95a1">${l.patch.id}</text>`;
    out += `</g>`;
  }
  return out;
}

// hero fallback: same box ratio as the stage (6:5)
{
  const W = 1200, H = 1000;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect width="${W}" height="${H}" fill="#0b0d10"/>` + renderStage(W, H) + `</svg>`;
  writeFileSync(new URL('../assets/hero-fallback.svg', import.meta.url), svg);
  console.log('wrote assets/hero-fallback.svg', svg.length, 'bytes');
}

// share image 1200x630
{
  const W = 1200, H = 630;
  const sans = 'Space Grotesk, Segoe UI, Helvetica Neue, Arial, sans-serif';
  const mono = 'JetBrains Mono, Consolas, Menlo, monospace';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect width="${W}" height="${H}" fill="#0b0d10"/>` +
    renderStage(560, 560, 620, 40) +
    `<text x="64" y="84" font-family="${sans}" font-size="18" font-weight="700" letter-spacing="4" fill="#e9edf1">CHEWI <tspan fill="#4da3ff">AI</tspan></text>` +
    `<text x="64" y="228" font-family="${mono}" font-size="13" letter-spacing="2.4" fill="#4da3ff">COMING SOON</text>` +
    `<text x="64" y="300" font-family="${sans}" font-size="52" font-weight="700" letter-spacing="-1.5" fill="#e9edf1">The intelligence</text>` +
    `<text x="64" y="358" font-family="${sans}" font-size="52" font-weight="700" letter-spacing="-1.5" fill="#e9edf1">layer between AI</text>` +
    `<text x="64" y="416" font-family="${sans}" font-size="52" font-weight="700" letter-spacing="-1.5" fill="#e9edf1">and the 3D world.</text>` +
    `<text x="64" y="470" font-family="${sans}" font-size="20" fill="#8b95a1">Compiled semantic structure for 3D assets.</text>` +
    `<text x="64" y="586" font-family="${mono}" font-size="13" letter-spacing="1" fill="#8b95a1">chewi.ai</text>` +
    `</svg>`;
  writeFileSync(new URL('../assets/og.svg', import.meta.url), svg);
  console.log('wrote assets/og.svg', svg.length, 'bytes');
}

// og.html: the share image composition with the real web fonts, for a headless-browser screenshot.
{
  const svg = (await import('node:fs')).readFileSync(new URL('../assets/og.svg', import.meta.url), 'utf8');
  const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:'Space Grotesk';font-weight:700;src:url('../fonts/space-grotesk-latin-700.woff2') format('woff2')}
@font-face{font-family:'Space Grotesk';font-weight:400;src:url('../fonts/space-grotesk-latin.woff2') format('woff2')}
@font-face{font-family:'JetBrains Mono';font-weight:400;src:url('../fonts/jetbrains-mono-latin.woff2') format('woff2')}
@font-face{font-family:'JetBrains Mono';font-weight:600;src:url('../fonts/jetbrains-mono-latin-600.woff2') format('woff2')}
html,body{margin:0;background:#0b0d10;width:1200px;height:630px;overflow:hidden}svg{display:block}
</style>${svg}`;
  writeFileSync(new URL('./og.html', import.meta.url), html);
  console.log('wrote tools/og.html');
}
