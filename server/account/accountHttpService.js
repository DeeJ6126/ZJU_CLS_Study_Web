import { maxCourseScheduleBytes, parseCourseScheduleWorkbook } from './courseScheduleService.js';

function isJson(request) {
  return String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json');
}

function requireAccount(sendJson, response, userId) {
  if (userId) return true;
  sendJson(response, 401, { message: '请先登录账号。' });
  return false;
}

function cleanCourse(input = {}) {
  const courseCode = String(input.courseCode ?? '').trim().toUpperCase();
  const courseName = String(input.courseName ?? '').trim();
  if (!/^[A-Z0-9-]{3,24}$/.test(courseCode) || !courseName || courseName.length > 100) return null;
  return {
    courseCode,
    courseName,
    teacherName: String(input.teacherName ?? '').trim().slice(0, 200),
    term: String(input.term ?? '').trim().slice(0, 40),
    classTime: String(input.classTime ?? '').trim().slice(0, 500),
    classLocation: String(input.classLocation ?? '').trim().slice(0, 500),
  };
}

function favoriteItems(authStore, contentStore, userId) {
  return authStore.listFavoriteIds(userId)
    .map((id) => contentStore.findById(id))
    .filter((item) => item?.status === 'published')
    .map((item) => ({
      id: item.id,
      routeId: item.routeId,
      courseCode: item.courseCode,
      type: item.type,
      title: item.title,
      summary: item.summary,
    }));
}

function courseViews(courses, catalogCodes) {
  return courses.map((course) => ({
    ...course,
    catalogMatched: catalogCodes.has(String(course.courseCode).toUpperCase()),
  }));
}

function notificationView(authStore, contentStore, notification) {
  const actor = notification.actorId ? authStore.findUserById(notification.actorId) : null;
  const item = notification.contentId ? contentStore.findById(notification.contentId) : null;
  return {
    ...notification,
    actor: actor ? {
      publicId: actor.publicId,
      nickname: actor.nickname,
      avatarUrl: actor.avatarStoredName
        ? `/api/profile-avatars/${encodeURIComponent(actor.avatarStoredName)}`
        : '',
    } : null,
    target: item ? {
      contentId: item.id,
      routeId: item.routeId,
      courseCode: item.courseCode,
      type: item.type,
    } : null,
  };
}

export async function handleAccountHttpRequest({
  request,
  response,
  url,
  userId,
  authStore,
  contentStore,
  sendJson,
  readJsonBody,
  readBinaryBody,
  catalogCodes = new Set(),
}) {
  if (!url.pathname.startsWith('/api/account/courses')
    && !url.pathname.startsWith('/api/account/favorites')
    && !url.pathname.startsWith('/api/account/notifications')) return false;
  if (!requireAccount(sendJson, response, userId)) return true;

  if (request.method === 'GET' && url.pathname === '/api/account/courses') {
    sendJson(response, 200, { courses: courseViews(authStore.listUserCourses(userId), catalogCodes) });
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/account/courses/import-preview') {
    if (request.headers['x-course-schedule-upload'] !== 'xlsx') {
      sendJson(response, 415, { message: '课表上传请求格式无效。' });
      return true;
    }
    const buffer = await readBinaryBody(request, maxCourseScheduleBytes);
    if (!buffer) {
      sendJson(response, 413, { message: '课表文件不能超过 5 MB。' });
      return true;
    }
    const result = await parseCourseScheduleWorkbook(buffer, {
      fileName: decodedFileName(request.headers['x-file-name']),
      catalogCodes,
    });
    sendJson(response, result.ok ? 200 : result.status, result.ok ? result : { message: result.message });
    return true;
  }

  if (request.method === 'PUT' && url.pathname === '/api/account/courses') {
    if (!isJson(request)) {
      sendJson(response, 415, { message: '课程清单请求格式无效。' });
      return true;
    }
    const body = await readJsonBody(request);
    const rawCourses = Array.isArray(body.courses) ? body.courses : [];
    const courses = rawCourses.map(cleanCourse);
    if (rawCourses.length > 100 || courses.some((course) => !course)) {
      sendJson(response, 400, { message: '课程清单包含无效记录。' });
      return true;
    }
    const unique = [...new Map(courses.map((course) => [course.courseCode, course])).values()];
    sendJson(response, 200, { courses: courseViews(authStore.replaceUserCourses(userId, unique), catalogCodes) });
    return true;
  }

  const courseMatch = url.pathname.match(/^\/api\/account\/courses\/([^/]+)$/);
  if (request.method === 'POST' && courseMatch) {
    if (!isJson(request)) {
      sendJson(response, 415, { message: '课程清单请求格式无效。' });
      return true;
    }
    const course = cleanCourse({ ...(await readJsonBody(request)), courseCode: decodeURIComponent(courseMatch[1]) });
    if (!course) {
      sendJson(response, 400, { message: '课程信息无效。' });
      return true;
    }
    sendJson(response, 200, { courses: courseViews(authStore.upsertUserCourse(userId, course), catalogCodes) });
    return true;
  }
  if (request.method === 'DELETE' && courseMatch) {
    sendJson(response, 200, {
      courses: courseViews(authStore.removeUserCourse(userId, decodeURIComponent(courseMatch[1])), catalogCodes),
    });
    return true;
  }

  if (request.method === 'GET' && url.pathname === '/api/account/favorites') {
    sendJson(response, 200, { favorites: favoriteItems(authStore, contentStore, userId) });
    return true;
  }
  const favoriteMatch = url.pathname.match(/^\/api\/account\/favorites\/([^/]+)$/);
  if (request.method === 'PUT' && favoriteMatch) {
    if (!isJson(request)) {
      sendJson(response, 415, { message: '收藏请求格式无效。' });
      return true;
    }
    const contentId = decodeURIComponent(favoriteMatch[1]);
    const item = contentStore.findById(contentId);
    if (!item || item.status !== 'published') {
      sendJson(response, 404, { message: '内容不存在。' });
      return true;
    }
    authStore.addFavorite(userId, contentId);
    sendJson(response, 200, { favorites: favoriteItems(authStore, contentStore, userId) });
    return true;
  }
  if (request.method === 'DELETE' && favoriteMatch) {
    authStore.removeFavorite(userId, decodeURIComponent(favoriteMatch[1]));
    sendJson(response, 200, { favorites: favoriteItems(authStore, contentStore, userId) });
    return true;
  }

  if (request.method === 'GET' && url.pathname === '/api/account/notifications') {
    sendJson(response, 200, {
      notifications: authStore.listNotifications(userId).map((item) => notificationView(authStore, contentStore, item)),
      unreadCount: authStore.countUnreadNotifications(userId),
    });
    return true;
  }
  if (request.method === 'POST' && url.pathname === '/api/account/notifications/read-all') {
    if (!isJson(request)) {
      sendJson(response, 415, { message: '消息请求格式无效。' });
      return true;
    }
    authStore.markAllNotificationsRead(userId);
    sendJson(response, 200, { unreadCount: 0 });
    return true;
  }
  const notificationMatch = url.pathname.match(/^\/api\/account\/notifications\/([^/]+)\/read$/);
  if (request.method === 'POST' && notificationMatch) {
    if (!isJson(request)) {
      sendJson(response, 415, { message: '消息请求格式无效。' });
      return true;
    }
    const notification = authStore.findNotificationById(decodeURIComponent(notificationMatch[1]));
    if (!notification || notification.userId !== userId) {
      sendJson(response, 404, { message: '消息不存在。' });
      return true;
    }
    authStore.markNotificationRead(userId, notification.id);
    sendJson(response, 200, { unreadCount: authStore.countUnreadNotifications(userId) });
    return true;
  }

  sendJson(response, 404, { message: '账号数据接口不存在。' });
  return true;
}

function decodedFileName(value) {
  try {
    return decodeURIComponent(String(value ?? 'schedule.xlsx'));
  } catch {
    return 'schedule.xlsx';
  }
}
