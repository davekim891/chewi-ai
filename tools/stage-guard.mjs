// Guards the staged public tree: no inbox address, no mailto, and a real contact key on deploy.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLACEHOLDER_KEY = 'WEB3FORMS_ACCESS_KEY_PENDING';
const LEAK_RE = /goburton|mailto:/i;

export function findLeaks(files) {
  return files.filter((f) => LEAK_RE.test(f.text)).map((f) => f.path);
}

function accessKeyValue(html) {
  const inputs = String(html ?? '').match(/<input\b[^>]*>/gi) || [];
  for (const tag of inputs) {
    if (!/\bname=["']access_key["']/i.test(tag)) continue;
    const quoted = tag.match(/\bvalue=["']([^"']*)["']/i);
    if (quoted) return quoted[1];
    const bare = tag.match(/\bvalue=([^\s>]+)/i);
    return bare ? bare[1] : '';
  }
  return '';
}

export function contactKeyProblem(html, { allowUnconfigured } = {}) {
  if (allowUnconfigured) return null;
  const key = accessKeyValue(html);
  if (key === PLACEHOLDER_KEY) {
    return 'contact form access_key is still WEB3FORMS_ACCESS_KEY_PENDING';
  }
  if (!UUID_RE.test(key)) {
    return 'contact form access_key is not a UUID';
  }
  return null;
}
