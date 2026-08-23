import {
  archiveActivity,
  createActivity,
  publishActivity,
  toPublicActivity,
  updateActivity,
} from './activityService.js';

function adminAuthorized(user) {
  return user?.role === 'admin';
}

function sendResult(sendJson, response, result) {
  sendJson(response, result.status, result.ok ? { activity: result.activity } : { message: result.message });
}

function logActivityAction(store, action, activity, user, userId) {
  store.createAuditLog({
    action,
    entityType: 'activity',
    entityId: activity.id,
    targetTitle: activity.title,
    actorId: userId,
    actorName: user?.cc98Nickname ?? user?.nickname ?? '',
    detail: activity.featured ? '首页推荐' : '',
  });
}

export async function handleActivityHttpRequest({
  request, response, url, user, userId, contentStore, sendJson, readJsonBody,
}) {
  if (request.method === 'GET' && url.pathname === '/api/activities') {
    const activities = contentStore
      .listPublishedActivities({ featuredOnly: url.searchParams.get('featured') === '1' })
      .map(toPublicActivity);
    sendJson(response, 200, { activities });
    return true;
  }

  const publicMatch = url.pathname.match(/^\/api\/activities\/([^/]+)$/);
  if (request.method === 'GET' && publicMatch) {
    const activity = contentStore.findActivityBySlug(decodeURIComponent(publicMatch[1]));
    if (!activity || activity.status !== 'published') {
      sendJson(response, 404, { message: '活动不存在。' });
      return true;
    }
    sendJson(response, 200, { activity: toPublicActivity(activity) });
    return true;
  }

  if (!url.pathname.startsWith('/api/admin/activities')) return false;
  if (!userId) {
    sendJson(response, 401, { message: '请先登录管理员账号。' });
    return true;
  }
  if (!adminAuthorized(user)) {
    sendJson(response, 403, { message: '当前账号没有管理员权限。' });
    return true;
  }

  if (request.method === 'GET' && url.pathname === '/api/admin/activities') {
    sendJson(response, 200, {
      activities: contentStore.listAdminActivities({
        status: url.searchParams.get('status') ?? '',
        category: url.searchParams.get('category') ?? '',
        query: url.searchParams.get('query') ?? '',
      }),
    });
    return true;
  }

  if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
    sendJson(response, 415, { message: '活动管理请求格式无效。' });
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/admin/activities') {
    const result = createActivity(contentStore, await readJsonBody(request), userId);
    if (result.ok) logActivityAction(contentStore, 'activity.create', result.activity, user, userId);
    sendResult(sendJson, response, result);
    return true;
  }

  const itemMatch = url.pathname.match(/^\/api\/admin\/activities\/([^/]+)$/);
  if (request.method === 'PATCH' && itemMatch) {
    const result = updateActivity(
      contentStore, decodeURIComponent(itemMatch[1]), await readJsonBody(request), userId,
    );
    if (result.ok) logActivityAction(contentStore, 'activity.update', result.activity, user, userId);
    sendResult(sendJson, response, result);
    return true;
  }

  const statusMatch = url.pathname.match(/^\/api\/admin\/activities\/([^/]+)\/(publish|archive)$/);
  if (request.method === 'POST' && statusMatch) {
    const id = decodeURIComponent(statusMatch[1]);
    const result = statusMatch[2] === 'publish'
      ? publishActivity(contentStore, id, userId)
      : archiveActivity(contentStore, id, userId);
    if (result.ok) logActivityAction(
      contentStore, `activity.${statusMatch[2]}`, result.activity, user, userId,
    );
    sendResult(sendJson, response, result);
    return true;
  }

  sendJson(response, 404, { message: '活动管理接口不存在。' });
  return true;
}
