// HTTP handler for /api/search — wraps searchService.searchAll.

import { searchAll } from './searchService.js';

export function handleSearchHttpRequest({
  request,
  response,
  url,
  contentStore,
  courseCatalog,
  studentHomepageStore,
  sendJson,
}) {
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
