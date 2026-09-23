/**
 * Sanitize an author-written HTML fragment before it is injected with v-html.
 *
 * The fragment lives in `public/` and is written by the site owner, so it is not
 * untrusted input. It is still cleaned because the content is fetched over HTTP:
 * this removes scriptable elements, inline event handlers, and dangerous URL
 * schemes, and rewrites relative asset paths so they survive a sub-path deploy.
 *
 * String-based on purpose: the project test runner is plain `node --test` with no
 * DOM implementation available.
 */

const blockedTags = [
  'script',
  'style',
  'title',
  'iframe',
  'object',
  'embed',
  'link',
  'meta',
  'base',
  'form',
];

const absoluteUrlPattern = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
const dangerousUrlPattern = /^(?:javascript|vbscript)\s*:/i;
const eventAttributePattern = /\son[a-z-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const urlAttributePattern = /\b(src|href|poster)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;

function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function stripDocumentWrappers(html) {
  return html
    .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<\/?(?:html|head|body)\b[^>]*>/gi, '');
}

function stripComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, '');
}

function stripBlockedElements(html) {
  let output = html;

  for (const tag of blockedTags) {
    output = output.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'), '');
    output = output.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi'), '');
  }

  return output;
}

export function sanitizeHtmlFragment(html, { rewriteUrl = (value) => value } = {}) {
  let output = stripDocumentWrappers(String(html ?? ''));
  output = stripComments(output);
  output = stripBlockedElements(output);
  output = output.replace(eventAttributePattern, '');

  output = output.replace(
    urlAttributePattern,
    (match, attribute, doubleQuoted, singleQuoted, bare) => {
      const value = String(doubleQuoted ?? singleQuoted ?? bare ?? '').trim();

      if (!value || value.startsWith('#')) {
        return match;
      }

      if (dangerousUrlPattern.test(value)) {
        return '';
      }

      if (absoluteUrlPattern.test(value)) {
        return match;
      }

      return `${attribute}="${escapeAttribute(rewriteUrl(value))}"`;
    },
  );

  return output.trim();
}
