// Guards the staged public tree: no personal inbox, no mailto, no leftover provider, and a live FormSubmit endpoint.

import { isConfigured } from '../js/contact.js';

const LEAK_RE = /goburton|playhybrid\.com|mailto:|web3forms/i;
const FORMSUBMIT_PREFIX = 'https://formsubmit.co/';

export function findLeaks(files) {
  return files.filter((f) => LEAK_RE.test(f.text)).map((f) => f.path);
}

function contactFormAction(html) {
  const tags = String(html ?? '').match(/<form\b[^>]*>/gi) || [];
  for (const tag of tags) {
    if (!/\bdata-contact\b/i.test(tag)) continue;
    const quoted = tag.match(/\baction=["']([^"']*)["']/i);
    if (quoted) return quoted[1];
    const bare = tag.match(/\baction=([^\s>]+)/i);
    return bare ? bare[1] : '';
  }
  return '';
}

function formEndpointIdFromJs(js) {
  const m = String(js ?? '').match(/export\s+const\s+FORM_ENDPOINT_ID\s*=\s*['"]([^'"]*)['"]/);
  return m ? m[1] : '';
}

export function contactEndpointProblem(html, js) {
  const action = contactFormAction(html);
  if (!action.startsWith(FORMSUBMIT_PREFIX)) {
    return 'contact form action is not a FormSubmit endpoint';
  }
  const id = action.slice(FORMSUBMIT_PREFIX.length);
  if (!isConfigured(id)) {
    return 'contact form endpoint id is not allowed';
  }
  const declared = formEndpointIdFromJs(js);
  if (declared !== id) {
    return 'contact form action does not match FORM_ENDPOINT_ID';
  }
  return null;
}
