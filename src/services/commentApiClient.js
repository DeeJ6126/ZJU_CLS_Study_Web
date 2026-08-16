export function createCommentApiClient(fetchImpl = fetch) {
  async function request(path, options = {}) {
    try {
      const response = await fetchImpl(path, {
        credentials: 'include',
        headers: options.method && options.method !== 'DELETE'
          ? { 'content-type': 'application/json', ...(options.headers ?? {}) }
          : options.headers,
        ...options,
      });
      const data = await response.json();
      return response.ok
        ? { ok: true, status: response.status, ...data }
        : { ok: false, status: response.status, message: data.message ?? '请求失败。' };
    } catch {
      return { ok: false, status: 0, message: '评论服务暂时无法连接。' };
    }
  }
  return {
    list: (contentId) => request(`api/content/items/${encodeURIComponent(contentId)}/comments`),
    create: (contentId, input) => request(`api/content/items/${encodeURIComponent(contentId)}/comments`, {
      method: 'POST', body: JSON.stringify(input),
    }),
    update: (id, body) => request(`api/comments/${encodeURIComponent(id)}`, {
      method: 'PATCH', body: JSON.stringify({ body }),
    }),
    remove: (id) => request(`api/comments/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  };
}

export const commentApiClient = createCommentApiClient();
