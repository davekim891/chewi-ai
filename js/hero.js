// hero.js: the bicycle scene, built on the shared hologram engine in holo.js.
import { createScene } from './holo.js';
import { buildFrame, buildCrank, buildPedal, PATCHES, REVEAL_ORDER, J, pedalOffsets, TUBES, JOINT_BALLS, WHEEL, saddleOutline, chainPath } from './bike.js';

const root = document.querySelector('[data-hero]');

const api = createScene({
  root,
  name: 'hero',
  camera: { target: [0.52, 0.42, 0], radius: 2.6, fov: 34, az0: 0.38, el0: 0.35, orbitPeriod: 40, bobPeriod: 13, bobAmp: 0.08 },
  staticT: 40,
  build(ctx) {
    const { THREE, scene, holo, lines, tubeMesh, groundGlow, grid, COLORS } = ctx;
    const frameArr = buildFrame(), crankArr = buildCrank(), pedalArr = buildPedal();

    // Line layer: a faint wire over the hologram bodies, so the mesh still reads as data.
    const core = { color: 0xcfe9ff, width: 1.0, opacity: 0.28 };
    const halo = { color: 0x3a9bff, width: 9.0, opacity: 0.075 };
    const thin = { color: 0xbfe0ff, width: 1.0, opacity: 0.55 };
    const frameMat = holo(0x7cc0ff, 0.13, 2.0, 1.15);

    const bodies = new THREE.Group();
    for (const t of TUBES) bodies.add(tubeMesh(t.a, t.b, t.r, frameMat));
    for (const [j, r] of JOINT_BALLS) { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), frameMat); s.position.set(...J[j]); bodies.add(s); }
    for (const axle of [J.RA, J.FA]) {
      const tire = new THREE.Mesh(new THREE.TorusGeometry(WHEEL.r - WHEEL.tire, WHEEL.tire, 10, 72), frameMat); tire.position.set(...axle); bodies.add(tire);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(WHEEL.rim, WHEEL.rimTube, 8, 64), frameMat); rim.position.set(...axle); bodies.add(rim);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL.hub, WHEEL.hub, WHEEL.hubLen, 16), frameMat); hub.position.set(...axle); hub.rotation.x = Math.PI / 2; bodies.add(hub);
    }
    { // chain + rear cog
      const pts = chainPath().map((p) => new THREE.Vector3(...p));
      bodies.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 160, 0.005, 6, true), holo(0x8fc8ff, 0.12, 2.0, 0.9)));
      const cog = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.005, 6, 32), frameMat); cog.position.set(J.RA[0], J.RA[1], 0.036); bodies.add(cog);
    }
    { // lower head tube collar, matching the headset patch at the top
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 8, 32), holo(COLORS.HINGE, 0.35, 1.6, 0.9));
      collar.position.set(...J.HTb);
      collar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(J.HTt[0] - J.HTb[0], J.HTt[1] - J.HTb[1], 0).normalize());
      bodies.add(collar);
    }

    const bike = new THREE.Group();
    scene.add(bike);
    bike.add(bodies, lines(frameArr, halo), lines(frameArr, core));

    const crank = new THREE.Group();
    crank.position.set(J.BB[0], J.BB[1], J.BB[2]);
    crank.add(lines(crankArr, halo), lines(crankArr, thin));
    {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.006, 6, 48), frameMat); ring.position.z = 0.036; crank.add(ring);
      const off0 = pedalOffsets(0);
      crank.add(tubeMesh([0, 0, -0.05], off0.pedalL, 0.009, frameMat), tubeMesh([0, 0, 0.05], off0.pedalR, 0.009, frameMat));
      const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 12), frameMat); axle.rotation.x = Math.PI / 2; crank.add(axle);
    }
    bike.add(crank);

    const off = pedalOffsets(0);
    const pedalL = new THREE.Group(); pedalL.position.set(...off.pedalL); pedalL.add(lines(pedalArr, thin)); crank.add(pedalL);
    const pedalR = new THREE.Group(); pedalR.position.set(...off.pedalR); pedalR.add(lines(pedalArr, thin)); crank.add(pedalR);

    grid(scene, 0.525, 0);
    const glows = { tire_r: groundGlow(bike, J.RA[0], 0), tire_f: groundGlow(bike, J.FA[0], 0) };

    const parents = { frame: bike, crank, pedalL, pedalR };
    const patches = PATCHES.map((p) => {
      const shape = p.shape.type === 'saddle'
        ? { type: 'custom', geometry: (T) => {
            const shapeXZ = new T.Shape(saddleOutline(40).map(([x, z]) => new T.Vector2(x, z)));
            const g = new T.ExtrudeGeometry(shapeXZ, { depth: p.shape.depth, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.016, bevelSegments: 5, curveSegments: 16 });
            g.rotateX(-Math.PI / 2);
            return g;
          } }
        : p.shape;
      const glow = glows[p.id];
      return {
        ...p, shape, parentObj: parents[p.parent], order: REVEAL_ORDER.indexOf(p.id),
        onUpdate: glow ? (ease, pulse) => { glow.glow.material.opacity = ease * (0.75 + pulse); glow.ring.material.opacity = ease * (0.8 + pulse); } : undefined,
      };
    });

    return {
      patches,
      animate(t) { crank.rotation.z = -0.25 * t; pedalL.rotation.z = 0.25 * t; pedalR.rotation.z = 0.25 * t; },
    };
  },
});

window.__chewiHero = api; // kept for the verification probes documented in README
