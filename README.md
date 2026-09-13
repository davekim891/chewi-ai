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
- Share image: `assets/og.jpg` (1200x630).
- Static hero for no-WebGL: `assets/hero-fallback.jpg`.

## Verification hook

`window.__chewiHero.status()` renders one frame synchronously and returns `{ready, mode, fps, revealed, running, labels[...]}`. `setTime(12)` completes the reveal. `capture()` returns the canvas as a PNG data URL. Set `window.__chewiForceNoWebGL = true` before load to force the fallback path.

## Deploy

GitHub Pages via `.github/workflows/deploy.yml` on push to `main`. `CNAME` is set to `chewi.ai`; the domain needs A records to GitHub Pages and a `www` CNAME to `<org>.github.io`.
