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

## Correction pass (attempt 2) — Dave: "stick with GO's ask, since he will be showing the website"

Pass 1 is snapshot-committed. Its structure stays (manifest section removed, manifest.js deleted, stage list, CSS
cleanup, standards-cols removed, chain markup with `.chain-label`, manifest-row loop removed, docs). Its WORDING is
replaced: every orchestrator rewrite or extension is reverted and GO's text is used verbatim, including his
capitalisation "CHEWI", his periods and his spaced hyphen " - ". The earlier rules "use Chewi" and "no dashes"
are withdrawn. Copy the strings below character for character.

1. `.where-notes`, first block, exactly:
   `<div><h3>Built to scale across diverse 3D asset libraries.</h3><p>CHEWI is being developed to scale semantic structuring across large, diverse 3D asset libraries - reducing the manual work required to prepare 3D data for AI. CHEWI is being developed to help transform existing 3D assets into structured, machine-understandable data for AI, simulation and spatial applications.</p></div>`
   (GO's item 4 sentence replaces the old first sentence in place; his item 2 sentence replaces the old
   "As the library grows…" sentence in place; his item 2 heading replaces the old h3.)
2. `.where-notes`, second block: restore the paragraph from `git show main:index.html` exactly, i.e.
   `<p>Different applications need different levels of semantic and physical precision. Chewi is designed for high-volume automation through higher-assurance workflows, with tighter validation, confidence scores and expert review where the application demands it.</p>`
   GO did not ask for this change.
3. `js/hero-mesh.js`: restore the role line exactly as on `main`:
   ``detail.querySelector('.hero-detail-role').textContent = ROLES[a.kind] + (p ? `, attached to ${p.joint}` : '');``
   and keep/restore `byId` / `p` as on `main`. Keep the removal of the `.manifest tr[data-id]` loop and the
   `#manifest` link (they point at the deleted section). README: put `joint` back in the detail-card description.
4. Standards section:
   - `<h2>Structure AI can reason about. Interaction AI can act on.</h2>` (unchanged)
   - `<p class="lede">CHEWI adds structured information about what an object is made of, how its parts relate, and how those parts can be interacted with - creating a richer bridge between AI models and 3D assets.</p>`
   - Chain labels, in order, exactly: `3D Asset`, `CHEWI`, `Understand`, `Reason`, `Interact`. Update the `ol`
     aria-label to `How CHEWI connects 3D assets to AI`.
   - CSS: remove `text-transform: uppercase` and the `letter-spacing` from `.chain-label` so GO's capitalisation
     shows as written. Everything else in the chain CSS stays.
   - Delete the caption paragraph under the heading (`<p class="caption">A hand and a cup, each a usable asset on
     its own…</p>`). GO asked for this section's text to be replaced by his heading and sentence. Keep the grasp
     hologram markup untouched.
5. Problem section flow: keep pass 1's line (it is GO's verbatim text):
   `A semantic correspondence layer that transforms 3D assets into structured data AI can understand.`
6. Docs: PRODUCT.md's bullet should say the page copy for these sections is GO's verbatim wording from
   2026-09-18; revert any PRODUCT.md or DESIGN.md wording that claimed a broader rule than GO's four items
   (e.g. do not state "no automation claims anywhere"; the Precision paragraph keeps its automation sentence).
   Positioning: restore the removed phrases from `main` unless they are page copy (they are not; PRODUCT.md is
   internal). Keep HANDOFF's sentence accurate to the final state.

### Success criteria for this pass (replace the earlier grep list)
- Tests and stage as before, all passing; `_site/` removed afterwards.
- In staged `index.html`: each GO string above appears exactly once (report a table of string → count);
  zero matches for `manifest`, `attached_to`, `provenance`, `better prior`, `heterogeneous`, `Two standards`,
  `topology`, `compiled automatically`, `A hand and a cup`; `high-volume automation` appears exactly once (restored).
- `git --no-pager diff main -- js/hero-mesh.js` shows only the removed manifest loop and header comment.
- Constraints from the original statement still apply (no commit, no push, protected files untouched).
