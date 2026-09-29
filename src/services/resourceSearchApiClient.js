import { createJsonClient } from './apiClient.js';

const RESOURCE_SEARCH_PATH = '/api/search/resources';

export function createResourceSearchApiClient({ fetchImpl } = {}) {
  const client = createJsonClient({
    name: 'resource-search',
    fetchImpl,
    networkErrorMessage: '资料搜索暂时不可用，请稍后重试。',
  });

  return {
    async search({ query = '', course = '', type = '', teacher = '', year = '', page = 1, pageSize = 10, signal } = {}) {
      const params = new URLSearchParams({
        q: String(query).trim(),
        course: String(course).trim(),
        type: String(type).trim(),
        teacher: String(teacher).trim(),
        year: String(year).trim(),
        page: String(page),
        pageSize: String(pageSize),
      });
      const result = await client.requestJson(`${RESOURCE_SEARCH_PATH}?${params}`, { signal });
      if (!result.ok) return result;
      if (!Array.isArray(result.items) || !Number.isInteger(result.total) || result.total < 0) {
        return { ok: false, message: '资料搜索返回的数据无效，请稍后重试。' };
      }
      return result;
    },
  };
}

export const resourceSearchApiClient = createResourceSearchApiClient();
