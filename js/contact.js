// Contact form: validate, pack, and POST to FormSubmit without ever showing a personal inbox.
// Pure helpers are safe to import from node; DOM wiring runs only in a browser.

export const FORM_ENDPOINT_ID = 'contact@chewi.ai';
export const AJAX_ENDPOINT = 'https://formsubmit.co/ajax/' + FORM_ENDPOINT_ID;

const CHEWI_ADDR_RE = /^[a-z0-9._%+-]+@chewi\.ai$/i;
const INVISIBLE_ID_RE = /^[a-z0-9]{16,64}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FIELD_ORDER = ['name', 'email', 'message'];
const KEEP_FIELDS = new Set(['_subject', '_template', 'name', 'email', 'company', 'message']);
const SUCCESS_TEXT = 'Thanks. Your message is on its way.';
const FAILURE_TEXT = 'Something went wrong sending your message. Please try again.';
const SENDING_TEXT = 'Sending…';
const FETCH_MS = 15000;

function isForbiddenId(id) {
  const s = String(id ?? '').toLowerCase();
  return s.includes('go' + 'burton') || s.includes('play' + 'hybrid');
}

export function isConfigured(id) {
  const s = String(id ?? '');
  if (!s || isForbiddenId(s)) return false;
  return CHEWI_ADDR_RE.test(s) || INVISIBLE_ID_RE.test(s);
}

export function validate({ name, email, message }) {
  const errors = {};
  const n = String(name ?? '').trim();
  const e = String(email ?? '').trim();
  const m = String(message ?? '').trim();
  if (!n) errors.name = 'Please add your name.';
  if (!e) errors.email = 'Please add your email.';
  else if (!EMAIL_RE.test(e)) errors.email = "That email doesn't look right.";
  if (!m) errors.message = 'Please add a message.';
  return { ok: Object.keys(errors).length === 0, errors };
}

function pairs(entries) {
  if (entries == null) return [];
  if (typeof entries[Symbol.iterator] === 'function') return [...entries];
  return Object.entries(entries);
}

export function isBot(entries) {
  for (const [key, value] of pairs(entries)) {
    if (key === '_honey' && String(value ?? '') !== '') return true;
  }
  return false;
}

export function buildPayload(entries) {
  const out = {};
  for (const [key, value] of pairs(entries)) {
    if (key === '_next' || key === '_honey') continue;
    if (!KEEP_FIELDS.has(key)) continue;
    const s = String(value ?? '').trim();
    if (key === 'company' && s === '') continue;
    out[key] = s;
  }
  return out;
}

export function isSuccess(status, json) {
  if (status !== 200) return false;
  if (json == null || typeof json !== 'object') return false;
  return json.success === true || json.success === 'true';
}

function fieldOf(form, name) {
  return form.querySelector(`[name="${name}"]`);
}

function errorOf(form, name) {
  const field = fieldOf(form, name);
  const id = field?.getAttribute('aria-describedby');
  return id ? form.querySelector(`[id="${id}"]`) : null;
}

function setFieldError(form, name, message) {
  const field = fieldOf(form, name);
  const err = errorOf(form, name);
  if (field) field.setAttribute('aria-invalid', 'true');
  if (err) err.textContent = message;
}

function clearFieldError(form, name) {
  const field = fieldOf(form, name);
  const err = errorOf(form, name);
  if (field) field.removeAttribute('aria-invalid');
  if (err) err.textContent = '';
}

function setStatus(form, text, state) {
  const status = form.querySelector('.contact-status');
  if (!status) return null;
  status.textContent = text;
  if (state) status.dataset.state = state;
  else delete status.dataset.state;
  return status;
}

function showSuccess(form) {
  const fields = form.querySelector('.contact-fields');
  if (fields) fields.hidden = true;
  const status = setStatus(form, SUCCESS_TEXT, 'success');
  if (status) {
    status.tabIndex = -1;
    status.focus();
  }
}

function showFailure(form, button, originalHtml) {
  if (button) {
    button.disabled = false;
    button.removeAttribute('aria-busy');
    button.innerHTML = originalHtml;
  }
  setStatus(form, FAILURE_TEXT, 'error');
}

let unconfiguredWarned = false;

async function onSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const button = form.querySelector('button[type="submit"]');
  const originalHtml = button ? button.innerHTML : '';

  if (isBot(data)) {
    showSuccess(form);
    return;
  }

  if (!isConfigured(FORM_ENDPOINT_ID)) {
    if (!unconfiguredWarned) {
      unconfiguredWarned = true;
      console.warn('Contact form is not configured; the message was not sent.');
    }
    showFailure(form, button, originalHtml);
    return;
  }

  const check = validate({
    name: data.get('name'),
    email: data.get('email'),
    message: data.get('message'),
  });
  for (const name of FIELD_ORDER) clearFieldError(form, name);
  if (!check.ok) {
    for (const name of FIELD_ORDER) {
      if (check.errors[name]) setFieldError(form, name, check.errors[name]);
    }
    const first = FIELD_ORDER.find((name) => check.errors[name]);
    fieldOf(form, first)?.focus();
    return;
  }

  if (button) {
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = SENDING_TEXT;
  }
  setStatus(form, '', null);

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_MS);
  try {
    const response = await fetch(AJAX_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(buildPayload(data)),
      signal: ac.signal,
    });
    let payload;
    try {
      payload = await response.json();
    } catch {
      showFailure(form, button, originalHtml);
      return;
    }
    if (isSuccess(response.status, payload)) {
      showSuccess(form);
      return;
    }
    if (
      response.status === 200
      && payload
      && typeof payload === 'object'
      && (payload.success === false || payload.success === 'false')
      && payload.message
    ) {
      console.warn(payload.message);
    }
    showFailure(form, button, originalHtml);
  } catch {
    showFailure(form, button, originalHtml);
  } finally {
    clearTimeout(timer);
  }
}

function onFieldEdit(event) {
  const el = event.target;
  if (!el || !el.name) return;
  const form = el.form || el.closest('form');
  if (form) clearFieldError(form, el.name);
}

function scrollBehavior() {
  return matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

function onHeroCta(event) {
  const contact = document.getElementById('contact');
  if (!contact) return;
  event.preventDefault();
  contact.scrollIntoView({ behavior: scrollBehavior() });
  if (location.hash !== '#contact') history.pushState(null, '', '#contact');
  const name = document.getElementById('contact-name');
  if (name) name.focus({ preventScroll: true });
}

if (typeof document !== 'undefined') {
  for (const form of document.querySelectorAll('form[data-contact]')) {
    form.addEventListener('submit', onSubmit);
    form.addEventListener('input', onFieldEdit);
    form.addEventListener('change', onFieldEdit);
  }
  for (const a of document.querySelectorAll('a.cta[href="#contact"]')) {
    a.addEventListener('click', onHeroCta);
  }
}
