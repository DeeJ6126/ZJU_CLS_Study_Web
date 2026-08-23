function queryString(filters = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      params.set(key, value);
    }
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function createAdminApiClient(fetchImpl = fetch) {
  async function requestJson(path, options = {}) {
    try {
      const isBlob = typeof Blob !== 'undefined' && options.body instanceof Blob;
      const response = await fetchImpl(path, {
        credentials: 'include',
        ...options,
        headers: {
          ...(options.body !== undefined && !isBlob ? { 'content-type': 'application/json' } : {}),
          ...(options.headers ?? {}),
        },
      });
      const data = await response.json();
      if (!response.ok) {
        return { ok: false, status: response.status, message: data.message ?? '请求失败。' };
      }
      return { ok: true, status: response.status, ...data };
    } catch {
      return { ok: false, status: 0, message: '管理服务暂时无法连接。' };
    }
  }

  return {
    fetchContent(filters = {}) {
      return requestJson(`api/admin/content${queryString(filters)}`);
    },
    createContent(input) {
      return requestJson('api/admin/content', { method: 'POST', body: JSON.stringify(input) });
    },
    updateContent(id, input) {
      return requestJson(`api/admin/content/${encodeURIComponent(id)}`, {
        method: 'PATCH', body: JSON.stringify(input),
      });
    },
    publishContent(id) {
      return requestJson(`api/admin/content/${encodeURIComponent(id)}/publish`, {
        method: 'POST', body: '{}',
      });
    },
    archiveContent(id) {
      return requestJson(`api/admin/content/${encodeURIComponent(id)}/archive`, {
        method: 'POST', body: '{}',
      });
    },
    uploadPdf(id, file) {
      return requestJson(`api/admin/content/${encodeURIComponent(id)}/file`, {
        method: 'PUT',
        headers: {
          'content-type': 'application/pdf',
          'x-file-name': encodeURIComponent(file.name),
          'x-admin-upload': 'course-content',
        },
        body: file,
      });
    },
    removePdf(id) {
      return requestJson(`api/admin/content/${encodeURIComponent(id)}/file`, {
        method: 'DELETE', body: '{}',
      });
    },
    fetchSubmissions(filters = {}) {
      return requestJson(`api/admin/submissions${queryString(filters)}`);
    },
    updateSubmission(id, input) {
      return requestJson(`api/admin/submissions/${encodeURIComponent(id)}`, {
        method: 'PATCH', body: JSON.stringify(input),
      });
    },
    approveSubmission(id) {
      return requestJson(`api/admin/submissions/${encodeURIComponent(id)}/approve`, {
        method: 'POST', body: '{}',
      });
    },
    rejectSubmission(id, note = '') {
      return requestJson(`api/admin/submissions/${encodeURIComponent(id)}/reject`, {
        method: 'POST', body: JSON.stringify({ note }),
      });
    },
    fetchAuditLogs(filters = {}) {
      return requestJson(`api/admin/audit-logs${queryString(filters)}`);
    },
    fetchActivities(filters = {}) {
      return requestJson(`api/admin/activities${queryString(filters)}`);
    },
    createActivity(input) {
      return requestJson('api/admin/activities', { method: 'POST', body: JSON.stringify(input) });
    },
    updateActivity(id, input) {
      return requestJson(`api/admin/activities/${encodeURIComponent(id)}`, {
        method: 'PATCH', body: JSON.stringify(input),
      });
    },
    publishActivity(id) {
      return requestJson(`api/admin/activities/${encodeURIComponent(id)}/publish`, {
        method: 'POST', body: '{}',
      });
    },
    archiveActivity(id) {
      return requestJson(`api/admin/activities/${encodeURIComponent(id)}/archive`, {
        method: 'POST', body: '{}',
      });
    },
  };
}

export const adminApiClient = createAdminApiClient();
