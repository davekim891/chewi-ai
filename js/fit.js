// fit.js: smallest orbit-camera radius that keeps a world-space point set inside the
// stage inset by a margin, at every sampled azimuth and listed elevation.
// Pure math on plain arrays — no three.js. Used by holo.js; checked by js/fit.test.mjs.
//
// Camera is the same as the render loop: position = target + R * dir(az, el),
// dir = (cos el sin az, sin el, cos el cos az), lookAt target, vertical fov, aspect w/h.
// After lookAt, camera +Z is dir, +X is normalize((0,1,0) × dir), +Y = dir × +X.
// A world point P then has camera-space (x, y) independent of R and z = dir·(P−T) − R.
// Perspective NDC is x / (aspect * tan(fov/2) * (R − along)) and y / (tan(fov/2) * (R − along)),
// so the R that lands a point on a margin edge is linear: R = along + |lateral| / (limit * scale).

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

export function projectCorner(corner, target, radius, az, el, fov, aspect) {
  const { dir, right, up } = cameraBasis(az, el);
  const ox = corner[0] - target[0], oy = corner[1] - target[1], oz = corner[2] - target[2];
  const cx = right[0] * ox + right[1] * oy + right[2] * oz;
  const cy = up[0] * ox + up[1] * oy + up[2] * oz;
  const cz = dir[0] * ox + dir[1] * oy + dir[2] * oz - radius;
  const tanHalf = Math.tan((fov * DEG) / 2);
  const depth = -cz;
  const ndcX = depth > 1e-12 ? cx / (aspect * tanHalf * depth) : (cx >= 0 ? Infinity : -Infinity);
  const ndcY = depth > 1e-12 ? cy / (tanHalf * depth) : (cy >= 0 ? Infinity : -Infinity);
  return { ndc: [ndcX, ndcY], cam: [cx, cy, cz] };
}

// Nested [x,y,z][] or a flat xyzxyz Float32Array / number[]. One allocation if nested.
function asFlat(points) {
  if (points instanceof Float32Array) return points;
  if (typeof points[0] === 'number') return points;
  const n = points.length;
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const p = points[i];
    out[i * 3] = p[0]; out[i * 3 + 1] = p[1]; out[i * 3 + 2] = p[2];
  }
  return out;
}

export function fitRadius({ points, target, fov, aspect, azSamples, els, margin, minRadius }) {
  const xyz = asFlat(points);
  const nPts = (xyz.length / 3) | 0;
  const n = azSamples | 0;
  const limit = 1 - 2 * margin;
  const tanHalf = Math.tan((fov * DEG) / 2);
  const invH = 1 / (limit * aspect * tanHalf);
  const invV = 1 / (limit * tanHalf);
  const tx = target[0], ty = target[1], tz = target[2];
  let R = minRadius;
  for (let i = 0; i < n; i++) {
    const az = (2 * Math.PI * i) / n;
    const ca = Math.cos(az), sa = Math.sin(az);
    for (let e = 0; e < els.length; e++) {
      const el = els[e];
      const ce = Math.cos(el), se = Math.sin(el);
      const dx = ce * sa, dy = se, dz = ce * ca;
      let rx = dz, rz = -dx;
      const rlen = Math.hypot(rx, rz);
      if (rlen < 1e-8) { rx = ca; rz = -sa; } else { rx /= rlen; rz /= rlen; }
      const ux = dy * rz, uy = dz * rx - dx * rz, uz = -dy * rx;
      for (let p = 0, o = 0; p < nPts; p++, o += 3) {
        const px = xyz[o] - tx, py = xyz[o + 1] - ty, pz = xyz[o + 2] - tz;
        const cx = rx * px + rz * pz;
        const cy = ux * px + uy * py + uz * pz;
        const along = dx * px + dy * py + dz * pz;
        const r = along + Math.max(Math.abs(cx) * invH, Math.abs(cy) * invV, 0);
        if (r > R) R = r;
      }
    }
  }
  return R;
}
