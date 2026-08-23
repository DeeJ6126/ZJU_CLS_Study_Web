import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthStore } from '../server/authStore.js';
import {
  normalizeCourseScheduleRows,
  validateCourseScheduleUpload,
} from '../server/account/courseScheduleService.js';
import { normalizeCourseScheduleRows as normalizeBrowserCourseRows } from '../src/services/courseScheduleService.js';
import { loadServerCourseCatalog } from '../server/account/courseCatalogService.js';

function createUser(store, nickname = '课程同学') {
  return store.createUser({
    email: `${Date.now()}@zju.edu.cn`,
    nickname,
    passwordHash: 'hash',
  });
}

test('course schedule rows find a later header, merge duplicate meetings, and retain unknown courses', () => {
  const rows = [
    ['2026-2027学年秋冬学期某同学的课表'],
    ['课程代码', '课程名称', '教师姓名', '学期', '上课时间', '上课地点', '选课志愿'],
    ['BIO3026M', '遗传学及实验', '甲/乙', '秋冬', '周一第6,7,8节;周二第6,7,8,9节{双周}', '紫金港西1-503;紫金港实验中心-411', '1'],
    ['BIO3026M', '遗传学及实验', '甲/乙', '秋冬', '周一第6,7,8节', '紫金港西1-503', '1'],
    ['SIS0506G', '西方歌剧文化', '丙', '秋冬', '周四第9,10节', '紫金港东1A-202', '1'],
    ['BIO4083M', '生物信息学产业实践', '丁', '冬', '', '', '1'],
  ];

  const catalogCodes = new Set(['BIO3026M', 'BIO4083M']);
  const result = normalizeCourseScheduleRows(rows, { catalogCodes });

  assert.equal(result.courses.length, 3);
  assert.equal(result.duplicateGroupCount, 1);
  assert.deepEqual(result.courses[0], {
    courseCode: 'BIO3026M',
    courseName: '遗传学及实验',
    teacherName: '甲/乙',
    term: '秋冬',
    classTime: '周一第6,7,8节;周二第6,7,8,9节{双周}',
    classLocation: '紫金港西1-503;紫金港实验中心-411',
    catalogMatched: true,
  });
  assert.equal(result.courses.find((course) => course.courseCode === 'SIS0506G').catalogMatched, false);
  assert.equal(result.courses.find((course) => course.courseCode === 'BIO4083M').classTime, '');
  assert.deepEqual(normalizeBrowserCourseRows(rows, { catalogCodes }), result);
});

test('course schedule validation rejects oversized and forged uploads', () => {
  assert.deepEqual(validateCourseScheduleUpload(Buffer.alloc(5 * 1024 * 1024 + 1), '课表.xlsx'), {
    ok: false,
    status: 413,
    message: '课表文件不能超过 5 MB。',
  });
  assert.equal(validateCourseScheduleUpload(Buffer.from('not-a-zip'), '课表.xlsx').status, 400);
  assert.equal(validateCourseScheduleUpload(Buffer.from('PK\u0003\u0004'), '课表.xls').status, 400);
});

test('server course catalog uses the shared course-code data source', () => {
  const catalog = loadServerCourseCatalog();
  assert.equal(catalog.byCode.get('BIO2110F').name, '微生物学（甲）');
  assert.equal(catalog.codes.has('SIS0506G'), false);
});

test('auth store persists private courses, favorites, and notifications per user', () => {
  const store = createAuthStore({ filename: ':memory:' });
  store.initialize();
  const first = createUser(store, '甲同学');
  const second = createUser(store, '乙同学');

  store.replaceUserCourses(first.id, [{
    courseCode: 'BIO3026M', courseName: '遗传学及实验', teacherName: '甲/乙',
    term: '秋冬', classTime: '周一第6,7,8节', classLocation: '紫金港西1-503',
  }]);
  store.upsertUserCourse(first.id, {
    courseCode: 'SIS0506G', courseName: '西方歌剧文化', teacherName: '丙',
    term: '秋冬', classTime: '', classLocation: '',
  });
  assert.equal(store.listUserCourses(first.id).length, 2);
  assert.equal(store.listUserCourses(second.id).length, 0);
  store.removeUserCourse(first.id, 'SIS0506G');
  assert.equal(store.listUserCourses(first.id).length, 1);

  store.addFavorite(first.id, 'content-1');
  store.addFavorite(first.id, 'content-1');
  assert.deepEqual(store.listFavoriteIds(first.id), ['content-1']);
  assert.deepEqual(store.listFavoriteIds(second.id), []);
  store.removeFavorite(first.id, 'content-1');
  assert.deepEqual(store.listFavoriteIds(first.id), []);

  const notification = store.createNotification({
    userId: first.id,
    type: 'comment.reply',
    actorId: second.id,
    contentId: 'content-1',
    commentId: 'comment-1',
    title: '评论收到回复',
    body: '乙同学回复了你的评论。',
  });
  assert.equal(store.listNotifications(first.id).length, 1);
  assert.equal(store.countUnreadNotifications(first.id), 1);
  store.markNotificationRead(first.id, notification.id);
  assert.equal(store.countUnreadNotifications(first.id), 0);
  assert.equal(store.listNotifications(second.id).length, 0);
  store.close();
});
