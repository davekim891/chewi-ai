// Headless checks for the staged-tree address and endpoint guards. Run: node tools/stage-guard.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findLeaks, contactEndpointProblem } from './stage-guard.mjs';

assert.deepEqual(
  findLeaks([
    { path: 'index.html', text: 'write to GOBURTON at the office' },
    { path: 'clean.html', text: 'a contact form' },
  ]),
  ['index.html'],
);
assert.deepEqual(
  findLeaks([
    { path: 'a.js', text: 'https://PlayHybrid.com/x' },
    { path: 'b.css', text: 'color: #fff' },
  ]),
  ['a.js'],
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
    { path: 'd.js', text: 'see Web3Forms docs' },
    { path: 'ok.html', text: 'a contact form' },
  ]),
  ['d.js'],
);
assert.deepEqual(
  findLeaks([
    { path: 'index.html', text: '<form class="contact-form"></form>' },
    { path: 'js/contact.js', text: 'export function validate() {}' },
  ]),
  [],
);
assert.deepEqual(
  findLeaks([{ path: 'index.html', text: 'A PlayHybrid product' }]),
  [],
);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const realHtml = readFileSync(join(root, 'index.html'), 'utf8');
const realJs = readFileSync(join(root, 'js/contact.js'), 'utf8');
assert.equal(contactEndpointProblem(realHtml, realJs), null);

const web3Html = '<form class="contact-form" action="https://api.web3forms.com/submit" method="POST" data-contact></form>';
assert.equal(typeof contactEndpointProblem(web3Html, realJs), 'string');
assert.match(contactEndpointProblem(web3Html, realJs), /FormSubmit/i);

const goburtonHtml = '<form class="contact-form" action="https://formsubmit.co/goburton@playhybrid.com" method="POST" data-contact></form>';
assert.equal(typeof contactEndpointProblem(goburtonHtml, realJs), 'string');
assert.match(contactEndpointProblem(goburtonHtml, realJs), /not allowed/i);

const mismatchJs = "export const FORM_ENDPOINT_ID = 'other@chewi.ai';";
assert.equal(typeof contactEndpointProblem(realHtml, mismatchJs), 'string');
assert.match(contactEndpointProblem(realHtml, mismatchJs), /FORM_ENDPOINT_ID/);

console.log('all stage-guard checks passed');
