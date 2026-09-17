// hero-mesh.js: the hero bicycle as a real 3D object — the Meshy v3 bike (3d/v3/README.md)
// copied to assets/bike.glb — on the shared hologram engine.
// Opens in the render's own pose (camera and anchors from 3d/v3/view_v3.json), orbits, drags, hovers;
// click a surface to inspect it. Falls back to the render image.
import { createScene } from './holo.js';
import { COLORS } from './colors.js';
import { PATCHES, ROLES, KIND_NOTES, REVEAL_ORDER } from './bike.js';

// From 3d/v3/view_v3.json (match-view against the Meshy v3 bike; mesh-local, centred; bike length is 1.0)
const VIEW = { az: -2.5416, el: 0.23, D: 1.2912, target: [-0.0868, -0.0205, 0.0536], fov: 34 };
const FLOOR_Y = -0.2606; // mesh min Y (tyre bottoms); GLB POSITION min [-0.5, -0.26057, -0.19184]
const ANCHORS = {
  tire_r:  { kind: 'CONTACT',  p: [ 0.2970, -0.2577, -0.0062], offset: [-30, 46] },
  tire_f:  { kind: 'CONTACT',  p: [-0.3562, -0.2249, -0.0066], offset: [30, 46] },
  crank:   { kind: 'ROTATION', p: [ 0.0042, -0.1039, -0.0276], offset: [-70, 40] },
  // near side (-z) is the rider's right
  pedal_l: { kind: 'CONTACT',  p: [-0.0184, -0.2014,  0.0720], offset: [56, 36], normal: [0, 0, 1] },
  pedal_r: { kind: 'CONTACT',  p: [ 0.0734, -0.0390, -0.0436], offset: [-56, -40], normal: [0, 0, -1] },
  saddle:  { kind: 'SUPPORT',  p: [ 0.1068,  0.2359, -0.0029], offset: [-40, -60] },
  grip_l:  { kind: 'GRIP',     p: [-0.2515,  0.2487,  0.1891], offset: [40, -56], normal: [0, 0, 1] },
  grip_r:  { kind: 'GRIP',     p: [-0.2559,  0.2496, -0.1388], offset: [40, -56], normal: [0, 0, -1] },
  hub_f:   { kind: 'ROTATION', p: [-0.3284, -0.0590,  0.0124], offset: [64, 10] },
  headset: { kind: 'HINGE',    p: [-0.2381,  0.1563,  0.0101], offset: [70, -30] },
};

const root = document.querySelector('[data-hero]');
const detail = root && root.querySelector('.hero-detail');
const byId = Object.fromEntries(PATCHES.map((p) => [p.id, p]));

function showDetail(id) {
  if (!detail) return;
  if (!id) { detail.hidden = true; return; }
  const a = ANCHORS[id], p = byId[id];
  detail.style.setProperty('--c', COLORS[a.kind]);
  detail.querySelector('.tag-kind').textContent = a.kind;
  detail.querySelector('.tag-kind').style.color = COLORS[a.kind];
  detail.querySelector('.tag-id').textContent = id;
  detail.querySelector('.hero-detail-role').textContent = ROLES[a.kind] + (p ? `, attached to ${p.joint}` : '');
  detail.querySelector('.hero-detail-note').textContent = KIND_NOTES[a.kind];
  detail.hidden = false;
}
if (detail) {
  detail.querySelector('.hero-detail-close').addEventListener('click', () => showDetail(null));
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') showDetail(null); });
}

let selected = null;
const api = root && createScene({
  root,
  name: 'hero',
  camera: { target: [VIEW.target[0], VIEW.target[1] - FLOOR_Y, VIEW.target[2]], radius: VIEW.D, fov: VIEW.fov, az0: VIEW.az, el0: VIEW.el, orbitPeriod: 40, bobPeriod: 13, bobAmp: 0.03, elMin: 0.08, elMax: 0.62 },
  staticT: 40,
  fallbackSrc: 'assets/hero-bike.jpg',
  async load() {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    return new GLTFLoader().loadAsync(new URL('../assets/bike.glb', import.meta.url).href);
  },
  onSelect(id) { selected = selected === id ? null : id; showDetail(selected); },
  build(ctx, gltf) {
    const { THREE, scene, holo, groundGlow, grid } = ctx;
    const obj = gltf.scene;
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj), center = box.getCenter(new THREE.Vector3());
    obj.position.sub(center);
    const bike = new THREE.Group();
    bike.position.y = -FLOOR_Y; // floor at y = 0
    bike.add(obj);
    scene.add(bike);

    // textured hologram: the render's baked colours, lifted, with a fresnel rim, additive
    const mats = [];
    obj.traverse((m) => {
      if (!m.isMesh) return;
      const map = m.material && m.material.map ? m.material.map : null;
      const mat = new THREE.ShaderMaterial({
        uniforms: { uMap: { value: map }, uHasMap: { value: map ? 1 : 0 }, uColor: { value: new THREE.Color(0x7cc0ff) }, uGain: { value: 2.6 }, uBase: { value: 0.22 }, uPower: { value: 1.8 }, uOpacity: { value: 1.0 } },
        vertexShader: `varying vec3 vN; varying vec3 vV; varying vec2 vUv;
          void main() { vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); vUv = uv; gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `uniform sampler2D uMap; uniform float uHasMap; uniform vec3 uColor; uniform float uGain; uniform float uBase; uniform float uPower; uniform float uOpacity;
          varying vec3 vN; varying vec3 vV; varying vec2 vUv;
          void main() {
            vec3 base = uHasMap > 0.5 ? texture2D(uMap, vUv).rgb * uGain : uColor;
            float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPower);
            float a = (uBase + (1.0 - uBase) * f) * uOpacity;
            vec3 c = mix(base, vec3(1.0), f * 0.35);
            gl_FragColor = vec4(c * a, a);
          }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
      m.material = mat; mats.push(mat);
    });

    grid(scene, 0, 0, 1.8, 12, 0x4da3ff, 0.07);
    const glows = {
      tire_r: groundGlow(scene, ANCHORS.tire_r.p[0], ANCHORS.tire_r.p[2], '74,222,128', 0.55, 0.32),
      tire_f: groundGlow(scene, ANCHORS.tire_f.p[0], ANCHORS.tire_f.p[2], '74,222,128', 0.55, 0.32),
    };

    scene.updateMatrixWorld(true);
    const STEP = 32;
    const fit = [];
    obj.traverse((m) => {
      if (!m.isMesh || !m.geometry) return;
      const pos = m.geometry.getAttribute('position');
      if (!pos) return;
      const e = m.matrixWorld.elements;
      for (let i = 0; i < pos.count; i += STEP) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        fit.push(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]);
      }
    });
    const GW = 0.55, GD = 0.32, RING_N = 16;
    for (const id of ['tire_r', 'tire_f']) {
      const cx = ANCHORS[id].p[0], cz = ANCHORS[id].p[2], rx = GW / 2, rz = GD / 2;
      for (let i = 0; i < RING_N; i++) {
        const t = (2 * Math.PI * i) / RING_N;
        fit.push(cx + rx * Math.cos(t), 0, cz + rz * Math.sin(t));
      }
    }

    // one glow dot per surface: hover target, reveal target, label anchor
    const patches = Object.entries(ANCHORS).map(([id, a]) => ({
      id, kind: a.kind, parentObj: obj,
      shape: { type: 'sphere', radius: a.kind === 'ROTATION' || a.kind === 'HINGE' ? 0.014 : 0.016 },
      position: a.p, anchor: a.p, normal: a.normal, facing: a.normal ? 'signed' : 'always', offset: a.offset,
      order: REVEAL_ORDER.indexOf(id),
      onUpdate: glows[id] ? (ease, pulse) => { glows[id].glow.material.opacity = ease * (0.75 + pulse); glows[id].ring.material.opacity = ease * (0.8 + pulse); } : undefined,
    }));
    return { patches, animate() {}, fitPoints: new Float32Array(fit), fitMargin: 0.04 };
  },
});

window.__chewiHero = api;
