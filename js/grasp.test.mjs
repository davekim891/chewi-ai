// Headless check that the grasp scene grasps with its rendered bodies: at full grip the contact sphere of
// each labelled digit touches the tapered cup wall from outside, no capsule or joint ball of any digit is
// inside the wall at any point of the approach, and the thumb opposes the fingers.
// Run: node js/grasp.test.mjs
import { CUP, wallR, DIGITS, defOf, tipSphereWorld, chainClearance, solveGrasp, CLEARANCE_TOL, tipWorld } from './grasp-layout.js';

let failures = 0;
const fail = (m) => { failures++; console.error('FAIL', m); };
const ok = (m) => console.log('ok  ', m);
const mm = (v) => (v * 1000).toFixed(2) + ' mm';

const fit = solveGrasp();
const LABELLED = ['index', 'middle', 'thumb'];

for (const id of LABELLED) {
  const f = fit[id];
  f.reached ? ok(`${id}: contact sphere reaches the wall at curl ${f.c.toFixed(3)}`) : fail(`${id}: contact sphere never reaches the wall (closest ${mm(f.minGap)})`);
  const s = tipSphereWorld(id, f.c);
  const [x, y, z] = s.center;
  const gap = Math.hypot(x, z) - wallR(y) - s.r;
  Math.abs(gap) <= 0.0015 ? ok(`${id}: contact sphere surface ${mm(Math.abs(gap))} from the wall (wall radius ${mm(wallR(y))} at that height)`) : fail(`${id}: contact sphere surface is ${mm(gap)} from the wall`);
  y > 0.008 && y < CUP.H - 0.006 ? ok(`${id}: contact at ${mm(y)} above the floor, inside the cup height`) : fail(`${id}: contact height ${mm(y)} outside the wall (rim ${mm(CUP.H)})`);
}
// every rendered body of every digit stays outside the wall, at full grip and all the way in
for (const id of DIGITS) {
  const f = fit[id];
  let worst = Infinity, worstC = 0;
  for (let i = 0; i <= 120; i++) { const c = (f.c * i) / 120; const cl = chainClearance(id, c); if (cl < worst) { worst = cl; worstC = c; } }
  worst >= -CLEARANCE_TOL ? ok(`${id}: whole chain clear of the wall (worst ${mm(worst)} at curl ${worstC.toFixed(2)})`) : fail(`${id}: a body enters the wall by ${mm(-worst)} at curl ${worstC.toFixed(2)}`);
}
// opposition: fingers behind the cup (z < 0), thumb in front (z > 0)
const zi = tipSphereWorld('index', fit.index.c).center[2], zm = tipSphereWorld('middle', fit.middle.c).center[2], zt = tipSphereWorld('thumb', fit.thumb.c).center[2];
zi < 0 && zm < 0 ? ok('index and middle wrap the back of the cup') : fail(`finger contacts not behind the cup (z index ${mm(zi)}, middle ${mm(zm)})`);
zt > 0 ? ok('thumb wraps the front of the cup, opposing the fingers') : fail(`thumb contact is not in front of the cup (z ${mm(zt)})`);
// the labelled digits close by similar amounts, so the hand reads as one grip rather than three poses
const cs = LABELLED.map((id) => fit[id].c);
Math.max(...cs) - Math.min(...cs) <= 0.12 ? ok(`labelled curls agree (${cs.map((c) => c.toFixed(2)).join(', ')})`) : fail(`labelled curls diverge (${cs.map((c) => c.toFixed(2)).join(', ')})`);
// the label anchor sits near its contact sphere (labels point at the contact)
for (const id of LABELLED) {
  const a = tipWorld(id, fit[id].c), s = tipSphereWorld(id, fit[id].c).center;
  Math.hypot(a[0] - s[0], a[1] - s[1], a[2] - s[2]) <= 0.006 ? ok(`${id}: label anchor within 6 mm of the contact`) : fail(`${id}: label anchor far from the contact`);
}

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1); }
console.log('\nall grasp checks passed');
