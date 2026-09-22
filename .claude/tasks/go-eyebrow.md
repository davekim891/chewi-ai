# Task: replace "Coming soon" with GO's "IN DEVELOPMENT · SEEKING DESIGN PARTNERS"

## Context
Repo: this directory (chewi-ai, static site live at https://chewi.ai). Read README.md, PRODUCT.md and DESIGN.md
first. Branch `go-eyebrow` (checked out, from live `main`). Pushing to `main` deploys; this branch does not.

GO (the client), 2026-09-22: "'Coming soon' at the very top now feels slightly wrong. The site demonstrates
working technology, measured results, interactive examples, and asks for design partners. 'Coming soon' subtly
makes it sound like CHEWI doesn't exist yet. I'd consider replacing it with something like:
IN DEVELOPMENT · SEEKING DESIGN PARTNERS". Dave approved and asked for the page's description text to match.
GO's eyebrow string is used verbatim, including his capitals and his middle dot (U+00B7).

## Mandate
1. `index.html` line ~39, the hero eyebrow: `<p class="eyebrow">Coming soon</p>` becomes
   `<p class="eyebrow">IN DEVELOPMENT · SEEKING DESIGN PARTNERS</p>`. Write the middle dot as the literal
   character `·` (U+00B7) in UTF-8, not an HTML entity and not a bullet. Change nothing else on that line.
2. `index.html` line ~7, `<meta name="description">`: replace the trailing `Coming soon.` with
   `In development, seeking design partners.` The rest of the sentence is unchanged.
3. `index.html` line ~11, `<meta property="og:description">`: becomes
   `The intelligence layer between AI and the 3D world. In development, seeking design partners.`
4. `css/site.css`: only if needed so the longer eyebrow does not overflow or clip at 390px wide. The eyebrow rule
   is mono 12px, 0.18em tracking, uppercase, accent. Allow it to wrap naturally if it must; do not shrink the
   font, do not change colour, tracking or case, and do not touch any other rule. If nothing is needed, change
   nothing and say so.
5. Docs: PRODUCT.md "Confirmed copy from GO" bullet and the "Coming-soon surface" bullet: record that the eyebrow
   is now GO's 2026-09-22 line and drop "Coming Soon" as confirmed copy. DESIGN.md's direction-contract block is a
   historical record: leave it. HANDOFF.md: one sentence.
6. `tools/render-static.mjs` still writes `COMING SOON` into an unused alternative share image (`assets/og.svg`,
   not published). Leave it and report it.

## Success criteria
- `node js/bike.test.mjs`, `node js/hand.test.mjs`, `node js/grasp.test.mjs`, `node js/fit.test.mjs`,
  `node js/contact.test.mjs`, `node tools/stage-guard.test.mjs` all pass.
- `node tools/stage.mjs _site` exits 0; remove `_site/` afterwards.
- In the staged `index.html`: `IN DEVELOPMENT · SEEKING DESIGN PARTNERS` appears exactly once with the correct
  UTF-8 bytes for the middle dot (C2 B7; report a byte check, e.g. `node -e` reading the file and printing the
  code point); `Coming soon` and `Coming Soon` appear zero times; the two description tags read as specified.
- No other copy changed anywhere: `git --no-pager diff main -- index.html` shows exactly three changed lines.

## Constraints
- No `git commit`, `git push`, `git worktree prune`, `git gc`, `git maintenance`.
- Do not touch the contact form, GO's other copy, `js/`, `assets/`, `3d/`, `CNAME`, `.github/`.
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
