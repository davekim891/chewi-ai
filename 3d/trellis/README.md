# TRELLIS-2 hero mesh (retired)

TRELLIS-2 image-to-3D via Fal from `assets/hero-bike.jpg`, 70k faces, 1k texture; was the hero until the v3 swap. Restore these VIEW / FLOOR_Y / ANCHORS into `js/hero-mesh.js` if this mesh is wired back in.

```
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
```
