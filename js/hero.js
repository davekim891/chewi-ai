// hero.js: live wireframe bicycle with its compiled action surfaces.
// Loads three.js from the import map (jsdelivr, pinned). Falls back to a static image when
// WebGL or the CDN is unavailable. Exposes window.__chewiHero for headless verification.

import { buildFrame, buildCrank, buildPedal, buildGrid, PATCHES, REVEAL_ORDER, COLORS, J, pedalOffsets, TUBES, JOINT_BALLS, WHEEL, saddleOutline, chainPath } from './bike.js';

const REDUCED_MQ = matchMedia('(prefers-reduced-motion: reduce)');
const COARSE_MQ = matchMedia('(pointer: coarse)');
// Test flag: window.__chewiForceReduced = true before load behaves as prefers-reduced-motion.
const reducedMotion = () => REDUCED_MQ.matches || !!window.__chewiForceReduced;

const root = document.querySelector('[data-hero]');
const stage = root.querySelector('.hero-stage');
const canvas = root.querySelector('canvas');
const tagLayer = root.querySelector('.hero-tags');
const svg = root.querySelector('.hero-leaders');
const fallbackEl = root.querySelector('.hero-fallback');

const SVG_NS = 'http://www.w3.org/2000/svg';
const ORBIT_PERIOD = 40;   // s per revolution
const BOB_PERIOD = 13;     // s
const AZ0 = 0.38;          // starting azimuth: drive side, slightly from the front, like the reference render
const STATIC_T = 40;       // one full orbit, so the static views sit at AZ0 with the reveal complete
const EL0 = 0.35;          // base elevation (rad)
const RADIUS = 2.6;
const FOV = 34;
const REVEAL_START = 0.6;  // s before the first patch appears
const REVEAL_STEP = 0.6;   // s between patches
const REVEAL_DUR = 0.45;   // s per patch fade
const PATCH_BASE = 0.55;

const state = {
  ready: false, mode: 'loading', error: null,
  fps: 0, frames: 0, pixelRatio: 1, revealed: 0, running: false, t: 0, labels: [],
};

let THREE, renderer, scene, camera, bike, crank, pedalL, pedalR;
let entries = [], lineMats = [];
let size = { w: 1, h: 1 };
let last = 0, yaw = 0, pitch = 0, yawT = 0, pitchT = 0;
let visible = true, lowFpsSince = 0, dprDropped = false, lostTimer = 0;
let dragging = false, interacted = false, dragYaw = 0, dragPitch = 0, dragVelYaw = 0, dragVelPitch = 0;
let lastPX = 0, lastPY = 0, lastPT = 0, hovered = null, raycaster, ndc, activePointer = null;
const hint = root.querySelector('.hero-hint');
let TARGET, vTmp, nTmp, dTmp;

function setMode(m) {
  state.mode = m;
  document.documentElement.dataset.heroState = m;
  root.dataset.mode = m;
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function smoothstep(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
function withTimeout(p, ms, label) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(label + ' timed out')), ms))]);
}
function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

function fallback(reason) {
  state.error = String((reason && reason.message) || reason);
  state.ready = true;
  state.running = false;
  if (renderer) { try { renderer.setAnimationLoop(null); } catch {} }
  setMode('fallback');
  canvas.hidden = true;
  tagLayer.hidden = true;
  svg.hidden = true;
  fallbackEl.hidden = false;
}

// ---- boot ------------------------------------------------------------------

async function boot() {
  if (window.__chewiForceNoWebGL || !hasWebGL()) return fallback('webgl unavailable');
  let mods;
  try {
    // ?cdnfail=1 imports a version that does not exist, to exercise the CDN-failure path.
    const threeSpec = window.__chewiForceCdnFail ? 'https://cdn.jsdelivr.net/npm/three@0.0.0-does-not-exist/build/three.module.js' : 'three';
    mods = await withTimeout(Promise.all([
      import(threeSpec),
      import('three/addons/lines/LineSegments2.js'),
      import('three/addons/lines/LineMaterial.js'),
      import('three/addons/lines/LineSegmentsGeometry.js'),
    ]), 6000, 'three.js load');
  } catch (e) { return fallback(e); }
  try {
    init(mods[0], mods[1].LineSegments2, mods[2].LineMaterial, mods[3].LineSegmentsGeometry);
  } catch (e) { return fallback(e); }
}

function init(three, LineSegments2, LineMaterial, LineSegmentsGeometry) {
  THREE = three;
  TARGET = new THREE.Vector3(0.52, 0.42, 0);
  vTmp = new THREE.Vector3(); nTmp = new THREE.Vector3(); dTmp = new THREE.Vector3();

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  state.pixelRatio = dpr;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 30);

  const frameArr = buildFrame(), crankArr = buildCrank(), pedalArr = buildPedal();

  // Line layer: a faint wire over the hologram bodies, so the mesh still reads as data.
  const core = { color: 0xcfe9ff, width: 1.0, opacity: 0.28, blending: THREE.AdditiveBlending };
  const halo = { color: 0x3a9bff, width: 9.0, opacity: 0.075, blending: THREE.AdditiveBlending };
  const thin = { color: 0xbfe0ff, width: 1.0, opacity: 0.55, blending: THREE.AdditiveBlending };

  // Hologram: bright at grazing angles, faint face-on, additive. The look of the reference render.
  const holo = (hex, base = 0.08, power = 2.4, opacity = 1.0, side = THREE.FrontSide) => new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(hex) }, uBase: { value: base }, uPower: { value: power }, uOpacity: { value: opacity } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main() { vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uBase; uniform float uPower; uniform float uOpacity; varying vec3 vN; varying vec3 vV;
      void main() { float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPower); float a = (uBase + (1.0 - uBase) * f) * uOpacity;
        vec3 c = mix(uColor, vec3(1.0), f * 0.5); gl_FragColor = vec4(c * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side,
  });
  const frameMat = holo(0x7cc0ff, 0.13, 2.0, 1.15);
  const Y = new THREE.Vector3(0, 1, 0);
  const tubeMesh = (a, b, r, mat = frameMat) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 18, 1, false), mat);
    m.position.copy(A).add(B).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(Y, d.normalize());
    return m;
  };
  const bodies = new THREE.Group();
  for (const t of TUBES) bodies.add(tubeMesh(t.a, t.b, t.r));
  for (const [j, r] of JOINT_BALLS) { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), frameMat); s.position.set(...J[j]); bodies.add(s); }
  for (const axle of [J.RA, J.FA]) {
    const tire = new THREE.Mesh(new THREE.TorusGeometry(WHEEL.r - WHEEL.tire, WHEEL.tire, 10, 72), frameMat); tire.position.set(...axle); bodies.add(tire);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(WHEEL.rim, WHEEL.rimTube, 8, 64), frameMat); rim.position.set(...axle); bodies.add(rim);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL.hub, WHEEL.hub, WHEEL.hubLen, 16), frameMat); hub.position.set(...axle); hub.rotation.x = Math.PI / 2; bodies.add(hub);
  }
  { // chain + rear cog
    const pts = chainPath().map((p) => new THREE.Vector3(...p));
    const chain = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 160, 0.005, 6, true), holo(0x8fc8ff, 0.12, 2.0, 0.9));
    bodies.add(chain);
    const cog = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.005, 6, 32), frameMat); cog.position.set(J.RA[0], J.RA[1], 0.036); bodies.add(cog);
  }
  { // head tube collar at the bottom, to match the top one carried by the headset patch
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 8, 32), holo(COLORS.HINGE, 0.35, 1.6, 0.9));
    collar.position.set(...J.HTb);
    collar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(J.HTt[0] - J.HTb[0], J.HTt[1] - J.HTb[1], 0).normalize());
    bodies.add(collar);
  }

  function lines(arr, o) {
    const g = new LineSegmentsGeometry().setPositions(arr);
    const m = new LineMaterial({
      color: o.color, linewidth: o.width, transparent: true, opacity: o.opacity,
      depthWrite: false, blending: o.blending, worldUnits: false,
    });
    lineMats.push(m);
    return new LineSegments2(g, m);
  }

  bike = new THREE.Group();
  scene.add(bike);
  bike.add(bodies, lines(frameArr, halo), lines(frameArr, core));

  crank = new THREE.Group();
  crank.position.set(J.BB[0], J.BB[1], J.BB[2]);
  crank.add(lines(crankArr, halo), lines(crankArr, thin));
  { // chainring + crank arms as bodies
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.006, 6, 48), frameMat); ring.position.z = 0.036; crank.add(ring);
    const off0 = pedalOffsets(0);
    crank.add(tubeMesh([0, 0, -0.05], off0.pedalL, 0.009), tubeMesh([0, 0, 0.05], off0.pedalR, 0.009));
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 12), frameMat); axle.rotation.x = Math.PI / 2; crank.add(axle);
  }
  bike.add(crank);

  // Ground glow under each tire, revealed with its contact patch.
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'); const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, 'rgba(74,222,128,0.55)'); grd.addColorStop(0.45, 'rgba(74,222,128,0.18)'); grd.addColorStop(1, 'rgba(74,222,128,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const groundGlows = {};
  for (const [id, axle] of [['tire_r', J.RA], ['tire_f', J.FA]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.55), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2; m.position.set(axle[0], 0.002, 0);
    bike.add(m); groundGlows[id] = m;
  }
  const ringGlow = (() => { // soft ring for the ground contact
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'); g.strokeStyle = 'rgba(74,222,128,0.9)'; g.lineWidth = 6; g.shadowColor = 'rgba(74,222,128,1)'; g.shadowBlur = 14;
    g.beginPath(); g.ellipse(128, 128, 112, 112, 0, 0, Math.PI * 2); g.stroke();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  for (const [id, axle] of [['tire_r', J.RA], ['tire_f', J.FA]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.46), new THREE.MeshBasicMaterial({ map: ringGlow, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2; m.position.set(axle[0], 0.003, 0);
    bike.add(m); groundGlows[id + '_ring'] = m;
  }
  window.__chewiGlows = groundGlows;

  const off = pedalOffsets(0);
  pedalL = new THREE.Group(); pedalL.position.set(...off.pedalL); pedalL.add(lines(pedalArr, thin)); crank.add(pedalL);
  pedalR = new THREE.Group(); pedalR.position.set(...off.pedalR); pedalR.add(lines(pedalArr, thin)); crank.add(pedalR);

  // ground grid, 1px, barely there
  const gridGeo = new THREE.BufferGeometry();
  gridGeo.setAttribute('position', new THREE.BufferAttribute(buildGrid(), 3));
  scene.add(new THREE.LineSegments(gridGeo, new THREE.LineBasicMaterial({ color: 0x4da3ff, transparent: true, opacity: 0.07, depthWrite: false })));

  // patches + labels
  const parents = { frame: bike, crank, pedalL, pedalR };
  entries = PATCHES.map((p, i) => {
    const color = new THREE.Color(COLORS[p.kind]);
    const geo = patchGeometry(p.shape);
    const mat = holo(COLORS[p.kind], 0.45, 1.5, 0, THREE.DoubleSide);
    const mesh = new THREE.Mesh(geo, mat);
    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    mesh.add(outline);
    mesh.position.set(...p.position);
    if (p.shape.axis) mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...p.shape.axis).normalize());
    else if (p.rotation) mesh.rotation.set(...p.rotation);
    mesh.visible = false;
    parents[p.parent].add(mesh);

    const anchor = new THREE.Object3D();
    anchor.position.set(...p.anchor);
    parents[p.parent].add(anchor);

    const tag = document.createElement('div');
    tag.className = 'tag';
    tag.style.setProperty('--c', COLORS[p.kind]);
    tag.innerHTML = `<span class="tag-kind">${p.kind}</span><span class="tag-id">${p.id}</span>`;
    tagLayer.appendChild(tag);

    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('stroke', COLORS[p.kind]);
    svg.appendChild(line);

    return { p, mesh, outline, anchor, tag, line, ease: 0, order: REVEAL_ORDER.indexOf(p.id), phase: i * 0.7 };
  });

  // events
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    renderer.setAnimationLoop(null);
    state.running = false;
    lostTimer = setTimeout(() => fallback('webgl context lost'), 3000);
  });
  canvas.addEventListener('webglcontextrestored', () => { clearTimeout(lostTimer); sync(); });

  new ResizeObserver(() => resize()).observe(stage);
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; sync(); }, { threshold: 0.05 }).observe(root);
  document.addEventListener('visibilitychange', sync);
  REDUCED_MQ.addEventListener('change', sync);

  raycaster = new THREE.Raycaster();
  ndc = new THREE.Vector2();

  // Parallax (fine pointers, until the first drag), drag to orbit (all pointers), hover to highlight.
  if (!COARSE_MQ.matches) {
    root.addEventListener('pointermove', (ev) => {
      if (dragging || interacted) return;
      const r = stage.getBoundingClientRect();
      yawT = clamp((ev.clientX - (r.left + r.width / 2)) / r.width, -0.5, 0.5) * 0.21;
      pitchT = clamp((ev.clientY - (r.top + r.height / 2)) / r.height, -0.5, 0.5) * -0.10;
    });
    root.addEventListener('pointerleave', () => { yawT = 0; pitchT = 0; setHover(null); });
  }
  stage.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    if (dragging) return; // one pointer drives the orbit; a second finger is ignored
    activePointer = ev.pointerId;
    dragging = true; interacted = true; yawT = 0; pitchT = 0;
    dragVelYaw = 0; dragVelPitch = 0;
    lastPX = ev.clientX; lastPY = ev.clientY; lastPT = performance.now();
    stage.classList.add('is-dragging');
    if (hint) hint.classList.add('is-done');
    try { stage.setPointerCapture(ev.pointerId); } catch {}
  });
  stage.addEventListener('pointermove', (ev) => {
    if (dragging) {
      if (ev.pointerId !== activePointer) return;
      const now = performance.now();
      const dtp = Math.max(1, now - lastPT) / 1000;
      const dYaw = (ev.clientX - lastPX) * 0.005, dPitch = -(ev.clientY - lastPY) * 0.003;
      dragYaw += dYaw;
      dragPitch = clamp(dragPitch + dPitch, -0.25, 0.30);
      // smoothed release velocity; with the 4/s damping the cap gives at most about 0.4 rad of coast
      dragVelYaw = clamp(dragVelYaw * 0.5 + (dYaw / dtp) * 0.5, -1.6, 1.6);
      dragVelPitch = clamp(dragVelPitch * 0.5 + (dPitch / dtp) * 0.5, -1, 1);
      lastPX = ev.clientX; lastPY = ev.clientY; lastPT = now;
      if (!state.running) renderOnce();
      return;
    }
    if (!COARSE_MQ.matches) hoverAt(ev);
  });
  const endDrag = (ev) => {
    if (!dragging || ev.pointerId !== activePointer) return;
    dragging = false;
    activePointer = null;
    stage.classList.remove('is-dragging');
    try { stage.releasePointerCapture(ev.pointerId); } catch {}
  };
  stage.addEventListener('pointerup', endDrag);
  window.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', (ev) => { if (ev.pointerId === activePointer) { dragVelYaw = 0; dragVelPitch = 0; } endDrag(ev); });
  stage.addEventListener('lostpointercapture', endDrag);

  resize();
  state.ready = true;
  setMode(reducedMotion() ? 'reduced' : 'webgl');
  if (reducedMotion()) { state.t = STATIC_T; }
  renderOnce();
  sync();
}

function patchGeometry(s) {
  switch (s.type) {
    case 'torusArc': return new THREE.TorusGeometry(s.radius, s.tube, 6, 16, s.arc);
    case 'ring': return new THREE.TorusGeometry((s.inner + s.outer) / 2, ((s.outer - s.inner) / 2) * 0.9, 8, 40);
    case 'disc': return new THREE.CircleGeometry(s.radius, 24);
    case 'box': return new THREE.BoxGeometry(...s.size);
    case 'saddle': {
      const shape = new THREE.Shape(saddleOutline(40).map(([x, z]) => new THREE.Vector2(x, z)));
      const g = new THREE.ExtrudeGeometry(shape, { depth: s.depth, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.016, bevelSegments: 5, curveSegments: 16 });
      g.rotateX(-Math.PI / 2); // outline lies in x/z, extrusion rises along +y
      return g;
    }
    case 'cylinder': return new THREE.CylinderGeometry(s.radius, s.radius, s.length, 16, 1, true);
    case 'sphere': {
      const g = new THREE.SphereGeometry(s.radius, 24, 14);
      if (s.scale) g.scale(...s.scale);
      return g;
    }
    default: throw new Error('unknown patch shape ' + s.type);
  }
}

// ---- per-frame -------------------------------------------------------------

function update(dt) {
  state.t += dt;
  const t = state.t;

  const k = 1 - Math.exp(-4 * dt);
  yaw += (yawT - yaw) * k;
  pitch += (pitchT - pitch) * k;

  if (!dragging) {
    dragYaw += dragVelYaw * dt;
    dragPitch = clamp(dragPitch + dragVelPitch * dt, -0.25, 0.30);
    const damp = Math.exp(-4 * dt);
    dragVelYaw *= damp; dragVelPitch *= damp;
  }

  crank.rotation.z = -0.25 * t;
  pedalL.rotation.z = 0.25 * t;
  pedalR.rotation.z = 0.25 * t;

  const az = AZ0 + (2 * Math.PI * t) / ORBIT_PERIOD + yaw + dragYaw;
  const el = clamp(EL0 + 0.08 * Math.sin((2 * Math.PI * t) / BOB_PERIOD) + pitch + dragPitch, 0.08, 0.62);
  camera.position.set(
    TARGET.x + RADIUS * Math.cos(el) * Math.sin(az),
    TARGET.y + RADIUS * Math.sin(el),
    TARGET.z + RADIUS * Math.cos(el) * Math.cos(az),
  );
  camera.lookAt(TARGET);

  let revealed = 0;
  for (const e of entries) {
    const local = t - REVEAL_START - e.order * REVEAL_STEP;
    const s = clamp(local / REVEAL_DUR, 0, 1);
    const ease = 1 - Math.pow(1 - s, 3);
    if (s >= 1) revealed++;
    const pulse = s >= 1 ? 0.12 * Math.sin(2 * t + e.phase) : 0;
    e.ease = ease;
    e.mesh.visible = s > 0;
    const hot = hovered === e ? 0.35 : 0;
    e.mesh.material.uniforms.uOpacity.value = Math.min(1.4, ease * (0.85 + pulse) + hot);
    e.outline.material.opacity = ease * 0.5 + hot;
    e.mesh.scale.setScalar(0.6 + 0.4 * ease);
    if (e.p.id === 'tire_r' || e.p.id === 'tire_f') {
      const g = window.__chewiGlows;
      if (g) { g[e.p.id].material.opacity = ease * (0.75 + pulse); g[e.p.id + '_ring'].material.opacity = ease * (0.8 + pulse); }
    }
  }
  state.revealed = revealed;
}

function hoverAt(ev) {
  const r = stage.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const meshes = entries.filter((e) => e.mesh.visible).map((e) => e.mesh);
  const hit = raycaster.intersectObjects(meshes, false)[0];
  setHover(hit ? entries.find((e) => e.mesh === hit.object) : null);
}
function setHover(e) {
  if (e === hovered) return;
  if (hovered) hovered.tag.classList.remove('is-hot');
  hovered = e;
  if (hovered) hovered.tag.classList.add('is-hot');
  stage.classList.toggle('is-hover', !!hovered);
  if (!state.running && renderer && state.mode !== 'fallback') renderOnce();
}

// Push overlapping tags apart along the axis of least penetration. Ten tags, a few passes: cheap.
function separate(rects, w, h) {
  const GAP = 6;
  for (let it = 0; it < 4; it++) {
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j];
        if (a.op < 0.05 || b.op < 0.05) continue;
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) + GAP;
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) + GAP;
        if (ox <= 0 || oy <= 0) continue;
        if (oy <= ox) { const s = (a.y <= b.y ? -1 : 1) * (oy / 2); a.y += s; b.y -= s; }
        else { const s = (a.x <= b.x ? -1 : 1) * (ox / 2); a.x += s; b.x -= s; }
      }
    }
    for (const r of rects) { r.x = clamp(r.x, 6, w - r.w - 6); r.y = clamp(r.y, 6, h - r.h - 6); }
  }
}

function layout(snap = false) {
  const { w, h } = size;
  camera.updateMatrixWorld();
  const rects = entries.map((e) => {
    e.anchor.getWorldPosition(vTmp);
    let facing = 1;
    if (e.p.facing === 'signed') {
      nTmp.set(...e.p.normal).transformDirection(e.anchor.parent.matrixWorld);
      dTmp.copy(camera.position).sub(vTmp).normalize();
      facing = smoothstep(-0.2, 0.3, nTmp.dot(dTmp));
    }
    vTmp.project(camera);
    const behind = vTmp.z > 1;
    const ax = ((vTmp.x + 1) / 2) * w;
    const ay = ((1 - vTmp.y) / 2) * h;
    const op = behind ? 0 : e.ease * facing;
    const tw = e.tag.offsetWidth || 80, th = e.tag.offsetHeight || 34;
    const x = clamp(e.p.offset[0] < 0 ? ax + e.p.offset[0] - tw : ax + e.p.offset[0], 6, w - tw - 6);
    const y = clamp(e.p.offset[1] < 0 ? ay + e.p.offset[1] - th : ay + e.p.offset[1], 6, h - th - 6);
    return { e, ax, ay, op, x, y, w: tw, h: th };
  });
  separate(rects, w, h);

  const labels = [];
  rects.forEach((r, i) => {
    const e = r.e;
    if (snap || e.tx === undefined) { e.tx = r.x; e.ty = r.y; }
    else { e.tx += (r.x - e.tx) * 0.3; e.ty += (r.y - e.ty) * 0.3; }
    const tx = e.tx, ty = e.ty;
    e.tag.style.transform = `translate3d(${tx.toFixed(1)}px,${ty.toFixed(1)}px,0)`;
    e.tag.style.opacity = r.op.toFixed(3);

    const cx = clamp(r.ax, tx, tx + r.w), cy = clamp(r.ay, ty, ty + r.h);
    e.line.setAttribute('x1', r.ax.toFixed(1)); e.line.setAttribute('y1', r.ay.toFixed(1));
    e.line.setAttribute('x2', cx.toFixed(1)); e.line.setAttribute('y2', cy.toFixed(1));
    e.line.setAttribute('opacity', (r.op * 0.7).toFixed(3));

    labels[i] = { name: e.p.id, kind: e.p.kind, x: r.ax, y: r.ay, tagX: tx, tagY: ty, tagW: r.w, tagH: r.h, visible: r.op > 0.05, opacity: r.op };
  });
  state.labels = labels;
}

function frame(now) {
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
  last = now;
  update(dt);
  renderer.render(scene, camera);
  layout();
  state.frames++;
  if (dt > 0) {
    const inst = 1 / dt;
    state.fps = state.fps ? state.fps * 0.9 + inst * 0.1 : inst;
    if (!dprDropped && state.pixelRatio > 1 && state.frames > 60) {
      if (state.fps < 45) {
        if (!lowFpsSince) lowFpsSince = now;
        else if (now - lowFpsSince > 2000) {
          dprDropped = true;
          state.pixelRatio = 1;
          renderer.setPixelRatio(1);
          resize();
        }
      } else lowFpsSince = 0;
    }
  }
}

function renderOnce() {
  update(0);
  renderer.render(scene, camera);
  layout(true);
}

function resize() {
  const r = stage.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
  size = { w, h };
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  for (const m of lineMats) m.resolution.set(w, h);
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  if (state.ready && !state.running) renderOnce();
}

function sync() {
  if (!renderer || state.mode === 'fallback') return;
  const reduced = reducedMotion();
  if (reduced && state.mode !== 'reduced') { setMode('reduced'); state.t = STATIC_T; yaw = pitch = yawT = pitchT = 0; renderOnce(); }
  else if (!reduced && state.mode === 'reduced') { setMode('webgl'); }
  const shouldRun = !reduced && visible && document.visibilityState === 'visible';
  if (shouldRun !== state.running) {
    state.running = shouldRun;
    last = 0;
    renderer.setAnimationLoop(shouldRun ? frame : null);
  }
}

// ---- verification hook -----------------------------------------------------

window.__chewiHero = {
  status() {
    if (renderer && state.mode !== 'fallback') renderOnce();
    return { ...state, labels: state.labels.map((l) => ({ ...l })), canvas: { w: size.w, h: size.h }, interacted, dragYaw, dragPitch, hovered: hovered ? hovered.p.id : null };
  },
  renderOnce() { if (renderer && state.mode !== 'fallback') renderOnce(); },
  setTime(s) { state.t = s; yaw = pitch = yawT = pitchT = 0; if (renderer && state.mode !== 'fallback') renderOnce(); },
  capture() { if (!renderer || state.mode === 'fallback') return null; renderOnce(); return canvas.toDataURL('image/png'); },
};

boot();
