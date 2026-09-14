// Headless geometry check: every patch anchor must sit on (within 2 cm of) the wire it labels.
// Run: node js/bike.test.mjs
import { buildFrame, buildCrank, buildPedal, PATCHES, REVEAL_ORDER, pedalOffsets, J, FRAME_PARTS } from './bike.js';

const TOL = 0.02;
// An anchor sits at the centre of its surface; the surface outline may be up to its extent away.
function shapeExtent(s) {
  switch (s.type) {
    case 'disc': return s.radius;
    case 'ring': return s.outer;
    case 'cylinder': return Math.max(s.radius, s.length / 2);
    case 'sphere': return s.radius * Math.max(...(s.scale || [1, 1, 1]));
    case 'torusArc': return s.tube;
    case 'box': return Math.max(s.size[0], s.size[2]) / 2;
    case 'saddle': return 0.15;
    default: return 0;
  }
}
let failures = 0;
const fail = (m) => { failures++; console.error('FAIL', m); };
const ok = (m) => console.log('ok  ', m);

function segDist(p, a, b) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const l2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1e-12;
  const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / l2));
  const c = [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t];
  return Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]);
}
function minDist(p, arr) {
  let m = Infinity;
  for (let i = 0; i < arr.length; i += 6) {
    m = Math.min(m, segDist(p, [arr[i], arr[i + 1], arr[i + 2]], [arr[i + 3], arr[i + 4], arr[i + 5]]));
  }
  return m;
}
function worldSegs(local, origin) {
  const out = new Float32Array(local.length);
  for (let i = 0; i < local.length; i += 3) {
    out[i] = local[i] + origin[0]; out[i + 1] = local[i + 1] + origin[1]; out[i + 2] = local[i + 2] + origin[2];
  }
  return out;
}

const frame = buildFrame();
const crankLocal = buildCrank();
const pedalLocal = buildPedal();
const off = pedalOffsets(0);
const world = {
  frame,
  crank: worldSegs(crankLocal, J.BB),
  pedalL: worldSegs(pedalLocal, [J.BB[0] + off.pedalL[0], J.BB[1] + off.pedalL[1], J.BB[2] + off.pedalL[2]]),
  pedalR: worldSegs(pedalLocal, [J.BB[0] + off.pedalR[0], J.BB[1] + off.pedalR[1], J.BB[2] + off.pedalR[2]]),
};
const origins = {
  frame: [0, 0, 0],
  crank: J.BB,
  pedalL: [J.BB[0] + off.pedalL[0], J.BB[1] + off.pedalL[1], J.BB[2] + off.pedalL[2]],
  pedalR: [J.BB[0] + off.pedalR[0], J.BB[1] + off.pedalR[1], J.BB[2] + off.pedalR[2]],
};
const all = new Float32Array([...world.frame, ...world.crank, ...world.pedalL, ...world.pedalR]);

// 1. counts
const segCount = frame.length / 6;
segCount > 400 && segCount < 2000 ? ok(`frame has ${segCount} segments`) : fail(`frame segment count ${segCount} out of range`);
frame.length % 6 === 0 ? ok('frame buffer is whole segments') : fail('frame buffer length not a multiple of 6');
PATCHES.length === 10 ? ok('10 patches') : fail(`expected 10 patches, got ${PATCHES.length}`);
new Set(PATCHES.map(p => p.id)).size === 10 ? ok('patch ids unique') : fail('duplicate patch ids');
const expected = ['grip_l', 'grip_r', 'saddle', 'pedal_l', 'pedal_r', 'tire_f', 'tire_r', 'crank', 'hub_f', 'headset'];
for (const id of expected) PATCHES.some(p => p.id === id) ? ok(`patch ${id} present`) : fail(`patch ${id} missing`);
REVEAL_ORDER.length === 10 && new Set(REVEAL_ORDER).size === 10 && REVEAL_ORDER.every(id => PATCHES.some(p => p.id === id))
  ? ok('reveal order covers all patches once') : fail('reveal order broken');

// 2. anchors sit on the specific wire they label, and exactly where the patch says
function wireSubset(p) {
  if (p.wire === 'crank') return world.crank;
  if (p.wire === 'pedal') return world[p.parent];
  const r = FRAME_PARTS[p.wire];
  return r ? frame.subarray(r[0], r[1]) : null;
}
for (const p of PATCHES) {
  const o = origins[p.parent];
  if (!o) { fail(`${p.id}: unknown parent ${p.parent}`); continue; }
  const a = [p.anchor[0] + o[0], p.anchor[1] + o[1], p.anchor[2] + o[2]];
  const subset = wireSubset(p);
  if (!subset) { fail(`${p.id}: wire part ${p.wire} not found`); continue; }
  const d = minDist(a, subset);
  const lim = TOL + shapeExtent(p.shape);
  d <= lim ? ok(`${p.id} anchor within ${(d * 100).toFixed(1)} cm of ${p.wire} (limit ${(lim * 100).toFixed(1)} cm)`) : fail(`${p.id} anchor is ${(d * 100).toFixed(1)} cm from ${p.wire} (limit ${(lim * 100).toFixed(1)} cm)`);
  const ref = p.anchorRef;
  const dr = Math.hypot(p.anchor[0] - ref[0], p.anchor[1] - ref[1], p.anchor[2] - ref[2]);
  dr <= 0.005 ? ok(`${p.id} anchor is at its reference point`) : fail(`${p.id} anchor is ${(dr * 100).toFixed(1)} cm from its reference point`);
}

// 3. sanity: wheels touch the ground, nothing below it
let minY = Infinity;
for (let i = 1; i < frame.length; i += 3) minY = Math.min(minY, frame[i]);
Math.abs(minY) < 1e-6 ? ok('lowest frame point is on the ground plane') : fail(`lowest frame point y=${minY}`);

// 4. every patch has the fields hero.js reads
for (const p of PATCHES) {
  const missing = ['id', 'kind', 'parent', 'shape', 'position', 'anchor', 'anchorRef', 'wire', 'facing', 'offset'].filter(k => !(k in p));
  missing.length === 0 ? ok(`${p.id} has all fields`) : fail(`${p.id} missing ${missing.join(',')}`);
  if (p.facing === 'signed' && !p.normal) fail(`${p.id}: signed facing needs a normal`);
}

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1); }
console.log('\nall geometry checks passed');
