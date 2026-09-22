# Task: make the hero eyebrow break after the middle dot on narrow screens

## Context
Repo: this directory (chewi-ai, static site live at https://chewi.ai). Branch `eyebrow-break` (checked out, from
live `main`). Pushing to `main` deploys; this branch does not. Read DESIGN.md before touching CSS.

Live now (v3.6): `<p class="eyebrow">IN DEVELOPMENT · SEEKING DESIGN PARTNERS</p>`, styled by the `.eyebrow` rule
in `css/site.css` (mono, 12px, 0.18em tracking, uppercase, `var(--accent)`, 22px margin-bottom).

Measured in a browser during the v3.6 audit: the line is 374.41px wide. It fits on one line at 1512, 1280 and
430 wide. It wraps at 900, 390 and 320. The wrap at 390 currently reads `IN DEVELOPMENT · SEEKING DESIGN` /
`PARTNERS`, leaving one word alone on the second line. Dave asked for the break to fall after the dot instead:
`IN DEVELOPMENT ·` / `SEEKING DESIGN PARTNERS`.

## Mandate
1. `index.html`, the eyebrow line only: keep the visible text exactly as it is, character for character, and wrap
   the second half in a span so it cannot break internally:
   `<p class="eyebrow">IN DEVELOPMENT · <span class="eyebrow-hold">SEEKING DESIGN PARTNERS</span></p>`
   Keep the single space either side of the middle dot (U+00B7, bytes C2 B7). Do not use a non-breaking space
   character and do not use an HTML entity for the dot.
2. `css/site.css`: add one rule next to the existing `.eyebrow` rule:
   `.eyebrow-hold { white-space: nowrap; }`
   Change nothing else: no font-size, colour, tracking, case or margin changes, and no other selector.
3. No other file changes except HANDOFF.md, one sentence recording the wrap fix.

## Success criteria
- `node js/bike.test.mjs`, `node js/hand.test.mjs`, `node js/grasp.test.mjs`, `node js/fit.test.mjs`,
  `node js/contact.test.mjs`, `node tools/stage-guard.test.mjs` all pass.
- `node tools/stage.mjs _site` exits 0; remove `_site/` afterwards.
- `git --no-pager diff main` touches exactly `index.html` (one line), `css/site.css` (one rule) and `HANDOFF.md`.
- The eyebrow's visible text is unchanged: the staged `index.html` still yields
  `IN DEVELOPMENT · SEEKING DESIGN PARTNERS` when tags are stripped from that paragraph, with the dot still
  bytes C2 B7 and no BOM. Report the byte check.
- Reasoning to report (the auditor measures it in a real browser): at 12px with 0.18em tracking in JetBrains Mono,
  the full line is ~374.4px, `IN DEVELOPMENT ·` is ~150px and `SEEKING DESIGN PARTNERS` is ~215px, so the held
  phrase still fits inside the hero copy column at 320px wide (~300px box). State whether you agree and why.

## Constraints
- No `git commit`, `git push`, `git worktree prune`, `git gc`, `git maintenance`.
- Do not touch `js/`, `assets/`, `3d/`, `CNAME`, `.github/`, the contact form, or any other copy.
- No npm install, no dependencies, no network requests. KRW as integers. Never invent API names, prices,
  versions or dates.
- You execute in WSL; everything runs on Windows in a browser. No POSIX paths. Write UTF-8 without a BOM.

## The three laws
1. Truth over comfort: report failures and uncertainty plainly.
2. If the task as stated seems wrong, flag it and do the minimum safe interpretation.
3. Verified over plausible: label everything you did not execute or trace this session.

## Reporting contract — your final message must contain
1. WHAT CHANGED: files and the one-line reason for each.
2. VERIFICATION: exact commands run and results; "ran and passed" vs "wrote but did not run"; the byte check.
3. UNVERIFIED: every symbol, behavior, or claim you could not confirm.
4. DEVIATIONS: anything done differently from this statement, and why.
5. OBSERVED ADJACENT ISSUES: reported, untouched.
