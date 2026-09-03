import { createRequestClient } from './apiClient.js';

export function createCommentApiClient(fetchImpl = fetch) {
  const { request } = createRequestClient({ name: 'comments', fetchImpl, networkErrorMessage: '评论服务暂时无法连接。' });

  return {
    list: (contentId) => request(`api/content/items/${encodeURIComponent(contentId)}/comments`),
    create: (contentId, input) => request(`api/content/items/${encodeURIComponent(contentId)}/comments`, {
      method: 'POST', body: input,
    }),
    update: (id, body) => request(`api/comments/${encodeURIComponent(id)}`, {
      method: 'PATCH', body: { body },
    }),
    remove: (id) => request(`api/comments/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  };
}

export const commentApiClient = createCommentApiClient();
