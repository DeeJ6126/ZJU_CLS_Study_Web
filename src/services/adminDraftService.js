const PREFIX = 'zjubio:admin-drafts:v1:';
const TYPES = new Set(['experience', 'material', 'paper']);
const FIELDS = {
  courseCode: 24, type: 20, title: 80, summary: 200, author: 40, body: 100000,
  bodyFormat: 20, externalUrl: 2000, cc98Url: 2000, sourcePlatform: 20, sourceUrl: 2000,
  gpa: 10, year: 20, teacher: 40,
};

function storageOrDefault(storage) {
  if (storage) return storage;
  try { return globalThis.localStorage; } catch { return null; }
}

function sanitize(input) {
  if (!input || typeof input !== 'object' || typeof input.key !== 'string' || !/^[a-zA-Z0-9:_-]{1,120}$/.test(input.key)) return null;
  const form = {};
  for (const [key, max] of Object.entries(FIELDS)) form[key] = String(input.form?.[key] ?? '').slice(0, max);
  if (!TYPES.has(form.type)) return null;
  form.bodyFormat = form.bodyFormat === 'ubb' ? 'ubb' : 'markdown';
  form.sourcePlatform = ['cc98', 'duoduo', 'other'].includes(form.sourcePlatform) ? form.sourcePlatform : 'cc98';
  return {
    key: input.key, majorId: String(input.majorId ?? '').slice(0, 50),
    editingId: String(input.editingId ?? '').slice(0, 100), requestId: String(input.requestId ?? '').slice(0, 100),
    pendingFileName: String(input.pendingFileName ?? '').slice(0, 200),
    savedFile: input.savedFile && typeof input.savedFile === 'object' ? {
      fileName: String(input.savedFile.fileName ?? '').slice(0, 200),
      url: String(input.savedFile.url ?? '').slice(0, 2000),
    } : null,
    baseUpdatedAt: String(input.baseUpdatedAt ?? '').slice(0, 100),
    updatedAt: String(input.updatedAt ?? '').slice(0, 100), form,
    revision: String(input.revision ?? '').slice(0, 100),
  };
}

export function readAdminDrafts(scope, storage) {
  if (!scope) return { ok: true, drafts: [] };
  try {
    const target = storageOrDefault(storage);
    if (!target) return { ok: false, drafts: [], message: '本机草稿无法读取。' };
    const raw = target.getItem(PREFIX + scope);
    const value = raw ? JSON.parse(raw) : [];
    const drafts = (Array.isArray(value) ? value : []).map(sanitize).filter(Boolean);
    return { ok: true, drafts: drafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) };
  } catch { return { ok: false, drafts: [], message: '本机草稿无法读取。' }; }
}

export function saveAdminDraft(scope, input, storage, expectedRevision = '') {
  try {
    const draft = sanitize({ ...input, updatedAt: new Date().toISOString(), revision: globalThis.crypto.randomUUID() });
    if (!scope || !draft) return { ok: false, message: '草稿内容无效。' };
    const target = storageOrDefault(storage);
    if (!target) throw new Error('Storage unavailable');
    const current = readAdminDrafts(scope, target);
    if (!current.ok) return current;
    const previous = current.drafts.find((item) => item.key === draft.key);
    if (expectedRevision && previous?.revision !== expectedRevision) {
      return { ok: false, message: '此草稿已在另一窗口修改，请重新恢复草稿。' };
    }
    if (!current.drafts.some((item) => item.key === draft.key) && current.drafts.length >= 20) {
      return { ok: false, message: '本机未完成草稿已达 20 条，请先处理已有草稿。' };
    }
    const drafts = [draft, ...current.drafts.filter((item) => item.key !== draft.key)];
    target.setItem(PREFIX + scope, JSON.stringify(drafts));
    return { ok: true, draft, drafts };
  } catch { return { ok: false, message: '自动保存失败，请保存草稿。' }; }
}

export function removeAdminDraft(scope, key, storage, expectedRevision = '') {
  if (!scope) return { ok: false, message: '账号状态已变化。' };
  try {
    const target = storageOrDefault(storage);
    if (!target) throw new Error('Storage unavailable');
    const current = readAdminDrafts(scope, target);
    if (!current.ok) return current;
    if (expectedRevision && current.drafts.find((item) => item.key === key)?.revision !== expectedRevision) {
      return { ok: true, skipped: true, drafts: current.drafts };
    }
    const drafts = current.drafts.filter((item) => item.key !== key);
    target.setItem(PREFIX + scope, JSON.stringify(drafts));
    return { ok: true, drafts };
  } catch { return { ok: false, message: '本机草稿更新失败。' }; }
}

export function hasAdminDraftContent(form, fileName = '') {
  return Boolean(fileName || ['title', 'summary', 'author', 'body', 'externalUrl', 'sourceUrl', 'cc98Url', 'teacher', 'year', 'gpa']
    .some((field) => String(form?.[field] ?? '').trim()));
}
