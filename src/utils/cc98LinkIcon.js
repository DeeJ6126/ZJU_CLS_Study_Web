import { publicAssetPath } from './publicPath.js';
import { safeAttachmentUrl, escapeAttachmentHtml } from './attachmentLinks.js';

export function cc98LinkIcon(url) {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol) || !['cc98.org', 'www.cc98.org'].includes(parsed.hostname)) return '';
    return `<img class="content-cc98-icon" src="${publicAssetPath('/assets/cc98-icon.jpg')}" alt="" aria-hidden="true">`;
  } catch { return ''; }
}

export function contentLinkIcon(url) {
  const cc98 = cc98LinkIcon(url);
  if (cc98) return cc98;
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return '';
    const file = ({ 'pan.baidu.com': 'baidu-pan.ico', 'pan.zju.edu.cn': 'zju-cloud.png' })[parsed.hostname];
    return file ? `<img class="content-cc98-icon content-cloud-icon" src="${publicAssetPath(`/assets/link-icons/${file}`)}" alt="" aria-hidden="true">` : '';
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
    return part.replace(/https?:\/\/(?:(?:www\.)?cc98\.org|pan\.baidu\.com|pan\.zju\.edu\.cn)\/[^\s<>\[\]"]+/gi, value => {
      const trimmed = value.replace(/[。，；）]+$/, '');
      const url = safeAttachmentUrl(trimmed.replace(/&amp;/g, '&'));
      if (!url || !contentLinkIcon(url)) return value;
      return `<a class="ubb-link" href="${escapeAttachmentHtml(url)}" target="_blank" rel="noopener noreferrer">${contentLinkIcon(url)}${trimmed}</a>${value.slice(trimmed.length)}`;
    });
  }).join('');
}
