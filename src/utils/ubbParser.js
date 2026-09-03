// UBB (CC98-style) → HTML renderer for 学习心得/帖子正文.
//
// Implements the common CC98 editor tags (B / I / U / S, URL, IMG, SIZE, COLOR,
// ALIGN, QUOTE, CODE, SMILEY). Unknown tags are kept as plain text so embeds
// like [bilibili] / [audio] / [file] / [table] still render as their raw
// token rather than disappearing. Output is HTML-safe: source text is escaped
// first, then UBB tags are mapped to a constrained tag allowlist.

const escapeMap = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (ch) => escapeMap[ch]);
}

function sanitizeUrl(url) {
  const trimmed = String(url ?? '').trim();
  if (!trimmed) return '';
  if (/^(https?:|mailto:|tel:|#|\/)/i.test(trimmed)) return trimmed;
  return '';
}

function unescapeHtml(text) {
  return String(text)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function applyReplacements(input) {
  let text = input;

  // [code]...[/code] — strip the outer escape so inner content is shown
  // verbatim, then re-escape the inner. The outer escape would otherwise
  // double-escape our entities.
  text = text.replace(/\[code\]([\s\S]*?)\[\/code\]/g, (_, inner) => {
    const raw = unescapeHtml(inner);
    const safe = escapeHtml(raw);
    return `<pre class="ubb-code"><code>${safe}</code></pre>`;
  });

  // [quote]...[/quote]
  text = text.replace(/\[quote\]([\s\S]*?)\[\/quote\]/g, (_, inner) => {
    return `<blockquote class="ubb-quote">${inner}</blockquote>`;
  });

  // [url=href]text[/url] — paired form.
  text = text.replace(/\[url=([^\]\n]+)\]([\s\S]*?)\[\/url\]/g, (_, href, content) => {
    const safeHref = sanitizeUrl(href);
    if (!safeHref) return content;
    return `<a class="ubb-link" href="${escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer">${content}</a>`;
  });

  // [url]href[/url] — single-value form (link text is the URL itself).
  text = text.replace(/\[url\]([^\[\n]+?)\[\/url\]/g, (_, href) => {
    const safeHref = sanitizeUrl(href.trim());
    if (!safeHref) return escapeHtml(href);
    const label = escapeHtml(safeHref);
    return `<a class="ubb-link" href="${escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });

  // [img]src[/img]
  text = text.replace(/\[img\]([^\[\n]+?)\[\/img\]/g, (_, src) => {
    const safeSrc = sanitizeUrl(src.trim());
    if (!safeSrc) return '';
    return `<img class="ubb-image" src="${escapeHtml(safeSrc)}" alt="" loading="lazy" />`;
  });

  // [size=N]text[/size]
  text = text.replace(/\[size=(\d{1,2})\]([\s\S]*?)\[\/size\]/g, (_, size, content) => {
    const clamped = Math.min(7, Math.max(1, Number(size) || 1));
    return `<span class="ubb-size ubb-size-${clamped}">${content}</span>`;
  });

  // [color=#xxx|name]text[/color]
  text = text.replace(/\[color=([#\w]+)\]([\s\S]*?)\[\/color\]/g, (_, color, content) => {
    return `<span class="ubb-color" style="color:${escapeHtml(color)}">${content}</span>`;
  });

  // [align=left|center|right]text[/align]
  text = text.replace(/\[align=(left|center|right)\]([\s\S]*?)\[\/align\]/g, (_, align, content) => {
    return `<div class="ubb-align" style="text-align:${align}">${content}</div>`;
  });

  // [smiley]code[/smiley] — pass-through as <span>.
  text = text.replace(/\[smiley\]([\s\S]*?)\[\/smiley\]/g, (_, code) => {
    return `<span class="ubb-smiley">${code}</span>`;
  });

  // Basic inline tags — must come after paired-with-attr forms above.
  text = text.replace(/\[b\]([\s\S]*?)\[\/b\]/g, '<strong>$1</strong>');
  text = text.replace(/\[i\]([\s\S]*?)\[\/i\]/g, '<em>$1</em>');
  text = text.replace(/\[u\]([\s\S]*?)\[\/u\]/g, '<u>$1</u>');
  text = text.replace(/\[s\]([\s\S]*?)\[\/s\]/g, '<s>$1</s>');

  return text;
}

function paragraphsToHtml(escaped) {
  return escaped
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export function ubbToHtml(input) {
  const text = String(input ?? '');
  if (!text) return '';
  const escaped = escapeHtml(text);
  const withTags = applyReplacements(escaped);
  return paragraphsToHtml(withTags);
}

export function isUbbFormat(format) {
  return String(format ?? '').toLowerCase() === 'ubb';
}
