import test from 'node:test';
import assert from 'node:assert/strict';
import { readContentBatchFile, MAX_BATCH_BYTES, prepareContentBatchRequest, completeContentBatchRequest } from '../src/services/contentBatchFileService.js';
import { createAdminApiClient } from '../src/services/adminApiClient.js';

test('batch file reader preserves JSON body text and accepts UTF-8 BOM', async () => {
  const document = { version: 1, items: [{ courseCode: 'BIO2011F', type: 'experience', title: '导入示例', body: '正文\n\n**加粗**' }] };
  const file = new File(['\uFEFF' + JSON.stringify(document)], 'resources.JSON', { type: 'application/json' });
  assert.deepEqual((await readContentBatchFile(file)).document, document);
});

test('batch file reader reports unreadable invalid oversized and wrong-shape files without throwing', async () => {
  for (const text of ['{', 'null', '[]', '{}', '{"items":[]}', JSON.stringify({ items: Array(201).fill({}) })]) {
    assert.equal((await readContentBatchFile(new File([text], 'invalid.json'))).ok, false);
  }
  assert.equal((await readContentBatchFile(new File(['{}'], 'invalid.txt'))).ok, false);
  assert.equal((await readContentBatchFile({ name: 'large.json', size: MAX_BATCH_BYTES + 1 })).ok, false);
  assert.equal((await readContentBatchFile({ name: 'unreadable.json', size: 4, text() { throw new Error('IO'); } })).ok, false);
});

test('administrator batch clients use shared credentials and scoped JSON APIs', async () => {
  const requests = [];
  const client = createAdminApiClient(async (url, options) => {
    requests.push({ url, options });
    return { ok: true, status: 200, json: async () => ({ preview: { total: 1 } }) };
  });
  const document = { items: [{ title: '心得' }] };
  await client.previewContentBatch(document);
  await client.importContentBatch(document, { fingerprint: 'fingerprint', requestId: 'request' });
  await client.fetchBatchCatalog('experience');
  await client.exportContentBatch({ courseCodes: ['BIO2011F'], type: 'material' });
  assert.equal(requests[0].url, '/zjubio/api/admin/content-batch/preview');
  assert.deepEqual(JSON.parse(requests[1].options.body), { document, fingerprint: 'fingerprint', requestId: 'request' });
  assert.match(requests[2].url, /catalog\?type=experience$/);
  assert.deepEqual(JSON.parse(requests[3].options.body), { courseCodes: ['BIO2011F'], type: 'material' });
  assert.ok(requests.every(({ options }) => options.credentials === 'include'));
});

test('pending batch request tokens survive reload and remain isolated until acknowledgement', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const first = prepareContentBatchRequest('real:a', 'fingerprint', 'original-token', storage);
  assert.equal(first.requestId, 'original-token');
  assert.equal(prepareContentBatchRequest('real:a', 'fingerprint', 'new-token', storage).requestId, 'original-token');
  assert.equal(prepareContentBatchRequest('real:b', 'fingerprint', 'another-user-token', storage).requestId, 'another-user-token');
  completeContentBatchRequest('real:a', 'fingerprint', 'wrong-token', storage);
  assert.equal(prepareContentBatchRequest('real:a', 'fingerprint', 'new-token', storage).requestId, 'original-token');
  assert.equal(completeContentBatchRequest('real:a', 'fingerprint', 'original-token', storage).ok, true);
  assert.equal(prepareContentBatchRequest('real:a', 'fingerprint', 'next-import-token', storage).requestId, 'next-import-token');
  assert.equal(prepareContentBatchRequest('real:b', 'fingerprint', 'new-token', storage).requestId, 'another-user-token');
});

test('pending request storage failure cannot start an unsafe nonpersistent retry', () => {
  const broken = { getItem: () => '[]', setItem() { throw new Error('quota'); } };
  assert.equal(prepareContentBatchRequest('real:a', 'fingerprint', 'token', broken).ok, false);
});
