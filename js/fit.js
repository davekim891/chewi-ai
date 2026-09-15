// fit.js: smallest orbit-camera radius that keeps world-space corners inside the
// stage inset by a margin, at every sampled azimuth and listed elevation.
// Pure math on plain arrays — no three.js. Used by holo.js; checked by js/fit.test.mjs.
//
// Camera is the same as the render loop: position = target + R * dir(az, el),
// dir = (cos el sin az, sin el, cos el cos az), lookAt target, vertical fov, aspect w/h.
// After lookAt, camera +Z is dir, +X is normalize((0,1,0) × dir), +Y = dir × +X.
// A world point P then has camera-space (x, y) independent of R and z = dir·(P−T) − R.
// Perspective NDC is x / (aspect * tan(fov/2) * (R − along)) and y / (tan(fov/2) * (R − along)),
// so the R that lands a corner on a margin edge is linear: R = along + |lateral| / (limit * scale).

const DEG = Math.PI / 180;

function cameraBasis(az, el) {
  const ce = Math.cos(el), se = Math.sin(el);
  const ca = Math.cos(az), sa = Math.sin(az);
  const dir = [ce * sa, se, ce * ca];
  // right = normalize(world-up × dir). Length is |cos el|; el in the hero range is well away from ±π/2.
  let rx = dir[2], ry = 0, rz = -dir[0];
  const rlen = Math.hypot(rx, ry, rz);
  if (rlen < 1e-8) { rx = ca; rz = -sa; } else { rx /= rlen; rz /= rlen; }
  const right = [rx, ry, rz];
  const up = [
    dir[1] * right[2] - dir[2] * right[1],
    dir[2] * right[0] - dir[0] * right[2],
    dir[0] * right[1] - dir[1] * right[0],
  ];
  return { dir, right, up };
}

function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }

export function projectCorner(corner, target, radius, az, el, fov, aspect) {
  const { dir, right, up } = cameraBasis(az, el);
  const offset = sub(corner, target);
  const cx = dot(right, offset);
  const cy = dot(up, offset);
  const cz = dot(dir, offset) - radius;
  const tanHalf = Math.tan((fov * DEG) / 2);
  const depth = -cz;
  const ndcX = depth > 1e-12 ? cx / (aspect * tanHalf * depth) : (cx >= 0 ? Infinity : -Infinity);
  const ndcY = depth > 1e-12 ? cy / (tanHalf * depth) : (cy >= 0 ? Infinity : -Infinity);
  return { ndc: [ndcX, ndcY], cam: [cx, cy, cz] };
}

function requiredRadius(corner, target, az, el, fov, aspect, limit) {
  const { dir, right, up } = cameraBasis(az, el);
  const offset = sub(corner, target);
  const cx = dot(right, offset);
  const cy = dot(up, offset);
  const along = dot(dir, offset);
  const tanHalf = Math.tan((fov * DEG) / 2);
  const horiz = Math.abs(cx) / (limit * aspect * tanHalf);
  const vert = Math.abs(cy) / (limit * tanHalf);
  return along + Math.max(horiz, vert, 0);
}

export function fitRadius({ corners, target, fov, aspect, azSamples, els, margin, minRadius }) {
  const n = azSamples | 0;
  const limit = 1 - 2 * margin;
  let R = minRadius;
  for (let i = 0; i < n; i++) {
    const az = (2 * Math.PI * i) / n;
    for (const el of els) {
      for (const c of corners) {
        const r = requiredRadius(c, target, az, el, fov, aspect, limit);
        if (r > R) R = r;
      }
    }
  }
  return R;
}
