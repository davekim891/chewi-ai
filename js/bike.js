// bike.js: procedural wireframe bicycle + the ten compiled action surfaces.
// Pure data. No DOM, no three.js import, so `node js/bike.test.mjs` can check it.
//
// Frame: bike faces +x, y is up, ground is y = 0. Units are metres.
// Line data is emitted as flat Float32Arrays of segments: [x1,y1,z1, x2,y2,z2, ...].

export const R_WHEEL = 0.34;
export const CRANK_LEN = 0.17;
export const PEDAL_Z = 0.10;
export const TUBE_R = 0.018;

export const J = {
  RA: [0.00, 0.34, 0], // rear axle
  FA: [1.05, 0.34, 0], // front axle
  BB: [0.42, 0.28, 0], // bottom bracket (crank axis)
  ST: [0.30, 0.78, 0], // seat cluster
  SD: [0.27, 0.86, 0], // saddle centre
  HTb: [0.93, 0.62, 0], // head tube, low
  HTt: [0.88, 0.80, 0], // head tube, high
  BAR: [0.90, 0.92, 0], // stem / bar centre
  GL: [0.90, 0.92, -0.28],
  GR: [0.90, 0.92, 0.28],
  FL: [1.05, 0.34, -0.05],
  FR: [1.05, 0.34, 0.05],
  RL: [0.00, 0.34, -0.05],
  RR: [0.00, 0.34, 0.05],
};

// ---- helpers ---------------------------------------------------------------

function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
function len(a) { return Math.hypot(a[0], a[1], a[2]); }
function norm(a) { const l = len(a) || 1; return scale(a, 1 / l); }
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function seg(out, a, b) { out.push(a[0], a[1], a[2], b[0], b[1], b[2]); }

// A tube is drawn as a 4-sided prism: four longitudinal edges around the axis.
function tube(out, a, b, r = TUBE_R) {
  const d = norm(sub(b, a));
  const ref = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = norm(cross(d, ref));
  const v = norm(cross(d, u));
  for (const [su, sv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const o = add(scale(u, su * r), scale(v, sv * r));
    seg(out, add(a, o), add(b, o));
  }
}

// Circle in the x/y plane at depth z.
function circleXY(out, cx, cy, z, r, n) {
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    seg(out, [cx + r * Math.cos(a0), cy + r * Math.sin(a0), z], [cx + r * Math.cos(a1), cy + r * Math.sin(a1), z]);
  }
}

// Ellipse in the x/z plane at height y.
function ellipseXZ(out, cx, y, cz, rx, rz, n) {
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    seg(out, [cx + rx * Math.cos(a0), y, cz + rz * Math.sin(a0)], [cx + rx * Math.cos(a1), y, cz + rz * Math.sin(a1)]);
  }
}

function wheel(out, cx, cy) {
  // tire: two circles at the tread edges
  circleXY(out, cx, cy, -0.018, R_WHEEL, 56);
  circleXY(out, cx, cy, 0.018, R_WHEEL, 56);
  // rim
  circleXY(out, cx, cy, -0.010, 0.30, 48);
  circleXY(out, cx, cy, 0.010, 0.30, 48);
  // hub flanges
  circleXY(out, cx, cy, -0.03, 0.035, 12);
  circleXY(out, cx, cy, 0.03, 0.035, 12);
  // spokes, alternating flanges
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const side = i % 2 ? 0.03 : -0.03;
    seg(out, [cx + 0.035 * Math.cos(a), cy + 0.035 * Math.sin(a), side], [cx + 0.30 * Math.cos(a), cy + 0.30 * Math.sin(a), side / 3]);
  }
}

// ---- builders --------------------------------------------------------------

// The frame's tubes, shared by the line builder (tests, static fallback) and the mesh builder (hero).
export const TUBES = [
  { part: 'rear_triangle', a: J.RL, b: [J.BB[0], J.BB[1], -0.05], r: 0.011 }, // chainstays
  { part: 'rear_triangle', a: J.RR, b: [J.BB[0], J.BB[1], 0.05], r: 0.011 },
  { part: 'rear_triangle', a: J.RL, b: J.ST, r: 0.010 },                      // seatstays
  { part: 'rear_triangle', a: J.RR, b: J.ST, r: 0.010 },
  { part: 'main_triangle', a: J.BB, b: J.ST, r: 0.017 },   // seat tube
  { part: 'main_triangle', a: J.BB, b: J.HTb, r: 0.020 },  // down tube
  { part: 'main_triangle', a: J.ST, b: J.HTt, r: 0.017 },  // top tube
  { part: 'head_tube', a: J.HTb, b: J.HTt, r: 0.022 },
  { part: 'fork', a: J.HTb, b: J.FL, r: 0.012 },
  { part: 'fork', a: J.HTb, b: J.FR, r: 0.012 },
  { part: 'seat_post', a: J.ST, b: J.SD, r: 0.012 },
  { part: 'stem', a: J.HTt, b: J.BAR, r: 0.012 },
  { part: 'bar_l', a: J.BAR, b: J.GL, r: 0.011 },
  { part: 'bar_r', a: J.BAR, b: J.GR, r: 0.011 },
];
// Joints that get a small sphere so tubes meet cleanly.
export const JOINT_BALLS = [['ST', 0.018], ['HTb', 0.023], ['HTt', 0.023], ['BB', 0.03], ['BAR', 0.013]];

export const WHEEL = { r: R_WHEEL, tire: 0.013, rim: 0.30, rimTube: 0.005, hub: 0.035, hubLen: 0.08 };

// Saddle outline in the x/z plane (metres, relative to the saddle centre): a teardrop, nose forward (+x).
export function saddleOutline(n = 36) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const u = (Math.cos(t) + 1) / 2;                 // 1 at the rear (-x side), 0 at the nose
    const x = -0.14 + 0.28 * (1 - u);
    const w = 0.075 * Math.sqrt(Math.max(0, 1 - (1 - u) ** 2.2)) * (0.3 + 0.7 * u);
    pts.push([x, Math.sin(t) >= 0 ? w : -w]);
  }
  return pts;
}

// Chain loop around the chainring (at the bottom bracket) and the rear cog, frame coordinates.
export function chainPath(n = 24) {
  const c1 = J.BB, r1 = 0.085, c2 = J.RA, r2 = 0.035, z = 0.036;
  const dx = c2[0] - c1[0], dy = c2[1] - c1[1];
  const L = Math.hypot(dx, dy), th = Math.atan2(dy, dx), al = Math.acos((r1 - r2) / L);
  const pts = [];
  const arc = (c, r, a0, a1, k) => { for (let i = 0; i <= k; i++) { const a = a0 + ((a1 - a0) * i) / k; pts.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a), z]); } };
  arc(c1, r1, th + al, th - al + Math.PI * 2, n);   // around the front of the chainring
  arc(c2, r2, th - al, th + al, Math.round(n / 3)); // around the back of the cog
  return pts;
}

// Named ranges into the frame buffer, so tests can check an anchor against the wire it labels.
export const FRAME_PARTS = {};

export function buildFrame() {
  const out = [];
  const ranges = {};
  const mark = (name) => { if (!ranges[name]) ranges[name] = [out.length, out.length]; };
  const done = (name) => { ranges[name][1] = out.length; };
  for (const t of TUBES) { mark(t.part); tube(out, t.a, t.b, Math.max(t.r, 0.010)); done(t.part); }
  const part = (name, fn) => { mark(name); fn(); done(name); };
  part('axle_f', () => { seg(out, J.FL, J.FR); });
  part('axle_r', () => { seg(out, J.RL, J.RR); });
  part('saddle', () => {
    const o = saddleOutline(28);
    for (let i = 0; i < o.length; i++) {
      const a = o[i], b = o[(i + 1) % o.length];
      seg(out, [J.SD[0] + a[0], J.SD[1], a[1]], [J.SD[0] + b[0], J.SD[1], b[1]]);
      seg(out, [J.SD[0] + a[0] * 0.9, J.SD[1] + 0.028, a[1] * 0.85], [J.SD[0] + b[0] * 0.9, J.SD[1] + 0.028, b[1] * 0.85]);
    }
  });
  part('wheel_r', () => { wheel(out, J.RA[0], J.RA[1]); });
  part('wheel_f', () => { wheel(out, J.FA[0], J.FA[1]); });
  Object.assign(FRAME_PARTS, ranges);
  return new Float32Array(out);
}

// Crank, in local coordinates with the bottom bracket at the origin.
export function buildCrank() {
  const out = [];
  seg(out, [0, 0, -0.05], [0, 0, 0.05]); // axle
  // arms, chainring
  tube(out, [0, 0, -0.05], [CRANK_LEN, 0, -PEDAL_Z], 0.010);
  tube(out, [-CRANK_LEN, 0, 0.05], [-CRANK_LEN, 0, PEDAL_Z], 0.010); // stub so the far arm reads
  tube(out, [0, 0, 0.05], [-CRANK_LEN, 0, PEDAL_Z], 0.010);
  circleXY(out, 0, 0, 0.035, 0.085, 32); // chainring
  circleXY(out, 0, 0, 0.0, 0.04, 16);    // bracket shell
  return new Float32Array(out);
}

// Pedal platform, in local coordinates with the pedal spindle at the origin.
export function buildPedal() {
  const out = [];
  const hx = 0.045, hz = 0.03;
  for (const y of [-0.008, 0.008]) {
    seg(out, [-hx, y, -hz], [hx, y, -hz]);
    seg(out, [hx, y, -hz], [hx, y, hz]);
    seg(out, [hx, y, hz], [-hx, y, hz]);
    seg(out, [-hx, y, hz], [-hx, y, -hz]);
  }
  return new Float32Array(out);
}

// Ground grid, 3 m square, centred under the bike.
export function buildGrid() {
  const out = [];
  const cx = 0.525, n = 12, s = 3.0;
  for (let i = 0; i <= n; i++) {
    const t = -s / 2 + (i / n) * s;
    seg(out, [cx + t, 0, -s / 2], [cx + t, 0, s / 2]);
    seg(out, [cx - s / 2, 0, t], [cx + s / 2, 0, t]);
  }
  return new Float32Array(out);
}

// ---- compiled action surfaces ---------------------------------------------
// joint: the canonical joint the surface is rigidly attached to (shown in the manifest).
// wire: the named wire part the anchor must sit on (a FRAME_PARTS key, or 'crank' / 'pedal').
// anchorRef: where the anchor is expected (parent-local), so a moved anchor fails the test.
// parent: 'frame' | 'crank' | 'pedalL' | 'pedalR' (pedal frames sit at the pedal spindles,
// counter-rotated so platforms stay level). anchor is in the parent's local frame.
// facing: 'signed' fades the far side (grips, pedals); 'always' stays visible.
// offset: label offset in CSS px from the projected anchor.

import { COLORS } from './colors.js';
export { COLORS };

const HEAD_AXIS = norm(sub(J.HTt, J.HTb));

export const PATCHES = [
  {
    id: 'tire_r', joint: 'B_Wheel', wire: 'wheel_r', anchorRef: [J.RA[0], 0.0, 0], kind: 'CONTACT', parent: 'frame',
    shape: { type: 'torusArc', radius: R_WHEEL, tube: 0.026, arc: 0.55 },
    position: [J.RA[0], J.RA[1], 0], rotation: [0, 0, -Math.PI / 2 - 0.275],
    anchor: [J.RA[0], 0.0, 0], normal: null, facing: 'always', offset: [-30, 46],
  },
  {
    id: 'tire_f', joint: 'F_Wheel', wire: 'wheel_f', anchorRef: [J.FA[0], 0.0, 0], kind: 'CONTACT', parent: 'frame',
    shape: { type: 'torusArc', radius: R_WHEEL, tube: 0.026, arc: 0.55 },
    position: [J.FA[0], J.FA[1], 0], rotation: [0, 0, -Math.PI / 2 - 0.275],
    anchor: [J.FA[0], 0.0, 0], normal: null, facing: 'always', offset: [30, 46],
  },
  {
    id: 'crank', joint: 'Crank', wire: 'crank', anchorRef: [J.BB[0], J.BB[1], 0], kind: 'ROTATION', parent: 'frame',
    shape: { type: 'ring', inner: 0.045, outer: 0.062 },
    position: [J.BB[0], J.BB[1], 0.0], rotation: [0, 0, 0],
    anchor: [J.BB[0], J.BB[1], 0], normal: null, facing: 'always', offset: [-70, 40],
  },
  {
    id: 'pedal_l', joint: 'L_Pedal_Base', wire: 'pedal', anchorRef: [0, 0.012, 0], kind: 'CONTACT', parent: 'pedalL',
    shape: { type: 'box', size: [0.09, 0.016, 0.06] },
    position: [0, 0.004, 0], rotation: [0, 0, 0],
    anchor: [0, 0.012, 0], normal: [0, 0, -1], facing: 'signed', offset: [56, 36],
  },
  {
    id: 'pedal_r', joint: 'R_Pedal_Base', wire: 'pedal', anchorRef: [0, 0.012, 0], kind: 'CONTACT', parent: 'pedalR',
    shape: { type: 'box', size: [0.09, 0.016, 0.06] },
    position: [0, 0.004, 0], rotation: [0, 0, 0],
    anchor: [0, 0.012, 0], normal: [0, 0, 1], facing: 'signed', offset: [56, 36],
  },
  {
    id: 'saddle', joint: 'M_Body', wire: 'saddle', anchorRef: [J.SD[0], J.SD[1] + 0.015, 0], kind: 'SUPPORT', parent: 'frame',
    shape: { type: 'saddle', depth: 0.014 },
    position: [J.SD[0], J.SD[1], 0], rotation: [0, 0, 0],
    anchor: [J.SD[0], J.SD[1] + 0.015, 0], normal: null, facing: 'always', offset: [-40, -60],
  },
  {
    id: 'grip_l', joint: 'L_Handle', wire: 'bar_l', anchorRef: [J.GL[0], J.GL[1], -0.22], kind: 'GRIP', parent: 'frame',
    shape: { type: 'cylinder', radius: 0.024, length: 0.12 },
    position: [J.GL[0], J.GL[1], -0.22], rotation: [Math.PI / 2, 0, 0],
    anchor: [J.GL[0], J.GL[1], -0.22], normal: [0, 0, -1], facing: 'signed', offset: [40, -56],
  },
  {
    id: 'grip_r', joint: 'R_Handle', wire: 'bar_r', anchorRef: [J.GR[0], J.GR[1], 0.22], kind: 'GRIP', parent: 'frame',
    shape: { type: 'cylinder', radius: 0.024, length: 0.12 },
    position: [J.GR[0], J.GR[1], 0.22], rotation: [Math.PI / 2, 0, 0],
    anchor: [J.GR[0], J.GR[1], 0.22], normal: [0, 0, 1], facing: 'signed', offset: [40, -56],
  },
  {
    id: 'hub_f', joint: 'F_Wheel', wire: 'axle_f', anchorRef: [J.FA[0], J.FA[1], 0], kind: 'ROTATION', parent: 'frame',
    shape: { type: 'ring', inner: 0.03, outer: 0.048 },
    position: [J.FA[0], J.FA[1], 0.0], rotation: [0, 0, 0],
    anchor: [J.FA[0], J.FA[1], 0], normal: null, facing: 'always', offset: [64, 10],
  },
  {
    id: 'headset', joint: 'Head', wire: 'head_tube', anchorRef: [J.HTt[0], J.HTt[1], 0], kind: 'HINGE', parent: 'frame',
    shape: { type: 'ring', inner: 0.028, outer: 0.044, axis: HEAD_AXIS },
    position: [J.HTt[0], J.HTt[1], 0], rotation: null,
    anchor: [J.HTt[0], J.HTt[1], 0], normal: null, facing: 'always', offset: [70, -30],
  },
];

// Order in which patches reveal on first paint.
export const REVEAL_ORDER = ['tire_r', 'tire_f', 'crank', 'pedal_l', 'pedal_r', 'saddle', 'grip_l', 'grip_r', 'hub_f', 'headset'];

// Where the moving parents sit at crank angle theta (radians), for tests and for hero.js.
export function pedalOffsets(theta = 0) {
  return {
    pedalL: [CRANK_LEN * Math.cos(theta), CRANK_LEN * Math.sin(theta), -PEDAL_Z],
    pedalR: [-CRANK_LEN * Math.cos(theta), -CRANK_LEN * Math.sin(theta), PEDAL_Z],
  };
}
