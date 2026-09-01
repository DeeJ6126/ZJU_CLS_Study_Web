import test from 'node:test';
import assert from 'node:assert/strict';

import { createAuthStore } from '../server/authStore.js';
import { hashPassword } from '../server/authService.js';
import { createContentStore } from '../server/content/contentStore.js';
import {
  approveSubmission,
  createRevisionSubmission,
} from '../server/content/submissionService.js';
import { createAuthServer } from '../server/server.js';
import { createQuizStore } from '../server/quiz/quizStore.js';

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

test('content ownership exposes only published posts on a public profile', async () => {
  const authStore = createAuthStore({ filename: ':memory:' });
  const contentStore = createContentStore({ filename: ':memory:' });
  authStore.initialize();
  contentStore.initialize();
  const user = authStore.createUser({
    email: '3220100000@zju.edu.cn',
    nickname: '生科同学',
    passwordHash: await hashPassword('12345678'),
  });
  contentStore.createItem({
    courseCode: 'BIO2110F',
    type: 'experience',
    title: '已发布心得',
    body: '正文',
    status: 'published',
    ownerId: user.id,
  });
  contentStore.createItem({
    courseCode: 'BIO2110F',
    type: 'experience',
    title: '草稿',
    body: '不公开',
    status: 'draft',
    ownerId: user.id,
  });

  assert.deepEqual(
    contentStore.listPublishedByOwner(user.id).map((item) => item.title),
    ['已发布心得'],
  );
  assert.equal(authStore.findUserByPublicId(user.publicId).email, '3220100000@zju.edu.cn');
  authStore.close();
  contentStore.close();
});

test('approved revisions replace the published body without creating a second post', async () => {
  const contentStore = createContentStore({ filename: ':memory:' });
  contentStore.initialize();
  const item = contentStore.createItem({
    courseCode: 'BIO2110F',
    type: 'experience',
    title: '原标题',
    summary: '原摘要',
    author: '作者',
    body: '原正文',
    status: 'published',
    ownerId: 7,
  });
  const revision = createRevisionSubmission(contentStore, item.id, {
    title: '新标题',
    summary: '新摘要',
    body: '新正文',
  }, { id: 7, nickname: '作者' });

  assert.equal(revision.ok, true);
  assert.equal(contentStore.findById(item.id).title, '原标题');
  const approved = approveSubmission(contentStore, revision.submission.id, {
    id: 1,
    cc98Nickname: '管理员',
  });
  assert.equal(approved.ok, true);
  assert.equal(contentStore.findById(item.id).title, '新标题');
  assert.equal(contentStore.listByOwner(7).length, 1);
  contentStore.close();
});

test('a revision cannot overwrite a post that changed while review was pending', () => {
  const contentStore = createContentStore({ filename: ':memory:' });
  contentStore.initialize();
  const item = contentStore.createItem({
    courseCode: 'BIO2110F', type: 'experience', title: '初始标题', body: '初始正文',
    status: 'published', ownerId: 7, createdAt: '2026-01-01T00:00:00.000Z',
  });
  const revision = createRevisionSubmission(contentStore, item.id, {
    title: '待审核标题', body: '待审核正文',
  }, { id: 7, nickname: '作者' });
  contentStore.updateItem(item.id, { title: '管理员新标题', updatedBy: 1 });

  const approved = approveSubmission(contentStore, revision.submission.id, {
    id: 1, cc98Nickname: '管理员',
  });
  assert.equal(approved.status, 409);
  assert.equal(contentStore.findById(item.id).title, '管理员新标题');
  contentStore.close();
});

test('an archived post can be resubmitted and returns only after administrator approval', () => {
  const contentStore = createContentStore({ filename: ':memory:' });
  contentStore.initialize();
  const item = contentStore.createItem({
    courseCode: 'BIO2110F', type: 'experience', title: '旧帖子', body: '旧正文',
    status: 'archived', ownerId: 7,
  });
  const revision = createRevisionSubmission(contentStore, item.id, {
    title: '重新发布', body: '更新正文',
  }, { id: 7, nickname: '作者' });
  assert.equal(revision.ok, true);
  assert.equal(contentStore.findById(item.id).status, 'archived');
  assert.equal(approveSubmission(contentStore, revision.submission.id, { id: 1, cc98Nickname: '管理员' }).ok, true);
  assert.equal(contentStore.findById(item.id).status, 'published');
});

test('profile HTTP API keeps email private and lets only the owner archive a post', async () => {
  const authStore = createAuthStore({ filename: ':memory:' });
  const contentStore = createContentStore({ filename: ':memory:' });
  const quizStore = createQuizStore({ filename: ':memory:' });
  authStore.initialize();
  contentStore.initialize();
  authStore.initialize();
  contentStore.initialize();
  const user = authStore.createUser({
    email: '3220100000@zju.edu.cn',
    nickname: '公开昵称',
    passwordHash: await hashPassword('12345678'),
  });
  const post = contentStore.createItem({
    courseCode: 'BIO2110F',
    type: 'experience',
    title: '主页帖子',
    body: '正文',
    status: 'published',
    ownerId: user.id,
  });
  authStore.createSession({ id: 'profile-session', userId: user.id });
  const { server } = createAuthServer({
    store: authStore,
    contentStore,
    quizStore,
    emailSender: async () => {},
  });
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    const publicResponse = await fetch(`${baseUrl}/api/profiles/${user.publicId}`);
    const publicBody = await publicResponse.json();
    assert.equal(publicBody.profile.nickname, '公开昵称');
    assert.equal(publicBody.profile.email, undefined);
    assert.equal(publicBody.posts.some((item) => item.title === '主页帖子'), true);

    const archived = await fetch(`${baseUrl}/api/account/posts/${post.id}/archive`, {
      method: 'POST',
      headers: {
        cookie: 'study_session=profile-session',
        'content-type': 'application/json',
      },
      body: '{}',
    });
    assert.equal(archived.status, 200);
    assert.equal(contentStore.findById(post.id).status, 'archived');
  } finally {
    server.close();
  }
});

test('logged-in users can update their own grade through the profile API', async () => {
  const authStore = createAuthStore({ filename: ':memory:' });
  const contentStore = createContentStore({ filename: ':memory:' });
  const quizStore = createQuizStore({ filename: ':memory:' });
  authStore.initialize();
  contentStore.initialize();
  const user = authStore.createUser({
    email: '3240123@zju.edu.cn',
    nickname: '年级同学',
    passwordHash: await hashPassword('12345678'),
    grade: 2024,
  });
  authStore.createSession({ id: 'grade-session', userId: user.id });
  const { server } = createAuthServer({
    store: authStore, contentStore, quizStore, emailSender: async () => {},
  });
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;
  const headers = { cookie: 'study_session=grade-session', 'content-type': 'application/json' };
  try {
    const invalid = await fetch(`${baseUrl}/api/account/profile/grade`, {
      method: 'PATCH', headers, body: JSON.stringify({ grade: 2023 }),
    });
    assert.equal(invalid.status, 400);

    const me = await fetch(`${baseUrl}/api/auth/me`, { headers });
    const meBody = await me.json();
    assert.equal(meBody.user.grade, 2024);

    const update = await fetch(`${baseUrl}/api/account/profile/grade`, {
      method: 'PATCH', headers, body: JSON.stringify({ grade: 2026 }),
    });
    const updateBody = await update.json();
    assert.equal(update.status, 200);
    assert.equal(updateBody.user.grade, 2026);
    assert.equal(authStore.findUserById(user.id).grade, 2026);

    const clear = await fetch(`${baseUrl}/api/account/profile/grade`, {
      method: 'PATCH', headers, body: JSON.stringify({ grade: null }),
    });
    const clearBody = await clear.json();
    assert.equal(clear.status, 200);
    assert.equal(clearBody.user.grade, null);
  } finally {
    server.close();
  }
});

test('the grade endpoint rejects anonymous requests', async () => {
  const authStore = createAuthStore({ filename: ':memory:' });
  const contentStore = createContentStore({ filename: ':memory:' });
  const quizStore = createQuizStore({ filename: ':memory:' });
  authStore.initialize();
  contentStore.initialize();
  const { server } = createAuthServer({
    store: authStore, contentStore, quizStore, emailSender: async () => {},
  });
  const port = await listen(server);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/account/profile/grade`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ grade: 2025 }),
    });
    assert.equal(response.status, 401);
  } finally {
    server.close();
  }
});

test('owners can edit and withdraw pending submissions and delete rejected submissions', async () => {
  const authStore = createAuthStore({ filename: ':memory:' });
  const contentStore = createContentStore({ filename: ':memory:' });
  const quizStore = createQuizStore({ filename: ':memory:' });
  authStore.initialize();
  contentStore.initialize();
  const user = authStore.createUser({
    email: '3220100001@zju.edu.cn', nickname: '投稿同学', passwordHash: await hashPassword('12345678'),
  });
  authStore.createSession({ id: 'submission-owner', userId: user.id });
  const pending = contentStore.createSubmission({
    courseCode: 'BIO2110F', type: 'experience', title: '原投稿', body: '原正文',
    submitterId: user.id, submitterName: user.nickname,
  });
  const rejected = contentStore.createSubmission({
    courseCode: 'BIO2110F', type: 'experience', title: '未通过投稿', body: '待修改正文',
    submitterId: user.id, submitterName: user.nickname,
  });
  contentStore.setSubmissionStatus(rejected.id, 'rejected', { id: 1, cc98Nickname: '管理员' });
  const { server } = createAuthServer({ store: authStore, contentStore, quizStore, emailSender: async () => {} });
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;
  const headers = { cookie: 'study_session=submission-owner', 'content-type': 'application/json' };
  try {
    const edited = await fetch(`${baseUrl}/api/account/submissions/${pending.id}`, {
      method: 'PATCH', headers, body: JSON.stringify({ title: '修改后的投稿', body: '新正文' }),
    });
    assert.equal(edited.status, 200);
    assert.equal(contentStore.findSubmissionById(pending.id).title, '修改后的投稿');

    const withdrawn = await fetch(`${baseUrl}/api/account/submissions/${pending.id}/withdraw`, {
      method: 'POST', headers, body: '{}',
    });
    assert.equal(withdrawn.status, 200);
    assert.equal(contentStore.findSubmissionById(pending.id).status, 'withdrawn');

    const removed = await fetch(`${baseUrl}/api/account/submissions/${rejected.id}`, {
      method: 'DELETE', headers: { cookie: 'study_session=submission-owner' },
    });
    assert.equal(removed.status, 200);
    assert.equal(contentStore.findSubmissionById(rejected.id), null);
  } finally {
    server.close();
  }
});
