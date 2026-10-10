export const MAX_BATCH_ITEMS = 200;
export const MAX_BATCH_BYTES = 8 * 1024 * 1024;
const REQUEST_PREFIX = 'zjubio:content-batch-requests:v1:';

export function prepareContentBatchRequest(scope, fingerprint, preferredRequestId, storage) {
  try {
    if (!scope || typeof fingerprint !== 'string' || !fingerprint || fingerprint.length > 100) throw new Error('Invalid scope');
    const target = storage ?? globalThis.localStorage;
    const key = REQUEST_PREFIX + scope;
    const pending = JSON.parse(target.getItem(key) || '[]');
    if (!Array.isArray(pending)) throw new Error('Invalid requests');
    const existing = pending.find(item => item.fingerprint === fingerprint);
    if (existing) return { ok: true, requestId: existing.requestId };
    if (pending.length >= 20) return { ok: false, message: '待确认导入过多，请先重试之前的文件。' };
    const requestId = preferredRequestId || crypto.randomUUID();
    target.setItem(key, JSON.stringify([...pending, { fingerprint, requestId }]));
    return { ok: true, requestId };
  } catch { return { ok: false, message: '导入请求无法保存在本机，请检查浏览器存储后重试。' }; }
}

export function completeContentBatchRequest(scope, fingerprint, requestId, storage) {
  try {
    const target = storage ?? globalThis.localStorage;
    const key = REQUEST_PREFIX + scope;
    const pending = JSON.parse(target.getItem(key) || '[]');
    target.setItem(key, JSON.stringify(pending.filter(item => item.fingerprint !== fingerprint || item.requestId !== requestId)));
    return { ok: true };
  } catch { return { ok: false, message: '草稿已生成，本机待确认请求清理失败。' }; }
}

export async function readContentBatchFile(file) {
  if (!file || !/\.json$/i.test(file.name)) return { ok: false, message: '请选择 JSON 文件。' };
  if (file.size > MAX_BATCH_BYTES) return { ok: false, message: 'JSON 文件不能超过 8 MB。' };
  try {
    const document = JSON.parse((await file.text()).replace(/^\uFEFF/, ''));
    if (!document || typeof document !== 'object' || Array.isArray(document) || !Array.isArray(document.items)) {
      return { ok: false, message: 'JSON 需要包含 items 数组。' };
    }
    if (!document.items.length || document.items.length > MAX_BATCH_ITEMS) {
      return { ok: false, message: '每次导入需要包含 1 到 200 条内容。' };
    }
    return { ok: true, document };
  } catch { return { ok: false, message: '文件无法读取或不是有效的 JSON。' }; }
}

export function downloadContentBatch(document, filename) {
  const blob = new Blob([JSON.stringify(document, null, 2) + '\n'], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = globalThis.document.createElement('a');
  try {
    anchor.href = url;
    anchor.download = filename;
    globalThis.document.body.append(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
