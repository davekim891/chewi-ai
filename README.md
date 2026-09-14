# chewi.ai

Coming-soon page for Chewi AI. Static, no build step.

## Run locally

Any static server that sends correct MIME types works. From this folder:

```
python -m http.server 8732
```

then open http://localhost:8732/. The hero loads three.js 0.180.0 from jsdelivr via the import map in `index.html`.

## Check the geometry

```
node js/bike.test.mjs
node js/hand.test.mjs
node js/grasp.test.mjs
```

## Where things live

- Copy: `index.html` (all visible text is there, nothing is generated).
- Tokens and layout: `css/site.css`.
- Hologram engine: `js/holo.js` (three.js loading, fallbacks, resize, visibility, drag, hover, labels, status hook), shared by three scenes.
- Hero: `js/hero-mesh.js` loads `assets/bike.glb`, a 3D reconstruction of the approved render (TRELLIS-2 via Fal from `assets/hero-bike.jpg`, 70k faces, 1k texture), and renders it as a textured hologram on the engine. It opens in the render's own pose; the camera and the ten anchor positions were computed by `tools/match-view.html` (silhouette match, then the render's anchor pixels raycast onto the mesh) and are pasted into `hero-mesh.js`. Drag to orbit, hover to light a surface, click to open the detail card and highlight the manifest row. No WebGL means the render image instead. `tools/mesh-anchors.html` and `tools/glb-preview.html` are inspection helpers; `js/hero-image.js` (render with live tags, no 3D) is kept as an alternative hero.
- Hologram engine: `js/holo.js` (three.js loading, fallbacks, resize, visibility, drag, hover, labels, status hook), shared by three scenes.
- Hero turntable: drop a label-free orbit clip of the render at `assets/hero-bike.mp4` (loop that starts and ends on the reference pose) and the hero plays it under the tags; tags show while the bike is within `data-pose-in` / `data-pose-out` seconds of the loop's start and end (set on the `<video>` in `index.html`) and hide while it turns. No clip, or reduced motion, means the still image.
- Hero interactions: the plate tilts with the pointer; hovering a surface lights its tag; clicking or tapping a surface or tag opens a detail card (kind, id, role, joint, a one-line note from `KIND_NOTES` in `js/bike.js`) and highlights the matching manifest row; Escape or the close button clears it. With the turntable clip present, dragging scrubs the rotation.
- Hero: `js/hero-image.js` places ten live HTML tags on `assets/hero-bike.jpg` (the approved Grok render, label-free) at the positions of the approved composition; reveal, pulse and hover, no WebGL. The earlier live 3D bicycle (`js/hero.js` on `js/bike.js`) is kept in the repo and still renders through `tools/capture.html?scene=hero`, but is not on the page or in the deploy artifact.
- Hand scenes: `js/scenes.js` on `js/hand.js` (a hand opening from a fist in the layers section; a hand grasping a cup in the two-standards section). The grasp layout and finger curls come from `js/grasp-layout.js`: a pure forward-kinematics model of the rig, a solver that closes each digit until its rendered contact sphere touches the tapered cup wall while every capsule and joint ball stays outside it, and `js/grasp.test.mjs` asserting exactly that. `node tools/grasp-search.mjs` re-searches the hand position and thumb angles if the hand or cup geometry changes. Surface colours live in `js/colors.js`.
- Fallback stills for the hand scenes come from `tools/capture.html?scene=hand|grasp` rendered headless (see below).
- Demo clip: `assets/contact-demo.mp4` + `assets/contact-demo-poster.jpg`. Replace both to swap the demo; keep the file names.
- Share image: `assets/og.jpg` (1200x630), made from the labelled Grok render (`tools/label-overlay.html` produces the labels). `tools/render-static.mjs` still writes an alternative `assets/og.svg`, unused.
- `assets/hero-fallback.svg` is the old 3D hero's static fallback, kept for the capture tool only and excluded from the deploy.

## Hero interactions

Auto-orbit (40 s per turn) with a slight bob. Drag anywhere on the stage to orbit (mouse or touch; inertia on release, vertical page scroll is not hijacked). Hover a highlighted surface to light up its tag. A "Drag to orbit" hint fades out after the first drag. With reduced motion the view is static but still draggable.

## Verification hook

Every scene registers in `window.__chewiScenes` (`hero`, `hand`, `grasp`); `window.__chewiHero` is the hero's api. `status()` renders one frame synchronously and returns `{ready, mode, fps, revealed, running, labels[...]}`. `setTime(12)` completes the reveal. `capture()` returns the canvas as a PNG data URL. Query switches: `?nowebgl=1` forces the static fallback, `?reduced=1` forces the reduced-motion path, `?cdnfail=1` imports a three.js version that does not exist to exercise the CDN-failure fallback.

## Regenerating the fallback stills

With the local server running:

```
"C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --hide-scrollbars --window-size=1200,1000 --virtual-time-budget=8000 --screenshot=assets\hand-fallback.png "http://localhost:8732/tools/capture.html?scene=hand"
```

Same for `grasp`. `tools/capture.html` also exposes a `<pre id="status">` readout for `--dump-dom` probes.

## Deploy

GitHub Pages via `.github/workflows/deploy.yml` on push to `main`. The `CNAME` file is only staged when the workflow runs with `PUBLISH_CNAME=1` (set it in the workflow once chewi.ai's DNS points at Pages); until then the site lives at https://davekim891.github.io/chewi-ai/. The workflow runs `node tools/stage.mjs _site`, which copies only the public files (`index.html`, `CNAME`, `css/`, `fonts/`, `assets/`, `js/hero.js`, `js/bike.js`, `js/manifest.js`) and fails if anything `index.html` references is missing from the staged tree. PRODUCT.md, DESIGN.md, this README, `tools/` and the test are never published. `CNAME` is set to `chewi.ai`; the domain needs A records to GitHub Pages and a `www` CNAME to `<org>.github.io`.
