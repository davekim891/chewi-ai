# Task: nothing cut off — fit the whole hero bike inside the stage at every viewport

## Context
Repo: this directory (chewi-ai, static site, no build). Read README.md, HANDOFF.md, DESIGN.md, `js/holo.js` and
`js/hero-mesh.js` first. The hero (`js/hero-mesh.js`) is the v3 Meshy bike (`assets/bike.glb`, length 1.0, centred),
drawn by the shared engine `js/holo.js`, which orbits a camera of FIXED radius `cam.radius` (= `VIEW.D` = 1.2912,
vertical fov 34) around `cam.target`. The radius was computed by match-view for the render's 16:9 frame. The hero
stage on the page is narrower than 16:9 (it is the right column of the hero section; on Dave's 1512x808 window the
canvas is roughly 1.2:1), so the bike overflows: the rear wheel is cut off at the left edge of the stage, and as the
camera orbits other parts leave the frame too. Dave: "the back of the bike, the wheel is cut off. can you show me in
the next version nothing cut off?"

## Mandate
Make the engine fit its content inside the stage at any stage size and at every azimuth of the orbit, by pushing the
camera back exactly as far as needed and no further. Concretely:

1. `js/holo.js`: a scene may return `bounds` from `build()` (a `THREE.Box3` in WORLD space, i.e. after any group
   transforms the scene applies) plus optional `fitMargin` (fraction of the stage on every side, default 0.06). When
   bounds are given, the engine computes `fitRadius` on every `resize()` (and once after build) as the smallest camera
   radius `R >= cam.radius` such that for EVERY azimuth (sample az in 36 steps over the full orbit, including the
   drag yaw range which is unbounded, so the full circle) and for both elevation extremes `cam.elMin` and `cam.elMax`
   (plus `cam.el0`), all 8 corners of `bounds` project inside the stage rectangle inset by `fitMargin` on each side,
   with the camera placed by the SAME formula the render loop uses (position = target + R*(cos el sin az, sin el,
   cos el cos az), lookAt target, the current `camera.aspect`, `cam.fov`). Solve for R analytically per corner
   (the required distance along the view axis for a point at lateral offset x and depth z to land at the margin edge
   is linear in R for a fixed direction: derive it, do not bisect blindly; a short bisection with a stated tolerance
   is acceptable if you show it converges to within 0.1 %). Use `fitRadius` in place of `cam.radius` in the render
   loop. `cam.radius` stays the floor: never zoom in closer than the authored VIEW.D.
2. `js/hero-mesh.js`: return `bounds` = the bike mesh's world Box3 (after `bike.position.y = -FLOOR_Y` is applied)
   expanded to include the two tyre floor glows (see `groundGlow` in holo.js for their extents at ANCHORS.tire_r /
   tire_f) and the floor grid is NOT included (it is decorative and larger than the stage by design).
3. Labels: the engine already clamps label rectangles inside the stage (holo.js `layout()`, the `clamp(r.x, 6, …)`
   line), so labels cannot be cut; do not change the label layout. But the fit margin must leave room for the label
   leader stubs: use `fitMargin` 0.06 for the hero.
4. Keep the render's composition: the opening pose (az0, el0) stays; only the distance changes when the stage is
   too narrow or too short. On a 16:9 stage of the render's proportions the fitted radius must equal VIEW.D (or be
   within 2 % of it) — state the number you get in your report.
5. Expose for verification: `window.__chewiHero.fit()` (add to the api the engine returns / the hero registers in
   `window.__chewiScenes`) returning `{ radius, fitRadius, stage: {w, h}, worst: { az, el, cornerPx: [x, y] } }`
   where `worst` is the sampled corner with the least margin at the CURRENT stage size. Also `fitCheck(az, el)`
   returning the projected pixel bbox of the bounds corners at that camera pose so a probe can sample azimuths.
6. A pure, dependency-free unit of the fit math in `js/fit.js` (exported function
   `fitRadius({ corners, target, fov, aspect, azSamples, els, margin, minRadius })` → number, plus
   `projectCorner(...)` helper), used by holo.js, with a node test `js/fit.test.mjs` (same style as
   `js/grasp.test.mjs`, plain asserts, exit code) that checks: (a) a box that already fits returns `minRadius`;
   (b) a wide box on a narrow aspect returns a radius strictly larger than on a wide aspect; (c) at the returned
   radius every sampled corner is inside the margin box and at 0.98x the returned radius at least one corner is
   outside (this proves minimality); (d) the hero's own numbers: bounds of the v3 bike (POSITION min
   [-0.5, -0.26057, -0.19184], max [0.5, 0.26057, 0.19184], shifted by -FLOOR_Y = +0.2606 in y, expanded by the
   floor-glow extents), target [-0.0868, -0.0205 + 0.2606, 0.0536], fov 34, aspect 1792/1008 → radius within 2 % of
   1.2912 is NOT required here (the render is a tight crop), but at aspect 1.2 the radius must be larger than at
   aspect 1.778. **Mutation-test every assertion**: break the implementation (e.g. drop the aspect from the
   horizontal half-angle), confirm the test goes red, restore; list each mutation and its failing assertion in the
   report.
7. `README.md` (Hero bullet) and `HANDOFF.md` (engine section): one sentence each that the camera radius now fits the
   scene bounds to the stage with a margin.

## Success criteria
- `node js/fit.test.mjs` passes; `node js/grasp.test.mjs` still passes; `node --check` on every edited .js file;
  `node tools/stage.mjs _site` exits 0 (remove `_site/` afterwards). Add `js/fit.js` to the staged PUBLIC list in
  `tools/stage.mjs` (it is a runtime dependency of holo.js now) — the stage check fails otherwise.
- In the browser (auditor verifies with `?reduced=1` at 1512x808, 1920x1080, 1280x720, 1024x1366, 390x844):
  `window.__chewiHero.fitCheck(az, el)` over 36 azimuths x {elMin, el0, elMax} never returns a bbox outside the
  stage inset by 6 %; the rear wheel is fully visible at the opening pose on 1512x808; the opening composition on a
  1792x1008 stage is visually the render's pose.
- The hand and grasp scenes (`js/scenes.js`) are unchanged in behaviour: they return no `bounds`, so the engine must
  behave exactly as before when `bounds` is absent (guard it).

## Constraints
- Do not run `git commit`, `git worktree prune`, `git gc`, or `git maintenance` (Windows worktrees; WSL git corrupts
  their metadata).
- Do not touch `index.html`, `css/`, `assets/`, `3d/`, `tools/match-view.html`, `tools/bake-v3.py`, the hero shader,
  ANCHORS / VIEW / FLOOR_Y constants, `js/hand.js`, `js/grasp-layout.js`.
- Do NOT run npm install / builds beyond the node commands named above.
- KRW as integers. Never invent API names, prices, versions, or dates. three.js is 0.180.0 from the import map;
  `Box3`, `Vector3`, `PerspectiveCamera` are what you have — but `js/fit.js` must not import three (pure math on
  plain arrays), so holo.js converts.
- You execute in WSL but ALL delivered code runs on WINDOWS in a browser. No POSIX paths or fixtures.

## The three laws
1. Truth over comfort: report failures and uncertainty plainly.
2. If the task as stated seems wrong, flag it and do the minimum safe interpretation.
3. Verified over plausible: label everything you did not execute or trace this session.

## Reporting contract — your final message must contain
1. WHAT CHANGED: files and the one-line reason for each.
2. VERIFICATION: exact commands run and results; distinguish "ran and passed" from "wrote but did not run"; the
   mutation list from item 6.
3. UNVERIFIED: every symbol, behavior, or claim you could not confirm.
4. DEVIATIONS: anything done differently from this statement, and why.
5. OBSERVED ADJACENT ISSUES: reported, untouched.
