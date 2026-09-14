// scenes.js: the two hand scenes (a hand opening from a fist; a hand grasping a cup), on the shared engine.
import { createScene } from './holo.js';
import { buildHand, roundedRect } from './hand.js';
import { CUP, HAND_MATRIX, HAND_POS, THUMB_ROT, SPREAD, OPEN_CURL, TIP_R, solveGrasp } from './grasp-layout.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

const HAND_COLOR = 0x7cc0ff;

function handPatches(ctx, rig, root, opts) {
  const { THREE } = ctx;
  const tip = (id) => {
    const f = id === 'thumb' ? rig.thumb : rig.fingers[id];
    const last = f.groups[f.groups.length - 1];
    return { id: `tip_${id}`, kind: 'CONTACT', parentObj: last, shape: { type: 'sphere', radius: f.def.r * 1.05 }, position: [0, f.tipLen - 0.002, 0.002], anchor: [0, f.tipLen, 0.004], facing: 'always', offset: opts.tipOffset[id] || [30, -40], engage: opts.tipEngage };
  };
  const knuckle = (id) => {
    const f = rig.fingers[id];
    return { id: `knuckle_${id}`, kind: 'ROTATION', parentObj: f.holder, shape: { type: 'ring', inner: f.def.r * 1.15, outer: f.def.r * 1.6, axis: [1, 0, 0] }, position: [0, 0, 0], anchor: [0, 0, 0], facing: 'always', offset: opts.knuckleOffset[id] || [-30, 30] };
  };
  const palm = {
    id: 'palm', kind: 'SUPPORT', parentObj: root,
    shape: { type: 'custom', geometry: (T) => { const s = new T.Shape(roundedRect(0.052, 0.046, 0.014).map(([x, y]) => new T.Vector2(x, y))); const g = new T.ExtrudeGeometry(s, { depth: 0.004, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.003, bevelSegments: 2, curveSegments: 8 }); return g; } },
    position: [0.006, 0.0, 0.015], anchor: [0.006, 0.0, 0.02], facing: 'signed', normal: [0, 0, 1], offset: opts.palmOffset || [-40, 40], engage: opts.palmEngage,
  };
  const wrist = { id: 'wrist', kind: 'ROTATION', parentObj: root, shape: { type: 'ring', inner: 0.031, outer: 0.037, axis: [0, 1, 0] }, position: [0.004, -0.058, 0], anchor: [0.004, -0.058, 0.03], facing: 'always', offset: opts.wristOffset || [40, 20] };
  return { tip, knuckle, palm, wrist };
}

// ---- Scene 1: a hand opening from a fist ------------------------------------
const handRoot = document.querySelector('[data-scene="hand"]');
if (handRoot) createScene({
  root: handRoot, name: 'hand',
  camera: { target: [0.0, 0.04, 0], radius: 0.52, fov: 30, az0: 0.35, el0: 0.2, orbitPeriod: 48, bobPeriod: 11, bobAmp: 0.05, elMin: -0.1, elMax: 0.6 },
  staticT: 48,
  reveal: { start: 0.8, step: 0.5, dur: 0.45 },
  build(ctx) {
    const { THREE, scene, holo, grid } = ctx;
    const mat = holo(HAND_COLOR, 0.11, 2.2, 1.1);
    const rig = buildHand(ctx, mat, { jointMat: holo(0x9fd3ff, 0.14, 2.0, 1.0) });
    rig.hand.position.set(0, 0.0, 0);
    scene.add(rig.hand);
    const floor = new THREE.Group(); floor.position.y = -0.16; grid(floor, 0, 0, 1.2, 12, 0x4da3ff, 0.06); scene.add(floor);

    let curl = 1;
    const P = handPatches(ctx, rig, rig.hand, {
      tipOffset: { thumb: [-60, 10], index: [-30, -50], middle: [10, -56], ring: [40, -46] },
      knuckleOffset: { index: [-70, 20], middle: [50, -30], ring: [60, 10] },
      palmOffset: [-60, 50], wristOffset: [50, 26],
      tipEngage: () => 1, palmEngage: () => 1,
    });
    const patches = [P.tip('index'), P.tip('middle'), P.tip('thumb'), P.knuckle('index'), P.knuckle('middle'), P.knuckle('ring'), P.palm, P.wrist].map((p, i) => ({ ...p, order: i }));
    return {
      patches,
      animate(t) {
        // closed at t=0, opens over ~1.6 s, then breathes between open and half-closed
        const open = smooth(0.4, 2.0, t);
        const breathe = 0.5 - 0.5 * Math.cos((2 * Math.PI * (t - 2.0)) / 9.2);
        curl = (1 - open) + open * (0.05 + 0.45 * (t > 2 ? breathe : 0));
        rig.setCurl(curl);
      },
    };
  },
});

// ---- Scene 2: a hand grasping a cup ------------------------------------------
// Layout and finger curls come from grasp-layout.js, which js/grasp.test.mjs checks with the same math.
const graspRoot = document.querySelector('[data-scene="grasp"]');
if (graspRoot) createScene({
  root: graspRoot, name: 'grasp',
  camera: { target: [-0.02, 0.055, 0.0], radius: 0.5, fov: 30, az0: 0.7, el0: 0.3, orbitPeriod: 48, bobPeriod: 11, bobAmp: 0.05, elMin: 0.0, elMax: 0.6 },
  staticT: 48,
  reveal: { start: 0.8, step: 0.5, dur: 0.45 },
  build(ctx) {
    const { THREE, scene, holo, grid, groundGlow } = ctx;
    const mat = holo(HAND_COLOR, 0.11, 2.2, 1.1);
    const cupMat = holo(0x9fd3ff, 0.10, 2.2, 1.0);
    grid(scene, 0, 0, 1.2, 12, 0x4da3ff, 0.06);

    // cup: open cylinder with a base and a handle, standing on the floor (y=0), axis +y, at the origin
    const cup = new THREE.Group();
    const { R, H } = CUP;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.92, H, 40, 1, true), holo(0x9fd3ff, 0.10, 2.2, 1.0, THREE.DoubleSide)); body.position.y = H / 2; cup.add(body);
    const base = new THREE.Mesh(new THREE.CircleGeometry(R * 0.92, 40), cupMat); base.rotation.x = -Math.PI / 2; base.position.y = 0.004; cup.add(base);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.0035, 8, 48), cupMat); rim.rotation.x = Math.PI / 2; rim.position.y = H; cup.add(rim);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.006, 10, 32, Math.PI), cupMat); handle.position.set(R + 0.004, H * 0.52, 0); handle.rotation.z = -Math.PI / 2; cup.add(handle);
    scene.add(cup);
    const glow = groundGlow(scene, 0, 0, '74,222,128', 0.26, 0.26);

    // the hand: left side of the cup, palm toward it, fingers wrapping the back, thumb wrapping the front
    const rig = buildHand(ctx, mat, { jointMat: holo(0x9fd3ff, 0.14, 2.0, 1.0), thumbRot: THUMB_ROT });
    const m = HAND_MATRIX;
    rig.hand.quaternion.setFromRotationMatrix(new THREE.Matrix4().set(m[0], m[3], m[6], 0, m[1], m[4], m[7], 0, m[2], m[5], m[8], 0, 0, 0, 0, 1));
    rig.hand.position.set(...HAND_POS);
    scene.add(rig.hand);

    const fit = solveGrasp();
    let c = 0;
    const engageTips = () => smooth(0.55, 0.85, c);
    const P = handPatches(ctx, rig, rig.hand, {
      tipOffset: { index: [40, -30], middle: [44, 0], ring: [44, 30], thumb: [-50, -50] },
      knuckleOffset: { index: [-60, -40], middle: [-60, 10], ring: [-60, 30] },
      palmOffset: [-60, 40], wristOffset: [-40, 50],
      tipEngage: engageTips, palmEngage: () => 0.4 + 0.6 * c,
    });
    const cupGrip = { id: 'cup_body', kind: 'GRIP', parentObj: cup, shape: { type: 'cylinder', radius: R + 0.003, length: 0.05 }, position: [0, H * 0.5, 0], anchor: [0, H * 0.5, R + 0.003], facing: 'always', offset: [40, -20], engage: engageTips };
    const cupHandle = { id: 'cup_handle', kind: 'GRIP', parentObj: cup, shape: { type: 'torusArc', radius: 0.026, tube: 0.009, arc: Math.PI }, position: [R + 0.004, H * 0.52, 0], rotation: [0, 0, -Math.PI / 2], anchor: [R + 0.03, H * 0.52, 0], facing: 'always', offset: [50, -10] };
    const cupBase = { id: 'cup_base', kind: 'CONTACT', parentObj: cup, shape: { type: 'ring', inner: R * 0.8, outer: R * 0.98, axis: [0, 1, 0] }, position: [0, 0.003, 0], anchor: [0, 0.0, R * 0.9], facing: 'always', offset: [30, 40], onUpdate: (ease, pulse) => { glow.glow.material.opacity = ease * (0.7 + pulse); glow.ring.material.opacity = ease * (0.8 + pulse); } };
    const patches = [cupBase, cupGrip, cupHandle, P.tip('index'), P.tip('middle'), P.tip('thumb'), P.palm, P.knuckle('index'), P.wrist].map((p, i) => ({ ...p, order: i }));

    const pose = {};
    return {
      patches,
      animate(t) {
        // approach and close, hold, release: 8 s cycle, starting closed
        const ph = ((t + 4) % 8) / 8;
        c = ph < 0.35 ? smooth(0.05, 0.35, ph) : ph < 0.7 ? 1 : 1 - smooth(0.7, 0.92, ph);
        for (const id of ['index', 'middle', 'ring', 'pinky', 'thumb']) pose[id] = OPEN_CURL + (fit[id].c - OPEN_CURL) * c;
        rig.setPose(pose, SPREAD);
        rig.hand.position.x = HAND_POS[0] - 0.035 * (1 - c);
      },
    };
  },
});
