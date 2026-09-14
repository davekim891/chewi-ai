// holo.js: the hologram scene engine shared by the hero bicycle and the hand scenes.
// One call per scene: createScene({ root, name, camera, staticT, build }).
// Handles three.js loading (import map, pinned), fallbacks (no WebGL, CDN down, context lost),
// resize, visibility gating, reduced motion, drag-to-orbit, hover, the label layer and a status hook.

const REDUCED_MQ = matchMedia('(prefers-reduced-motion: reduce)');
const COARSE_MQ = matchMedia('(pointer: coarse)');
const reducedMotion = () => REDUCED_MQ.matches || !!window.__chewiForceReduced;
const SVG_NS = 'http://www.w3.org/2000/svg';

import { COLORS } from './colors.js';
export { COLORS };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const withTimeout = (p, ms, label) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(label + ' timed out')), ms))]);
function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

let threeLoad = null;
function loadThree() {
  if (!threeLoad) {
    const spec = window.__chewiForceCdnFail ? 'https://cdn.jsdelivr.net/npm/three@0.0.0-does-not-exist/build/three.module.js' : 'three';
    threeLoad = withTimeout(Promise.all([
      import(spec),
      import('three/addons/lines/LineSegments2.js'),
      import('three/addons/lines/LineMaterial.js'),
      import('three/addons/lines/LineSegmentsGeometry.js'),
    ]), 6000, 'three.js load').then((m) => ({ THREE: m[0], LineSegments2: m[1].LineSegments2, LineMaterial: m[2].LineMaterial, LineSegmentsGeometry: m[3].LineSegmentsGeometry }));
    threeLoad.catch(() => { threeLoad = null; });
  }
  return threeLoad;
}

window.__chewiScenes = window.__chewiScenes || {};

export function createScene(opts) {
  const { root, name } = opts;
  const stage = root.querySelector('.holo-stage');
  const canvas = stage.querySelector('canvas');
  const tagLayer = stage.querySelector('.holo-tags');
  const svg = stage.querySelector('.holo-leaders');
  const fallbackEl = stage.querySelector('.holo-fallback');
  const hint = stage.querySelector('.holo-hint');
  const cam = Object.assign({ target: [0, 0, 0], radius: 2.6, fov: 34, az0: 0.38, el0: 0.35, orbitPeriod: 40, bobPeriod: 13, bobAmp: 0.08, elMin: 0.08, elMax: 0.62 }, opts.camera || {});
  const reveal = Object.assign({ start: 0.6, step: 0.6, dur: 0.45 }, opts.reveal || {});
  const STATIC_T = opts.staticT ?? 40;

  const state = { ready: false, mode: 'loading', error: null, fps: 0, frames: 0, pixelRatio: 1, revealed: 0, running: false, t: 0, labels: [] };
  let THREE, renderer, scene, camera, TARGET, vTmp, nTmp, dTmp, raycaster, ndc;
  let entries = [], lineMats = [], animate = null;
  let size = { w: 1, h: 1 };
  let last = 0, yaw = 0, pitch = 0, yawT = 0, pitchT = 0;
  let visible = true, lowFpsSince = 0, dprDropped = false, lostTimer = 0;
  let dragging = false, interacted = false, dragYaw = 0, dragPitch = 0, dragVelYaw = 0, dragVelPitch = 0;
  let lastPX = 0, lastPY = 0, lastPT = 0, hovered = null, activePointer = null;

  function setMode(m) {
    state.mode = m;
    root.dataset.mode = m;
    if (root.hasAttribute('data-hero')) document.documentElement.dataset.heroState = m;
  }
  function fallback(reason) {
    state.error = String((reason && reason.message) || reason);
    state.ready = true; state.running = false;
    if (renderer) { try { renderer.setAnimationLoop(null); } catch {} }
    setMode('fallback');
    canvas.hidden = true; tagLayer.hidden = true; svg.hidden = true;
    if (fallbackEl) {
      const img = fallbackEl.querySelector('img[data-src]');
      if (img) { img.src = img.dataset.src; img.removeAttribute('data-src'); } // only fetched when actually needed
      fallbackEl.hidden = false;
    }
  }

  async function boot() {
    if (window.__chewiForceNoWebGL || !hasWebGL()) return fallback('webgl unavailable');
    let mods;
    try { mods = await loadThree(); } catch (e) { return fallback(e); }
    try { init(mods); } catch (e) { return fallback(e); }
  }

  // ---- helpers handed to the scene builder --------------------------------
  function holo(hex, base = 0.08, power = 2.4, opacity = 1.0, side) {
    return new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(hex) }, uBase: { value: base }, uPower: { value: power }, uOpacity: { value: opacity } },
      vertexShader: `varying vec3 vN; varying vec3 vV;
        void main() { vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uColor; uniform float uBase; uniform float uPower; uniform float uOpacity; varying vec3 vN; varying vec3 vV;
        void main() { float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPower); float a = (uBase + (1.0 - uBase) * f) * uOpacity;
          vec3 c = mix(uColor, vec3(1.0), f * 0.5); gl_FragColor = vec4(c * a, a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: side ?? THREE.FrontSide,
    });
  }
  function lines(arr, o, mods) {
    const g = new mods.LineSegmentsGeometry().setPositions(arr);
    const m = new mods.LineMaterial({ color: o.color, linewidth: o.width, transparent: true, opacity: o.opacity, depthWrite: false, blending: o.blending ?? THREE.AdditiveBlending, worldUnits: false });
    lineMats.push(m);
    return new mods.LineSegments2(g, m);
  }
  const Y = () => new THREE.Vector3(0, 1, 0);
  function tubeMesh(a, b, r, mat, segs = 18) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), segs, 1, false), mat);
    m.position.copy(A).add(B).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(Y(), d.normalize());
    return m;
  }
  function radialTexture(rgb, stops) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'); const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    for (const [at, a] of stops) grd.addColorStop(at, `rgba(${rgb},${a})`);
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function ringTexture(rgb) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'); g.strokeStyle = `rgba(${rgb},0.9)`; g.lineWidth = 6; g.shadowColor = `rgba(${rgb},1)`; g.shadowBlur = 14;
    g.beginPath(); g.ellipse(128, 128, 112, 112, 0, 0, Math.PI * 2); g.stroke();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  // Soft glow + ring on the floor at (x, z); returns the two meshes so a patch can drive their opacity.
  function groundGlow(parent, x, z, rgb = '74,222,128', w = 0.95, d = 0.55) {
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: radialTexture(rgb, [[0, 0.55], [0.45, 0.18], [1, 0]]), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.rotation.x = -Math.PI / 2; glow.position.set(x, 0.002, z); parent.add(glow);
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.84, d * 0.84), new THREE.MeshBasicMaterial({ map: ringTexture(rgb), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.003, z); parent.add(ring);
    return { glow, ring };
  }
  function grid(parent, cx, cz, s = 3.0, n = 12, color = 0x4da3ff, opacity = 0.07) {
    const out = [];
    for (let i = 0; i <= n; i++) { const t = -s / 2 + (i / n) * s; out.push(cx + t, 0, cz - s / 2, cx + t, 0, cz + s / 2, cx - s / 2, 0, cz + t, cx + s / 2, 0, cz + t); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(out), 3));
    parent.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false })));
  }
  function patchGeometry(s) {
    switch (s.type) {
      case 'torusArc': return new THREE.TorusGeometry(s.radius, s.tube, 6, 16, s.arc);
      case 'ring': return new THREE.TorusGeometry((s.inner + s.outer) / 2, ((s.outer - s.inner) / 2) * 0.9, 8, 40);
      case 'disc': return new THREE.CircleGeometry(s.radius, 24);
      case 'box': return new THREE.BoxGeometry(...s.size);
      case 'cylinder': return new THREE.CylinderGeometry(s.radius, s.radius, s.length, 16, 1, true);
      case 'capsule': return new THREE.CapsuleGeometry(s.radius, s.length, 4, 12);
      case 'sphere': { const g = new THREE.SphereGeometry(s.radius, 24, 14); if (s.scale) g.scale(...s.scale); return g; }
      case 'custom': return s.geometry(THREE);
      default: throw new Error('unknown patch shape ' + s.type);
    }
  }

  function init(mods) {
    THREE = mods.THREE;
    TARGET = new THREE.Vector3(...cam.target);
    vTmp = new THREE.Vector3(); nTmp = new THREE.Vector3(); dTmp = new THREE.Vector3();
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setClearColor(0x000000, 0);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr); state.pixelRatio = dpr;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(cam.fov, 1, 0.05, 30);
    raycaster = new THREE.Raycaster(); ndc = new THREE.Vector2();

    const ctx = { THREE, scene, holo, lines: (arr, o) => lines(arr, o, mods), tubeMesh, groundGlow, grid, patchGeometry, COLORS, state };
    const built = opts.build(ctx);
    animate = built.animate || null;

    entries = built.patches.map((p, i) => {
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
      p.parentObj.add(mesh);
      const anchor = new THREE.Object3D(); anchor.position.set(...p.anchor); p.parentObj.add(anchor);
      const tag = document.createElement('div'); tag.className = 'tag'; tag.style.setProperty('--c', COLORS[p.kind]);
      tag.innerHTML = `<span class="tag-kind">${p.kind}</span><span class="tag-id">${p.id}</span>`;
      tagLayer.appendChild(tag);
      const line = document.createElementNS(SVG_NS, 'line'); line.setAttribute('stroke', COLORS[p.kind]); svg.appendChild(line);
      return { p, mesh, outline, anchor, tag, line, ease: 0, order: p.order ?? i, phase: i * 0.7 };
    });

    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); renderer.setAnimationLoop(null); state.running = false; lostTimer = setTimeout(() => fallback('webgl context lost'), 3000); });
    canvas.addEventListener('webglcontextrestored', () => { clearTimeout(lostTimer); sync(); });
    new ResizeObserver(() => resize()).observe(stage);
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; sync(); }, { threshold: 0.05 }).observe(root);
    document.addEventListener('visibilitychange', sync);
    REDUCED_MQ.addEventListener('change', sync);

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
      if (dragging) return;
      activePointer = ev.pointerId;
      dragging = true; interacted = true; yawT = 0; pitchT = 0; dragVelYaw = 0; dragVelPitch = 0;
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
      dragging = false; activePointer = null;
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
    if (reducedMotion()) state.t = STATIC_T;
    renderOnce();
    sync();
  }

  function update(dt) {
    state.t += dt;
    const t = state.t;
    const k = 1 - Math.exp(-4 * dt);
    yaw += (yawT - yaw) * k; pitch += (pitchT - pitch) * k;
    if (!dragging) {
      dragYaw += dragVelYaw * dt;
      dragPitch = clamp(dragPitch + dragVelPitch * dt, -0.25, 0.30);
      const damp = Math.exp(-4 * dt); dragVelYaw *= damp; dragVelPitch *= damp;
    }
    if (animate) animate(t, dt);
    const az = cam.az0 + (2 * Math.PI * t) / cam.orbitPeriod + yaw + dragYaw;
    const el = clamp(cam.el0 + cam.bobAmp * Math.sin((2 * Math.PI * t) / cam.bobPeriod) + pitch + dragPitch, cam.elMin, cam.elMax);
    camera.position.set(TARGET.x + cam.radius * Math.cos(el) * Math.sin(az), TARGET.y + cam.radius * Math.sin(el), TARGET.z + cam.radius * Math.cos(el) * Math.cos(az));
    camera.lookAt(TARGET);

    let revealed = 0;
    for (const e of entries) {
      const local = t - reveal.start - e.order * reveal.step;
      const s = clamp(local / reveal.dur, 0, 1);
      const ease = 1 - Math.pow(1 - s, 3);
      if (s >= 1) revealed++;
      const engage = e.p.engage ? clamp(e.p.engage(t), 0, 1) : 1;
      const pulse = s >= 1 ? 0.12 * Math.sin(2 * t + e.phase) : 0;
      e.ease = ease * (0.25 + 0.75 * engage);
      e.mesh.visible = s > 0;
      const hot = hovered === e ? 0.35 : 0;
      e.mesh.material.uniforms.uOpacity.value = Math.min(1.4, e.ease * (0.85 + pulse) + hot);
      e.outline.material.opacity = e.ease * 0.5 + hot;
      e.mesh.scale.setScalar(0.6 + 0.4 * ease);
      if (e.p.onUpdate) e.p.onUpdate(e.ease, pulse, t);
    }
    state.revealed = revealed;
  }

  function hoverAt(ev) {
    const r = stage.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(entries.filter((e) => e.mesh.visible).map((e) => e.mesh), false)[0];
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
  function separate(rects, w, h) {
    const GAP = 6;
    for (let it = 0; it < 4; it++) {
      for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j];
        if (a.op < 0.05 || b.op < 0.05) continue;
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) + GAP;
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) + GAP;
        if (ox <= 0 || oy <= 0) continue;
        if (oy <= ox) { const s = (a.y <= b.y ? -1 : 1) * (oy / 2); a.y += s; b.y -= s; }
        else { const s = (a.x <= b.x ? -1 : 1) * (ox / 2); a.x += s; b.x -= s; }
      }
      for (const r of rects) { r.x = clamp(r.x, 6, w - r.w - 6); r.y = clamp(r.y, 6, h - r.h - 6); }
    }
  }
  function layout(snap = false) {
    const { w, h } = size;
    camera.updateMatrixWorld();
    const rects = entries.map((e) => {
      e.anchor.getWorldPosition(vTmp);
      const world = [vTmp.x, vTmp.y, vTmp.z];
      let facing = 1;
      if (e.p.facing === 'signed') {
        nTmp.set(...e.p.normal).transformDirection(e.anchor.parent.matrixWorld);
        dTmp.copy(camera.position).sub(vTmp).normalize();
        facing = smoothstep(-0.2, 0.3, nTmp.dot(dTmp));
      }
      vTmp.project(camera);
      const behind = vTmp.z > 1;
      const ax = ((vTmp.x + 1) / 2) * w, ay = ((1 - vTmp.y) / 2) * h;
      const op = behind ? 0 : e.ease * facing;
      const tw = e.tag.offsetWidth || 80, th = e.tag.offsetHeight || 34;
      const x = clamp(e.p.offset[0] < 0 ? ax + e.p.offset[0] - tw : ax + e.p.offset[0], 6, w - tw - 6);
      const y = clamp(e.p.offset[1] < 0 ? ay + e.p.offset[1] - th : ay + e.p.offset[1], 6, h - th - 6);
      return { e, ax, ay, op, x, y, w: tw, h: th, world };
    });
    separate(rects, w, h);
    const labels = [];
    rects.forEach((r, i) => {
      const e = r.e;
      if (snap || e.tx === undefined) { e.tx = r.x; e.ty = r.y; } else { e.tx += (r.x - e.tx) * 0.3; e.ty += (r.y - e.ty) * 0.3; }
      const tx = e.tx, ty = e.ty;
      e.tag.style.transform = `translate3d(${tx.toFixed(1)}px,${ty.toFixed(1)}px,0)`;
      e.tag.style.opacity = r.op.toFixed(3);
      const cx = clamp(r.ax, tx, tx + r.w), cy = clamp(r.ay, ty, ty + r.h);
      e.line.setAttribute('x1', r.ax.toFixed(1)); e.line.setAttribute('y1', r.ay.toFixed(1));
      e.line.setAttribute('x2', cx.toFixed(1)); e.line.setAttribute('y2', cy.toFixed(1));
      e.line.setAttribute('opacity', (r.op * 0.7).toFixed(3));
      labels[i] = { name: e.p.id, kind: e.p.kind, x: r.ax, y: r.ay, tagX: tx, tagY: ty, tagW: r.w, tagH: r.h, visible: r.op > 0.05, opacity: r.op, world: r.world };
    });
    state.labels = labels;
  }
  function frame(now) {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    update(dt); renderer.render(scene, camera); layout();
    state.frames++;
    if (dt > 0) {
      const inst = 1 / dt;
      state.fps = state.fps ? state.fps * 0.9 + inst * 0.1 : inst;
      if (!dprDropped && state.pixelRatio > 1 && state.frames > 60) {
        if (state.fps < 45) {
          if (!lowFpsSince) lowFpsSince = now;
          else if (now - lowFpsSince > 2000) { dprDropped = true; state.pixelRatio = 1; renderer.setPixelRatio(1); resize(); }
        } else lowFpsSince = 0;
      }
    }
  }
  function renderOnce() { update(0); renderer.render(scene, camera); layout(true); }
  function resize() {
    const r = stage.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    size = { w, h };
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    for (const m of lineMats) m.resolution.set(w, h);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    if (state.ready && !state.running) renderOnce();
  }
  function sync() {
    if (!renderer || state.mode === 'fallback') return;
    const reduced = reducedMotion();
    if (reduced && state.mode !== 'reduced') { setMode('reduced'); state.t = STATIC_T; yaw = pitch = yawT = pitchT = 0; renderOnce(); }
    else if (!reduced && state.mode === 'reduced') setMode('webgl');
    const shouldRun = !reduced && visible && document.visibilityState === 'visible';
    if (shouldRun !== state.running) { state.running = shouldRun; last = 0; renderer.setAnimationLoop(shouldRun ? frame : null); }
  }

  const api = {
    status() {
      if (renderer && state.mode !== 'fallback') renderOnce();
      return { ...state, labels: state.labels.map((l) => ({ ...l })), canvas: { w: size.w, h: size.h }, interacted, dragYaw, dragPitch, hovered: hovered ? hovered.p.id : null };
    },
    renderOnce() { if (renderer && state.mode !== 'fallback') renderOnce(); },
    setTime(s) { state.t = s; yaw = pitch = yawT = pitchT = 0; if (renderer && state.mode !== 'fallback') renderOnce(); },
    capture() { if (!renderer || state.mode === 'fallback') return null; renderOnce(); return canvas.toDataURL('image/png'); },
  };
  window.__chewiScenes[name] = api;
  boot();
  return api;
}
