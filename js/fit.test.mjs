// Headless check of the orbit-camera fit: the smallest radius that keeps a point set
// inside the stage inset by a margin, at every sampled azimuth and listed elevation.
// Run: node js/fit.test.mjs
import { fitRadius, projectCorner } from './fit.js';

let failures = 0;
const fail = (m) => { failures++; console.error('FAIL', m); };
const ok = (m) => console.log('ok  ', m);

function boxCorners(min, max) {
  const c = [];
  for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) c.push([x, y, z]);
  return c;
}

function allInside(points, target, R, fov, aspect, azSamples, els, margin) {
  const limit = 1 - 2 * margin;
  for (let i = 0; i < azSamples; i++) {
    const az = (2 * Math.PI * i) / azSamples;
    for (const el of els) {
      for (const c of points) {
        const p = projectCorner(c, target, R, az, el, fov, aspect);
        if (!(Math.abs(p.ndc[0]) <= limit + 1e-9 && Math.abs(p.ndc[1]) <= limit + 1e-9) || p.cam[2] >= 0) return false;
      }
    }
  }
  return true;
}

function aabbOf(points) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const p of points) for (let k = 0; k < 3; k++) { if (p[k] < min[k]) min[k] = p[k]; if (p[k] > max[k]) max[k] = p[k]; }
  return boxCorners(min, max);
}

function circleXY(cx, cy, r, n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (2 * Math.PI * i) / n;
    pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t), 0]);
  }
  return pts;
}

const origin = [0, 0, 0];
const elsMid = [0.08, 0.23, 0.62];

// (a) a box that already fits returns minRadius
const small = boxCorners([-0.02, -0.02, -0.02], [0.02, 0.02, 0.02]);
const minA = 1.2912;
const Ra = fitRadius({ points: small, target: origin, fov: 34, aspect: 1792 / 1008, azSamples: 36, els: elsMid, margin: 0.06, minRadius: minA });
Ra === minA ? ok('a: box that already fits returns minRadius') : fail(`a: expected minRadius ${minA}, got ${Ra}`);

// (b) a wide box on a narrow aspect returns a radius strictly larger than on a wide aspect.
const wide = boxCorners([-2, -0.08, -2], [2, 0.08, 2]);
const bOpts = { points: wide, target: origin, fov: 34, azSamples: 36, els: elsMid, margin: 0.06, minRadius: 0.05 };
const RbN = fitRadius({ ...bOpts, aspect: 1.2 });
const RbW = fitRadius({ ...bOpts, aspect: 1.778 });
RbN > RbW ? ok(`b: wide box, aspect 1.2 radius ${RbN.toFixed(4)} > aspect 1.778 radius ${RbW.toFixed(4)}`) : fail(`b: expected narrow aspect to need a larger radius (1.2 → ${RbN}, 1.778 → ${RbW})`);

// (c) at the returned radius every sampled point is inside the margin box, and at 0.98x at least one is outside
allInside(wide, origin, RbN, 34, 1.2, 36, elsMid, 0.06) ? ok('c: at returned radius every sampled point is inside the margin box') : fail('c: a sampled point sits outside the margin box at the returned radius');
allInside(wide, origin, RbN * 0.98, 34, 1.2, 36, elsMid, 0.06) ? fail(`c: 0.98× returned radius (${(RbN * 0.98).toFixed(4)}) still fits — radius is not minimal`) : ok('c: at 0.98× the returned radius at least one point is outside');

// (d) sampled hull of a bike-like set is strictly tighter than its AABB at aspect 1.2
const hull = [
  ...circleXY(0.34, 0.26, 0.26, 16),
  ...circleXY(-0.34, 0.26, 0.26, 16),
  [-0.2515, 0.2487 + 0.2606, 0.1891],  // grip_l
  [-0.2559, 0.2496 + 0.2606, -0.1388], // grip_r
  [0.1068, 0.2359 + 0.2606, -0.0029],  // saddle
  [-0.2381, 0.1563 + 0.2606, 0.0101],  // headset
];
const dOpts = { target: [-0.0868, -0.0205 + 0.2606, 0.0536], fov: 34, aspect: 1.2, azSamples: 36, els: elsMid, margin: 0.04, minRadius: 0 };
const RdHull = fitRadius({ ...dOpts, points: hull });
const RdBox = fitRadius({ ...dOpts, points: aabbOf(hull) });
RdHull < RdBox ? ok(`d: sampled hull radius ${RdHull.toFixed(4)} < AABB-corner radius ${RdBox.toFixed(4)} at aspect 1.2`) : fail(`d: expected hull < AABB at aspect 1.2 (hull ${RdHull}, AABB ${RdBox})`);

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1); }
console.log('\nall fit checks passed');
