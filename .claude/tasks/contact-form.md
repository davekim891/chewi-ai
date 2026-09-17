# Task: replace the mailto links with a contact form that never shows GO's address

## Context
Repo: this directory (chewi-ai, static site on GitHub Pages, no build, no backend). Read README.md, PRODUCT.md and
DESIGN.md first; DESIGN.md is binding for every visual decision. Branch: `contact-form` (already checked out).
Pushing to `main` deploys to https://chewi.ai; this branch does not deploy.

Dave's request (2026-09-18): both "Curious? Get in touch" buttons (`index.html` hero and footer) are
`mailto:goburton@playhybrid.com` links. Hovering shows GO's address in the browser status bar, and clicking does
nothing on machines without a registered mail handler. He wants a contact section whose messages go to
goburton@playhybrid.com without the address ever being shown to visitors. This reverses PRODUCT.md's
"No email-capture backend (decided by Dave 2026-09-13; mailto instead)".

Delivery service: **Web3Forms**. Facts below were read from its docs this session (docs.web3forms.com):
- Endpoint `https://api.web3forms.com/submit`, POST. Its AJAX example sends
  `headers: { "Content-Type": "application/json", Accept: "application/json" }`, body `JSON.stringify(Object.fromEntries(new FormData(form)))`,
  then `await response.json()` and treats `response.status == 200` as success; the JSON carries `message`.
- Required field `access_key`. The key is emailed to the destination address when someone requests one on
  web3forms.com; submissions go to that address. The FAQ states the key is public ("Access key is public"), so it
  lives in the page. It is NOT available yet: use the placeholder `WEB3FORMS_ACCESS_KEY_PENDING` everywhere a key
  is needed. The API reference says the form ID and access key are the same UUID.
- Optional fields used here: `subject`, `from_name`. Without JavaScript a form post needs a hidden `redirect`
  field, because the endpoint otherwise returns JSON.
- Honeypot markup from their docs: `<input type="checkbox" name="botcheck" class="hidden" style="display: none;">`.
  Their docs mark the honeypot as deprecated in favour of a captcha; we use it anyway (low-traffic partner page,
  captcha friction is worse). Do not add hCaptcha.

## Mandate

1. `index.html`
   - Hero CTA: keep the label, arrow SVG and `.cta` class; change `href` to `#contact`. No `mailto:` anywhere.
   - Footer `<footer class="close" id="contact">`: keep the `h2`, the `.lede` paragraph (text unchanged) and the
     `.credit` line. Replace the footer CTA with a form:
     ```
     <form class="contact-form" action="https://api.web3forms.com/submit" method="POST" novalidate data-contact>
       hidden access_key = WEB3FORMS_ACCESS_KEY_PENDING
       hidden subject    = "Chewi AI: new message from chewi.ai"
       hidden from_name  = "chewi.ai contact form"
       hidden redirect   = "https://chewi.ai/#contact"
       honeypot: the exact botcheck checkbox above, plus aria-hidden="true" tabindex="-1" autocomplete="off"
       Name     (name="name",    required, autocomplete="name",  maxlength 200)
       Email    (name="email",   type="email", required, autocomplete="email", maxlength 254)
       Company  (name="company", optional, label shows "(optional)", autocomplete="organization", maxlength 200)
       Message  (name="message", textarea, required, maxlength 5000, rows 5)
       submit button: class "cta", text "Send message" + the same arrow SVG
       status region: <p class="contact-status" role="status" aria-live="polite"></p>
     </form>
     ```
     Every field has a visible `<label for>`; each field gets an error element referenced by `aria-describedby`.
   - Load `js/contact.js` with `<script type="module" src="js/contact.js"></script>` next to the other modules.
   - Layout: the footer is currently a 7/5 grid with `align-items: end`. Put the heading and lede in the left
     column and the form in the right column on wide screens; stack below 900px. The credit line stays full width.

2. `js/contact.js` (new ES module). Pure, DOM-free exports first, DOM wiring after, guarded by
   `typeof document !== 'undefined'` so node can import the file:
   - `PLACEHOLDER_KEY = 'WEB3FORMS_ACCESS_KEY_PENDING'`
   - `isConfigured(key)`: true only for a UUID (`/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`).
   - `validate({ name, email, message })` → `{ ok, errors }`, values trimmed; `errors` keys are field names with
     these exact messages: name "Please add your name.", email "Please add your email." when empty and "That email
     doesn't look right." when it fails `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, message "Please add a message.".
   - `isBot(entries)`: true when `botcheck` is present with any value.
   - `buildPayload(entries)`: plain object from form entries, all string values trimmed, `redirect` and `botcheck`
     removed, `company` removed when empty.
   - DOM behaviour on submit (`preventDefault` always):
     1. `isBot` → show the success state, send nothing.
     2. key not configured → `console.warn` once and show the failure message, send nothing.
     3. `validate` fails → set `aria-invalid="true"` and the error text on each bad field, focus the first bad field,
        send nothing. Editing a field clears its own error.
     4. Otherwise disable the button, set its text to "Sending…" and `aria-busy="true"`, then `fetch` exactly as in the
        docs shape above with a 15 s `AbortController` timeout.
     5. Success = `response.status === 200` and the parsed JSON's `success` is not `false`. Replace the form's fields
        with the message "Thanks. Your message is on its way." in the status region and move focus to it
        (`tabindex="-1"`).
     6. Any other outcome (non-200, JSON parse failure, network error, timeout) → keep everything the visitor typed,
        re-enable the button with its original label, show "Something went wrong sending your message. Please try
        again." Never reveal or suggest an email address.
   - Hero CTA: clicking `a.cta[href="#contact"]` scrolls to `#contact` (`behavior: 'smooth'`, or `'auto'` under
     `prefers-reduced-motion: reduce`) and focuses the Name field with `{ preventScroll: true }`. Without JavaScript
     the plain anchor still works.

3. `css/site.css`: form styles using existing tokens only, plus one new token `--danger: #ff6b6b` used only for
   form error text and invalid-field borders. Fields: `--bg-elevated` background, 1px `--hairline` border,
   `var(--radius)`, `--fg` text, 16px font (prevents iOS zoom), padding 12px 14px, full width; placeholder
   `--fg-muted`; `:focus-visible` outline 2px `--accent` offset 2px; textarea `resize: vertical`, min-height 140px.
   Labels: sans 14px `--fg-muted`; "(optional)" in the same colour at 13px. Gap 16px between fields, form
   max-width 560px. Disabled button: opacity 0.6, `cursor: progress`. The submit button reuses `.cta` with the
   top margin reduced to fit the form. No glows, gradients or shadows (DESIGN.md). Add `scroll-margin-top` on
   `#contact` if the top bar overlaps the section when jumped to.

4. `tools/stage-guard.mjs` (new, pure) and wiring in `tools/stage.mjs`:
   - `findLeaks(files)` where `files` is `[{ path, text }]`: returns the paths whose text contains `goburton` or
     `mailto:` (case-insensitive).
   - `contactKeyProblem(html, { allowUnconfigured })`: returns an error string when the `access_key` input still
     holds `WEB3FORMS_ACCESS_KEY_PENDING` or is not a UUID, unless `allowUnconfigured` is true; otherwise `null`.
   - `tools/stage.mjs`: add `js/contact.js` to `PUBLIC`. After staging, read every staged text file (`.html`, `.css`,
     `.js`, `.json`, `.svg`, `.txt`) and exit 1 with the offending paths if `findLeaks` returns any (not
     overridable). Exit 1 with the key message if `contactKeyProblem(index.html, { allowUnconfigured:
     process.env.ALLOW_UNCONFIGURED_CONTACT === '1' })` returns a string. Keep the existing reference check.

5. Tests, plain `node:assert` style like `js/grasp.test.mjs`:
   - `js/contact.test.mjs`: `isConfigured` (placeholder, empty, a non-UUID string all false; a UUID true);
     `validate` (each missing field, whitespace-only message, bad email, a valid set); `isBot`; `buildPayload`
     (trims, removes `redirect` and `botcheck`, drops empty `company`, keeps a non-empty one).
   - `tools/stage-guard.test.mjs`: `findLeaks` catches both strings case-insensitively and passes clean files;
     `contactKeyProblem` flags the placeholder and a non-UUID, passes a UUID, and passes the placeholder when
     `allowUnconfigured` is true.
   - Mutation-test every assertion group: break the implementation, run the test, see it fail, restore. List each
     mutation and the assertion that failed in your report.
   - `.github/workflows/deploy.yml`: add `node js/contact.test.mjs` and `node tools/stage-guard.test.mjs` steps
     before the stage step. Do not set `ALLOW_UNCONFIGURED_CONTACT` in the workflow: an unconfigured form must
     fail the deploy.

6. Docs, minimal edits:
   - PRODUCT.md: replace the mailto sentence in Operating Context and the "No email-capture backend" bullet with
     the 2026-09-18 decision: a contact form delivered by Web3Forms to GO's inbox, address never shown on the page.
     PRODUCT.md is not published, but write the address as "GO's inbox", not the literal address.
   - DESIGN.md: under Colour add the `--danger` row (form errors only); under Components add a "Contact form" entry
     describing fields, states and the "Send message" button; keep "Curious? Get in touch" as the contact-intent
     label.
   - README.md: a short "Contact form" section: where the key goes, that `node tools/stage.mjs _site` refuses to
     stage without a real key or with the address/mailto present, and `ALLOW_UNCONFIGURED_CONTACT=1` for local runs.
   - HANDOFF.md: one sentence.

## Success criteria
- `node --check` on `js/contact.js`, `tools/stage-guard.mjs`, `tools/stage.mjs`.
- `node js/contact.test.mjs`, `node tools/stage-guard.test.mjs`, `node js/bike.test.mjs`, `node js/hand.test.mjs`,
  `node js/grasp.test.mjs`, `node js/fit.test.mjs` all pass.
- `ALLOW_UNCONFIGURED_CONTACT=1 node tools/stage.mjs _site` exits 0; `node tools/stage.mjs _site` exits non-zero
  naming the unconfigured key. Remove `_site/` afterwards.
- `git grep -n -i "goburton\|mailto:" -- index.html js css` returns nothing.
- Browser behaviour (the auditor verifies): both buttons lead to the form, no address in any hover/status text or
  page source, validation messages, sending state, success and failure states with a stubbed endpoint, the typed
  message survives a failure, mobile layout, keyboard focus order.

## Constraints
- Do not run `git commit`, `git push`, `git worktree prune`, `git gc` or `git maintenance`.
- Do not touch `js/holo.js`, `js/fit.js`, `js/hero-mesh.js`, `js/hand.js`, `js/scenes.js`, `js/grasp-layout.js`,
  `assets/`, `3d/`, `CNAME`, or any hologram code. Do not change page copy other than the two CTAs and the new form.
- Do not contact web3forms.com or request a key. Do not send any network request to api.web3forms.com.
- No npm install, no dependencies, no build step. Plain ES modules.
- Never invent API names, prices, versions or dates. KRW as integers.
- You execute in WSL but everything runs on Windows in a browser. No POSIX paths or fixtures.

## The three laws
1. Truth over comfort: report failures and uncertainty plainly.
2. If the task as stated seems wrong, flag it and do the minimum safe interpretation.
3. Verified over plausible: label everything you did not execute or trace this session.

## Reporting contract — your final message must contain
1. WHAT CHANGED: files and the one-line reason for each.
2. VERIFICATION: exact commands run and results; "ran and passed" vs "wrote but did not run"; the mutation table.
3. UNVERIFIED: every symbol, behavior, or claim you could not confirm.
4. DEVIATIONS: anything done differently from this statement, and why.
5. OBSERVED ADJACENT ISSUES: reported, untouched.
