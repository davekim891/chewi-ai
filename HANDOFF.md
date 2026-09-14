# Chewi AI landing page: handoff (2026-09-14, end of session)

Repo: `C:\WEB\chewi-ai` (git, branch `main`, HEAD `74d7568`, tag `3d_v1`). Not pushed anywhere yet.
Local preview: launch config `chewi` in `C:\Fable 5.1\.claude\launch.json` (python http.server on 8732 serving this folder). A server on 8732 was still running at handoff (PID may differ; verify with `netstat -ano | findstr 8732`, and check it serves this tree before trusting any capture).

## What the page is

Coming-soon page for chewi.ai (PlayHybrid product). GO asked for it in Slack on 2026-09-10; Dave directed every decision since. Sections, in order: hero, manifest, demo clip with measurements, problem + flow, layers with the opening hand, applications, two standards with the grasp, close. Copy sources and constraints are in `PRODUCT.md`; visual rules in `DESIGN.md`; how to run, test and deploy in `README.md`. Read those three first.

## Hero history (the part that changed most)

1. Procedural three.js wireframe bicycle (`js/hero.js` + `js/bike.js`). Kept in repo, off the page.
2. Same, rebuilt as a fresnel hologram to match Dave's Grok render.
3. Dave preferred the render itself: `js/hero-image.js` puts ten live HTML tags on `assets/hero-bike.jpg` (label-free render), with tilt, click-to-inspect, and a slot for a Grok turntable clip. Kept in repo, off the page.
4. **Current:** `js/hero-mesh.js` loads `assets/bike.glb`, a TRELLIS-2 image-to-3D reconstruction of the render (Fal, 70k faces, 1k texture, 3.2 MB), draws it as a textured hologram on the engine, opens in the render's pose. Camera and the ten anchors were computed by `tools/match-view.html` (silhouette IoU search, then the render's anchor pixels raycast onto the mesh) and pasted as constants into `hero-mesh.js`. Drag, hover, click-to-inspect (detail card + manifest row highlight) all verified in Chrome.

The share image `assets/og.jpg` is the labelled render (made with `tools/label-overlay.html`).

## 3d_v1 (Dave's Meshy mesh)

`3d/v1/`: Dave's Meshy AI "Neon Bicycle Blueprint" FBX (93 MB, 3.05 M triangles, no UVs, no materials), gitignored; `bike-full.glb` (220 MB, gitignored); `bike.glb` decimated to 120k triangles (5.8 MB, committed). Provenance in `3d/v1/README.md`. Previewed: clean, well-proportioned geometry; in hologram mode it looks like a proper wire bicycle. It is NOT on the page. Likely next step: use it as the hero geometry (cleaner than the TRELLIS mesh) with the engine's plain hologram material and the coloured patch bodies from the procedural bike placed by hand or by `tools/match-view.html` against the render. Conversion recipe: Blender 5.1 headless, `import_scene.fbx` then `export_scene.gltf`, Decimate modifier for the web copy (script was in the session scratchpad; trivial to rewrite).

## Engine and scenes

- `js/holo.js`: shared engine. three.js 0.180.0 from jsdelivr via import map (cdnjs has no addons). Handles load with 6 s CDN timeout, optional async `load()` with 20 s timeout, no-WebGL and context-loss fallbacks, ResizeObserver, IntersectionObserver + visibilitychange gating, reduced motion (`?reduced=1` test switch), drag-to-orbit with single active pointer, hover raycast, click-to-select (`onSelect`), label layout with overlap separation, `status()/setTime()/capture()` hooks registered in `window.__chewiScenes` (`hero`, `hand`, `grasp`; `window.__chewiHero` is the hero).
- `js/scenes.js` + `js/hand.js` + `js/grasp-layout.js`: hand opening (layers section) and hand grasping a cup (two-standards section). The grasp is solved geometrically: `grasp-layout.js` has a pure forward-kinematics model of the rig, a tapered cup wall, whole-chain clearance, and a solver; `js/grasp.test.mjs` asserts contact within 1.5 mm, no body inside the wall, opposition. `tools/grasp-search.mjs` re-searches hand placement and thumb angles if geometry changes. The rig's three.js positions were verified equal to the model to 1e-4.
- Test switches on the page: `?reduced=1`, `?nowebgl=1`, `?cdnfail=1`.

## Tests and checks

```
node js/bike.test.mjs
node js/hand.test.mjs
node js/grasp.test.mjs
node tools/stage.mjs <tmpdir>      # stages the deploy artifact; fails if any page reference or JS import is missing
node "%USERPROFILE%\.claude\skills\impeccable\scripts\detect.mjs" --json index.html css/site.css js/*.js   # only the accepted Space Grotesk warning
```

Headless verification pattern that proved reliable here: `"C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --window-size=1440,900 --virtual-time-budget=8000 --dump-dom "http://localhost:8732/?reduced=1&v=<n>"` (fresh profile each run, change `v` to defeat caches). `tools/capture.html?scene=hero|hand|grasp` renders one scene full-window with a `<pre id="status">` JSON readout. For anything needing real JS execution (async loads, interaction probes), the Chrome MCP tab's `javascript_tool` works even when the tab is hidden; screenshots there often stall.

## Audits

Five Opus auditor rounds ran (plan-verified; first KILL for tree churn and published internal docs; grasp geometry KILLed twice until it was solved on the rendered bodies). The last three rounds of changes (grasp clearance fix, image hero, interactive hero, mesh hero, 3d_v1) have NOT had an independent audit: the auto-mode classifier refused every auditor dispatch after the fifth round, twice with plain wording. Options: add a permission rule allowing the Agent tool for this project, or run the checklist above by hand. Dave was told.

## Gotchas learned this session

- The python static server sends no cache headers; Chrome served stale `hero.js` twice. Before believing "no change", force a refresh (`fetch(url, {cache:'reload'})` then reload, or a fresh headless profile).
- The auto-mode classifier blocks Bash commands that start listeners or detached processes, and blocked two auditor dispatches. Use launch configs for servers.
- Headless `--window-size=390` clamps to about 526 px, so phone captures show a clipped right edge that is NOT a layout bug; the pane and the auditor's per-element rect checks show no overflow at 390.
- Headless `--dump-dom` with a virtual-time budget can print a page's status before an async GLB load finishes; use the Chrome tab JS for those.
- Several stray python servers from auditors (ports 8741, 8742, 8743, 8777, 8913) may still be running; one on 8742 belongs to another session. Leave them.
- `git tag`/`commit` need `-c user.name -c user.email` here (no global identity).

## Open items for Dave

1. Push: create the GitHub repo (public or private: `PRODUCT.md`, `DESIGN.md`, `HANDOFF.md` are in the repo but never in the deploy artifact) and enable Pages. Workflow: `.github/workflows/deploy.yml` (three test steps, then `tools/stage.mjs`, then Pages).
2. Domain: buy chewi.ai; `CNAME` is in the repo; DNS records to hand over once the repo exists.
3. GO's read: the measurements table (Sean's V5.1 numbers) and the "Two standards" section (from the team's discussion note).
4. Decide whether the hero should move to the Meshy geometry (3d_v1) or stay on the TRELLIS reconstruction.
5. Optional: compress `assets/bike.glb` (meshopt or draco) if load time matters; it is the second-largest asset after the demo clip (7.1 MB).
6. Impeccable skill update available (v4.1.1, `npx impeccable update`); not run.
