import { publicAssetPath } from './publicPath.js';
import { safeAttachmentUrl, escapeAttachmentHtml } from './attachmentLinks.js';

export function cc98LinkIcon(url) {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol) || !['cc98.org', 'www.cc98.org'].includes(parsed.hostname)) return '';
    return `<img class="content-cc98-icon" src="${publicAssetPath('/assets/cc98-icon.jpg')}" alt="" aria-hidden="true">`;
  } catch { return ''; }
}

export function linkBareCc98Urls(html) {
  let anchorDepth = 0;
  return html.split(/(<[^>]+>)/g).map(part => {
    if (part.startsWith('<')) {
      if (/^<a\b/i.test(part)) anchorDepth++;
      if (/^<\/a\b/i.test(part)) anchorDepth--;
      return part;
    }
    if (anchorDepth) return part;
    return part.replace(/https?:\/\/(?:www\.)?cc98\.org\/[^\s<>\[\]"]+/gi, value => {
      const trimmed = value.replace(/[。，；）]+$/, '');
      const url = safeAttachmentUrl(trimmed.replace(/&amp;/g, '&'));
      if (!url || !cc98LinkIcon(url)) return value;
      return `<a class="ubb-link" href="${escapeAttachmentHtml(url)}" target="_blank" rel="noopener noreferrer">${cc98LinkIcon(url)}${trimmed}</a>${value.slice(trimmed.length)}`;
    });
  }).join('');
}
