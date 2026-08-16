function createRequester(fetchImpl) {
  return async function request(path, options = {}) {
    try {
      const response = await fetchImpl(path, { credentials: 'include', ...options });
      const data = await response.json();
      return response.ok
        ? { ok: true, status: response.status, ...data }
        : { ok: false, status: response.status, message: data.message ?? '请求失败。' };
    } catch {
      return { ok: false, status: 0, message: '账号数据服务暂时无法连接。' };
    }
  };
}

export function createAccountDataApiClient(fetchImpl = fetch) {
  const request = createRequester(fetchImpl);
  const json = (method, body = {}) => ({
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return {
    fetchCourses: () => request('api/account/courses'),
    previewCourseSchedule: (file) => request('api/account/courses/import-preview', {
      method: 'POST',
      headers: {
        'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'x-course-schedule-upload': 'xlsx',
        'x-file-name': encodeURIComponent(file.name),
      },
      body: file,
    }),
    replaceCourses: (courses) => request('api/account/courses', json('PUT', { courses })),
    addCourse: (course) => request(
      `api/account/courses/${encodeURIComponent(course.courseCode)}`,
      json('POST', course),
    ),
    removeCourse: (courseCode) => request(`api/account/courses/${encodeURIComponent(courseCode)}`, { method: 'DELETE' }),
    fetchFavorites: () => request('api/account/favorites'),
    addFavorite: (contentId) => request(`api/account/favorites/${encodeURIComponent(contentId)}`, json('PUT')),
    removeFavorite: (contentId) => request(`api/account/favorites/${encodeURIComponent(contentId)}`, { method: 'DELETE' }),
    fetchNotifications: () => request('api/account/notifications'),
    markNotificationRead: (id) => request(`api/account/notifications/${encodeURIComponent(id)}/read`, json('POST')),
    markAllNotificationsRead: () => request('api/account/notifications/read-all', json('POST')),
  };
}

export const accountDataApiClient = createAccountDataApiClient();
