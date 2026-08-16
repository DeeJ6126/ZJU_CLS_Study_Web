import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthStore } from '../server/authStore.js';
import { createAuthServer } from '../server/server.js';
import { createQuizStore } from '../server/quiz/quizStore.js';
import { createContentStore } from '../server/content/contentStore.js';

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

test('account APIs keep courses and favorites private and expose notification read state', async () => {
  const store = createAuthStore({ filename: ':memory:' });
  const quizStore = createQuizStore({ filename: ':memory:' });
  const contentStore = createContentStore({ filename: ':memory:' });
  const { server } = createAuthServer({ store, quizStore, contentStore });
  const user = store.createUser({ email: '3240100000@zju.edu.cn', nickname: '同步同学', passwordHash: 'hash' });
  store.createSession({ id: 'account-session', userId: user.id });
  contentStore.createItem({
    id: 'content-1', courseCode: 'BIO2110F', type: 'experience', title: '学习心得',
    body: '正文', status: 'published', ownerId: user.id,
  });
  const cookie = 'study_session=account-session';
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    assert.equal((await fetch(`${baseUrl}/api/account/courses`)).status, 401);
    const replaced = await fetch(`${baseUrl}/api/account/courses`, {
      method: 'PUT', headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ courses: [{
        courseCode: 'BIO2110F', courseName: '微生物学（甲）', teacherName: '教师',
        term: '秋冬', classTime: '周一第1,2节', classLocation: '紫金港西1-101',
      }] }),
    });
    assert.equal(replaced.status, 200);
    const replacedBody = await replaced.json();
    assert.equal(replacedBody.courses[0].courseCode, 'BIO2110F');
    assert.equal(replacedBody.courses[0].catalogMatched, true);

    const favorite = await fetch(`${baseUrl}/api/account/favorites/content-1`, {
      method: 'PUT', headers: { 'content-type': 'application/json', cookie }, body: '{}',
    });
    assert.equal(favorite.status, 200);
    assert.equal((await favorite.json()).favorites[0].title, '学习心得');

    store.createNotification({
      userId: user.id, type: 'submission.approved', title: '投稿已通过', body: '学习心得已发布。',
      contentId: 'content-1',
    });
    const notifications = await fetch(`${baseUrl}/api/account/notifications`, { headers: { cookie } });
    const notificationBody = await notifications.json();
    assert.equal(notificationBody.unreadCount, 1);
    assert.equal(notificationBody.notifications[0].target.courseCode, 'BIO2110F');
    assert.equal(notificationBody.notifications[0].target.routeId, 'content-1');
    const read = await fetch(`${baseUrl}/api/account/notifications/${notificationBody.notifications[0].id}/read`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: '{}',
    });
    assert.equal(read.status, 200);
    assert.equal((await read.json()).unreadCount, 0);
  } finally {
    server.close();
  }
});

test('comment APIs expose public profile identity, create replies, and notify owners', async () => {
  const store = createAuthStore({ filename: ':memory:' });
  const quizStore = createQuizStore({ filename: ':memory:' });
  const contentStore = createContentStore({ filename: ':memory:' });
  const { server } = createAuthServer({ store, quizStore, contentStore });
  const owner = store.createUser({ email: '3240100001@zju.edu.cn', nickname: '作者', passwordHash: 'hash' });
  const commenter = store.createUser({ email: '3240100002@zju.edu.cn', nickname: '评论者', passwordHash: 'hash' });
  store.createSession({ id: 'owner-session', userId: owner.id });
  store.createSession({ id: 'comment-session', userId: commenter.id });
  contentStore.createItem({
    id: 'content-2', courseCode: 'BIO2110F', type: 'paper', title: '历年卷',
    body: '说明', status: 'published', ownerId: owner.id,
  });
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const guest = await fetch(`${baseUrl}/api/content/items/content-2/comments`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ body: '游客评论' }),
    });
    assert.equal(guest.status, 401);
    const created = await fetch(`${baseUrl}/api/content/items/content-2/comments`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie: 'study_session=comment-session' },
      body: JSON.stringify({ body: '请问有答案吗？' }),
    });
    const createdBody = await created.json();
    assert.equal(created.status, 201);
    assert.equal(createdBody.comment.author.nickname, '评论者');
    assert.equal(createdBody.comment.author.publicId, commenter.publicId);

    const ownerNotifications = await fetch(`${baseUrl}/api/account/notifications`, {
      headers: { cookie: 'study_session=owner-session' },
    });
    assert.equal((await ownerNotifications.json()).notifications[0].type, 'content.comment');

    const reply = await fetch(`${baseUrl}/api/content/items/content-2/comments`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie: 'study_session=owner-session' },
      body: JSON.stringify({ body: '已补充。', parentCommentId: createdBody.comment.id }),
    });
    assert.equal(reply.status, 201);
    const commenterNotifications = await fetch(`${baseUrl}/api/account/notifications`, {
      headers: { cookie: 'study_session=comment-session' },
    });
    assert.equal((await commenterNotifications.json()).notifications[0].type, 'comment.reply');

    const listed = await fetch(`${baseUrl}/api/content/items/content-2/comments`);
    const listedBody = await listed.json();
    assert.equal(listedBody.comments.length, 2);
    assert.equal(listedBody.comments[0].author.avatarUrl, '');
    assert.equal(listedBody.comments[0].canManage, false);

    const ownedList = await fetch(`${baseUrl}/api/content/items/content-2/comments`, {
      headers: { cookie: 'study_session=comment-session' },
    });
    assert.equal((await ownedList.json()).comments[0].canManage, true);

    const profile = await fetch(`${baseUrl}/api/account/profile`, {
      headers: { cookie: 'study_session=comment-session' },
    });
    const profileBody = await profile.json();
    assert.equal(profileBody.comments[0].itemTitle, '历年卷');
    assert.equal(profileBody.comments[0].courseCode, 'BIO2110F');
    assert.equal(profileBody.comments[0].routeId, 'content-2');
  } finally {
    server.close();
  }
});

test('quiz account APIs claim anonymous sessions and synchronize vocabulary', async () => {
  const store = createAuthStore({ filename: ':memory:' });
  const quizStore = createQuizStore({ filename: ':memory:' });
  const contentStore = createContentStore({ filename: ':memory:' });
  const { server } = createAuthServer({ store, quizStore, contentStore });
  const user = store.createUser({ email: '3240100003@zju.edu.cn', nickname: '刷题同学', passwordHash: 'hash' });
  store.createSession({ id: 'quiz-sync-session', userId: user.id });
  const cookie = 'study_session=quiz-sync-session';
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const guestSession = await fetch(`${baseUrl}/api/quiz/sessions`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ collectionSlug: 'microbiology-final-review', categorySourceIds: ['1'], limit: 1 }),
    });
    const guestSessionBody = await guestSession.json();
    assert.equal((await fetch(`${baseUrl}/api/quiz/account-state?collectionSlug=microbiology-final-review`)).status, 401);
    const claimed = await fetch(`${baseUrl}/api/quiz/sessions/${guestSessionBody.session.id}/claim`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: '{}',
    });
    assert.equal(claimed.status, 200);

    const merged = await fetch(`${baseUrl}/api/quiz/account-state/merge`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        collectionSlug: 'microbiology-final-review', mistakes: [],
        vocabulary: [{ recordKey: 'virus', term: 'Virus', status: 'learning', context: {} }],
      }),
    });
    assert.equal(merged.status, 200);
    const state = await fetch(`${baseUrl}/api/quiz/account-state?collectionSlug=microbiology-final-review`, {
      headers: { cookie },
    });
    assert.equal((await state.json()).state.vocabulary[0].term, 'Virus');

    const removed = await fetch(`${baseUrl}/api/quiz/vocabulary/microbiology-final-review/virus`, {
      method: 'DELETE', headers: { cookie },
    });
    assert.equal(removed.status, 200);
  } finally {
    server.close();
  }
});
