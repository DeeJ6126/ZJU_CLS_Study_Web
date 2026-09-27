import { Marked } from './vendor/marked.esm.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function safeUrl(value) {
  const url = String(value ?? '').trim();
  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
    } catch {
      return '';
    }
  }
  if (/^(?:\/(?!\/)|\.\.?\/|#)/.test(url)) return url;
  return '';
}

const markdown = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    html({ text }) {
      return escapeHtml(text);
    },
    link({ href, title, tokens }) {
      const label = this.parser.parseInline(tokens);
      const url = safeUrl(href);
      if (!url) return label;
      const titleAttribute = title ? ` title="${escapeHtml(title)}"` : '';
      return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"${titleAttribute}>${label}</a>`;
    },
    image({ href, title, text }) {
      const url = safeUrl(href);
      if (!url) return escapeHtml(text);
      const titleAttribute = title ? ` title="${escapeHtml(title)}"` : '';
      return `<img src="${escapeHtml(url)}" alt="${escapeHtml(text)}" loading="lazy"${titleAttribute}>`;
    },
  },
});

export function renderCourseMarkdown(body) {
  return markdown.parse(String(body ?? ''));
}
