// API client for the cross-source /api/search endpoint. Falls back to a
// fetched-from-public-asset static list when the backend is unavailable
// (e.g. the user is browsing the static export without the dev server).

const SEARCH_ENDPOINT = '/api/search';

export const emptySearchResult = Object.freeze({
  query: '',
  total: 0,
  results: { courses: [], content: [], activities: [], homepages: [] },
});

async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function fetchSearch({ query, limit = 8, signal } = {}) {
  const trimmed = String(query ?? '').trim();
  if (!trimmed) {
    return { ok: true, ...emptySearchResult };
  }
  try {
    const url = new URL(SEARCH_ENDPOINT, window.location.origin);
    url.searchParams.set('q', trimmed);
    if (limit) url.searchParams.set('limit', String(limit));
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'same-origin',
      signal,
      headers: { accept: 'application/json' },
    });
    if (!response.ok) {
      return { ok: false, message: `搜索失败 (${response.status})` };
    }
    const data = await parseJsonSafe(response);
    if (!data || typeof data !== 'object') {
      return { ok: false, message: '搜索返回格式无效' };
    }
    return { ok: true, ...data };
  } catch (error) {
    if (error?.name === 'AbortError') {
      return { ok: false, message: '', aborted: true };
    }
    return { ok: false, message: '搜索服务不可用,请确认后端是否启动' };
  }
}
