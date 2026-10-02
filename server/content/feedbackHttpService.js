import { createHash } from 'node:crypto';

export async function handleFeedbackHttpRequest({ request, response, url, user, userId, clientIp, contentStore, sendJson, readJsonBody }) {
  const publicRoute = url.pathname === '/api/feedback';
  const adminRoute = url.pathname.startsWith('/api/admin/feedback');
  if (!publicRoute && !adminRoute) return false;
  if (adminRoute && (!userId || user?.role !== 'admin')) {
    sendJson(response, userId ? 403 : 401, { message: '仅管理员可查看意见反馈。' });
    return true;
  }
  if (adminRoute && request.method === 'GET') {
    if (url.pathname === '/api/admin/feedback/count') sendJson(response, 200, { unreadCount: contentStore.countUnreadFeedback() });
    else if (url.pathname === '/api/admin/feedback') {
      const page = Math.max(1, Math.min(10000, Math.trunc(Number(url.searchParams.get('page')) || 1)));
      sendJson(response, 200, { ...contentStore.listFeedback({ page }), page, pageSize: 50 });
    } else sendJson(response, 404, { message: '反馈接口不存在。' });
    return true;
  }
  if (request.method !== 'POST' || (!publicRoute && url.pathname !== '/api/admin/feedback/read')) {
    sendJson(response, 404, { message: '反馈接口不存在。' });
    return true;
  }
  if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
    sendJson(response, 415, { message: '反馈请求格式无效。' });
    return true;
  }
  const raw = await readJsonBody(request);
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  if (adminRoute) {
    if (!Array.isArray(input.ids) || input.ids.length > 100 || input.ids.some((id) => typeof id !== 'string' || !id || id.length > 100)) {
      sendJson(response, 400, { message: '已读反馈列表无效。' });
      return true;
    }
    sendJson(response, 200, { unreadCount: contentStore.markFeedbackRead([...new Set(input.ids)]) });
    return true;
  }
  const body = typeof input.body === 'string' ? input.body.trim().replace(/\r\n/g, '\n') : '';
  if (!body || body.length > 2000) { sendJson(response, 400, { message: '请填写1至2000字的意见。' }); return true; }
  const senderKey = userId ? `user:${userId}` : `guest:${createHash('sha256').update(String(clientIp)).digest('hex')}`;
  const now = Date.now();
  if (contentStore.hasRecentFeedbackBody(senderKey, body, new Date(now - 60000).toISOString())) {
    sendJson(response, 429, { message: '这条意见已发送，请勿重复提交。' }); return true;
  }
  if (contentStore.countRecentFeedback(senderKey, new Date(now - 600000).toISOString()) >= 10) {
    sendJson(response, 429, { message: '发送过于频繁，请稍后再试。' }); return true;
  }
  sendJson(response, 201, { feedback: contentStore.createFeedback({ body, authorName: user?.nickname || '游客', senderKey }) });
  return true;
}
