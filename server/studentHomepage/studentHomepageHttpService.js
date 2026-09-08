import {
  approveStudentHomepageApplication,
  createStudentHomepage,
  createStudentHomepageApplication,
  deleteStudentHomepage,
  rejectStudentHomepageApplication,
  updateStudentHomepage,
} from './studentHomepageService.js';
import { canLeaveSiteTrace } from '../authService.js';

function adminAuthorized(user) {
  return user?.role === 'admin';
}

function logHomepageAction(store, action, homepage, user, userId) {
  if (!store.createAuditLog) return;
  store.createAuditLog({
    action,
    entityType: 'student_homepage',
    entityId: homepage.id,
    targetTitle: homepage.name,
    actorId: userId,
    actorName: user?.cc98Nickname ?? user?.nickname ?? '',
    detail: homepage.href,
  });
}

function logApplicationAction(store, action, application, user, userId) {
  if (!store.createAuditLog) return;
  store.createAuditLog({
    action,
    entityType: 'student_homepage_application',
    entityId: application.id,
    targetTitle: application.name,
    actorId: userId,
    actorName: user?.cc98Nickname ?? user?.nickname ?? '',
    detail: application.href,
  });
}

function sendHomepageResult(sendJson, response, result, successKey) {
  if (!result.ok) {
    const status = result.status ?? 400;
    sendJson(response, status, { message: result.message });
    return;
  }
  const payload = successKey ? { [successKey]: result.homepage } : { homepage: result.homepage };
  sendJson(response, result.status ?? 200, payload);
}

export async function handleStudentHomepageHttpRequest({
  request, response, url, user, userId, studentHomepageStore, sendJson, readJsonBody,
}) {
  if (request.method === 'GET' && url.pathname === '/api/student-homepages') {
    sendJson(response, 200, { homepages: studentHomepageStore.listHomepages({ status: 'approved' }) });
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/student-homepages/applications') {
    if (!canLeaveSiteTrace(user)) {
      sendJson(response, userId ? 403 : 401, { message: '完成学号认证后才可以申请收录。' });
      return true;
    }
    if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
      sendJson(response, 415, { message: '申请请求格式无效。' });
      return true;
    }
    const result = createStudentHomepageApplication(studentHomepageStore)(
      await readJsonBody(request),
      user,
    );
    if (result.ok) {
      logApplicationAction(studentHomepageStore, 'student_homepage_application.create', result.application, user, userId);
    }
    if (!result.ok) {
      sendJson(response, result.status ?? 400, { message: result.message });
      return true;
    }
    sendJson(response, result.status ?? 201, { application: result.application });
    return true;
  }

  if (!url.pathname.startsWith('/api/admin/student-homepages')) {
    return false;
  }
  if (!userId) {
    sendJson(response, 401, { message: '请先登录管理员账号。' });
    return true;
  }
  if (!adminAuthorized(user)) {
    sendJson(response, 403, { message: '当前账号没有管理员权限。' });
    return true;
  }

  if (request.method === 'GET' && url.pathname === '/api/admin/student-homepages') {
    sendJson(response, 200, { homepages: studentHomepageStore.listHomepages() });
    return true;
  }

  if (request.method === 'GET' && url.pathname === '/api/admin/student-homepages/statuses') {
    sendJson(response, 200, { statuses: ['pending', 'approved'] });
    return true;
  }

  if (request.method === 'GET' && url.pathname === '/api/admin/student-homepages/applications') {
    const status = url.searchParams.get('status') ?? '';
    sendJson(response, 200, {
      applications: studentHomepageStore.listApplications({ status }),
      pendingCount: studentHomepageStore.countPendingApplications(),
    });
    return true;
  }

  if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
    sendJson(response, 415, { message: '同学主页请求格式无效。' });
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/admin/student-homepages') {
    const result = createStudentHomepage(studentHomepageStore)(await readJsonBody(request));
    if (result.ok) logHomepageAction(studentHomepageStore, 'student_homepage.create', result.homepage, user, userId);
    sendHomepageResult(sendJson, response, result, 'homepage');
    return true;
  }

  const itemMatch = url.pathname.match(/^\/api\/admin\/student-homepages\/([^/]+)$/);
  if (request.method === 'PATCH' && itemMatch) {
    const result = updateStudentHomepage(studentHomepageStore)(decodeURIComponent(itemMatch[1]), await readJsonBody(request));
    if (result.ok) logHomepageAction(studentHomepageStore, 'student_homepage.update', result.homepage, user, userId);
    sendHomepageResult(sendJson, response, result, 'homepage');
    return true;
  }

  if (request.method === 'DELETE' && itemMatch) {
    const result = deleteStudentHomepage(studentHomepageStore)(decodeURIComponent(itemMatch[1]));
    if (result.ok) logHomepageAction(studentHomepageStore, 'student_homepage.delete', result.homepage, user, userId);
    sendHomepageResult(sendJson, response, result, 'homepage');
    return true;
  }

  const decideMatch = url.pathname.match(/^\/api\/admin\/student-homepages\/applications\/([^/]+)\/(approve|reject)$/);
  if (request.method === 'POST' && decideMatch) {
    const id = decodeURIComponent(decideMatch[1]);
    const body = await readJsonBody(request);
    const decisionNote = String(body?.decisionNote ?? '').trim();
    const result = decideMatch[2] === 'approve'
      ? approveStudentHomepageApplication(studentHomepageStore)(id, { adminId: userId, decisionNote })
      : rejectStudentHomepageApplication(studentHomepageStore)(id, { adminId: userId, decisionNote });
    if (result.ok) {
      logApplicationAction(
        studentHomepageStore,
        `student_homepage_application.${decideMatch[2]}`,
        result.application,
        user,
        userId,
      );
    }
    if (!result.ok) {
      sendJson(response, result.status ?? 400, { message: result.message });
      return true;
    }
    sendJson(response, result.status ?? 200, { application: result.application });
    return true;
  }

  sendJson(response, 404, { message: '同学主页管理接口不存在。' });
  return true;
}
