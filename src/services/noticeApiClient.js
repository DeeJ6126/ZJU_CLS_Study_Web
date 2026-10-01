import { createRequestClient } from './apiClient.js';

function queryString(filters) {
  return new URLSearchParams(Object.entries(filters).filter(([, value]) => value != null && value !== '')).toString();
}

export function createNoticeApiClient(fetchImpl = fetch) {
  const { request } = createRequestClient({ name: 'notices', fetchImpl, networkErrorMessage: '通知服务暂时无法连接。' });
  const itemPath = (id) => `api/admin/notices/${encodeURIComponent(id)}`;
  async function list(path, filters) {
    const result = await request(`${path}?${queryString(filters)}`);
    if (!result.ok) return result;
    return Array.isArray(result.items) && Number.isFinite(result.total)
      ? result : { ok: false, message: '通知列表暂时无法读取。' };
  }
  return {
    listPublic: (filters = {}) => list('api/notices', filters),
    listAdmin: (filters = {}) => list('api/admin/notices', filters),
    getPublic: (id) => request(`api/notices/${encodeURIComponent(id)}`),
    create: (input) => request('api/admin/notices', { method: 'POST', body: input }),
    update: (id, input) => request(itemPath(id), { method: 'PATCH', body: input }),
    publish: (id) => request(`${itemPath(id)}/publish`, { method: 'POST', body: {} }),
    archive: (id) => request(`${itemPath(id)}/archive`, { method: 'POST', body: {} }),
    uploadAttachment: (id, file) => request(`${itemPath(id)}/attachments`, {
      method: 'POST', body: file, headers: {
        'content-type': file.type || ({ pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }[file.name.split('.').at(-1).toLowerCase()] ?? 'application/octet-stream'),
        'x-file-name': encodeURIComponent(file.name), 'x-notice-upload': 'notice-attachment',
      },
    }),
    removeAttachment: (id, attachmentId) => request(`${itemPath(id)}/attachments/${encodeURIComponent(attachmentId)}`, { method: 'DELETE' }),
  };
}

export const noticeApiClient = createNoticeApiClient();
