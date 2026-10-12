const fileExtensions = new Set(['pdf', 'md', 'txt', 'csv', 'json', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tex', 'ipynb', 'py', 'r', 'epub', 'png', 'jpg', 'jpeg', 'webp']);

export function escapeAttachmentHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

export function safeAttachmentUrl(value) {
  const raw = String(value ?? '').trim();
  if (!/^https?:\/\//i.test(raw) || /[\u0000-\u001f\u007f\\]/.test(raw)) return '';
  try {
    const url = new URL(raw);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

export function attachmentLink(value, { force = false } = {}) {
  const url = safeAttachmentUrl(value);
  if (!url) return null;
  let pathname = new URL(url).pathname;
  try { pathname = decodeURIComponent(pathname); } catch { /* Keep malformed percent escapes as literal filename text. */ }
  const extension = pathname.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ?? '';
  if (!force && !fileExtensions.has(extension)) return null;
  const isPdf = extension === 'pdf';
  const filename = (pathname.split('/').pop() || '附件').replace(/[\\/\u0000-\u001f<>:"|?*]/g, '_').slice(0, 200);
  return { url, isPdf, filename, label: isPdf ? '点击查看PDF' : '点击下载文件' };
}

export function renderAttachmentLink(value, options) {
  const file = attachmentLink(value, options);
  if (!file) return '';
  const download = file.isPdf ? '' : ` download="${escapeAttachmentHtml(file.filename)}"`;
  return `<a class="course-action-link content-file-link" href="${escapeAttachmentHtml(file.url)}" target="_blank" rel="noopener noreferrer" title="${escapeAttachmentHtml(file.filename)}"${download}>${file.label}</a>`;
}

export function renderLegacyResourceLink(value) {
  const url = safeAttachmentUrl(value);
  if (!url) return '';
  return renderAttachmentLink(url) || `<a class="course-action-link" href="${escapeAttachmentHtml(url)}" target="_blank" rel="noopener noreferrer">打开资料链接</a>`;
}
