import test from 'node:test';
import assert from 'node:assert/strict';
import { createNoticeApiClient } from '../src/services/noticeApiClient.js';
import { getDemoPageFromHash } from '../src/services/demoNavigationService.js';
import { demoTopPages } from '../src/data/quizDemo.js';

test('public notices use independent routes from private account messages', () => {
  assert.equal(getDemoPageFromHash('#notices', demoTopPages), 'notices');
  assert.equal(getDemoPageFromHash('#notices/example', demoTopPages), 'notices');
  assert.equal(getDemoPageFromHash('#notifications', demoTopPages), 'notifications');
  assert.equal(demoTopPages.find((item) => item.id === 'notices').label, '通知');
});

test('notice client sends public filters and administrative JSON/binary requests through the shared prefix', async () => {
  const calls = [];
  const client = createNoticeApiClient(async (path, options) => {
    calls.push({ path, options });
    return { ok: true, status: 200, json: async () => ({ items: [], total: 0, notice: { id: 'n1' } }) };
  });
  await client.listPublic({ query: '评优', category: 'awards', majorId: 'biology', cohortYear: 2025, timing: 'active', page: 2, pageSize: 12 });
  assert.ok(calls[0].path.startsWith('/zjubio/api/notices?'));
  const params = new URL(calls[0].path, 'https://site.test').searchParams;
  assert.equal(params.get('query'), '评优');
  assert.equal(params.get('timing'), 'active');
  assert.equal(params.get('cohortYear'), '2025');
  await client.create({ title: '通知' });
  assert.equal(calls[1].options.method, 'POST');
  assert.equal(calls[1].options.credentials, 'include');
  await client.publish('n/1');
  assert.equal(calls[2].path, '/zjubio/api/admin/notices/n%2F1/publish');
  const file = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
  file.name = '评奖说明.pdf';
  await client.uploadAttachment('n1', file);
  assert.equal(calls[3].options.body, file);
  assert.equal(calls[3].options.headers['x-notice-upload'], 'notice-attachment');
  assert.equal(decodeURIComponent(calls[3].options.headers['x-file-name']), file.name);
  await client.removeAttachment('n1', 'a1');
  assert.equal(calls[4].options.method, 'DELETE');
});

test('notice client preserves successful empty lists and reports invalid payloads and network errors', async () => {
  const empty = createNoticeApiClient(async () => ({ ok: true, status: 200, json: async () => ({ items: [], total: 0 }) }));
  assert.deepEqual((await empty.listPublic()).items, []);
  const invalid = createNoticeApiClient(async () => ({ ok: true, status: 200, json: async () => ({ items: [] }) }));
  assert.equal((await invalid.listAdmin()).ok, false);
  const offline = createNoticeApiClient(async () => { throw new Error('offline'); });
  assert.equal((await offline.listPublic()).ok, false);
});
