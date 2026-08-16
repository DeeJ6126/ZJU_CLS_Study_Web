function createRequest(fetchImpl) {
  return async function request(path, options = {}) {
    try {
      const isFile = typeof Blob !== 'undefined' && options.body instanceof Blob;
      const response = await fetchImpl(path, {
        credentials: 'include',
        ...options,
        headers: {
          ...(options.body !== undefined && !isFile ? { 'content-type': 'application/json' } : {}),
          ...(options.headers ?? {}),
        },
      });
      const data = await response.json();
      if (!response.ok) {
        return { ok: false, status: response.status, message: data.message ?? '请求失败。' };
      }
      return { ok: true, status: response.status, ...data };
    } catch {
      return { ok: false, status: 0, message: '投稿服务暂时无法连接。' };
    }
  };
}

export function createSubmissionApiClient(fetchImpl = fetch) {
  const request = createRequest(fetchImpl);
  return {
    create(input) {
      return request('api/submissions', { method: 'POST', body: JSON.stringify(input) });
    },
    uploadPdf(id, file) {
      return request(`api/submissions/${encodeURIComponent(id)}/file`, {
        method: 'PUT',
        headers: {
          'content-type': 'application/pdf',
          'x-file-name': encodeURIComponent(file.name),
          'x-submission-upload': 'course-content',
        },
        body: file,
      });
    },
    toggleLike(contentId) {
      return request(`api/content/${encodeURIComponent(contentId)}/like`, { method: 'POST', body: '{}' });
    },
  };
}

export const submissionApiClient = createSubmissionApiClient();
