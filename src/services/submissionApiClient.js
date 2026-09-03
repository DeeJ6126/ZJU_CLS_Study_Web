import { createRequestClient } from './apiClient.js';

export function createSubmissionApiClient(fetchImpl = fetch) {
  const { request } = createRequestClient({ name: 'submissions', fetchImpl, networkErrorMessage: '投稿服务暂时无法连接。' });

  return {
    create(input) {
      return request('api/submissions', { method: 'POST', body: input });
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
      return request(`api/content/${encodeURIComponent(contentId)}/like`, { method: 'POST', body: {} });
    },
  };
}

export const submissionApiClient = createSubmissionApiClient();
