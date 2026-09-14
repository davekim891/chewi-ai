// hero-mesh.js: the hero bicycle as a real 3D object reconstructed from the approved render
// (assets/bike.glb, TRELLIS-2 from assets/hero-bike.jpg), on the shared hologram engine.
// Opens in the render's own pose (camera and anchors from tools/match-view.html), orbits, drags, hovers;
// click a surface to inspect it and highlight its manifest row. Falls back to the render image.
import { createScene } from './holo.js';
import { COLORS } from './colors.js';
import { PATCHES, ROLES, KIND_NOTES, REVEAL_ORDER } from './bike.js';

// From tools/match-view.html against assets/bike.glb (mesh-local, centred; bike length is 1.0)
const VIEW = { az: 0.4584, el: 0.26, D: 1.4103, target: [0.0755, -0.0034, -0.0363], fov: 34 };
const FLOOR_Y = -0.2627; // tire contact height in mesh coordinates
const ANCHORS = {
  tire_r:  { kind: 'CONTACT',  p: [-0.3255, -0.2627,  0.0015], offset: [-30, 46] },
  tire_f:  { kind: 'CONTACT',  p: [ 0.3410, -0.2553,  0.0087], offset: [30, 46] },
  crank:   { kind: 'ROTATION', p: [-0.0536, -0.1063,  0.0088], offset: [-70, 40] },
  pedal_l: { kind: 'CONTACT',  p: [-0.1347, -0.0333,  0.0042], offset: [-56, -40], normal: [0, 0, 1] },
  pedal_r: { kind: 'CONTACT',  p: [ 0.0210, -0.2006, -0.0671], offset: [56, 36], normal: [0, 0, -1] },
  saddle:  { kind: 'SUPPORT',  p: [-0.1694,  0.2512, -0.0348], offset: [-40, -60] },
  grip_l:  { kind: 'GRIP',     p: [ 0.2582,  0.2596, -0.2290], offset: [40, -56], normal: [0, 0, -1] },
  grip_r:  { kind: 'GRIP',     p: [ 0.2491,  0.2646,  0.2289], offset: [40, -56], normal: [0, 0, 1] },
  hub_f:   { kind: 'ROTATION', p: [ 0.3224, -0.0495,  0.0190], offset: [64, 10] },
  headset: { kind: 'HINGE',    p: [ 0.2395,  0.1894, -0.0057], offset: [70, -30] },
};

const root = document.querySelector('[data-hero]');
const detail = root && root.querySelector('.hero-detail');
const byId = Object.fromEntries(PATCHES.map((p) => [p.id, p]));

function showDetail(id) {
  if (!detail) return;
  for (const tr of document.querySelectorAll('.manifest tr[data-id]')) {
    const on = !!id && tr.dataset.id === id;
    tr.classList.toggle('is-active', on);
    if (on) tr.style.setProperty('--c', COLORS[ANCHORS[id].kind]); else tr.style.removeProperty('--c');
  }
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

    // one glow dot per surface: hover target, reveal target, label anchor
    const patches = Object.entries(ANCHORS).map(([id, a]) => ({
      id, kind: a.kind, parentObj: obj,
      shape: { type: 'sphere', radius: a.kind === 'ROTATION' || a.kind === 'HINGE' ? 0.014 : 0.016 },
      position: a.p, anchor: a.p, normal: a.normal, facing: a.normal ? 'signed' : 'always', offset: a.offset,
      order: REVEAL_ORDER.indexOf(id),
      onUpdate: glows[id] ? (ease, pulse) => { glows[id].glow.material.opacity = ease * (0.75 + pulse); glows[id].ring.material.opacity = ease * (0.8 + pulse); } : undefined,
    }));
    return { patches, animate() {} };
  },
});

window.__chewiHero = api;
