// grasp-layout.js: the hand-and-cup layout and the grasp solver, in pure math so `node js/grasp.test.mjs`
// can check the same numbers the scene renders. The scene applies the HAND matrix + position to the rig and
// per-finger curls from solveGrasp(); the test checks contact and clearance of the rendered bodies.
import { FINGERS, THUMB, CURL_MAX, THUMB_MAX, fingerChainPoints, SEG_R, JOINT_R, TIP_BALL_R, TIP_SPHERE_OFFSET, TIP_SPHERE_R } from './hand.js';

// Cup body: CylinderGeometry(R at the rim, R*0.92 at the base, H). Wall radius depends on height.
export const CUP = { R: 0.042, H: 0.105, taper: 0.92 };
export const wallR = (y) => CUP.R * CUP.taper + (CUP.R - CUP.R * CUP.taper) * Math.max(0, Math.min(1, y / CUP.H));

// The rig is a left hand (palm +z, fingers +y, thumb on -x). Placed on the cup's left side (-x), palm
// facing the cup (+x), fingers pointing away from the camera (-z) to wrap the back, thumb on top wrapping
// the front. Rotation matrix columns: local x -> world (0,-1,0), local y -> (0,0,-1), local z -> (1,0,0).
export const HAND_MATRIX = [
  0, -1, 0,   // local x
  0, 0, -1,   // local y
  1, 0, 0,    // local z
];
export const HAND_POS = [-0.068, 0.050, 0.004];    // from the placement search (README): contact with whole-chain clearance
export const THUMB_ROT = [0.4, 0, -2.2];            // holder Euler XYZ; setPose adds -c*0.55 to y
export const SPREAD = 0.4;
export const OPEN_CURL = 0.08;                      // curl at full release
export const CLEARANCE_TOL = 0.001;                 // 1 mm of allowed body/wall overlap (tessellation slack)
export const TIP_R = TIP_SPHERE_R;

export const DIGITS = ['index', 'middle', 'ring', 'pinky', 'thumb'];
export const defOf = (id) => (id === 'thumb' ? THUMB : FINGERS.find((f) => f.id === id));

export function localToWorld(p, pos = HAND_POS) {
  const m = HAND_MATRIX;
  return [
    pos[0] + m[0] * p[0] + m[3] * p[1] + m[6] * p[2],
    pos[1] + m[1] * p[0] + m[4] * p[1] + m[7] * p[2],
    pos[2] + m[2] * p[0] + m[5] * p[1] + m[8] * p[2],
  ];
}
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const applyR = (R, v) => [R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[3] * v[0] + R[4] * v[1] + R[5] * v[2], R[6] * v[0] + R[7] * v[1] + R[8] * v[2]];

function chain(id, c, thumbRot = THUMB_ROT) {
  const isThumb = id === 'thumb';
  const def = defOf(id);
  const holder = isThumb ? [thumbRot[0], -c * 0.55, thumbRot[2]] : [0, 0, def.spread * (1 - c) * SPREAD];
  const angles = (isThumb ? THUMB_MAX : CURL_MAX).map((a) => a * c);
  return { def, ...fingerChainPoints(def, holder, angles) };
}

// World position of the label anchor ([0, tipLen, 0.004] in the last segment frame).
export function tipWorld(id, c, pos = HAND_POS, thumbRot = THUMB_ROT) {
  const { def, pts, last } = chain(id, c, thumbRot);
  const base = pts[pts.length - 1];
  return localToWorld(add(base, applyR(last, [0, def.segs[def.segs.length - 1], 0.004])), pos);
}
// World centre of the rendered contact sphere at the tip, and its radius.
export function tipSphereWorld(id, c, pos = HAND_POS, thumbRot = THUMB_ROT) {
  const { def, pts, last } = chain(id, c, thumbRot);
  const base = pts[pts.length - 1];
  return { center: localToWorld(add(base, applyR(last, TIP_SPHERE_OFFSET(def))), pos), r: TIP_SPHERE_R(def) };
}
// Signed clearance (metres) between a sphere and the cup wall: positive = outside, negative = overlapping.
// Only heights inside the cup body count; above the rim there is no wall.
function sphereClearance(center, r) {
  const [x, y, z] = center;
  if (y > CUP.H + r || y < -r) return Infinity;
  return Math.hypot(x, z) - wallR(y) - r;
}
// Worst clearance over every rendered body of one digit: joint balls, capsule axes (sampled), tip ball, contact sphere.
export function chainClearance(id, c, pos = HAND_POS, thumbRot = THUMB_ROT) {
  const { def, pts, rots, tip } = chain(id, c, thumbRot);
  let worst = Infinity;
  for (let i = 0; i < pts.length; i++) {
    worst = Math.min(worst, sphereClearance(localToWorld(pts[i], pos), JOINT_R(def)));
    const end = i + 1 < pts.length ? pts[i + 1] : tip;
    for (let k = 1; k <= 8; k++) {
      const t = k / 8;
      const p = pts[i].map((v, j) => v + (end[j] - v) * t);
      worst = Math.min(worst, sphereClearance(localToWorld(p, pos), SEG_R(def, i)));
    }
  }
  worst = Math.min(worst, sphereClearance(localToWorld(tip, pos), TIP_BALL_R(def)));
  const s = tipSphereWorld(id, c, pos, thumbRot);
  worst = Math.min(worst, sphereClearance(s.center, s.r));
  return worst;
}

// For each digit, the smallest curl at which the contact sphere touches the wall from outside (within
// CLEARANCE_TOL) at a usable height, with the whole chain clear of the wall all the way in.
// Digits that cannot reach stop at the last curl where the chain is still clear.
export function solveGrasp(pos = HAND_POS, thumbRot = THUMB_ROT, steps = 600) {
  const out = {};
  for (const id of DIGITS) {
    let found = null, lastSafe = 0, minGap = Infinity, worstOnPath = Infinity;
    for (let i = 0; i <= steps; i++) {
      const c = i / steps;
      const clear = chainClearance(id, c, pos, thumbRot);
      if (clear < -CLEARANCE_TOL) break;           // a body would enter the wall: stop before it
      worstOnPath = Math.min(worstOnPath, clear);
      const s = tipSphereWorld(id, c, pos, thumbRot);
      const gap = sphereClearance(s.center, s.r);
      minGap = Math.min(minGap, gap);
      const y = s.center[1];
      if (gap <= CLEARANCE_TOL && y > 0.008 && y < CUP.H - 0.006) { found = c; break; }
      lastSafe = c;
    }
    out[id] = { c: found ?? lastSafe, reached: found !== null, minGap, worstOnPath };
  }
  return out;
}
