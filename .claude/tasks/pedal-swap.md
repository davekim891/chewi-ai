# Task: pedal_l and pedal_r are labelled the wrong way round on the hero

## Context
Repo: this directory (chewi-ai, static site, no build). Read README.md and HANDOFF.md first. The hero (`js/hero-mesh.js`)
draws the v3 bike with ten anchors. Dave, looking at the live v3.3 site: "pedal l and pedal r need to be reversed in
labeling". He is right, and here is why so you can check it rather than trust it: the bike faces -X in mesh space and
+Y is up, so the rider's right-hand side is forward x up = (-1,0,0) x (0,1,0) = (0,0,-1), i.e. NEGATIVE z. The opening
camera sits at negative z too (about x -0.80, z -0.98), so the viewer sees the bike's RIGHT side (the drive side; the
chainring is on the near side). In `js/hero-mesh.js` today the near-side pedal (p.z = -0.0436, normal [0,0,-1]) is
called `pedal_l` and the far-side pedal (p.z = +0.0720, normal [0,0,1]) is `pedal_r`. Those ids are swapped. The
mislabel came from the render's anchor pixel list, which was labelled by eye; `tools/label-overlay.html` even says
"The bike is seen from its right side" while tagging the near upper pedal `pedal_l`.

## Mandate
1. `js/hero-mesh.js` ANCHORS: swap the ids so that `pedal_r` carries the near-side data
   `{ kind: 'CONTACT', p: [ 0.0734, -0.0390, -0.0436], offset: [-56, -40], normal: [0, 0, -1] }` and `pedal_l` carries
   the far-side data `{ kind: 'CONTACT', p: [-0.0184, -0.2014,  0.0720], offset: [56, 36], normal: [0, 0, 1] }`.
   Position, offset and normal travel together (the offsets were tuned for those screen positions); only the id
   changes. Keep the object key order in the file the same as today (pedal_l line before pedal_r line) so the diff is
   a two-line swap of the data, and add a one-line comment above them: near side (-z) is the rider's right.
2. Keep the render-derived tool data consistent with the same correction, id swap only, no coordinate changes:
   - `3d/v3/view_v3.json` and `3d/v3/view_v2.json`: swap the `id` values of the two pedal anchor entries (leave `p`,
     `kind`, `how` with their entries).
   - `tools/match-view.html` ANCHORS list, `tools/label-overlay.html` L list, `js/hero-image.js` list: swap the id
     strings between the two pedal rows (pixel coordinates stay with their rows).
   - `tools/label-overlay.html`: fix the comment so it no longer contradicts itself (right side seen, near pedal is
     the right pedal).
3. Do NOT touch: `js/bike.js` (the procedural bike's pedal_l/pedal_r are geometrically correct in its own frame),
   `js/manifest.js`, `index.html`, `css/`, `assets/` (including `assets/og.jpg`, the share image: it still carries the
   old labels; report it under OBSERVED ADJACENT ISSUES, do not regenerate it), `3d/*/bike.glb`, `tools/bake-v3.py`,
   `js/holo.js`, `js/fit.js`.
4. Docs: one sentence in HANDOFF.md (hero history or gotchas) recording the correction and the right-hand-rule reason,
   so nobody "fixes" it back.

## Success criteria
- `node --check js/hero-mesh.js js/hero-image.js`; `node js/fit.test.mjs`, `node js/grasp.test.mjs`,
  `node js/bike.test.mjs`, `node js/hand.test.mjs` all pass (bike.test.mjs checks js/bike.js, which you do not touch;
  it must stay green); `node tools/stage.mjs _site` exits 0 (remove `_site/` afterwards).
- `git diff --stat` touches only: js/hero-mesh.js, js/hero-image.js, tools/match-view.html, tools/label-overlay.html,
  3d/v3/view_v3.json, 3d/v3/view_v2.json, HANDOFF.md. In hero-mesh.js the only non-comment change is the two pedal
  lines.
- In the browser (auditor verifies): at the opening pose the label on the near, upper pedal reads CONTACT pedal_r
  and the far, lower pedal (visible when dragged round) reads pedal_l; hover/click on the near pedal highlights the
  manifest row `pedal_r`.

## Constraints
- Do not run `git commit`, `git worktree prune`, `git gc`, or `git maintenance` (Windows worktrees).
- Do NOT run npm install / builds beyond the node commands above. KRW as integers. Never invent API names, prices,
  versions, or dates. You execute in WSL but the code runs on Windows in a browser; no POSIX paths or fixtures.

## The three laws
1. Truth over comfort: report failures and uncertainty plainly.
2. If the task as stated seems wrong, flag it and do the minimum safe interpretation.
3. Verified over plausible: label everything you did not execute or trace this session.

## Reporting contract — your final message must contain
1. WHAT CHANGED: files and the one-line reason for each.
2. VERIFICATION: exact commands run and results; "ran and passed" vs "wrote but did not run".
3. UNVERIFIED: every symbol, behavior, or claim you could not confirm.
4. DEVIATIONS: anything done differently from this statement, and why.
5. OBSERVED ADJACENT ISSUES: reported, untouched.
