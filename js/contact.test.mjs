// Headless checks for the contact form helpers. Run: node js/contact.test.mjs
import assert from 'node:assert/strict';
import { PLACEHOLDER_KEY, isConfigured, validate, isBot, buildPayload } from './contact.js';

const UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const valid = { name: 'Ada Lovelace', email: 'ada@example.com', message: 'Hello from a partner team.' };

assert.equal(isConfigured(PLACEHOLDER_KEY), false);
assert.equal(isConfigured(''), false);
assert.equal(isConfigured('not-a-uuid'), false);
assert.equal(isConfigured(UUID), true);

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

assert.equal(isBot([['botcheck', 'on']]), true);
assert.equal(isBot([['botcheck', '']]), true);
assert.equal(isBot({ botcheck: '1' }), true);
assert.equal(isBot([['name', 'Ada']]), false);
assert.equal(isBot([]), false);

{
  const payload = buildPayload([
    ['name', '  Ada  '],
    ['email', ' ada@example.com '],
    ['company', '   '],
    ['message', ' hello '],
    ['redirect', 'https://chewi.ai/#contact'],
    ['botcheck', 'on'],
    ['access_key', ' KEY '],
    ['subject', ' Chewi '],
  ]);
  assert.deepEqual(payload, {
    name: 'Ada',
    email: 'ada@example.com',
    message: 'hello',
    access_key: 'KEY',
    subject: 'Chewi',
  });
  assert.equal('redirect' in payload, false);
  assert.equal('botcheck' in payload, false);
  assert.equal('company' in payload, false);
}
{
  const payload = buildPayload({ name: 'Ada', company: ' PlayHybrid ', message: 'Hi' });
  assert.equal(payload.company, 'PlayHybrid');
  assert.equal(payload.name, 'Ada');
}

console.log('all contact checks passed');
