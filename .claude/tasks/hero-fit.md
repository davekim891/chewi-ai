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

## Findings to fix (attempt 2) — orchestrator gate, 2026-09-15

Attempt 1 is a KILL on success criterion 4: `fitRadius` = 2.677 on every landscape aspect (VIEW.D is 1.2912), so the
bike renders at about half its intended size and fills roughly a quarter of the stage. Your report correctly
diagnosed the cause: the AABB is a poor hull. Its floor-level corners beside the wheels (the handlebar width projected
down to the tyre plane) are what leave the frame, not the bike. The fix is to fit the SILHOUETTE, not the box:

1. `bounds` becomes a point set, not a Box3. `js/hero-mesh.js` returns `fitPoints`: a `Float32Array` (or array of
   [x,y,z]) of WORLD-space points sampled from the bike mesh's POSITION attribute (every k-th vertex so that
   1,500–3,000 points remain; the mesh has 81,268 vertices, so k = 32 gives ~2,540), transformed by the bike group's
   world matrix (after `bike.position.y = -FLOOR_Y`), PLUS 16 points on each tyre floor-glow ring at its outer
   radius (y = 0), so the glows are inside the frame too. Keep the `bounds`/Box3 path out; remove it rather than
   leaving two code paths.
2. `js/fit.js` `fitRadius` takes `points` (any count) instead of 8 corners; the per-point linear solve you derived is
   unchanged. Complexity: 36 az × 3 el × ~2,600 points ≈ 280k projections per `resize()`; that is fine (it runs only
   on resize and once after build), but do it in a plain loop over a flat Float32Array, no allocation per point.
3. `fitMargin` for the hero: 0.04 (the label layout clamps labels inside the stage on its own).
4. Report the numbers: `fitRadius` at aspect 1792/1008, 1.2 (Dave's stage is about 1.2:1 at 1512x808), 1.0 and
   0.6 (phone portrait), and the opening pose's bike fill (projected bike width / stage width at az0, el0) for
   aspect 1.2. Orchestrator's rough expectation, to be checked not matched: on landscape aspects the binding pose is
   side-on (length 1.0 across the stage) or the elMax tilt, giving a radius in the neighbourhood of 1.8–1.9, i.e.
   the opening pose about 30 % smaller than the render crop, not 50 %. If your result differs, explain which pose
   and point binds.
5. Update `js/fit.test.mjs` for the point-set API: (a)–(c) as before; (d) replace the AABB case with the sampled-hull
   case: build a synthetic bike-like point set (two circles of radius 0.26 at x = ±0.34, y = 0.26, in the XY plane,
   plus the four grip/saddle points) and assert that the fitted radius at aspect 1.2 is strictly less than the
   AABB-corner radius for the same set's bounding box (this pins the reason for the change). Mutation-test again and
   list the mutations.
6. Everything else in the mandate stands (elMin/el0/elMax, 36 azimuths, `fit()` / `fitCheck()` hooks, minimality,
   `cam.radius` floor, stage.mjs, docs sentences). Keep your attempt-1 derivation and test infrastructure; this is a
   change of input, not of method.

## Findings to fix (attempt 3) — orchestrator gate, 2026-09-15; executor: Opus (Windows-side)

Attempt 2 met its own spec and is a KILL on the user's bar: `fitRadius` = 2.4534 on every landscape aspect (mesh-only
1.9756), opening-pose bike width = 0.559 of the stage at aspect 1.2. The bike is half size. The binding sample is the
drag-only extreme (el = elMax 0.62, az ≈ 100°) against the rear floor glow. Paying for a pose the auto-orbit never
visits is the wrong trade. New design, replacing the "one static radius for every reachable pose" rule:

1. **Static envelope = the untouched auto-orbit only.** `fitRadius` is computed (on resize and after build, as now)
   over all 36 azimuths but only over el in [el0 − bobAmp − 0.05, el0 + bobAmp + 0.05] (sample 3 values: min, el0,
   max; the ±0.05 is the mouse-hover pitch `pitchT` range in holo.js), with the same point set (sampled vertices +
   glow ellipses) and margin 0.04. This is what a visitor who never drags sees: nothing cut off, no breathing.
   Orchestrator's estimate for aspect 1.2: side-on binds horizontally at about 1.75; report the real number.
2. **Dynamic zoom-out for drags.** Every frame, after `az`/`el` are known, compute `rNeed = fitRadius` for THAT pose
   only (one azimuth, one elevation; ~2,600 point projections, no allocation) and set the camera radius to a
   smoothed `rLive`, where the target is `max(fitRadius, rNeed)` and `rLive += (target − rLive) · (1 − e^(−4·dt))`
   (same smoothing constant the engine already uses for yaw). So a drag to an extreme tilt dollies the camera back
   just enough, and it eases back in when released. Since `rNeed ≤ fitRadius` for every pose inside the envelope,
   the untouched orbit has a constant radius (assert this in the test: for all sampled envelope poses,
   `rNeed(az, el) ≤ fitRadius + 1e−6`).
3. Hooks: `fit()` now also returns `rLive` and `rNeed` for the current pose; `fitCheck(az, el)` returns the bbox at
   the radius the engine would use for that pose (`max(fitRadius, rNeed(az, el))`), so a probe over ALL 36 az ×
   {elMin, el0, elMax} still never sees a point outside the margin box — that remains a success criterion, now met
   by the dynamic term instead of a single radius.
4. Tests (`js/fit.test.mjs`): keep (a)–(d); add (e) the envelope invariant from item 2 on the synthetic bike, and (f)
   a drag-extreme pose whose `rNeed` is strictly greater than the envelope `fitRadius` (proves the dynamic term is
   live). Mutation-test (e) and (f) too (e.g. clamp `rNeed` to `fitRadius`, drop the el term) and list mutations.
5. **Browser verification is part of this attempt** (you run Windows-side): headless Chrome
   ("C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new, unique --user-data-dir under your temp
   dir, kill only your own PID; never touch the user's Chrome or the python server on port 8732, which serves this
   repo at http://localhost:8732/), `?reduced=1` at window sizes 1512x808, 1920x1080, 1280x720, 1024x1366, 390x844:
   screenshot each; for 1512x808 confirm the rear wheel is fully inside the stage at the opening pose and report the
   projected bike width / stage width (via `window.__chewiHero.fit()` or the DOM, whichever the reduced mode
   exposes; if the hook is unreachable in headless, measure the screenshot). Also run `fitCheck` over 36 az × 3 el
   through `--dump-dom`-free means (e.g. a tiny probe page under tools/ that imports the engine, or
   `--remote-debugging-port` + a node WebSocket script) and report the worst margin. Do not claim what you did not
   run; `?reduced=1` forces the static pose, so the dynamic term (item 2) is proved by the tests plus one non-reduced
   screenshot at a larger virtual-time budget if the headless page reaches the webgl state (it fell back to the
   image at 25 s in an earlier audit; if that happens, say so).
6. Docs sentence in README/HANDOFF updated to describe the envelope + dynamic dolly. Mandate constraints unchanged
   (no changes to VIEW/ANCHORS/FLOOR_Y, shader, index.html, css, assets; no git commit).
