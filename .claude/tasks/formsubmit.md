# Task: release branch site-v3.5 — finish the merge, switch the contact form from Web3Forms to FormSubmit

## Context
Repo: this directory (chewi-ai, static site on GitHub Pages at https://chewi.ai). Read README.md, PRODUCT.md,
DESIGN.md, `.claude/tasks/contact-form.md` (the audited contact form) and `.claude/tasks/go-copy.md` (GO's copy)
first. Branch `site-v3.5` is checked out: it was created from `go-copy` (GO's audited copy changes) and
`git merge --no-commit --no-ff contact-form` was run. The merge is IN PROGRESS with two conflicts. Do not run
`git commit`, `git merge --abort` or `git reset`; the orchestrator commits after audit.

Why the provider changes: Web3Forms now requires creating an account to get an access key, which is not possible
here. Replacement: **FormSubmit** (formsubmit.co), no registration. Delivery path already set up by the
orchestrator: Namecheap free email forwarding `contact@chewi.ai` → GO's inbox (verified saved). The form posts to
FormSubmit with the endpoint address `contact@chewi.ai`. GO's personal address must still never appear in any
published file. `contact@chewi.ai` may appear in page source (form action and JS constant); it is a public role
address on the company domain. It must NOT be shown as visible text, a link, or in a hover/status bar.

FormSubmit facts read from formsubmit.co this session (the orchestrator could not send a live request; anything
not listed here is unverified):
- No registration. The first submission to an address triggers an email with an "Activate Form" link to that
  address; nothing is delivered until it is clicked. Activation will be done by Dave and GO after publishing.
- HTML endpoint: `action="https://formsubmit.co/<email>"` with `method="POST"`.
- AJAX endpoint shown in their docs: `https://formsubmit.co/ajax/<email>`, POST, JSON response (`dataType: "json"`).
  The exact JSON shape is NOT documented on the pages read. Treat success defensively (see below).
- Special fields: `_subject` (email subject), `_template` (`table` is one of the templates), `_next` (URL of the
  thank-you page after a non-AJAX submit), `_honey` honeypot `<input type="text" name="_honey" style="display:none">`,
  `_captcha` (`false` disables their reCAPTCHA; their docs recommend keeping it enabled, so do not send it),
  `_cc`, `_autoresponse`, `_blacklist`, `_webhook` (do not use these four).
- "Invisible emails": a random string can replace the address after activation. Not used now (it is emailed to
  the activated address and is not available to us). Design the config so swapping to a random string later is a
  one-constant change.

## Mandate

1. **Resolve the two merge conflicts** (keep GO's removal of the manifest, keep the contact form):
   - `index.html` scripts: no `js/manifest.js` tag; keep exactly one `<script type="module" src="js/contact.js"></script>`.
   - `tools/stage.mjs` `PUBLIC`: the HEAD list (no `js/manifest.js`) plus `'js/contact.js'`. Keep contact-form's
     staging guards. Remove the conflict markers. `git add` the two files.
   - Check the rest of the auto-merged files for sense: `css/site.css` keeps GO's removals and the chain rules AND
     the contact form rules; docs keep both branches' sentences. Report anything that auto-merged wrongly.

2. **Form markup** (`index.html`, footer form from the contact-form task; keep its layout, labels, fields,
   error elements, status region, `novalidate`, `data-contact`):
   - `action="https://formsubmit.co/contact@chewi.ai"` `method="POST"`.
   - Remove the Web3Forms hidden inputs (`access_key`, `from_name`, `redirect`) and the `botcheck` honeypot.
   - Hidden inputs: `_subject` = `Chewi AI: new message from chewi.ai`; `_template` = `table`;
     `_next` = `https://chewi.ai/#contact`.
   - Honeypot: `<input type="text" name="_honey" style="display:none" tabindex="-1" autocomplete="off" aria-hidden="true">`.

3. **`js/contact.js`**:
   - Config at the top: `export const FORM_ENDPOINT_ID = 'contact@chewi.ai';` and
     `export const AJAX_ENDPOINT = 'https://formsubmit.co/ajax/' + FORM_ENDPOINT_ID;` (only these two places name
     the address). Remove `PLACEHOLDER_KEY` and the UUID `isConfigured`; replace with
     `isConfigured(id)`: true for an address ending in `@chewi.ai` (`/^[a-z0-9._%+-]+@chewi\.ai$/i`) or a random
     string `/^[a-z0-9]{16,64}$/i`; false for empty, anything containing `goburton` or `playhybrid`, or any other
     address.
   - `isBot(entries)`: true when `_honey` has a non-empty value (a text honeypot is always submitted, possibly empty).
   - `buildPayload(entries)`: trimmed strings; remove `_next` and `_honey`; drop empty `company`; keep `_subject`,
     `_template`, `name`, `email`, `company` (if non-empty), `message`.
   - Submit: `fetch(AJAX_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) })`
     with the existing 15 s AbortController, sending state and failure handling.
   - Success rule (defensive, the JSON shape is unverified): success only when `response.status === 200` AND the
     parsed JSON has `success === true` or `success === 'true'`. Everything else, including `success: 'false'`
     (which is what an unactivated form is expected to return), a non-JSON body, non-200, network error or
     timeout, is the failure state. Keep the typed values on failure. `console.warn` the JSON `message` on a
     200-with-false so an unactivated form is diagnosable.
   - Keep all user-facing strings, validation rules, the hero CTA scroll/focus behaviour, and the rest unchanged.

4. **Guards** (`tools/stage-guard.mjs`, `tools/stage.mjs`):
   - `findLeaks`: case-insensitive `goburton`, `playhybrid.com`, `mailto:`, `web3forms` (leftover provider
     references are a defect). Not overridable.
   - Replace `contactKeyProblem` with `contactEndpointProblem(html, js)`: returns an error string unless the form
     `action` is exactly `https://formsubmit.co/` + an id that passes the same rule as `isConfigured`, AND the
     `FORM_ENDPOINT_ID` constant in `js/contact.js` equals that id. Remove `ALLOW_UNCONFIGURED_CONTACT` everywhere
     (workflow, README, code): the form is configured now.
   - Stage calls it on the staged `index.html` and `js/contact.js`; non-zero exit with the message on failure.

5. **Tests**: update `js/contact.test.mjs` and `tools/stage-guard.test.mjs` for the new rules:
   `isConfigured` (contact@chewi.ai true, a 32-char alphanumeric string true, empty false,
   goburton@playhybrid.com false, someone@gmail.com false); `isBot` (`_honey` empty false, non-empty true);
   `buildPayload` (removes `_next` and `_honey`, keeps `_subject`/`_template`, trims, drops empty company);
   a pure exported `isSuccess(status, json)` covering 200+true, 200+'true', 200+'false', 200+false, 200+{}, 500+true,
   and use it in the submit path; `findLeaks` catches each of the four strings case-insensitively;
   `contactEndpointProblem` passes the real markup + JS, fails a Web3Forms action, fails a goburton action, fails
   a mismatch between the action and the JS constant. Mutation-test every assertion group and list the mutations.
   Keep the workflow running both test files before stage.

6. **Docs** (minimal): README "Contact form" section (FormSubmit, contact@chewi.ai forwarding to GO via Namecheap,
   activation step after publishing, how to swap in the random string); PRODUCT.md (provider changed to
   FormSubmit, 2026-09-18, reason: Web3Forms requires an account); DESIGN.md unchanged unless it names the provider;
   HANDOFF.md: one sentence including the activation step still pending.

## Success criteria
- Merge conflicts resolved, no conflict markers anywhere (`git diff --check` clean for markers).
- `node --check` on `js/contact.js`, `tools/stage-guard.mjs`, `tools/stage.mjs`, `js/hero-mesh.js`.
- `node js/contact.test.mjs`, `node tools/stage-guard.test.mjs`, `node js/bike.test.mjs`, `node js/hand.test.mjs`,
  `node js/grasp.test.mjs`, `node js/fit.test.mjs` pass.
- `node tools/stage.mjs _site` exits 0 with no environment override; the staged tree contains `js/contact.js`,
  no `js/manifest.js`, and zero case-insensitive matches for `goburton`, `playhybrid.com`, `mailto:`, `web3forms`,
  `WEB3FORMS_ACCESS_KEY_PENDING`. Remove `_site/` afterwards.
- GO's copy from the go-copy task is intact (each of his strings still exactly once).

## Constraints
- No `git commit`, `git push`, `git merge --abort`, `git reset`, `git worktree prune`, `git gc`, `git maintenance`.
  `git add` is fine.
- Do not send any network request to formsubmit.co, web3forms.com or anywhere else.
- Do not touch `js/holo.js`, `js/fit.js`, `js/scenes.js`, `js/hand.js`, `js/grasp-layout.js`, `assets/`, `3d/`,
  `CNAME`, GO's copy, or any page copy other than the form's hidden fields.
- No npm install, no dependencies. KRW as integers. Never invent API names, prices, versions or dates.
- You execute in WSL; everything runs on Windows in a browser. No POSIX paths.

## The three laws
1. Truth over comfort: report failures and uncertainty plainly.
2. If the task as stated seems wrong, flag it and do the minimum safe interpretation.
3. Verified over plausible: label everything you did not execute or trace this session.

## Reporting contract — your final message must contain
1. WHAT CHANGED: files and the one-line reason for each (including how each conflict was resolved).
2. VERIFICATION: exact commands run and results; "ran and passed" vs "wrote but did not run"; the mutation table.
3. UNVERIFIED: every symbol, behavior, or claim you could not confirm.
4. DEVIATIONS: anything done differently from this statement, and why.
5. OBSERVED ADJACENT ISSUES: reported, untouched.

## Follow-up (attempt 1b) — section heading sizes, approved by Dave 2026-09-18

Pass 1 is committed as the merge commit. Measured in the browser: the section h2s of `.demo`, `.layers` and
`.close` get the display size from `css/site.css` (`.demo h2, .layers h2, .close h2 { font-size: clamp(1.7rem, 2.6vw, 3.1rem); }`),
while `.problem`, `.where` and `.standards` h2s fall back to the base h2 size (25.5px), visibly smaller.

1. Add `.problem h2`, `.where h2` and `.standards h2` to that selector list so all six section headings share the
   one display size. Change nothing else in that rule; keep `.problem h2 { max-width: 22ch; }`.
2. No copy changes, no other CSS changes. Report the diff of `css/site.css` for this follow-up.
3. Re-run `node tools/stage.mjs _site` (exit 0, then remove `_site/`).
Constraints from the statement above still apply (no commit, no push, no network requests).
