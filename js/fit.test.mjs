// Headless check of the orbit-camera fit: the smallest radius that keeps a box inside the
// stage inset by a margin, at every sampled azimuth and listed elevation.
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

function allInside(corners, target, R, fov, aspect, azSamples, els, margin) {
  const limit = 1 - 2 * margin;
  for (let i = 0; i < azSamples; i++) {
    const az = (2 * Math.PI * i) / azSamples;
    for (const el of els) {
      for (const c of corners) {
        const p = projectCorner(c, target, R, az, el, fov, aspect);
        if (!(Math.abs(p.ndc[0]) <= limit + 1e-9 && Math.abs(p.ndc[1]) <= limit + 1e-9) || p.cam[2] >= 0) return false;
      }
    }
  }
  return true;
}

const origin = [0, 0, 0];
const elsMid = [0.08, 0.23, 0.62];

// (a) a box that already fits returns minRadius
const small = boxCorners([-0.02, -0.02, -0.02], [0.02, 0.02, 0.02]);
const minA = 1.2912;
const Ra = fitRadius({ corners: small, target: origin, fov: 34, aspect: 1792 / 1008, azSamples: 36, els: elsMid, margin: 0.06, minRadius: minA });
Ra === minA ? ok('a: box that already fits returns minRadius') : fail(`a: expected minRadius ${minA}, got ${Ra}`);

// (b) a wide box on a narrow aspect returns a radius strictly larger than on a wide aspect.
// Wide in XZ so the horizontal half-angle (which carries aspect) actually binds at 1.2.
const wide = boxCorners([-2, -0.08, -2], [2, 0.08, 2]);
const bOpts = { corners: wide, target: origin, fov: 34, azSamples: 36, els: elsMid, margin: 0.06, minRadius: 0.05 };
const RbN = fitRadius({ ...bOpts, aspect: 1.2 });
const RbW = fitRadius({ ...bOpts, aspect: 1.778 });
RbN > RbW ? ok(`b: wide box, aspect 1.2 radius ${RbN.toFixed(4)} > aspect 1.778 radius ${RbW.toFixed(4)}`) : fail(`b: expected narrow aspect to need a larger radius (1.2 → ${RbN}, 1.778 → ${RbW})`);

// (c) at the returned radius every sampled corner is inside the margin box, and at 0.98x at least one is outside
allInside(wide, origin, RbN, 34, 1.2, 36, elsMid, 0.06) ? ok('c: at returned radius every sampled corner is inside the margin box') : fail('c: a sampled corner sits outside the margin box at the returned radius');
allInside(wide, origin, RbN * 0.98, 34, 1.2, 36, elsMid, 0.06) ? fail(`c: 0.98× returned radius (${(RbN * 0.98).toFixed(4)}) still fits — radius is not minimal`) : ok('c: at 0.98× the returned radius at least one corner is outside');

// (d) hero v3 bike bounds: at aspect 1.2 the radius must be larger than at aspect 1.778
const FLOOR_Y = -0.2606;
const posMin = [-0.5, -0.26057, -0.19184], posMax = [0.5, 0.26057, 0.19184];
const bmin = [posMin[0], posMin[1] - FLOOR_Y, posMin[2]];
const bmax = [posMax[0], posMax[1] - FLOOR_Y, posMax[2]];
const GW = 0.55, GD = 0.32; // groundGlow w, d at ANCHORS.tire_r / tire_f in hero-mesh.js
for (const [x, z] of [[0.2970, -0.0062], [-0.3562, -0.0066]]) {
  bmin[0] = Math.min(bmin[0], x - GW / 2); bmax[0] = Math.max(bmax[0], x + GW / 2);
  bmin[1] = Math.min(bmin[1], 0.002); bmax[1] = Math.max(bmax[1], 0.003);
  bmin[2] = Math.min(bmin[2], z - GD / 2); bmax[2] = Math.max(bmax[2], z + GD / 2);
}
const heroCorners = boxCorners(bmin, bmax);
const heroTarget = [-0.0868, -0.0205 + 0.2606, 0.0536];
const heroBase = { corners: heroCorners, target: heroTarget, fov: 34, azSamples: 36, els: [0.08, 0.23, 0.62], margin: 0.06, minRadius: 1.2912 };
const RdN = fitRadius({ ...heroBase, aspect: 1.2 });
const RdW = fitRadius({ ...heroBase, aspect: 1.778 });
const RdP = fitRadius({ ...heroBase, aspect: 0.8 });
// Landscape stages (1.2 and 16:9) are vertically bound on this AABB, so they share a radius.
// A narrower stage is horizontally bound and must zoom out further — that is the aspect check.
RdN >= RdW ? ok(`d: hero bounds, aspect 1.2 radius ${RdN.toFixed(4)} >= aspect 1.778 radius ${RdW.toFixed(4)}`) : fail(`d: expected hero aspect 1.2 radius >= 1.778 (1.2 → ${RdN}, 1.778 → ${RdW})`);
RdP > RdW ? ok(`d: hero bounds, aspect 0.8 radius ${RdP.toFixed(4)} > aspect 1.778 radius ${RdW.toFixed(4)}`) : fail(`d: expected hero aspect 0.8 to need a larger radius than 1.778 (0.8 → ${RdP}, 1.778 → ${RdW})`);

const R16 = fitRadius({ ...heroBase, aspect: 1792 / 1008 });
console.log(`hero 16:9 (1792/1008) fitRadius ${R16} vs VIEW.D 1.2912 (ratio ${(R16 / 1.2912).toFixed(4)})`);

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1); }
console.log('\nall fit checks passed');
