import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createAuthServer } from '../server/server.js';
import { createAuthStore } from '../server/authStore.js';
import { createQuizStore } from '../server/quiz/quizStore.js';
import { createContentStore } from '../server/content/contentStore.js';
import { createStudentHomepageStore } from '../server/studentHomepage/studentHomepageStore.js';
import { createConsultationStore } from '../server/consultation/consultationStore.js';
import { MAX_BATCH_BYTES } from '../server/content/contentBatchService.js';

const note = (changes = {}) => ({ courseCode: 'BIO2110F', type: 'experience',
  title: 'Batch HTTP fixture', author: 'Original author', body: 'Course notes', ...changes });

async function fixture(t) {
  const store = createAuthStore({ filename: ':memory:' });
  const quizStore = createQuizStore({ filename: ':memory:' });
  const contentStore = createContentStore({ filename: ':memory:' });
  const studentHomepageStore = createStudentHomepageStore({ filename: ':memory:' });
  const consultationStore = createConsultationStore({ filename: ':memory:' });
  const { server } = createAuthServer({ store, quizStore, contentStore, studentHomepageStore,
    consultationStore, adminStudentIds: [], adminCc98Names: [] });
  const cookies = {};
  for (const role of ['admin', 'student']) {
    const user = store.createUser({ email: `${role === 'admin' ? '3220100000' : '3230100000'}@zju.edu.cn`,
      nickname: `Batch ${role}`, passwordHash: 'unused-test-hash', role });
    const sessionId = randomUUID();
    store.createSession({ id: sessionId, userId: user.id });
    cookies[role] = `study_session=${sessionId}`;
  }
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    for (const database of [store, quizStore, contentStore, studentHomepageStore, consultationStore]) database.close?.();
  });
  return {
    contentStore,
    baseUrl,
    cookies,
    async request(path, body, { role = 'admin', headers = {}, method = body === undefined ? 'GET' : 'POST' } = {}) {
      return fetch(`${baseUrl}${path}`, { method,
        headers: { ...(role && cookies[role] ? { cookie: cookies[role] } : {}),
          ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
        ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) });
    },
  };
}

const batchPath = (operation) => `/api/admin/content-batch/${operation}`;

test('all batch routes enforce authenticated administrator roles', async (t) => {
  const app = await fixture(t);
  for (const [role, status] of [[null, 401], ['student', 403]]) {
    for (const operation of ['preview', 'import', 'catalog', 'export']) {
      const response = await app.request(batchPath(operation), operation === 'catalog' ? undefined : {}, { role });
      assert.equal(response.status, status, `${role}: ${operation}`);
    }
  }
});

test('batch HTTP handles malformed JSON and enforces its JSON-only request format', async (t) => {
  const app = await fixture(t);
  for (const operation of ['preview', 'import', 'export']) {
    assert.equal((await app.request(batchPath(operation), '{}', { headers: { 'content-type': 'text/plain' } })).status, 415);
    assert.equal((await app.request(batchPath(operation), '{broken')).status, 400);
  }
  assert.equal((await app.request(batchPath('catalog'), { type: '' })).status, 405);
  assert.equal((await app.request(batchPath('preview'))).status, 405);
  assert.equal((await app.request(batchPath('preview'), { document: null })).status, 400);
  assert.equal((await app.request(batchPath('export'), null)).status, 400);
  const bomResponse = await app.request(batchPath('preview'), `\uFEFF${JSON.stringify({ document: { items: [note()] } })}`);
  assert.equal(bomResponse.status, 200);
});

test('batch HTTP preview reports row failures without modifying SQLite', async (t) => {
  const app = await fixture(t);
  const before = app.contentStore.listAdmin().length;
  const response = await app.request(batchPath('preview'), { document: { items: [note(), note({ type: 'paper' }), note({ body: '' })] } });
  assert.equal(response.status, 200);
  const { preview } = await response.json();
  assert.equal(preview.validCount, 1);
  assert.equal(preview.invalidCount, 2);
  assert.equal(preview.rows[1].index, 2);
  assert.equal(preview.rows[0].courseName, '微生物学（甲）');
  assert.equal(app.contentStore.listAdmin().length, before);
});

test('batch HTTP accepts files above the normal JSON limit without increasing other endpoints', async (t) => {
  const app = await fixture(t);
  const document = { version: 1, items: Array.from({ length: 4 }, (_, index) => note({ title: `Large note ${index}`, body: 'a'.repeat(70000) })) };
  assert.equal((await app.request(batchPath('preview'), { document })).status, 200);
  assert.equal((await app.request('/api/admin/content', { ...note(), body: 'a'.repeat(300000) })).status, 413);
  assert.equal((await app.request(batchPath('preview'), { document: { items: Array.from({ length: 201 }, () => note()) } })).status, 413);
  assert.equal((await app.request(batchPath('preview'), ' '.repeat(MAX_BATCH_BYTES + 16 * 1024 + 1))).status, 413);
});

test('batch HTTP reserves envelope space for a document just below the 8 MiB limit', async (t) => {
  const app = await fixture(t);
  const document = { version: 1, items: Array.from({ length: 100 }, () => note({ body: '' })) };
  const baseline = Buffer.byteLength(JSON.stringify(document), 'utf8');
  const bodyLength = Math.floor((MAX_BATCH_BYTES - baseline - 10) / document.items.length);
  for (const item of document.items) item.body = 'x'.repeat(bodyLength);
  assert.ok(Buffer.byteLength(JSON.stringify(document), 'utf8') < MAX_BATCH_BYTES);
  const response = await app.request(batchPath('preview'), { document });
  assert.equal(response.status, 200);
  const { preview } = await response.json();
  const payload = { document, fingerprint: preview.fingerprint, requestId: randomUUID() };
  assert.ok(Buffer.byteLength(JSON.stringify(payload), 'utf8') > MAX_BATCH_BYTES);
  const imported = await app.request(batchPath('import'), payload);
  assert.equal(imported.status, 201);
  assert.equal((await imported.json()).result.createdCount, document.items.length);
});

test('batch HTTP confirms drafts, preserves lost-response retries and rejects changed input', async (t) => {
  const app = await fixture(t);
  const before = app.contentStore.listAdmin().length;
  const document = { version: 1, items: [note(), note({ type: 'material', title: 'PDF URL fixture',
    body: '', externalUrl: 'https://example.edu/course-notes.pdf' })] };
  const previewResponse = await app.request(batchPath('preview'), { document });
  const { preview } = await previewResponse.json();
  const payload = { document, fingerprint: preview.fingerprint, requestId: randomUUID() };
  const imported = await app.request(batchPath('import'), payload);
  assert.equal(imported.status, 201);
  const { result } = await imported.json();
  assert.equal(result.createdCount, 2);
  assert.equal(result.replayed, false);
  assert.equal(app.contentStore.listAdmin().length, before + 2);
  for (const item of result.items) {
    assert.equal(item.status, 'draft');
    const record = app.contentStore.findById(item.id);
    assert.equal(record.ownerId, null);
    assert.equal(record.author, 'Original author');
  }
  const publicResponse = await app.request('/api/content/courses/BIO2110F', undefined, { role: null });
  const publicBody = await publicResponse.json();
  assert.equal(publicBody.items.some((item) => result.items.some((created) => created.id === item.id)), false);
  const retry = await app.request(batchPath('import'), payload);
  assert.equal(retry.status, 200);
  assert.deepEqual((await retry.json()).result, { ...result, replayed: true });
  assert.equal(app.contentStore.listAuditLogs().filter((log) => result.items.some((item) => item.id === log.entityId)).length, 2);
  document.items[0].title = 'Changed file';
  assert.equal((await app.request(batchPath('import'), payload)).status, 409);
  const nextPreview = await app.request(batchPath('preview'), { document });
  const nextFingerprint = (await nextPreview.json()).preview.fingerprint;
  assert.equal((await app.request(batchPath('import'), { ...payload, fingerprint: nextFingerprint })).status, 409);
});

test('batch HTTP export and catalog share category/course filters and portable published fields', async (t) => {
  const app = await fixture(t);
  const initial = app.contentStore.listPublishedByCourse('BIO2110F').filter((item) => item.type === 'material').length;
  const record = app.contentStore.createItem({ ...note({ type: 'material', title: 'Stored PDF fixture', body: '' }),
    status: 'published', ownerId: 25, sourcePath: '/internal/path',
    file: { url: '/api/content/files/fixture-pdf', storedName: 'private-storage.pdf' } });
  app.contentStore.createItem({ ...note({ type: 'material', title: 'Private draft' }), status: 'draft' });
  const catalogResponse = await app.request(`${batchPath('catalog')}?type=material`);
  assert.equal(catalogResponse.status, 200);
  const catalog = await catalogResponse.json();
  assert.equal(catalog.courses.find((course) => course.code === 'BIO2110F').count, initial + 1);
  const exportResponse = await app.request(batchPath('export'), { courseCodes: ['BIO2110F'], type: 'material' });
  assert.equal(exportResponse.status, 200);
  const exported = await exportResponse.json();
  assert.equal(exported.count, initial + 1);
  assert.equal(exported.document.version, 1);
  const item = exported.document.items.find((content) => content.title === record.title);
  assert.equal(item.externalUrl, 'https://bis.zju.edu.cn/zjubio/api/content/files/fixture-pdf');
  for (const key of ['file', 'id', 'status', 'ownerId', 'sourcePath', 'createdBy', 'updatedBy']) assert.equal(key in item, false);
  assert.equal((await app.request(`${batchPath('catalog')}?type=paper`)).status, 400);
  assert.equal((await app.request(batchPath('export'), { courseCodes: ['UNKNOWN'] })).status, 400);
  assert.equal((await app.request(batchPath('export'), { type: 'paper' })).status, 400);
});
