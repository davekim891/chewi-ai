// Headless checks for the staged-tree address and key guards. Run: node tools/stage-guard.test.mjs
import assert from 'node:assert/strict';
import { findLeaks, contactKeyProblem } from './stage-guard.mjs';

assert.deepEqual(
  findLeaks([
    { path: 'index.html', text: 'write to GOBURTON at the office' },
    { path: 'clean.html', text: 'a contact form' },
  ]),
  ['index.html'],
);
assert.deepEqual(
  findLeaks([
    { path: 'a.js', text: 'href="MAILTO:someone"' },
    { path: 'b.css', text: 'color: #fff' },
  ]),
  ['a.js'],
);
assert.deepEqual(
  findLeaks([
    { path: 'index.html', text: '<form class="contact-form"></form>' },
    { path: 'js/contact.js', text: 'export function validate() {}' },
  ]),
  [],
);

const placeholderHtml = '<input type="hidden" name="access_key" value="WEB3FORMS_ACCESS_KEY_PENDING">';
const badHtml = '<input type="hidden" name="access_key" value="not-a-uuid">';
const goodHtml = '<input type="hidden" name="access_key" value="a1b2c3d4-e5f6-7890-abcd-ef1234567890">';

assert.equal(typeof contactKeyProblem(placeholderHtml), 'string');
assert.match(contactKeyProblem(placeholderHtml), /WEB3FORMS_ACCESS_KEY_PENDING/);
assert.equal(typeof contactKeyProblem(badHtml), 'string');
assert.match(contactKeyProblem(badHtml), /UUID/i);
assert.equal(contactKeyProblem(goodHtml), null);
assert.equal(contactKeyProblem(placeholderHtml, { allowUnconfigured: true }), null);
assert.equal(contactKeyProblem(badHtml, { allowUnconfigured: true }), null);

console.log('all stage-guard checks passed');
