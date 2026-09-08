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

test('demo student and administrator have isolated private data and safe public projections', () => {
  const service = createDemoAccountService({ storage: createMemoryStorage() });
  const student = service.getPrivateProfile('student');
  const admin = service.getPrivateProfile('admin');
  assert.equal(student.ok, true);
  assert.ok(student.courses.length >= 3);
  assert.notDeepEqual(student.courses, admin.courses);
  assert.ok(student.posts.length);
  assert.ok(student.submissions.some((item) => item.status === 'pending'));

  const publicView = service.getPublicProfile('demo-student');
  assert.equal(publicView.ok, true);
  assert.equal(publicView.profile.email, undefined);
  assert.equal(publicView.profile.id, undefined);
  assert.equal(publicView.profile.verifications, undefined);
  assert.ok(publicView.posts.every((item) => item.status === 'published'));
});

test('demo mutations persist and remain isolated between identities', () => {
  const storage = createMemoryStorage();
  const service = createDemoAccountService({ storage });
  const adminCount = service.getPrivateProfile('admin').courses.length;
  const firstCode = service.getPrivateProfile('student').courses[0].courseCode;
  assert.equal(service.removeCourse('student', firstCode).ok, true);
  assert.equal(service.getPrivateProfile('admin').courses.length, adminCount);
  assert.ok(storage.value(demoAccountStorageKey));

  const reloaded = createDemoAccountService({ storage });
  assert.ok(!reloaded.getPrivateProfile('student').courses.some((item) => item.courseCode === firstCode));
  assert.equal(reloaded.resetAccount('student').ok, true);
  assert.ok(reloaded.getPrivateProfile('student').courses.some((item) => item.courseCode === firstCode));
});

test('demo profile, favorite, comment, and notification actions use API-shaped results', () => {
  const service = createDemoAccountService({ storage: createMemoryStorage(), now: () => '2026-08-23T12:00:00.000Z' });
  assert.equal(service.updateNickname('student', '蓝桥新同学').user.nickname, '蓝桥新同学');
  assert.equal(service.addFavorite('student', { id: 'content-x', courseCode: 'BIO2110F', type: 'material', routeId: '1', title: '资料', summary: '' }).favorites.length, 2);
  assert.equal(service.removeFavorite('student', 'content-x').favorites.length, 1);
  assert.deepEqual(service.toggleLike('student', 'content-x', 4), { ok: true, liked: true, likeCount: 5 });
  assert.deepEqual(service.getLikedContentIds('student'), ['content-x']);
  assert.deepEqual(service.toggleLike('student', 'content-x', 5), { ok: true, liked: false, likeCount: 4 });
  assert.equal(service.createComment('student', { id: 'content-x', courseCode: 'BIO2110F', type: 'material', routeId: '1', title: '资料' }, { body: '很好用' }).ok, true);
  const comment = service.getPrivateProfile('student').comments[0];
  assert.equal(service.updateComment('student', comment.id, '已修改').comment.body, '已修改');
  assert.equal(service.deleteComment('student', comment.id).ok, true);
  assert.equal(service.markAllNotificationsRead('student').unreadCount, 0);
});

test('Bug 7: comments on adminContent push a notification to the admin identity', () => {
  const service = createDemoAccountService({ storage: createMemoryStorage(), now: () => '2026-08-23T12:00:00.000Z' });
  // Inject an admin-published content item directly into the demo state. The
  // admin client API has its own createContent, but it stores in the same
  // state.adminContent slot the bug fix checks.
  const storage = service.createAdminClient();
  // Build a deterministic adminContent entry through the public listComments
  // path is not possible, so call createContent and then drive a comment on
  // the resulting id.
  return storage.createContent({
    id: 'admin-content-1', courseCode: 'BIO2110F', type: 'material', title: '管理员资料', status: 'published', body: '正文',
  }).then((created) => {
    const before = service.getPrivateProfile('admin').notifications.length;
    const result = service.createComment(
      'student',
      { id: created.item.id, courseCode: 'BIO2110F', type: 'material', title: '管理员资料' },
      { body: '管理员资料下面的评论' },
    );
    assert.equal(result.ok, true);
    const after = service.getPrivateProfile('admin').notifications.length;
    assert.equal(after, before + 1, 'admin should receive a new comment notification');
    const newest = service.getPrivateProfile('admin').notifications[0];
    assert.equal(newest.title, '帖子收到新评论');
    assert.match(newest.body, /管理员资料/);
    assert.equal(newest.actor.publicId, 'demo-student');
    assert.equal(newest.readAt, '');
  });
});

test('Bug 8: nested replies flatten to the root comment id and notify the root author', () => {
  const service = createDemoAccountService({ storage: createMemoryStorage(), now: () => '2026-08-23T12:00:00.000Z' });
  const contentItem = { id: 'demo-post-student-1', courseCode: 'BIO2110F', type: 'experience', title: '微生物学复习节奏记录' };

  // student owns the post; admin posts a top-level comment.
  const root = service.createComment('admin', contentItem, { body: '首条评论' });
  assert.equal(root.ok, true);
  const rootId = root.comment.id;

  // student (the post owner) replies to that root comment.
  const reply = service.createComment('student', contentItem, { body: '作者回复', parentCommentId: rootId });
  assert.equal(reply.ok, true);
  assert.equal(reply.comment.parentCommentId, rootId, 'first-level reply keeps the root id');

  // admin then replies to the reply — it must be flattened to the same root.
  const nested = service.createComment('admin', contentItem, { body: '再次回复', parentCommentId: reply.comment.id });
  assert.equal(nested.ok, true);
  assert.equal(nested.comment.parentCommentId, rootId, 'nested reply is flattened to root');

  // The root comment's author (admin) must have received a reply notification.
  const adminNotifs = service.getPrivateProfile('admin').notifications;
  const newest = adminNotifs[0];
  assert.equal(newest.title, '评论收到回复');
  assert.match(newest.body, /回复了你的评论/);
  assert.equal(newest.actor.publicId, 'demo-student');
});

test('Bug 9: replying to a deleted or missing parent comment is rejected', () => {
  const service = createDemoAccountService({ storage: createMemoryStorage(), now: () => '2026-08-23T12:00:00.000Z' });
  const contentItem = { id: 'demo-post-student-1', courseCode: 'BIO2110F', type: 'experience', title: '微生物学复习节奏记录' };

  // Missing parent: there is no comment with this id.
  const missing = service.createComment('student', contentItem, { body: '回复不存在的评论', parentCommentId: 'demo-comment-does-not-exist' });
  assert.equal(missing.ok, false);
  assert.match(missing.message, /回复的评论不存在/);

  // Deleted parent: create then delete a comment, then try to reply to it.
  const created = service.createComment('student', contentItem, { body: '先创建再删' });
  assert.equal(created.ok, true);
  const deleted = service.deleteComment('student', created.comment.id);
  assert.equal(deleted.ok, true);
  const blocked = service.createComment('admin', contentItem, { body: '回复已删除', parentCommentId: created.comment.id });
  assert.equal(blocked.ok, false);
  assert.match(blocked.message, /回复的评论不存在/);
});

test('demo administrator can approve and reject submissions across identities', async () => {
  const service = createDemoAccountService({ storage: createMemoryStorage(), now: () => '2026-08-23T12:00:00.000Z' });
  const admin = service.createAdminClient();
  const initial = await admin.fetchSubmissions({ status: 'pending' });
  const pending = initial.submissions.find((item) => item.id === 'demo-sub-student-1');
  assert.ok(pending);
  assert.equal((await admin.approveSubmission(pending.id)).ok, true);
  assert.ok(service.getPrivateProfile('student').posts.some((item) => item.title === pending.title));
  assert.ok(service.getPrivateProfile('student').notifications.some((item) => /已通过/.test(item.title)));

  const created = service.createSubmission('student', { courseCode: 'BIO2019F', type: 'experience', title: '新的观察记录', summary: '', body: '完整正文' });
  assert.equal((await admin.rejectSubmission(created.submission.id, '请补充倍率')).ok, true);
  assert.equal(service.getPrivateProfile('student').submissions.find((item) => item.id === created.submission.id).status, 'rejected');

  const post = service.getPrivateProfile('student').posts[0];
  const revision = service.revisePost('student', post.id, { title: '修订后的复习节奏' });
  assert.ok(revision.submission.id);
  assert.equal(revision.submission.status, 'pending');
  assert.equal((await admin.approveSubmission(revision.submission.id)).ok, true);
  assert.equal(service.getPrivateProfile('student').posts.find((item) => item.id === post.id).title, '修订后的复习节奏');
});

test('demo avatar and timetable workflows validate and parse local files', async () => {
  const service = createDemoAccountService({ storage: createMemoryStorage() });
  const avatar = { type: 'image/png', size: 100, name: 'avatar.png' };
  const avatarResult = await service.uploadAvatar('student', avatar, async () => 'data:image/png;base64,AAAA');
  assert.equal(avatarResult.ok, true);
  assert.match(avatarResult.user.avatarUrl, /^data:image\/png/);
  assert.equal((await service.uploadAvatar('student', { ...avatar, type: 'image/svg+xml' })).ok, false);

  const rows = [
    ['课程代码', '课程名称', '教师姓名', '学期', '上课时间', '上课地点'],
    ['BIO2110F', '微生物学及实验', '陈老师', '秋冬', '周一1-2', '教1'],
    ['BIO2110F', '微生物学及实验', '陈老师', '秋冬', '周三3-4', '教2'],
  ];
  const preview = await service.previewCourseSchedule('student', { name: '课表.xlsx', size: 200 }, async () => [[['说明']], rows]);
  assert.equal(preview.ok, true);
  assert.equal(preview.duplicateGroupCount, 1);
  assert.equal(preview.courses[0].classTime, '周一1-2;周三3-4');
});

test('storage failures keep demo mode usable for the current session', () => {
  const service = createDemoAccountService({ storage: createMemoryStorage({ fail: true }) });
  const result = service.getPrivateProfile('student');
  assert.equal(result.ok, true);
  assert.match(result.persistenceWarning, /当前页面/);
  assert.equal(service.removeCourse('student', result.courses[0].courseCode).ok, true);

  const quotaService = createDemoAccountService({ storage: createMemoryStorage({ failWrite: true }) });
  const mutation = quotaService.removeCourse('student', 'BIO2019F');
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
  assert.equal(initial.activities.length, 0);

  const created = await admin.createActivity({
    title: '实验室开放日回顾',
    programId: 'laboratory-open-day',
    imageUrl: '/assets/activities/laboratory-open-day.webp',
    externalUrl: 'https://mp.weixin.qq.com/s/demo-lab',
  });
  assert.equal(created.ok, true);
  assert.equal(created.activity.status, 'published');
  assert.equal((await publicClient.fetchActivities()).activities[0].externalUrl, created.activity.externalUrl);
  assert.equal((await admin.updateActivity(created.activity.id, {
    title: '实验室开放日纪实',
    programId: 'laboratory-open-day',
    imageUrl: '/assets/activities/laboratory-open-day.webp',
    externalUrl: 'https://mp.weixin.qq.com/s/demo-lab',
  })).activity.title, '实验室开放日纪实');
  assert.equal((await admin.archiveActivity(created.activity.id)).ok, true);
  assert.equal((await publicClient.fetchActivities()).activities.length, 0);
});
