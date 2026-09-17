# Task: GO's copy changes (2026-09-18) — less methodology, no automation claims

## Context
Repo: this directory (chewi-ai, static site on GitHub Pages at https://chewi.ai). Read README.md, PRODUCT.md and
DESIGN.md first; DESIGN.md is binding for visuals. Branch `go-copy` (checked out, branched from live `main`).
Pushing to `main` deploys; this branch does not.

GO (the client) asked for four changes. Dave agreed. The orchestrator has resolved the overlaps and wording; the
exact strings below are final. Use "Chewi" in running text (the rest of the page does), not GO's "CHEWI".
The page uses no dashes as punctuation; do not introduce any.

## Mandate

### A. Remove "What a compiled asset carries" and every schema field it exposes
1. `index.html`: delete the whole `<section class="manifest-section" id="manifest">…</section>`; delete the hero
   detail card's link `<a class="hero-detail-link" href="#manifest">Row in the manifest</a>`; delete
   `<script type="module" src="js/manifest.js"></script>`.
2. `git rm js/manifest.js`. In `tools/stage.mjs` remove `'js/manifest.js'` from `PUBLIC`.
3. `js/hero-mesh.js` `showDetail`: delete the loop over `.manifest tr[data-id]`; the role line becomes
   `ROLES[a.kind]` only (drop `, attached to ${p.joint}`, which is the `attached_to` field on the page). Keep the
   kind/id tag and the `KIND_NOTES` line. If `p`/`byId` become unused, remove them. Update the header comment
   (no manifest row). Change nothing else in that file.
4. `css/site.css`: delete every rule that only serves the removed markup (`.manifest*`, `.manifest-section`,
   `.manifest-copy`, `.manifest-wrap`, `.m-id`, `.m-kind`, `.m-joint`, `.hero-detail-link` if present) and remove
   `.manifest-section` from the shared responsive selector list. Touch no other rule.
5. Comments only: `js/bike.js` (the two comments that mention the manifest) and `js/colors.js` (drop "the
   manifest"). No data changes. `js/hero-image.js` is not published; leave it and report its stale references.

### B. "Where this matters" notes (`.where-notes`)
1. First block: `<h3>Built to scale across diverse 3D asset libraries</h3>` and
   `<p>Chewi is being developed to help transform existing 3D assets into structured, machine-understandable data for AI, simulation and spatial applications, reducing the manual work required to prepare them.</p>`
2. Second block: keep `<h3>Precision matched to the application</h3>`; the paragraph becomes only
   `<p>Different applications need different levels of semantic and physical precision.</p>`
   (delete the sentence about high-volume automation, validation, confidence scores and expert review).

### C. Replace "Two standards, kept separate" (`<section class="standards" id="standards">`)
1. Keep the section element, the grasp hologram markup and the caption paragraph exactly as they are.
2. `<h2>Structure AI can reason about. Interaction AI can act on.</h2>`
3. Lede: `<p class="lede">Chewi adds structured information about what an object is made of, how its parts relate, and how those parts can be interacted with, creating a richer bridge between AI models and 3D assets.</p>`
4. Directly after the lede, a compact chain:
   ```
   <ol class="chain" aria-label="How Chewi connects 3D assets to AI">
     <li>3D asset<span class="chain-arrow" aria-hidden="true">→</span></li>
     <li class="chain-self">Chewi<span class="chain-arrow" aria-hidden="true">→</span></li>
     <li>Understand<span class="chain-arrow" aria-hidden="true">→</span></li>
     <li>Reason<span class="chain-arrow" aria-hidden="true">→</span></li>
     <li>Interact</li>
   </ol>
   ```
   Style (new rules, DESIGN.md vocabulary, reads like the site's tag chips): `list-style: none`, flex row with
   wrap, gap 10px, margin-top 28px, padding 0. Each item: `--mono`, 12px, uppercase, letter-spacing 0.12em,
   1px `--hairline` border, radius 4px (the tag radius), padding 6px 10px, colour `--fg-muted`,
   `display: inline-flex; align-items: center; gap: 10px` so the arrow sits outside-right of the label.
   Arrow: `--fg-muted`, not uppercase-tracked. `.chain-self`: colour `--fg`, border `--fg-muted`. No accent, no
   semantic colours, no glow, no gradient, no shadow. Must wrap cleanly at 390px wide.
   Put the arrow OUTSIDE the chip border: make the border live on an inner `<span class="chain-label">` if needed,
   i.e. `<li><span class="chain-label">3D asset</span><span class="chain-arrow" aria-hidden="true">→</span></li>`.
   Use whichever of the two markups gives chips with arrows between them; report which.
5. Delete `<div class="standards-cols">…</div>` entirely and its CSS, and remove `.standards-cols` from the shared
   responsive selector list.

### D. Soften the automation claim in the problem section flow
`<span class="flow-v">A semantic correspondence layer, compiled automatically and validated.</span>` becomes
`<span class="flow-v">A semantic correspondence layer that transforms 3D assets into structured data AI can understand.</span>`

### E. Docs (minimal)
- PRODUCT.md: add a dated bullet under Capabilities and Constraints: GO's 2026-09-18 direction — no schema or
  manifest fields on the page, no explanation of how the system improves internally, customer benefit over
  methodology, and no automation or validation claims until the automation ceiling is proven (say "being
  developed to"). In Positioning, remove "automated at library scale" and "validated through animation, not just
  object or part labels" from the public-framing description.
- README.md: remove the manifest and manifest-row-highlight mentions (hero bullet and any file list).
- DESIGN.md: add a one-line "Chain" component; remove manifest references if any.
- HANDOFF.md: one sentence recording this change.

## Success criteria
- `node --check js/hero-mesh.js`; `node js/bike.test.mjs`, `node js/hand.test.mjs`, `node js/grasp.test.mjs`,
  `node js/fit.test.mjs` pass; `node tools/stage.mjs _site` exits 0 (remove `_site/` afterwards).
- In the staged `index.html`, zero case-insensitive matches for each of: `manifest`, `attached_to`, `attached to`,
  `provenance`, `confidence`, `compiled automatically`, `automate`, `automation`, `better prior`,
  `heterogeneous`, `Two standards`, `topology`. Report the grep. (`validation` still appears in the demo table
  caption, which is out of scope; report the count.)
- No file references `js/manifest.js` or `#manifest` except `js/hero-image.js` (unpublished).
- In the browser (auditor verifies): no console errors; clicking a hero surface opens the detail card with
  kind, id, role and note and no joint name; the new standards section renders the heading, lede, chain and the
  grasp hologram at 1512x808 and 390x844.

## Constraints
- Do not run `git commit`, `git push`, `git worktree prune`, `git gc` or `git maintenance`. `git rm` is fine.
- Do not touch `js/holo.js`, `js/fit.js`, `js/scenes.js`, `js/hand.js`, `js/grasp-layout.js`, `assets/`, `3d/`,
  `CNAME`, `.github/`, the hero copy, the demo section, the layers section or the footer.
- Change no copy other than the strings above.
- No npm install, no dependencies. KRW as integers. Never invent API names, prices, versions or dates.
- You execute in WSL; everything runs on Windows in a browser. No POSIX paths.

## The three laws
1. Truth over comfort: report failures and uncertainty plainly.
2. If the task as stated seems wrong, flag it and do the minimum safe interpretation.
3. Verified over plausible: label everything you did not execute or trace this session.

## Reporting contract — your final message must contain
1. WHAT CHANGED: files and the one-line reason for each.
2. VERIFICATION: exact commands run and results; "ran and passed" vs "wrote but did not run"; the grep table.
3. UNVERIFIED: every symbol, behavior, or claim you could not confirm.
4. DEVIATIONS: anything done differently from this statement, and why.
5. OBSERVED ADJACENT ISSUES: reported, untouched.
