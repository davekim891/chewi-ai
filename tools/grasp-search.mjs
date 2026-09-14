// Search hand x-offset, height and thumb holder angles so index, middle and thumb contact spheres touch the
// cup wall with the whole chain clear, and ring/pinky stay clear. Prints the best candidates.
import { solveGrasp, chainClearance, tipSphereWorld, CUP, wallR, DIGITS } from '../js/grasp-layout.js';

const results = [];
for (const px of [-0.062, -0.065, -0.068, -0.071, -0.074])
for (const py of [0.045, 0.05, 0.055])
for (let rx = -1.2; rx <= 1.2; rx += 0.2)
for (let rz = -3.1; rz <= 3.1; rz += 0.15) {
  const pos = [px, py, 0.004], rot = [+rx.toFixed(2), 0, +rz.toFixed(2)];
  const fit = solveGrasp(pos, rot, 300);
  if (!fit.index.reached || !fit.middle.reached || !fit.thumb.reached) continue;
  const worst = Math.min(...DIGITS.map((id) => chainClearance(id, fit[id].c, pos, rot)));
  if (worst < -0.001) continue;
  const t = tipSphereWorld('thumb', fit.thumb.c, pos, rot).center, i = tipSphereWorld('index', fit.index.c, pos, rot).center, m = tipSphereWorld('middle', fit.middle.c, pos, rot).center;
  if (!(t[2] > 0.01 && i[2] < -0.01 && m[2] < -0.01)) continue;  // opposition
  const cs = [fit.index.c, fit.middle.c, fit.thumb.c];
  const score = Math.abs(t[1] - 0.06) + Math.abs(i[1] - 0.07) + 0.5 * (Math.max(...cs) - Math.min(...cs)) - 0.2 * worst;
  results.push({ px, py, rx: rot[0], rz: rot[2], c: cs.map((v) => +v.toFixed(2)), thumb: t.map((v) => +v.toFixed(3)), index: i.map((v) => +v.toFixed(3)), worst: +(worst * 1000).toFixed(2), score });
}
results.sort((a, b) => a.score - b.score);
console.log(results.length, 'candidates');
for (const r of results.slice(0, 8)) console.log(JSON.stringify(r));
