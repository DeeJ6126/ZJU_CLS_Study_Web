import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { demoAccountStorageKey } from '../src/data/config/demoAccountSeeds.js';
import { createDemoAccountService } from '../src/services/demoAccountService.js';

function createMemoryStorage({ fail = false, failWrite = false } = {}) {
  const values = new Map();
  return {
    getItem(key) {
      if (fail) throw new Error('blocked');
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      if (fail || failWrite) throw new Error('blocked');
      values.set(key, String(value));
    },
    value(key) { return values.get(key); },
  };
}

test('demo accounts have realistic isolated private data and safe public projections', () => {
  const service = createDemoAccountService({ storage: createMemoryStorage() });
  const cc98 = service.getPrivateProfile('cc98');
  const email = service.getPrivateProfile('email');
  assert.equal(cc98.ok, true);
  assert.ok(cc98.courses.length >= 3);
  assert.notDeepEqual(cc98.courses, email.courses);
  assert.ok(cc98.posts.length);
  assert.ok(email.submissions.some((item) => item.status === 'rejected'));

  const publicView = service.getPublicProfile('demo-cc98');
  assert.equal(publicView.ok, true);
  assert.equal(publicView.profile.email, undefined);
  assert.equal(publicView.profile.id, undefined);
  assert.equal(publicView.profile.verifications, undefined);
  assert.ok(publicView.posts.every((item) => item.status === 'published'));
});

test('demo mutations persist and remain isolated between identities', () => {
  const storage = createMemoryStorage();
  const service = createDemoAccountService({ storage });
  const emailCount = service.getPrivateProfile('email').courses.length;
  const firstCode = service.getPrivateProfile('cc98').courses[0].courseCode;
  assert.equal(service.removeCourse('cc98', firstCode).ok, true);
  assert.equal(service.getPrivateProfile('email').courses.length, emailCount);
  assert.ok(storage.value(demoAccountStorageKey));

  const reloaded = createDemoAccountService({ storage });
  assert.ok(!reloaded.getPrivateProfile('cc98').courses.some((item) => item.courseCode === firstCode));
  assert.equal(reloaded.resetAccount('cc98').ok, true);
  assert.ok(reloaded.getPrivateProfile('cc98').courses.some((item) => item.courseCode === firstCode));
});

test('demo profile, favorite, comment, and notification actions use API-shaped results', () => {
  const service = createDemoAccountService({ storage: createMemoryStorage(), now: () => '2026-08-23T12:00:00.000Z' });
  assert.equal(service.updateNickname('email', '蓝桥新同学').user.nickname, '蓝桥新同学');
  assert.equal(service.addFavorite('email', { id: 'content-x', courseCode: 'BIO2110F', type: 'material', routeId: '1', title: '资料', summary: '' }).favorites.length, 2);
  assert.equal(service.removeFavorite('email', 'content-x').favorites.length, 1);
  assert.deepEqual(service.toggleLike('email', 'content-x', 4), { ok: true, liked: true, likeCount: 5 });
  assert.deepEqual(service.getLikedContentIds('email'), ['content-x']);
  assert.deepEqual(service.toggleLike('email', 'content-x', 5), { ok: true, liked: false, likeCount: 4 });
  assert.equal(service.createComment('email', { id: 'content-x', courseCode: 'BIO2110F', type: 'material', routeId: '1', title: '资料' }, { body: '很好用' }).ok, true);
  const comment = service.getPrivateProfile('email').comments[0];
  assert.equal(service.updateComment('email', comment.id, '已修改').comment.body, '已修改');
  assert.equal(service.deleteComment('email', comment.id).ok, true);
  assert.equal(service.markAllNotificationsRead('email').unreadCount, 0);
});

test('demo administrator can approve and reject submissions across identities', async () => {
  const service = createDemoAccountService({ storage: createMemoryStorage(), now: () => '2026-08-23T12:00:00.000Z' });
  const admin = service.createAdminClient();
  const initial = await admin.fetchSubmissions({ status: 'pending' });
  const pending = initial.submissions.find((item) => item.id === 'demo-sub-cc98-1');
  assert.ok(pending);
  assert.equal((await admin.approveSubmission(pending.id)).ok, true);
  assert.ok(service.getPrivateProfile('cc98').posts.some((item) => item.title === pending.title));
  assert.ok(service.getPrivateProfile('cc98').notifications.some((item) => /已通过/.test(item.title)));

  const created = service.createSubmission('email', { courseCode: 'BIO2019F', type: 'experience', title: '新的观察记录', summary: '', body: '完整正文' });
  assert.equal((await admin.rejectSubmission(created.submission.id, '请补充倍率')).ok, true);
  assert.equal(service.getPrivateProfile('email').submissions.find((item) => item.id === created.submission.id).status, 'rejected');

  const post = service.getPrivateProfile('cc98').posts[0];
  const revision = service.revisePost('cc98', post.id, { title: '修订后的复习节奏' });
  assert.ok(revision.submission.id);
  assert.equal(revision.submission.status, 'pending');
  assert.equal((await admin.approveSubmission(revision.submission.id)).ok, true);
  assert.equal(service.getPrivateProfile('cc98').posts.find((item) => item.id === post.id).title, '修订后的复习节奏');
});

test('demo avatar and timetable workflows validate and parse local files', async () => {
  const service = createDemoAccountService({ storage: createMemoryStorage() });
  const avatar = { type: 'image/png', size: 100, name: 'avatar.png' };
  const avatarResult = await service.uploadAvatar('email', avatar, async () => 'data:image/png;base64,AAAA');
  assert.equal(avatarResult.ok, true);
  assert.match(avatarResult.user.avatarUrl, /^data:image\/png/);
  assert.equal((await service.uploadAvatar('email', { ...avatar, type: 'image/svg+xml' })).ok, false);

  const rows = [
    ['课程代码', '课程名称', '教师姓名', '学期', '上课时间', '上课地点'],
    ['BIO2110F', '微生物学及实验', '陈老师', '秋冬', '周一1-2', '教1'],
    ['BIO2110F', '微生物学及实验', '陈老师', '秋冬', '周三3-4', '教2'],
  ];
  const preview = await service.previewCourseSchedule('email', { name: '课表.xlsx', size: 200 }, async () => [[['说明']], rows]);
  assert.equal(preview.ok, true);
  assert.equal(preview.duplicateGroupCount, 1);
  assert.equal(preview.courses[0].classTime, '周一1-2;周三3-4');
});

test('storage failures keep demo mode usable for the current session', () => {
  const service = createDemoAccountService({ storage: createMemoryStorage({ fail: true }) });
  const result = service.getPrivateProfile('cc98');
  assert.equal(result.ok, true);
  assert.match(result.persistenceWarning, /当前页面/);
  assert.equal(service.removeCourse('cc98', result.courses[0].courseCode).ok, true);

  const quotaService = createDemoAccountService({ storage: createMemoryStorage({ failWrite: true }) });
  const mutation = quotaService.removeCourse('email', 'BIO2019F');
  assert.equal(mutation.ok, true);
  assert.match(mutation.persistenceWarning, /存储空间不足/);
});

test('demo administrator manages the same browser-local activities shown on public pages', async () => {
  const catalog = JSON.parse(readFileSync('public/content/activities/catalog.json', 'utf8'));
  const service = createDemoAccountService({
    storage: createMemoryStorage(),
    now: () => '2026-08-23T12:00:00.000Z',
    activityLoader: async () => catalog.activities,
  });
  const admin = service.createAdminClient();
  const publicClient = service.createPublicActivityClient();
  const initial = await admin.fetchActivities({ status: 'published' });
  assert.equal(initial.activities.length, 6);

  const lab = initial.activities.find((item) => item.slug === 'lab-open-day');
  assert.equal((await admin.updateActivity(lab.id, { ...lab, featured: false, displayOrder: 3 })).ok, true);
  assert.equal((await publicClient.fetchActivities({ featured: true })).activities.some((item) => item.id === lab.id), false);
  assert.equal((await admin.archiveActivity(lab.id)).ok, true);
  assert.equal((await publicClient.fetchActivities()).activities.some((item) => item.id === lab.id), false);
  assert.equal((await admin.publishActivity(lab.id)).ok, true);
  assert.equal((await publicClient.fetchActivities()).activities.some((item) => item.id === lab.id), true);
});
