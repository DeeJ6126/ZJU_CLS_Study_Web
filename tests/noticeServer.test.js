import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { createAuthServer } from '../server/server.js';
import { createAuthStore } from '../server/authStore.js';
import { createQuizStore } from '../server/quiz/quizStore.js';
import { createContentStore } from '../server/content/contentStore.js';
import { createConsultationStore } from '../server/consultation/consultationStore.js';
import { createStudentHomepageStore } from '../server/studentHomepage/studentHomepageStore.js';

test('notice routes use actual authenticated sessions and remain distinct from account notifications', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'notice-server-'));
  const store = createAuthStore({ filename: ':memory:' });
  const quizStore = createQuizStore({ filename: ':memory:' });
  const contentStore = createContentStore({ filename: ':memory:' });
  const consultationStore = createConsultationStore({ filename: ':memory:' });
  const studentHomepageStore = createStudentHomepageStore({ filename: ':memory:' });
  const { server } = createAuthServer({ store, quizStore, contentStore, consultationStore, studentHomepageStore,
    uploadDirectory: directory, adminCc98Names: new Set(), adminStudentIds: new Set() });
  const admin = store.createUser({ email: '3240100001@zju.edu.cn', nickname: 'NoticeAdmin', passwordHash: 'x', role: 'admin' });
  const student = store.createUser({ email: '3240100002@zju.edu.cn', nickname: 'NoticeStudent', passwordHash: 'x' });
  store.createSession({ id: 'notice-admin-session', userId: admin.id });
  store.createSession({ id: 'notice-student-session', userId: student.id });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, session = '', method = 'GET', body) => fetch(base + path, {
    method, headers: { ...(session ? { cookie: `study_session=${session}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  try {
    assert.equal((await request('/api/admin/notices')).status, 401);
    assert.equal((await request('/api/admin/notices', 'notice-student-session')).status, 403);
    const created = await request('/api/admin/notices', 'notice-admin-session', 'POST', {
      title: 'Backend fixture only', category: 'general', publishedDate: '2026-10-01', summary: 'Summary', body: 'Body',
    });
    assert.equal(created.status, 201);
    const { notice } = await created.json();
    const png = await sharp({ create: { width: 80, height: 40, channels: 3, background: '#14768a' } }).png().toBuffer();
    const uploadImage = (session, bytes = png, origin = '') => fetch(`${base}/api/admin/notices/${notice.id}/images`, {
      method: 'POST', headers: { cookie: `study_session=${session}`, 'content-type': 'image/png',
        'x-notice-upload': 'notice-image', 'x-file-name': encodeURIComponent('图片.png'), ...(origin ? { origin } : {}) }, body: bytes,
    });
    assert.equal((await uploadImage('')).status, 401);
    assert.equal((await uploadImage('notice-student-session')).status, 403);
    assert.equal((await uploadImage('notice-admin-session', png, 'https://evil.test')).status, 403);
    assert.equal((await uploadImage('notice-admin-session', Buffer.from('<svg onload="alert(1)"></svg>'))).status, 400);
    const uploaded = await uploadImage('notice-admin-session');
    assert.equal(uploaded.status, 201);
    const imageNotice = (await uploaded.json()).notice;
    assert.equal(imageNotice.images.length, 1);
    assert.equal(imageNotice.attachments.length, 0);
    const imagePath = imageNotice.images[0].url.replace('/zjubio', '');
    assert.equal((await request(imagePath)).status, 404);
    assert.equal((await request(imagePath, 'notice-admin-session')).status, 200);
    assert.equal((await request(`/api/notices/${notice.id}`)).status, 404);
    assert.equal((await request(`/api/admin/notices/${notice.id}/publish`, 'notice-student-session', 'POST', {})).status, 403);
    assert.equal((await request(`/api/admin/notices/${notice.id}/publish`, 'notice-admin-session', 'POST', {})).status, 200);
    assert.equal((await request(`/api/notices/${notice.id}`)).status, 200);
    const imageResponse = await request(imagePath);
    assert.equal(imageResponse.status, 200);
    assert.equal(imageResponse.headers.get('content-type'), 'image/webp');
    assert.match(imageResponse.headers.get('content-disposition'), /^inline;/);
    const metadata = await sharp(Buffer.from(await imageResponse.arrayBuffer())).metadata();
    assert.equal(metadata.width, 80);
    assert.equal(metadata.format, 'webp');
    assert.equal((await request('/api/account/notifications')).status, 401);
    assert.equal((await (await request('/api/notices')).json()).total, 1);
    assert.equal(contentStore.listAuditLogs({ action: 'notice.create' })[0].actorId, admin.id);
    assert.equal((await request(`/api/admin/notices/${notice.id}/archive`, 'notice-admin-session', 'POST', {})).status, 200);
    assert.equal((await request(imagePath)).status, 404);
  } finally {
    server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
    for (const database of [store, quizStore, contentStore]) database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
