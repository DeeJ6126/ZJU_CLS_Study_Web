const sourcePlatforms = new Set(['cc98', 'duoduo', 'other']);

export function normalizeContentSource(input = {}, current = {}) {
  let sourcePlatform = String(input.sourcePlatform ?? current.sourcePlatform ?? 'cc98').trim() || 'cc98';
  let sourceUrl;
  if (input.sourceUrl !== undefined && input.sourceUrl !== null) {
    sourceUrl = input.sourceUrl;
  } else if (input.sourcePlatform === undefined && input.cc98Url !== undefined
    && (input.cc98Url || sourcePlatform === 'cc98')) {
    sourcePlatform = 'cc98';
    sourceUrl = input.cc98Url;
  } else {
    sourceUrl = current.sourceUrl ?? (sourcePlatform === 'cc98' ? current.cc98Url ?? input.cc98Url : '') ?? '';
  }
  sourceUrl = String(sourceUrl ?? '').trim();
  return { sourcePlatform, sourceUrl, cc98Url: sourcePlatform === 'cc98' ? sourceUrl : '' };
}

export function validateContentSource(input = {}, current = {}) {
  const value = normalizeContentSource(input, current);
  if (!sourcePlatforms.has(value.sourcePlatform)) {
    return { ok: false, status: 400, message: '来源平台无效。' };
  }
  if (value.sourceUrl) {
    try {
      const url = new URL(value.sourceUrl);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
        || /[\u0000-\u001f\u007f]/.test(value.sourceUrl) || value.sourceUrl.length > 2048) throw new Error();
    } catch {
      return { ok: false, status: 400, message: '原帖链接必须使用有效的 http 或 https 地址。' };
    }
  }
  return { ok: true, value };
}
