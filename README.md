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
```

## Where things live

- Copy: `index.html` (all visible text is there, nothing is generated).
- Tokens and layout: `css/site.css`.
- Hero scene: `js/hero.js` (renderer, labels, fallbacks) and `js/bike.js` (bicycle geometry and the ten action surfaces).
- Demo clip: `assets/contact-demo.mp4` + `assets/contact-demo-poster.jpg`. Replace both to swap the demo; keep the file names.
- Share image: `assets/og.jpg` (1200x630), made from the labelled Grok render (`tools/label-overlay.html` produces the labels). `tools/render-static.mjs` still writes an alternative `assets/og.svg`, unused.
- Static hero for no-WebGL: `assets/hero-fallback.svg`.

## Hero interactions

Auto-orbit (40 s per turn) with a slight bob. Drag anywhere on the stage to orbit (mouse or touch; inertia on release, vertical page scroll is not hijacked). Hover a highlighted surface to light up its tag. A "Drag to orbit" hint fades out after the first drag. With reduced motion the view is static but still draggable.

## Verification hook

`window.__chewiHero.status()` renders one frame synchronously and returns `{ready, mode, fps, revealed, running, labels[...]}`. `setTime(12)` completes the reveal. `capture()` returns the canvas as a PNG data URL. Query switches: `?nowebgl=1` forces the static fallback, `?reduced=1` forces the reduced-motion path, `?cdnfail=1` imports a three.js version that does not exist to exercise the CDN-failure fallback.

## Deploy

GitHub Pages via `.github/workflows/deploy.yml` on push to `main`. The workflow runs `node tools/stage.mjs _site`, which copies only the public files (`index.html`, `CNAME`, `css/`, `fonts/`, `assets/`, `js/hero.js`, `js/bike.js`, `js/manifest.js`) and fails if anything `index.html` references is missing from the staged tree. PRODUCT.md, DESIGN.md, this README, `tools/` and the test are never published. `CNAME` is set to `chewi.ai`; the domain needs A records to GitHub Pages and a `www` CNAME to `<org>.github.io`.
