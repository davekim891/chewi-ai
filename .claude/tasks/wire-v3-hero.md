# Task: wire the 3d/v3 bike into the hero

## Context
Repo: this directory (chewi-ai, static site, no build step). Read README.md, HANDOFF.md, DESIGN.md first.
The hero (`js/hero-mesh.js`) currently loads `assets/bike.glb`, a TRELLIS-2 reconstruction, and draws it through a
textured-hologram shader with ten anchor "patches" (glow dots + labels) at constants VIEW / FLOOR_Y / ANCHORS that
`tools/match-view.html` computed for that mesh. A better mesh now exists: `3d/v3/bike.glb` (Meshy geometry, 120k tris,
the approved render projected on, action surfaces painted; see `3d/v3/README.md`). Dave has approved it visually and
asked: "wire v3 into the hero".

`tools/match-view.html` has already been run against `3d/v3/bike.glb` (browser step, done by the orchestrator). Its
output is committed at `3d/v3/view_v3.json`. Those are the numbers to use. Do NOT re-derive them, and do not run
match-view (it needs a visible browser).

## Mandate

### Part A (required): make v3 the hero mesh
1. Preserve the old mesh: `git mv assets/bike.glb 3d/trellis/bike.glb` and add `3d/trellis/README.md` (3 lines:
   TRELLIS-2 image-to-3D via Fal from `assets/hero-bike.jpg`, 70k faces, 1k texture, was the hero until this change;
   the old VIEW/FLOOR_Y/ANCHORS constants for it, copied verbatim from the current `js/hero-mesh.js`, so it can be
   restored).
2. Copy `3d/v3/bike.glb` to `assets/bike.glb` (keep `3d/v3/bike.glb` too; the hero must keep loading `assets/bike.glb`
   because `tools/stage.mjs` publishes only `assets/`).
3. In `js/hero-mesh.js` replace the constants with the v3 values from `3d/v3/view_v3.json`:
   - `VIEW = { az: -2.5416, el: 0.23, D: 1.2912, target: [-0.0868, -0.0205, 0.0536], fov: 34 }`
   - `FLOOR_Y = -0.2606` (the mesh's minimum Y; the tyre bottoms. The GLB POSITION min is [-0.5, -0.26057, -0.19184].)
   - `ANCHORS`: same ten ids and kinds, `p` from the JSON (4 decimals), keep each anchor's existing `offset` values.
     The bike now faces -X and left/right are mirrored in Z relative to the old mesh, so the `normal` fields must be
     recomputed by this rule: for the four anchors that carry a `normal` (pedal_l, pedal_r, grip_l, grip_r) set
     `normal: [0, 0, sign(p.z)]`, i.e. pedal_l -> [0,0,-1], pedal_r -> [0,0,1], grip_l -> [0,0,1], grip_r -> [0,0,-1].
     Anchors without a `normal` today stay without one.
   - Update the header comment and the "From tools/match-view.html against assets/bike.glb" comment to say the mesh is
     the Meshy v3 bike (`3d/v3/README.md`) and the numbers come from `3d/v3/view_v3.json`.
   - Do not change the shader, the engine (`js/holo.js`), the patch shapes, the reveal order, or the fallback image.
4. Docs: in `README.md` (the "Hero:" bullet) and `HANDOFF.md` (hero history item 4 and the 3d_v1 section) say the hero
   now uses the v3 mesh, what v3 is (one sentence, pointing at `3d/v3/README.md`), and that the TRELLIS mesh moved to
   `3d/trellis/`. Keep edits to those passages; do not rewrite the documents.

### Part B (required if Blender runs; otherwise report): remove the projection colour bleed
The audit of v3 found that the occlusion-free projection copies the render's green pedal onto the seat tube behind it
(a green band on the seat tube next to the crank), and can leave other stray hues. Fix in `tools/bake-v3.py`:
1. The projected render must contribute LUMINANCE ONLY, tinted with the wire colour: replace the "photo colour vs
   wire fallback" mix with `colour = WIRE * clamp(lum / 0.55, 0.35, 1.6)` where `lum` is the render pixel's luminance
   (RGB to BW node), and pixels outside the frame or darker than DARK still fall back to plain WIRE. The painted
   patches stay exactly as they are (they are the only source of category colour on the mesh).
2. Make the script self-contained in the repo: derive every path from the script's own location
   (`os.path.dirname(os.path.abspath(__file__))` is `tools/`, the repo root is its parent). Inputs:
   `3d/v2/bike.glb`, `assets/hero-bike.jpg`, `3d/v3/view_v2.json` (this is the match-view output for the v2 frame the
   bake projects in; do NOT use view_v3.json here, its frame is the scaled output). Intermediate PNG: write it to
   `3d/v3/bake.png` and add `3d/v3/bake.png` to `.gitignore`. Output: `3d/v3/bike.glb`.
3. Re-run the bake. Blender is a Windows program; from WSL run it through interop, from the repo root:
   `"/mnt/c/Program Files/Blender Foundation/Blender 5.1/blender.exe" -b --python tools/bake-v3.py`
   Expected log lines: PAINTED {...}, BAKED 2048, SCALED by 0.52574, EXPORT ... ~4.8 MB. If Blender cannot be
   launched from WSL, or the run errors, STOP Part B there: leave the script edits in place, do not hand-edit or fake
   any GLB, and describe the failure under DEVIATIONS. Part A must still be complete.
4. If the bake succeeded, copy the new `3d/v3/bike.glb` over `assets/bike.glb` again and update the "Texture" bullet
   in `3d/v3/README.md` to describe the luminance-only projection.

## Success criteria
- `assets/bike.glb` is byte-identical to `3d/v3/bike.glb`; `3d/trellis/bike.glb` is byte-identical to the previous
  `assets/bike.glb` (git shows it as a rename).
- `js/hero-mesh.js` parses (`node --check js/hero-mesh.js` is fine to run) and contains exactly the constants above.
- `node tools/stage.mjs _site` exits 0 (the auditor runs it; you may too, it is instant and touches only `_site/`).
- `node js/grasp.test.mjs` still passes (unrelated to this change, must not regress).
- In the browser (auditor verifies): the hero opens with the v3 bike in the render's pose (front wheel on the right,
  saddle upper-left, as in `assets/hero-bike.jpg`), the ten labels attach to the correct parts, hover/click still
  work, and no console errors. Part B: no green on the seat tube.

## Constraints
- Do not run `git commit`, `git worktree prune`, `git gc`, or `git maintenance` (Windows worktrees; WSL git corrupts
  their metadata). `git mv` and `git add` are fine.
- Do not touch `js/holo.js`, `js/hand.js`, `js/grasp-layout.js`, `js/scenes.js`, `tools/match-view.html`, `index.html`,
  `css/`, or anything under `assets/` other than `bike.glb`.
- Do not delete or regenerate `3d/v2/`, `3d/v1/`, `assets/hero-bike.jpg`, `assets/og.jpg`.
- Do NOT run npm install / builds / test suites beyond the three commands named above.
- KRW as integers. Never invent API names, prices, versions, or dates.
- You execute in WSL but ALL delivered code runs on WINDOWS. Never use POSIX-specific fixtures or paths in code.
  `tools/bake-v3.py` runs under Windows Blender: use `os.path` joins, no `/tmp`, no `/mnt/c` inside the script.

## The three laws
1. Truth over comfort: report failures and uncertainty plainly.
2. If the task as stated seems wrong, flag it and do the minimum safe interpretation.
3. Verified over plausible: label everything you did not execute or trace this session.

## Reporting contract — your final message must contain
1. WHAT CHANGED: files and the one-line reason for each.
2. VERIFICATION: exact commands run and results; distinguish "ran and passed" from "wrote but did not run".
3. UNVERIFIED: every symbol, behavior, or claim you could not confirm.
4. DEVIATIONS: anything done differently from this statement, and why.
5. OBSERVED ADJACENT ISSUES: reported, untouched.
