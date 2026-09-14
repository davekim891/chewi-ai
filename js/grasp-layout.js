// grasp-layout.js: the hand-and-cup layout and the grasp solver, in pure math so `node js/grasp.test.mjs`
// can check the same numbers the scene renders. The scene applies HAND matrix + position to the rig and
// per-finger curls from solveGrasp(); the test checks that every labelled fingertip lands on the cup wall.
import { FINGERS, THUMB, CURL_MAX, THUMB_MAX, fingerChainFK } from './hand.js';

export const CUP = { R: 0.042, H: 0.105 };

// The rig is a left hand (palm +z, fingers +y, thumb on -x). Placed on the cup's left side (-x), palm
// facing the cup (+x), fingers pointing away from the camera (-z) to wrap the back, thumb on top wrapping
// the front. Rotation matrix columns: local x -> world (0,-1,0), local y -> (0,0,-1), local z -> (1,0,0).
export const HAND_MATRIX = [
  0, -1, 0,   // local x
  0, 0, -1,   // local y
  1, 0, 0,    // local z
];
export const HAND_POS = [-(CUP.R + 0.0105 + 0.006), 0.048, 0.004]; // palm bottom 5 mm above the floor
export const THUMB_ROT = [0.4, 0, -2.3];    // holder Euler XYZ, found by tools search: thumb wraps the front wall; setPose adds -c*0.55 to y
export const SPREAD = 0.4;
export const OPEN_CURL = 0.08;               // curl at full release
export const TIP_R = (def) => def.r * 1.05;  // the tip contact sphere radius used by the scene

export function localToWorld(p) {
  const m = HAND_MATRIX;
  return [
    HAND_POS[0] + m[0] * p[0] + m[3] * p[1] + m[6] * p[2],
    HAND_POS[1] + m[1] * p[0] + m[4] * p[1] + m[7] * p[2],
    HAND_POS[2] + m[2] * p[0] + m[5] * p[1] + m[8] * p[2],
  ];
}

// World position of a finger tip anchor at curl c (fingers: holder rotation z = spread*(1-c)*SPREAD;
// thumb: holder Euler THUMB_ROT with y = -c*0.55, matching hand.js setPose).
export function tipWorld(id, c) {
  const isThumb = id === 'thumb';
  const def = isThumb ? THUMB : FINGERS.find((f) => f.id === id);
  const holder = isThumb ? [THUMB_ROT[0], -c * 0.55, THUMB_ROT[2]] : [0, 0, def.spread * (1 - c) * SPREAD];
  const angles = (isThumb ? THUMB_MAX : CURL_MAX).map((a) => a * c);
  const local = fingerChainFK(def, holder, angles, [0, 0, 0.004]);
  return localToWorld(local);
}

// For each finger, the smallest curl at which the tip touches the cup wall from outside
// (radial distance == R + tip radius) at a height inside the cup's wall.
export function solveGrasp(steps = 600) {
  const out = {};
  for (const id of ['index', 'middle', 'ring', 'pinky', 'thumb']) {
    const def = id === 'thumb' ? THUMB : FINGERS.find((f) => f.id === id);
    const target = CUP.R + TIP_R(def);
    let found = null, lastSafe = 0, minRadial = Infinity;
    for (let i = 0; i <= steps; i++) {
      const c = i / steps;
      const [x, y, z] = tipWorld(id, c);
      const radial = Math.hypot(x, z);
      minRadial = Math.min(minRadial, radial);
      if (radial <= target && y > 0.008 && y < CUP.H - 0.006) { found = c; break; }
      if (radial < target) break;   // about to enter the wall outside the usable height: stop here
      lastSafe = c;
    }
    // Unreachable fingers stop at the last curl that keeps the tip outside the wall.
    out[id] = { c: found ?? lastSafe, reached: found !== null, minRadial };
  }
  return out;
}
