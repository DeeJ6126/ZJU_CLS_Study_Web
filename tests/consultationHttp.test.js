import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthStore } from '../server/authStore.js';
import { createQuizStore } from '../server/quiz/quizStore.js';
import { createContentStore } from '../server/content/contentStore.js';
import { createStudentHomepageStore } from '../server/studentHomepage/studentHomepageStore.js';
import { createConsultationStore } from '../server/consultation/consultationStore.js';
import { createGuestCreationGuard } from '../server/consultation/guestCreationGuard.js';
import { createAuthServer } from '../server/server.js';

function setup({ guestCreationGuard } = {}) {
  const authStore = createAuthStore({ filename: ':memory:' });
  const consultationStore = createConsultationStore({ filename: ':memory:' });
  const { server } = createAuthServer({
    store: authStore,
    quizStore: createQuizStore({ filename: ':memory:' }),
    contentStore: createContentStore({ filename: ':memory:' }),
    studentHomepageStore: createStudentHomepageStore({ filename: ':memory:' }),
    consultationStore,
    guestCreationGuard,
  });
  const admin = authStore.createUser({ email: '3230100001@zju.edu.cn', nickname: '管理员', passwordHash: 'x', role: 'admin' });
  const mentor = authStore.createUser({ email: '3230100002@zju.edu.cn', nickname: '指导学长', passwordHash: 'x' });
  const student = authStore.createUser({ email: '3230100003@zju.edu.cn', nickname: '咨询同学', passwordHash: 'x' });
  for (const [id, account] of [['admin', admin], ['mentor', mentor], ['student', student]]) {
    authStore.createSession({ id, userId: account.id });
  }
  return { server, admin, mentor, student };
}

async function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)));
}

async function request(base, path, { method = 'GET', cookie, body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie') };
}

test('consultation session supports guest and student one-to-one chat, mentor inbox, and closure', async () => {
  const { server, admin, mentor, student } = setup();
  const base = await listen(server);
  const adminCookie = 'study_session=admin';
  const mentorCookie = 'study_session=mentor';
  const studentCookie = 'study_session=student';
  try {
    const initial = await request(base, '/api/consultation/status');
    assert.equal(initial.body.open, false);
    assert.equal(initial.body.mentor, null);
    assert.equal((await request(base, '/api/admin/consultation/candidates')).status, 401);
    assert.equal((await request(base, '/api/admin/consultation/candidates', { cookie: studentCookie })).status, 403);

    const candidates = await request(base, '/api/admin/consultation/candidates?q=3230100002', { cookie: adminCookie });
    assert.equal(candidates.status, 200);
    assert.deepEqual(candidates.body.users, [{ id: mentor.id, nickname: mentor.nickname, studentId: '3230100002' }]);

    const startsAt = new Date(Date.now() - 60_000).toISOString();
    const endsAt = new Date(Date.now() + 3_600_000).toISOString();
    assert.equal((await request(base, '/api/admin/consultation/session', {
      method: 'PUT', cookie: studentCookie, body: { mentorUserId: mentor.id, startsAt, endsAt },
    })).status, 403);
    const opened = await request(base, '/api/admin/consultation/session', {
      method: 'PUT', cookie: adminCookie, body: { mentorUserId: mentor.id, startsAt, endsAt },
    });
    assert.equal(opened.status, 200);
    assert.equal(opened.body.open, true);
    assert.equal(opened.body.mentorUserId, mentor.id);
    assert.equal((await request(base, '/api/consultation/status')).body.mentorUserId, undefined);
    assert.equal((await request(base, '/api/consultation/status', { cookie: mentorCookie })).body.isMentor, true);

    assert.deepEqual((await request(base, '/api/consultation/conversations/current')).body, { conversation: null });
    const first = await request(base, '/api/consultation/conversations', {
      method: 'POST', body: { guestName: '游客甲' },
    });
    assert.equal(first.status, 201);
    assert.match(first.cookie, /consultation_guest=/);
    assert.match(first.cookie, /HttpOnly/);
    assert.match(first.cookie, /Path=\/zjubio\//);
    const guestCookie = first.cookie.split(';')[0];
    const conversationId = first.body.conversation.id;
    assert.equal(first.body.conversation.participantName, '游客甲');
    assert.equal(first.body.conversation.visitorUserId, undefined);
    assert.equal(first.body.conversation.sessionId, undefined);
    assert.equal((await request(base, '/api/consultation/conversations/current', { cookie: guestCookie })).body.conversation.id, conversationId);
    const current = await request(base, '/api/consultation/conversations/current', { cookie: guestCookie });
    assert.equal(current.body.conversation.visitorUserId, undefined);
    assert.equal(current.body.conversation.sessionId, undefined);
    assert.equal((await request(base, '/api/consultation/conversations', { method: 'POST', cookie: guestCookie, body: {} })).body.conversation.id, conversationId);
    assert.equal((await request(base, `/api/consultation/conversations/${conversationId}/messages`)).status, 404);
    const otherGuest = await request(base, '/api/consultation/conversations', {
      method: 'POST', body: { guestName: '游客乙' },
    });
    const otherGuestCookie = otherGuest.cookie.split(';')[0];
    assert.notEqual(otherGuest.body.conversation.id, conversationId);
    assert.equal((await request(base, `/api/consultation/conversations/${conversationId}/messages`, { cookie: otherGuestCookie })).status, 404);

    const asked = await request(base, `/api/consultation/conversations/${conversationId}/messages`, {
      method: 'POST', cookie: guestCookie, body: { text: '请问实验室轮转如何准备？' },
    });
    assert.equal(asked.status, 201);
    assert.equal(asked.body.message.sender, 'visitor');
    assert.equal((await request(base, `/api/consultation/conversations/${conversationId}/messages`, {
      method: 'POST', cookie: guestCookie, body: { text: '太快了' },
    })).status, 429);
    assert.equal((await request(base, `/api/consultation/conversations/${conversationId}/messages`, {
      method: 'POST', cookie: guestCookie, body: { text: 'x'.repeat(1001) },
    })).status, 400);

    const registered = await request(base, '/api/consultation/conversations', {
      method: 'POST', cookie: studentCookie, body: {},
    });
    assert.equal(registered.status, 201);
    assert.equal(registered.body.conversation.participantName, student.nickname);
    assert.notEqual(registered.body.conversation.id, conversationId);
    assert.equal((await request(base, '/api/consultation/conversations', { cookie: studentCookie })).status, 403);
    const studentConversationId = registered.body.conversation.id;
    assert.equal((await request(base, `/api/consultation/conversations/${studentConversationId}/messages`, {
      method: 'POST', cookie: studentCookie, body: { text: '我也想咨询选课。' },
    })).status, 201);
    assert.equal((await request(base, `/api/consultation/conversations/${studentConversationId}/messages`, {
      cookie: guestCookie,
    })).status, 404);

    const inbox = await request(base, '/api/consultation/conversations', { cookie: mentorCookie });
    assert.equal(inbox.status, 200);
    const item = inbox.body.conversations.find((entry) => entry.id === conversationId);
    assert.equal(item.visitorUserId, undefined);
    assert.equal(item.sessionId, undefined);
    assert.equal(item.unreadCount, 1);
    assert.equal(item.latestMessageId, asked.body.message.id);
    assert.equal(item.participantName, '游客甲');
    assert.equal(inbox.body.conversations.find((entry) => entry.id === studentConversationId).unreadCount, 1);
    const read = await request(base, `/api/consultation/conversations/${conversationId}/messages`, { cookie: mentorCookie });
    assert.equal(read.body.messages.length, 1);
    assert.equal((await request(base, '/api/consultation/conversations', { cookie: mentorCookie })).body.conversations.find((entry) => entry.id === conversationId).unreadCount, 0);
    const replied = await request(base, `/api/consultation/conversations/${conversationId}/messages`, {
      method: 'POST', cookie: mentorCookie, body: { text: '先熟悉研究方向。' },
    });
    assert.equal(replied.status, 201);
    assert.equal(replied.body.message.sender, 'mentor');
    assert.equal((await request(base, `/api/consultation/conversations/${conversationId}/messages`, { cookie: guestCookie })).body.messages.length, 2);
    assert.equal((await request(base, `/api/consultation/conversations/${studentConversationId}/messages`, { cookie: mentorCookie })).body.messages.length, 1);
    assert.equal((await request(base, `/api/consultation/conversations/${studentConversationId}/messages`, {
      method: 'POST', cookie: mentorCookie, body: { text: '先对照培养方案。' },
    })).status, 201);
    assert.equal((await request(base, `/api/consultation/conversations/${studentConversationId}/messages`, { cookie: studentCookie })).body.messages.length, 2);
    assert.equal((await request(base, `/api/consultation/conversations/${conversationId}/messages`, { cookie: studentCookie })).status, 404);
    assert.equal((await request(base, `/api/consultation/conversations/${conversationId}/messages`, { cookie: adminCookie })).status, 404);

    const closed = await request(base, '/api/admin/consultation/session', { method: 'DELETE', cookie: adminCookie });
    assert.equal(closed.body.open, false);
    assert.equal(closed.body.closed, true);
    assert.equal((await request(base, `/api/consultation/conversations/${conversationId}/messages`, {
      method: 'POST', cookie: guestCookie, body: { text: '谢谢' },
    })).status, 403);
    assert.equal((await request(base, '/api/consultation/conversations', { method: 'POST', cookie: guestCookie, body: {} })).status, 403);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('fresh guest identities are rate limited without blocking a valid guest cookie', async () => {
  const { server, mentor } = setup({
    guestCreationGuard: createGuestCreationGuard({ maxCreates: 2 }),
  });
  const base = await listen(server);
  try {
    const startsAt = new Date(Date.now() - 60_000).toISOString();
    const endsAt = new Date(Date.now() + 3_600_000).toISOString();
    await request(base, '/api/admin/consultation/session', {
      method: 'PUT', cookie: 'study_session=admin', body: { mentorUserId: mentor.id, startsAt, endsAt },
    });
    const first = await request(base, '/api/consultation/conversations', { method: 'POST', body: {} });
    assert.equal(first.status, 201);
    assert.equal((await request(base, '/api/consultation/conversations', { method: 'POST', body: {} })).status, 201);
    assert.equal((await request(base, '/api/consultation/conversations', { method: 'POST', body: {} })).status, 429);
    const resumed = await request(base, '/api/consultation/conversations', {
      method: 'POST', cookie: first.cookie.split(';')[0], body: {},
    });
    assert.equal(resumed.status, 201);
    assert.equal(resumed.body.conversation.id, first.body.conversation.id);
    assert.equal((await request(base, '/api/consultation/conversations', {
      method: 'POST', cookie: 'study_session=student', body: {},
    })).status, 201);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('consultation scheduling validates mentor and start/end time', async () => {
  const { server, mentor } = setup();
  const base = await listen(server);
  try {
    const now = Date.now();
    const future = new Date(now + 3_600_000).toISOString();
    const later = new Date(now + 7_200_000).toISOString();
    const invalid = await request(base, '/api/admin/consultation/session', {
      method: 'PUT', cookie: 'study_session=admin',
      body: { mentorUserId: mentor.id, startsAt: later, endsAt: future },
    });
    assert.equal(invalid.status, 400);
    const scheduled = await request(base, '/api/admin/consultation/session', {
      method: 'PUT', cookie: 'study_session=admin',
      body: { mentorUserId: mentor.id, startsAt: future, endsAt: later },
    });
    assert.equal(scheduled.status, 200);
    assert.equal(scheduled.body.open, false);
    assert.equal(scheduled.body.closed, false);
    assert.equal(scheduled.body.startsAt, future);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
