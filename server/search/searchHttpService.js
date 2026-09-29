// HTTP handler for /api/search — wraps searchService.searchAll.

import { searchAll } from './searchService.js';
import { searchResources } from './resourceSearchService.js';

export function handleSearchHttpRequest({
  request,
  response,
  url,
  contentStore,
  courseCatalog,
  studentHomepageStore,
  sendJson,
}) {
  if (request.method === 'GET' && url.pathname === '/api/search/resources') {
    const result = searchResources({
      query: url.searchParams.get('q') ?? '',
      course: url.searchParams.get('course') ?? '',
      type: url.searchParams.get('type') ?? '',
      teacher: url.searchParams.get('teacher') ?? '',
      year: url.searchParams.get('year') ?? '',
      page: url.searchParams.get('page') ?? 1,
      pageSize: url.searchParams.get('pageSize') ?? 20,
      contentStore,
      courseCatalog,
    });
    sendJson(response, 200, result);
    return true;
  }
  if (request.method !== 'GET' || url.pathname !== '/api/search') {
    return false;
  }

  const query = url.searchParams.get('q') ?? '';
  const limit = url.searchParams.get('limit') ?? '';

  const result = searchAll({
    query,
    limit,
    contentStore,
    courseCatalog,
    studentHomepageStore,
  });

  sendJson(response, 200, result);
  return true;
}
