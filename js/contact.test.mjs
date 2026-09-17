// Headless checks for the contact form helpers. Run: node js/contact.test.mjs
import assert from 'node:assert/strict';
import { FORM_ENDPOINT_ID, isConfigured, validate, isBot, buildPayload, isSuccess } from './contact.js';

assert.equal(isConfigured('contact@chewi.ai'), true);
assert.equal(isConfigured(FORM_ENDPOINT_ID), true);
assert.equal(isConfigured('0123456789abcdef0123456789abcdef'), true);
assert.equal(isConfigured(''), false);
assert.equal(isConfigured('goburton@playhybrid.com'), false);
assert.equal(isConfigured('someone@gmail.com'), false);

const valid = { name: 'Ada Lovelace', email: 'ada@example.com', message: 'Hello from a partner team.' };

{
  const r = validate({ ...valid, name: '' });
  assert.equal(r.ok, false);
  assert.equal(r.errors.name, 'Please add your name.');
}
{
  const r = validate({ ...valid, email: '' });
  assert.equal(r.ok, false);
  assert.equal(r.errors.email, 'Please add your email.');
}
{
  const r = validate({ ...valid, message: '' });
  assert.equal(r.ok, false);
  assert.equal(r.errors.message, 'Please add a message.');
}
{
  const r = validate({ ...valid, message: '   ' });
  assert.equal(r.ok, false);
  assert.equal(r.errors.message, 'Please add a message.');
}
{
  const r = validate({ ...valid, email: 'not-an-email' });
  assert.equal(r.ok, false);
  assert.equal(r.errors.email, "That email doesn't look right.");
}
{
  const r = validate(valid);
  assert.equal(r.ok, true);
  assert.deepEqual(r.errors, {});
}

assert.equal(isBot([['_honey', '']]), false);
assert.equal(isBot([['_honey', 'spam']]), true);
assert.equal(isBot({ _honey: '1' }), true);
assert.equal(isBot([['name', 'Ada']]), false);
assert.equal(isBot([]), false);

{
  const payload = buildPayload([
    ['name', '  Ada  '],
    ['email', ' ada@example.com '],
    ['company', '   '],
    ['message', ' hello '],
    ['_next', 'https://chewi.ai/#contact'],
    ['_honey', 'spam'],
    ['_subject', ' Chewi AI: new message from chewi.ai '],
    ['_template', ' table '],
  ]);
  assert.deepEqual(payload, {
    name: 'Ada',
    email: 'ada@example.com',
    message: 'hello',
    _subject: 'Chewi AI: new message from chewi.ai',
    _template: 'table',
  });
  assert.equal('_next' in payload, false);
  assert.equal('_honey' in payload, false);
  assert.equal('company' in payload, false);
}
{
  const payload = buildPayload({ name: 'Ada', company: ' Acme ', message: 'Hi', _subject: 'S', _template: 'table' });
  assert.equal(payload.company, 'Acme');
  assert.equal(payload.name, 'Ada');
  assert.equal(payload._subject, 'S');
  assert.equal(payload._template, 'table');
}

assert.equal(isSuccess(200, { success: true }), true);
assert.equal(isSuccess(200, { success: 'true' }), true);
assert.equal(isSuccess(200, { success: 'false' }), false);
assert.equal(isSuccess(200, { success: false }), false);
assert.equal(isSuccess(200, {}), false);
assert.equal(isSuccess(500, { success: true }), false);

console.log('all contact checks passed');
