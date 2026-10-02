import test from 'node:test';
import assert from 'node:assert/strict';
import { createContentStore } from '../server/content/contentStore.js';
import { handleFeedbackHttpRequest } from '../server/content/feedbackHttpService.js';
import { createDemoAccountService } from '../src/services/demoAccountService.js';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

function setup() {
  const store = createContentStore({ filename: ':memory:' }); store.initialize();
  const call = async (path, { method = 'GET', body, user = { role: 'guest' }, userId = 0, ip = '192.0.2.1', contentType = 'application/json' } = {}) => {
    let response;
    const handled = await handleFeedbackHttpRequest({ request: { method, headers: { 'content-type': contentType } }, response: {}, url: new URL(path, 'http://test'), user, userId, clientIp: ip, contentStore: store, sendJson: (_, status, data) => { response = { status, data }; }, readJsonBody: async () => body });
    return { handled, ...response };
  };
  return { store, call };
}
const admin = { role: 'admin', nickname: '管理员' };

test('guest feedback stays plain text and private to administrators', async () => {
  const { store, call } = setup();
  const body = '**纯文字**\n<img src=x onerror=alert(1)>';
  const created = await call('/api/feedback', { method: 'POST', body: { body, authorName: '冒充管理员' } });
  assert.equal(created.status, 201);
  assert.deepEqual(Object.keys(created.data.feedback).sort(), ['createdAt', 'id']);
  assert.equal((await call('/api/feedback')).status, 404);
  assert.equal((await call('/api/admin/feedback')).status, 401);
  assert.equal((await call('/api/admin/feedback/count', { userId: 1, user: { role: 'student' } })).status, 403);
  const listed = await call('/api/admin/feedback', { userId: 2, user: admin });
  assert.equal(listed.data.items[0].body, body);
  assert.equal(listed.data.items[0].authorName, '游客');
  assert.equal(listed.data.unreadCount, 1);
  assert.equal('senderKey' in listed.data.items[0], false);
  store.close();
});

test('reading a page marks only its observed IDs, not later arrivals', async () => {
  const { store, call } = setup();
  const first = await call('/api/feedback', { method: 'POST', body: { body: '第一条' } });
  await call('/api/feedback', { method: 'POST', body: { body: '后来发送' } });
  const read = await call('/api/admin/feedback/read', { method: 'POST', userId: 2, user: admin, body: { ids: [first.data.feedback.id] } });
  assert.equal(read.data.unreadCount, 1);
  assert.equal((await call('/api/admin/feedback/count', { userId: 2, user: admin })).data.unreadCount, 1);
  assert.equal((await call('/api/admin/feedback/read', { method: 'POST', body: { ids: [first.data.feedback.id] } })).status, 401);
  assert.equal((await call('/api/admin/feedback/read', { method: 'POST', userId: 2, user: admin, body: null })).status, 400);
  store.close();
});

test('feedback validates size and types and bounds duplicate/frequent guest submissions', async () => {
  const { store, call } = setup();
  for (const input of [null, [], { body: [] }, { body: ' ' }, { body: 'x'.repeat(2001) }]) assert.equal((await call('/api/feedback', { method: 'POST', body: input })).status, 400);
  assert.equal((await call('/api/feedback', { method: 'POST', body: { body: '意见' }, contentType: 'text/plain' })).status, 415);
  for (let i = 0; i < 10; i++) assert.equal((await call('/api/feedback', { method: 'POST', body: { body: `意见${i}` } })).status, 201);
  assert.equal((await call('/api/feedback', { method: 'POST', body: { body: '意见0' } })).status, 429);
  assert.equal((await call('/api/feedback', { method: 'POST', body: { body: '更多意见' } })).status, 429);
  assert.equal((await call('/api/feedback', { method: 'POST', ip: '192.0.2.2', body: { body: '其他访客' } })).status, 201);
  store.close();
});

test('demo feedback and unread state never use the real backend', async () => {
  const service = createDemoAccountService({ storage: null });
  const client = service.createFeedbackClient(() => 'guest');
  assert.equal((await client.submit('演示反馈')).ok, true);
  const adminClient = service.createAdminClient();
  assert.equal((await adminClient.fetchFeedbackCount()).unreadCount, 1);
  const list = await adminClient.fetchFeedback();
  assert.equal(list.items[0].body, '演示反馈');
  assert.equal((await adminClient.markFeedbackRead([list.items[0].id])).unreadCount, 0);
});

test('contributor avatars are distinct local snapshots rather than a shared test replacement', () => {
  const hashes = ['DeeJ6126', 'somnis7', 'serashikan'].map((name) => createHash('sha256').update(readFileSync(`public/assets/about/contributors/${name}.webp`)).digest('hex'));
  assert.equal(new Set(hashes).size, 3);
});
