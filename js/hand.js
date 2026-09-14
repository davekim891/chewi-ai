// hand.js: a procedural right hand for the hologram scenes. Pure data plus a rig builder.
// Local frame: palm centre near the origin, fingers point +y, palm faces +z, thumb on the -x side.
// Units are metres. `node js/hand.test.mjs` checks the data without a browser.

export const FINGERS = [
  { id: 'index',  base: [-0.024, 0.047, 0], segs: [0.042, 0.027, 0.022], r: 0.0085, spread: -0.10 },
  { id: 'middle', base: [-0.002, 0.052, 0], segs: [0.047, 0.030, 0.024], r: 0.0088, spread: -0.02 },
  { id: 'ring',   base: [ 0.020, 0.049, 0], segs: [0.043, 0.028, 0.022], r: 0.0082, spread:  0.06 },
  { id: 'pinky',  base: [ 0.040, 0.041, 0], segs: [0.033, 0.022, 0.018], r: 0.0072, spread:  0.16 },
];
export const THUMB = { id: 'thumb', base: [-0.043, 0.006, 0.010], segs: [0.040, 0.032], r: 0.0100 };
// Fist angles per joint (MCP, PIP, DIP) in radians; the curl parameter c in [0,1] scales them.
export const CURL_MAX = [1.35, 1.65, 1.00];
export const THUMB_MAX = [0.55, 1.05];
export const PALM = { w: 0.086, h: 0.092, t: 0.021, center: [0.008, 0.002, 0] };
export const WRIST = { r: 0.030, len: 0.06, y: -0.078 };

export const THUMB_ROT_DEFAULT = [0.35, 0, 0.95];

// ---- pure forward kinematics (matches three.js Euler XYZ and the group hierarchy in buildHand) ----
function rotX(a) { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; }
function rotY(a) { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; }
function rotZ(a) { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; }
function mul(A, B) { const o = new Array(9); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c]; return o; }
function apply(M, v) { return [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]]; }
const eulerXYZ = ([x, y, z]) => mul(mul(rotX(x), rotY(y)), rotZ(z));

// Hand-local position of a point `tipOffset` in the last segment's frame, for a finger definition,
// holder Euler [x,y,z] and per-segment curl angles (radians about the segment's local x).
export function fingerChainFK(def, holderEuler, angles, tipOffset = [0, 0, 0]) {
  let R = eulerXYZ(holderEuler);
  let p = [...def.base];
  let prevLen = 0;
  for (let i = 0; i < def.segs.length; i++) {
    p = p.map((v, k) => v + apply(R, [0, prevLen, 0])[k]);
    R = mul(R, rotX(angles[i] || 0));
    prevLen = def.segs[i];
  }
  const last = [tipOffset[0], prevLen + tipOffset[1], tipOffset[2]];
  return p.map((v, k) => v + apply(R, last)[k]);
}

// Rounded-rectangle outline in the x/y plane, used for the palm body and the palm patch.
export function roundedRect(w, h, r, n = 6) {
  const pts = [];
  const cx = [w / 2 - r, -w / 2 + r, -w / 2 + r, w / 2 - r], cy = [h / 2 - r, h / 2 - r, -h / 2 + r, -h / 2 + r];
  for (let k = 0; k < 4; k++) for (let i = 0; i <= n; i++) { const a = (k * Math.PI) / 2 + (i / n) * (Math.PI / 2); pts.push([cx[k] + r * Math.cos(a), cy[k] + r * Math.sin(a)]); }
  return pts;
}

// Builds the rig. Returns { hand, fingers: {id: {groups, tip}}, thumb, setCurl(c, spreadAmount) }.
export function buildHand(ctx, mat, opts = {}) {
  const thumbRot = opts.thumbRot || THUMB_ROT_DEFAULT;
  const { THREE } = ctx;
  const hand = new THREE.Group();
  const jointMat = opts.jointMat || mat;

  // palm: extruded rounded rect, slightly narrower at the wrist
  {
    const shape = new THREE.Shape(roundedRect(PALM.w, PALM.h, 0.022).map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: PALM.t, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 3, curveSegments: 10 });
    g.translate(0, 0, -PALM.t / 2);
    const palm = new THREE.Mesh(g, mat);
    palm.position.set(...PALM.center);
    hand.add(palm);
  }
  // wrist
  {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(WRIST.r, WRIST.r * 1.05, WRIST.len, 20, 1, true), mat);
    w.position.set(0.004, WRIST.y, 0);
    hand.add(w);
  }

  const capsule = (len, r) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 14), mat); m.position.y = len / 2; return m; };
  const ball = (r) => new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), jointMat);

  const chain = (def, parent) => {
    const groups = [];
    let holder = new THREE.Group(); holder.position.set(...def.base); parent.add(holder);
    let prevLen = 0, host = holder;
    def.segs.forEach((len, i) => {
      const g = new THREE.Group(); g.position.y = prevLen; host.add(g);
      g.add(ball(def.r * 0.88), capsule(len, def.r * (1 - i * 0.07)));
      groups.push(g); host = g; prevLen = len;
    });
    const tipBall = ball(def.r * 0.8); tipBall.position.y = prevLen; host.add(tipBall);
    return { holder, groups, tipLen: prevLen };
  };

  const fingers = {};
  for (const f of FINGERS) fingers[f.id] = { def: f, ...chain(f, hand) };
  const thumb = { def: THUMB, ...chain(THUMB, hand) };
  thumb.holder.rotation.set(thumbRot[0], thumbRot[1], thumbRot[2]); // points diagonally out from the palm

  // pose: { index, middle, ring, pinky, thumb } curls in [0,1], plus spread amount.
  function setPose(pose, spread = 1) {
    for (const f of FINGERS) {
      const F = fingers[f.id], c = pose[f.id] ?? 0;
      F.groups.forEach((g, i) => { g.rotation.x = c * CURL_MAX[i]; });
      F.holder.rotation.z = f.spread * (1 - c) * spread;
    }
    const ct = pose.thumb ?? 0;
    thumb.groups.forEach((g, i) => { g.rotation.x = ct * THUMB_MAX[i]; });
    thumb.holder.rotation.y = -ct * 0.55; // sweeps across the palm as it closes
  }
  function setCurl(c, spread = 1) { setPose({ index: c, middle: c, ring: c, pinky: c, thumb: c }, spread); }
  setCurl(0);
  return { hand, fingers, thumb, setCurl, setPose };
}
