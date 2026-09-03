import { createRequestClient } from './apiClient.js';

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
  const { request } = createRequestClient({ name: 'admin', fetchImpl, networkErrorMessage: '管理服务暂时无法连接。' });

  return {
    fetchContent(filters = {}) {
      return request(`api/admin/content${queryString(filters)}`);
    },
    createContent(input) {
      return request('api/admin/content', { method: 'POST', body: input });
    },
    updateContent(id, input) {
      return request(`api/admin/content/${encodeURIComponent(id)}`, { method: 'PATCH', body: input });
    },
    publishContent(id) {
      return request(`api/admin/content/${encodeURIComponent(id)}/publish`, { method: 'POST', body: {} });
    },
    archiveContent(id) {
      return request(`api/admin/content/${encodeURIComponent(id)}/archive`, { method: 'POST', body: {} });
    },
    uploadPdf(id, file) {
      return request(`api/admin/content/${encodeURIComponent(id)}/file`, {
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
      return request(`api/admin/content/${encodeURIComponent(id)}/file`, { method: 'DELETE', body: {} });
    },
    fetchSubmissions(filters = {}) {
      return request(`api/admin/submissions${queryString(filters)}`);
    },
    updateSubmission(id, input) {
      return request(`api/admin/submissions/${encodeURIComponent(id)}`, { method: 'PATCH', body: input });
    },
    approveSubmission(id) {
      return request(`api/admin/submissions/${encodeURIComponent(id)}/approve`, { method: 'POST', body: {} });
    },
    rejectSubmission(id, note = '') {
      return request(`api/admin/submissions/${encodeURIComponent(id)}/reject`, { method: 'POST', body: { note } });
    },
    fetchAuditLogs(filters = {}) {
      return request(`api/admin/audit-logs${queryString(filters)}`);
    },
    fetchActivities(filters = {}) {
      return request(`api/admin/activities${queryString(filters)}`);
    },
    createActivity(input) {
      return request('api/admin/activities', { method: 'POST', body: input });
    },
    updateActivity(id, input) {
      return request(`api/admin/activities/${encodeURIComponent(id)}`, { method: 'PATCH', body: input });
    },
    publishActivity(id) {
      return request(`api/admin/activities/${encodeURIComponent(id)}/publish`, { method: 'POST', body: {} });
    },
    archiveActivity(id) {
      return request(`api/admin/activities/${encodeURIComponent(id)}/archive`, { method: 'POST', body: {} });
    },
  };
}

export const adminApiClient = createAdminApiClient();
