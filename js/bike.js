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

// Named ranges into the frame buffer, so tests can check an anchor against the wire it labels.
export const FRAME_PARTS = {};

export function buildFrame() {
  const out = [];
  const part = (name, fn) => { const a = out.length; fn(); FRAME_PARTS[name] = [a, out.length]; };
  part('rear_triangle', () => {
    tube(out, J.RL, [J.BB[0], J.BB[1], -0.05]); // chainstays
    tube(out, J.RR, [J.BB[0], J.BB[1], 0.05]);
    tube(out, J.RL, J.ST);                      // seatstays
    tube(out, J.RR, J.ST);
  });
  part('main_triangle', () => {
    tube(out, J.BB, J.ST);   // seat tube
    tube(out, J.BB, J.HTb);  // down tube
    tube(out, J.ST, J.HTt);  // top tube
  });
  part('head_tube', () => { tube(out, J.HTb, J.HTt, 0.022); });
  part('fork', () => { tube(out, J.HTb, J.FL, 0.014); tube(out, J.HTb, J.FR, 0.014); });
  part('axle_f', () => { seg(out, J.FL, J.FR); });
  part('axle_r', () => { seg(out, J.RL, J.RR); });
  part('seat_post', () => { tube(out, J.ST, J.SD, 0.012); });
  part('saddle', () => {
    ellipseXZ(out, J.SD[0], J.SD[1], 0, 0.14, 0.07, 28);
    ellipseXZ(out, J.SD[0], J.SD[1] + 0.025, 0, 0.12, 0.055, 28);
  });
  part('stem', () => { tube(out, J.HTt, J.BAR, 0.012); });
  part('bar_l', () => { tube(out, J.BAR, J.GL, 0.012); });
  part('bar_r', () => { tube(out, J.BAR, J.GR, 0.012); });
  part('wheel_r', () => { wheel(out, J.RA[0], J.RA[1]); });
  part('wheel_f', () => { wheel(out, J.FA[0], J.FA[1]); });
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

export const COLORS = {
  CONTACT: '#4ade80',
  GRIP: '#38d6e0',
  SUPPORT: '#a78bfa',
  ROTATION: '#f5b544',
  HINGE: '#f5b544',
};

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
    shape: { type: 'disc', radius: 0.042 },
    position: [0, 0.012, 0], rotation: [-Math.PI / 2, 0, 0],
    anchor: [0, 0.012, 0], normal: [0, 0, -1], facing: 'signed', offset: [56, 36],
  },
  {
    id: 'pedal_r', joint: 'R_Pedal_Base', wire: 'pedal', anchorRef: [0, 0.012, 0], kind: 'CONTACT', parent: 'pedalR',
    shape: { type: 'disc', radius: 0.042 },
    position: [0, 0.012, 0], rotation: [-Math.PI / 2, 0, 0],
    anchor: [0, 0.012, 0], normal: [0, 0, 1], facing: 'signed', offset: [56, 36],
  },
  {
    id: 'saddle', joint: 'M_Body', wire: 'saddle', anchorRef: [J.SD[0], J.SD[1] + 0.015, 0], kind: 'SUPPORT', parent: 'frame',
    shape: { type: 'sphere', radius: 0.13, scale: [1, 0.22, 0.55] },
    position: [J.SD[0], J.SD[1] + 0.02, 0], rotation: [0, 0, 0],
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
