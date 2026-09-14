// Headless checks for the hand rig data. Run: node js/hand.test.mjs
import { FINGERS, THUMB, CURL_MAX, THUMB_MAX, PALM, roundedRect } from './hand.js';

let failures = 0;
const fail = (m) => { failures++; console.error('FAIL', m); };
const ok = (m) => console.log('ok  ', m);

FINGERS.length === 4 ? ok('four fingers') : fail(`expected 4 fingers, got ${FINGERS.length}`);
new Set(FINGERS.map((f) => f.id).concat(THUMB.id)).size === 5 ? ok('finger ids unique') : fail('duplicate finger ids');
for (const f of FINGERS) {
  f.segs.length === 3 ? ok(`${f.id} has 3 segments`) : fail(`${f.id} has ${f.segs.length} segments`);
  f.segs.every((l, i, a) => i === 0 || l <= a[i - 1]) ? ok(`${f.id} segments shorten toward the tip`) : fail(`${f.id} segments do not shorten`);
  const len = f.segs.reduce((s, v) => s + v, 0);
  len > 0.06 && len < 0.11 ? ok(`${f.id} length ${(len * 100).toFixed(1)} cm plausible`) : fail(`${f.id} length ${(len * 100).toFixed(1)} cm implausible`);
  Math.abs(f.base[0]) <= PALM.w / 2 + 0.005 ? ok(`${f.id} base sits on the palm width`) : fail(`${f.id} base x=${f.base[0]} outside the palm`);
}
THUMB.segs.length === 2 ? ok('thumb has 2 segments') : fail('thumb segment count');
CURL_MAX.length === 3 && THUMB_MAX.length === 2 ? ok('curl limits match segment counts') : fail('curl limit arrays mismatch');
CURL_MAX.every((a) => a > 0 && a < Math.PI / 1.8) ? ok('curl limits within a real fist') : fail('curl limit out of range');
// middle finger is the longest, index/ring next, pinky shortest
const tot = Object.fromEntries(FINGERS.map((f) => [f.id, f.segs.reduce((s, v) => s + v, 0)]));
tot.middle > tot.index && tot.middle > tot.ring && tot.pinky < tot.ring ? ok('finger length order is anatomical') : fail('finger length order wrong');
const rr = roundedRect(0.08, 0.09, 0.02);
rr.length === 28 && rr.every(([x, y]) => Math.abs(x) <= 0.04 + 1e-9 && Math.abs(y) <= 0.045 + 1e-9) ? ok('rounded rect stays within its box') : fail('rounded rect outline broken');

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1); }
console.log('\nall hand checks passed');
