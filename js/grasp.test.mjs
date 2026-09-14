// Headless check that the grasp scene actually grasps: every labelled fingertip lands on the cup wall
// from outside at full grip, nothing penetrates the wall on the way in, and the thumb opposes the fingers.
// Run: node js/grasp.test.mjs
import { CUP, TIP_R, tipWorld, solveGrasp } from './grasp-layout.js';
import { FINGERS, THUMB } from './hand.js';

let failures = 0;
const fail = (m) => { failures++; console.error('FAIL', m); };
const ok = (m) => console.log('ok  ', m);
const mm = (v) => (v * 1000).toFixed(1) + ' mm';

const fit = solveGrasp();
const LABELLED = ['index', 'middle', 'thumb'];
const defOf = (id) => (id === 'thumb' ? THUMB : FINGERS.find((f) => f.id === id));

for (const id of LABELLED) {
  const def = defOf(id), tipR = TIP_R(def), f = fit[id];
  f.reached ? ok(`${id}: tip reaches the cup wall at curl ${f.c.toFixed(3)}`) : fail(`${id}: tip never reaches the wall (closest ${mm(f.minRadial)} from the axis, wall at ${mm(CUP.R)})`);
  const [x, y, z] = tipWorld(id, f.c);
  const radial = Math.hypot(x, z), gap = radial - (CUP.R + tipR);
  Math.abs(gap) <= 0.002 ? ok(`${id}: tip surface within ${mm(Math.abs(gap))} of the wall`) : fail(`${id}: tip surface is ${mm(gap)} from the wall`);
  y > 0.008 && y < CUP.H - 0.006 ? ok(`${id}: tip at ${mm(y)} above the floor, inside the cup height`) : fail(`${id}: tip height ${mm(y)} is outside the cup wall (rim at ${mm(CUP.H)})`);
  // no penetration during the approach
  let worst = Infinity;
  for (let i = 0; i <= 200; i++) { const c = (f.c * i) / 200; const [px, , pz] = tipWorld(id, c); worst = Math.min(worst, Math.hypot(px, pz) - (CUP.R + tipR)); }
  worst >= -0.002 ? ok(`${id}: no wall penetration on the way in`) : fail(`${id}: penetrates the wall by ${mm(-worst)} during the approach`);
}
// opposition: fingers behind the cup (z < 0), thumb in front (z > 0), on opposite sides of the axis
const [, , zi] = tipWorld('index', fit.index.c), [, , zm] = tipWorld('middle', fit.middle.c), [, , zt] = tipWorld('thumb', fit.thumb.c);
zi < 0 && zm < 0 ? ok('index and middle tips wrap the back of the cup') : fail(`finger tips not behind the cup (z index ${mm(zi)}, middle ${mm(zm)})`);
zt > 0 ? ok('thumb tip wraps the front of the cup, opposing the fingers') : fail(`thumb tip is not in front of the cup (z ${mm(zt)})`);
// unlabelled fingers must not sit inside the cup either
for (const id of ['ring', 'pinky']) {
  const [x, , z] = tipWorld(id, fit[id].c);
  Math.hypot(x, z) >= CUP.R - 0.001 ? ok(`${id}: tip stays outside the cup wall`) : fail(`${id}: tip inside the cup (radial ${mm(Math.hypot(x, z))})`);
}

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1); }
console.log('\nall grasp checks passed');
