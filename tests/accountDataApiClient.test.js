import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccountDataApiClient } from '../src/services/accountDataApiClient.js';

test('account data client manages courses, favorites, and notifications with relative deployment paths', async () => {
  const requests = [];
  const client = createAccountDataApiClient(async (path, options = {}) => {
    requests.push({ path, options });
    return { ok: true, status: 200, async json() { return { courses: [], favorites: [], notifications: [] }; } };
  });
  await client.fetchCourses();
  await client.previewCourseSchedule(new File(['PK\u0003\u0004'], '课表.xlsx'));
  await client.replaceCourses([{ courseCode: 'BIO2110F', courseName: '微生物学（甲）' }]);
  await client.addCourse({ courseCode: 'BIO2110F', courseName: '微生物学（甲）' });
  await client.removeCourse('BIO2110F');
  await client.fetchFavorites();
  await client.addFavorite('content-1');
  await client.removeFavorite('content-1');
  await client.fetchNotifications();
  await client.markNotificationRead('notice-1');
  await client.markAllNotificationsRead();

  assert.ok(requests.every((request) => request.path.startsWith('api/')));
  assert.equal(requests[1].options.headers['x-course-schedule-upload'], 'xlsx');
  assert.equal(requests[1].options.headers['x-file-name'], encodeURIComponent('课表.xlsx'));
  assert.equal(requests[2].options.method, 'PUT');
  assert.equal(requests[6].options.method, 'PUT');
  assert.equal(requests[10].path, 'api/account/notifications/read-all');
});
