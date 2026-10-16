import test from 'node:test';
import assert from 'node:assert/strict';
import { createPaperArchiveApiClient } from '../src/services/paperArchiveApiClient.js';

test('paper archive client encodes current filters, retains credentials and reads the ZIP filename', async () => {
  const controller = new AbortController();
  const client = createPaperArchiveApiClient({ fetchImpl: async (url, options) => {
    const parsed = new URL(url, 'http://fixture');
    assert.equal(parsed.pathname, '/zjubio/api/content/courses/BIO2110F/papers/download');
    assert.equal(parsed.searchParams.get('year'), '2024-2025');
    assert.equal(parsed.searchParams.get('teacher'), '甲/乙');
    assert.equal(options.credentials, 'include'); assert.equal(options.signal, controller.signal);
    return new Response('PK fixture', { headers: { 'content-type': 'application/zip',
      'content-disposition': "attachment; filename*=UTF-8''" + encodeURIComponent('试卷.zip') } });
  } });
  const result = await client.download('BIO2110F', { year: '2024-2025', teacher: '甲/乙' }, { signal: controller.signal });
  assert.equal(result.ok, true); assert.equal(result.filename, '试卷.zip'); assert.equal(await result.blob.text(), 'PK fixture');
});

test('paper archive client reports network, API and malformed response failures without triggering downloads', async () => {
  for (const [response, message] of [
    [null, /无法连接/], [new Response(JSON.stringify({ message: '缩小筛选范围' }), { status: 413 }), /缩小筛选/],
    [new Response('<html>'), /格式异常/],
  ]) {
    const client = createPaperArchiveApiClient({ fetchImpl: async () => response });
    const result = await client.download('BIO2110F');
    assert.equal(result.ok, false); assert.match(result.message, message);
  }
});
