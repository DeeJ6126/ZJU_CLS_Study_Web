import { noticeListOptions, toPublicNotice, validateNoticeInput } from './noticeService.js';
import { maxNoticeAttachmentBytes, readNoticeAttachment, removeNoticeAttachment, saveNoticeAttachment } from './noticeFileService.js';

function acceptsSameOrigin(request) {
  if (request.headers['sec-fetch-site'] === 'cross-site') return false;
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    const expectedProtocol = request.socket?.encrypted
      || String(request.headers['x-forwarded-proto'] ?? '').split(',')[0].trim() === 'https' ? 'https:' : 'http:';
    const parsed = new URL(origin);
    return parsed.host === request.headers.host && parsed.protocol === expectedProtocol;
  } catch { return false; }
}

function audit(store, action, notice, user, userId, detail = '') {
  store.createAuditLog({ action: `notice.${action}`, entityType: 'notice', entityId: notice.id,
    targetTitle: notice.title, actorId: userId, actorName: user?.nickname || user?.cc98Nickname || '', detail });
}

export async function handleNoticeHttpRequest({ request, response, url, user, userId, contentStore,
  uploadDirectory, sendJson, readJsonBody, readBinaryBody }) {
  const publicRoot = url.pathname === '/api/notices' || url.pathname.startsWith('/api/notices/');
  const adminRoot = url.pathname === '/api/admin/notices' || url.pathname.startsWith('/api/admin/notices/');
  if (!publicRoot && !adminRoot) return false;
  const sendError = (status, message) => { sendJson(response, status, { message }); return true; };
  const sendNotice = (notice, status = 200) => { sendJson(response, status, { notice: toPublicNotice(notice) }); return true; };
  try { url.pathname.split('/').forEach((part) => decodeURIComponent(part)); }
  catch { return sendError(400, '通知地址格式无效。'); }
  const administrator = Boolean(userId && user?.role === 'admin');
  if (adminRoot) {
    if (!userId) return sendError(401, '请先登录管理员账号。');
    if (!administrator) return sendError(403, '当前账号没有管理员权限。');
    if (!['GET', 'HEAD'].includes(request.method) && !acceptsSameOrigin(request)) return sendError(403, '不允许跨站管理请求。');
  }
  if (request.method === 'GET' && ['/api/notices', '/api/admin/notices'].includes(url.pathname)) {
    const options = noticeListOptions(url.searchParams, { publicOnly: publicRoot });
    if (!options.ok) return sendError(options.status, options.message);
    const result = contentStore.listNotices(options.value);
    sendJson(response, 200, { ...result, items: result.items.map(toPublicNotice) });
    return true;
  }
  const attachmentMatch = url.pathname.match(/^\/api\/notices\/([^/]+)\/attachments\/([^/]+)$/);
  if (request.method === 'GET' && attachmentMatch) {
    const notice = contentStore.findNoticeById(decodeURIComponent(attachmentMatch[1]));
    if (!notice || (notice.status !== 'published' && !administrator)) return sendError(404, '附件不存在。');
    const attachment = notice.attachments.find((item) => item.id === decodeURIComponent(attachmentMatch[2]));
    const buffer = attachment && readNoticeAttachment(uploadDirectory, attachment.storedName);
    if (!buffer) return sendError(404, '附件不存在。');
    response.writeHead(200, { 'content-type': attachment.mimeType, 'content-length': buffer.length,
      'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(attachment.fileName).replace(/'/g, '%27')}`,
      'x-content-type-options': 'nosniff', 'cache-control': 'private, no-store' });
    response.end(buffer);
    return true;
  }
  const itemMatch = url.pathname.match(/^\/api\/(?:admin\/)?notices\/([^/]+)$/);
  if (request.method === 'GET' && itemMatch) {
    const notice = contentStore.findNoticeById(decodeURIComponent(itemMatch[1]));
    if (!notice || (publicRoot && notice.status !== 'published')) return sendError(404, '通知不存在。');
    return sendNotice(notice);
  }
  if (!adminRoot) return sendError(404, '通知接口不存在。');
  const uploadMatch = url.pathname.match(/^\/api\/admin\/notices\/([^/]+)\/attachments$/);
  if (request.method === 'POST' && uploadMatch) {
    const notice = contentStore.findNoticeById(decodeURIComponent(uploadMatch[1]));
    if (!notice) return sendError(404, '通知不存在。');
    if (notice.attachments.length >= 20) return sendError(400, '每条通知最多上传 20 个附件。');
    if (request.headers['x-notice-upload'] !== 'notice-attachment') return sendError(415, '附件上传请求格式无效。');
    let fileName;
    try { fileName = decodeURIComponent(request.headers['x-file-name'] ?? ''); }
    catch { return sendError(400, '附件文件名无效。'); }
    const buffer = await readBinaryBody(request, maxNoticeAttachmentBytes);
    if (!buffer) return sendError(413, '附件不能超过 25 MB。');
    const saved = await saveNoticeAttachment({ buffer, fileName, mimeType: request.headers['content-type'], uploadDirectory });
    if (!saved.ok) return sendError(saved.status, saved.message);
    let next;
    try {
      if (contentStore.listNoticeAttachments(notice.id).length >= 20) {
        const error = new Error('每条通知最多上传 20 个附件。');
        error.code = 'NOTICE_ATTACHMENT_LIMIT';
        throw error;
      }
      next = contentStore.attachNoticeFile(notice.id, saved.file, userId);
    } catch (error) {
      try { removeNoticeAttachment(uploadDirectory, saved.file.storedName); }
      catch (cleanupError) { console.error('[notice] unattached upload cleanup failed', cleanupError.code); }
      if (error.code === 'NOTICE_ATTACHMENT_LIMIT') return sendError(400, error.message);
      throw error;
    }
    audit(contentStore, 'file.add', next, user, userId, saved.file.fileName);
    return sendNotice(next, 201);
  }
  const deleteMatch = url.pathname.match(/^\/api\/admin\/notices\/([^/]+)\/attachments\/([^/]+)$/);
  if (request.method === 'DELETE' && deleteMatch) {
    const notice = contentStore.findNoticeById(decodeURIComponent(deleteMatch[1]));
    const attachment = notice?.attachments.find((item) => item.id === decodeURIComponent(deleteMatch[2]));
    if (!attachment) return sendError(404, '附件不存在。');
    if (notice.status === 'published' && !notice.body && !notice.sourceUrl && notice.attachments.length === 1) {
      return sendError(400, '请先下架通知，再删除唯一的正文附件。');
    }
    if (!removeNoticeAttachment(uploadDirectory, attachment.storedName)) return sendError(500, '附件移除失败，记录未改变。');
    const next = contentStore.removeNoticeFile(notice.id, attachment.id, userId);
    audit(contentStore, 'file.remove', next, user, userId, attachment.fileName);
    return sendNotice(next);
  }
  if (request.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return sendError(415, '通知管理请求需要 JSON 格式。');
  }
  if (request.method === 'POST' && url.pathname === '/api/admin/notices') {
    const validated = validateNoticeInput(await readJsonBody(request));
    if (!validated.ok) return sendError(validated.status, validated.message);
    const notice = contentStore.createNotice({ ...validated.value, createdBy: userId });
    audit(contentStore, 'create', notice, user, userId);
    return sendNotice(notice, 201);
  }
  if (request.method === 'PATCH' && itemMatch) {
    const body = await readJsonBody(request);
    const current = contentStore.findNoticeById(decodeURIComponent(itemMatch[1]));
    if (!current) return sendError(404, '通知不存在。');
    const validated = validateNoticeInput(body, { current });
    if (!validated.ok) return sendError(validated.status, validated.message);
    const next = contentStore.updateNotice(current.id, { ...validated.value, updatedBy: userId });
    audit(contentStore, 'update', next, user, userId);
    return sendNotice(next);
  }
  const statusMatch = url.pathname.match(/^\/api\/admin\/notices\/([^/]+)\/(publish|archive)$/);
  if (request.method === 'POST' && statusMatch) {
    const current = contentStore.findNoticeById(decodeURIComponent(statusMatch[1]));
    if (!current) return sendError(404, '通知不存在。');
    if (statusMatch[2] === 'publish') {
      const validated = validateNoticeInput({}, { current, publish: true });
      if (!validated.ok) return sendError(validated.status, validated.message);
    }
    const next = contentStore.updateNotice(current.id, { status: statusMatch[2] === 'publish' ? 'published' : 'archived', updatedBy: userId });
    audit(contentStore, statusMatch[2], next, user, userId);
    return sendNotice(next);
  }
  return sendError(404, '通知管理接口不存在。');
}
