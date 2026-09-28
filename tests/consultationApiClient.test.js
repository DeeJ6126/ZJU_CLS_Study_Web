import test from 'node:test';
import assert from 'node:assert/strict';
import { createConsultationApiClient } from '../src/services/consultationApiClient.js';

test('consultation client uses the scoped public API with cookies', async () => {
  const calls = [];
  const client = createConsultationApiClient(async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 200, json: async () => ({ conversation: { id: 'c-1' } }) };
  });

  await client.getStatus();
  await client.createConversation({ guestName: '  来访同学  ' });
  await client.getCurrentConversation();
  await client.listConversations();
  await client.listMessages('a/b');
  await client.sendMessage('a/b', '你好');

  assert.deepEqual(calls.map((call) => call.url), [
    '/zjubio/api/consultation/status',
    '/zjubio/api/consultation/conversations',
    '/zjubio/api/consultation/conversations/current',
    '/zjubio/api/consultation/conversations',
    '/zjubio/api/consultation/conversations/a%2Fb/messages',
    '/zjubio/api/consultation/conversations/a%2Fb/messages',
  ]);
  assert.ok(calls.every((call) => call.options.credentials === 'include'));
  assert.deepEqual(JSON.parse(calls[1].options.body), { guestName: '来访同学' });
  assert.deepEqual(JSON.parse(calls[5].options.body), { text: '你好' });
});

test('consultation administration calls use administrator endpoints', async () => {
  const calls = [];
  const client = createConsultationApiClient(async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 200, json: async () => ({}) };
  });

  await client.listCandidates('张 三');
  await client.setSession({ mentorUserId: 42, startsAt: '2026-09-28T10:00:00Z', endsAt: '2026-09-28T11:00:00Z' });
  await client.closeSession();

  assert.equal(calls[0].url, '/zjubio/api/admin/consultation/candidates?q=%E5%BC%A0+%E4%B8%89');
  assert.equal(calls[1].url, '/zjubio/api/admin/consultation/session');
  assert.equal(calls[1].options.method, 'PUT');
  assert.equal(calls[2].options.method, 'DELETE');
});

test('consultation client preserves transport errors for retry UI', async () => {
  const client = createConsultationApiClient(async () => { throw new Error('offline'); });
  assert.deepEqual(await client.getStatus(), {
    ok: false,
    status: 0,
    message: '咨询服务暂时无法连接。',
  });
});
