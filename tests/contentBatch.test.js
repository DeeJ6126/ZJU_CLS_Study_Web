import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createContentStore } from '../server/content/contentStore.js';
import {
  exportContentBatch, importContentBatch, listContentBatchCourses,
  MAX_BATCH_ITEMS, previewContentBatch,
} from '../server/content/contentBatchService.js';

const actor = { id: 17, role: 'admin', nickname: 'Recording administrator' };
const note = (changes = {}) => ({ courseCode: 'BIO2110F', type: 'experience',
  title: 'Resource tower', author: 'Original author', body: '## Course notes\n\nUseful notes.',
  sourceUrl: 'https://www.cc98.org/topic/6003753/1#5', ...changes });
const doc = (...items) => ({ version: 1, items });

function storeFor(t, filename = ':memory:') {
  const store = createContentStore({ filename });
  store.initialize();
  t.after(() => store.close());
  return store;
}

function importDocument(store, document, { requestId = randomUUID(), fingerprint, user = actor } = {}) {
  return importContentBatch(store, { document, requestId,
    fingerprint: fingerprint ?? previewContentBatch(store, document).preview?.fingerprint }, user);
}

test('batch preview is read-only and returns numbered courses and row validation', (t) => {
  const store = storeFor(t);
  const result = previewContentBatch(store, doc(note(), note({ courseCode: 'NOTACOURSE' }),
    note({ type: 'paper' }), note({ title: 123 }), note({ ownerId: 17 })));
  assert.equal(result.status, 200);
  assert.equal(result.preview.total, 5);
  assert.equal(result.preview.validCount, 1);
  assert.equal(result.preview.invalidCount, 4);
  assert.equal(result.preview.rows[0].index, 1);
  assert.equal(result.preview.rows[0].courseName, '微生物学（甲）');
  assert.match(result.preview.fingerprint, /^[0-9a-f]{64}$/);
  assert.equal(store.listAdmin().length, 0);
  assert.equal(store.listAuditLogs().length, 0);
});

test('batch rejects malformed documents, versions, empty files and unsupported field types', (t) => {
  const store = storeFor(t);
  for (const document of [null, [], {}, { items: [] }, { version: '1', items: [note()] },
    { version: 2, items: [note()] }, { items: [note()], ownerId: 7 }]) {
    assert.equal(previewContentBatch(store, document).status, 400);
  }
  for (const value of [null, 5, true, {}, []]) {
    assert.equal(previewContentBatch(store, doc(note({ summary: value }))).preview.invalidCount, 1);
  }
  for (const field of ['gpa', 'gradePercentage', 'year', 'teacher', 'body', 'bodyFormat', 'cc98Url']) {
    assert.equal(previewContentBatch(store, doc(note({ [field]: 3 }))).preview.invalidCount, 1);
  }
  assert.equal(previewContentBatch(store, doc(null, 'hello')).preview.invalidCount, 2);
  let nested = {};
  for (let index = 0; index < 20000; index += 1) nested = { nested };
  assert.equal(previewContentBatch(store, doc(note({ body: nested }))).preview.invalidCount, 1);
});

test('batch validates existing content lengths, unsafe URLs, body format and substantive contents', (t) => {
  const store = storeFor(t);
  const invalid = [
    note({ title: '' }), note({ title: 'a'.repeat(81) }), note({ author: 'a'.repeat(41) }),
    note({ body: 'a'.repeat(100001) }), note({ summary: 'a'.repeat(201) }),
    note({ sourceUrl: 'javascript:alert(1)' }), note({ externalUrl: 'file:///private.pdf' }),
    note({ sourcePlatform: 'invented' }), note({ bodyFormat: 'html' }),
    note({ gpa: '5.1' }), note({ gradePercentage: '101' }), note({ year: 'a'.repeat(21) }),
    note({ teacher: 'a'.repeat(41) }), note({ body: '  ' }),
    note({ type: 'material', body: '', externalUrl: '' }),
  ];
  assert.equal(previewContentBatch(store, doc(...invalid)).preview.invalidCount, invalid.length);
  assert.equal(previewContentBatch(store, doc(note({ type: 'material', body: '',
    externalUrl: 'https://example.edu/notes.pdf' }))).preview.invalidCount, 0);
  assert.equal(previewContentBatch(store, doc(note({ bodyFormat: '' }))).preview.rows[0].bodyFormat, 'markdown');
});

test('batch enforces item and UTF-8 document size limits', (t) => {
  const store = storeFor(t);
  assert.equal(previewContentBatch(store, doc(...Array.from({ length: MAX_BATCH_ITEMS + 1 }, () => note()))).status, 413);
  assert.equal(previewContentBatch(store, doc(...Array.from({ length: 100 }, () => note({ body: '文'.repeat(30000) })))).status, 413);
  assert.equal(previewContentBatch(store, doc(...Array.from({ length: MAX_BATCH_ITEMS }, () => note()))).preview.total, 200);
});

test('batch confirms only the previewed document and rejects invalid batches without writing', (t) => {
  const store = storeFor(t);
  const document = doc(note());
  const fingerprint = previewContentBatch(store, document).preview.fingerprint;
  assert.equal(importDocument(store, doc(note({ title: 'Changed' })), { fingerprint }).status, 409);
  assert.equal(importDocument(store, doc(note(), note({ body: '' }))).status, 400);
  assert.equal(importDocument(store, document, { requestId: 'invalid' }).status, 400);
  assert.equal(importDocument(store, document, { user: { id: 17, role: 'student' } }).status, 403);
  assert.equal(store.listAdmin().length, 0);
  assert.equal(store.listAuditLogs().length, 0);
});

test('batch creates only unowned drafts, preserves sources/authors and logs each administrator action', (t) => {
  const store = storeFor(t);
  const result = importDocument(store, doc(note({ bodyFormat: 'ubb', body: '[b]Notes[/b]',
    teacher: 'Teacher', gpa: '4.20', gradePercentage: '90', year: '2025-2026' }),
  note({ type: 'material', sourcePlatform: 'duoduo', sourceUrl: 'https://www.duoduo.link/notes',
    body: '', externalUrl: 'https://example.edu/notes.pdf' })));
  assert.equal(result.status, 201);
  assert.equal(result.result.createdCount, 2);
  assert.equal(result.result.replayed, false);
  assert.equal(store.listPublishedByCourse('BIO2110F').length, 0);
  for (const item of store.listAdmin()) {
    assert.equal(item.ownerId, null);
    assert.equal(item.status, 'draft');
    assert.equal(item.author, 'Original author');
    assert.equal(item.createdBy, actor.id);
  }
  const experience = store.findById(result.result.items[0].id);
  assert.equal(experience.bodyFormat, 'ubb');
  assert.equal(experience.gpa, '4.20');
  assert.equal(experience.gradePercentage, '90');
  assert.equal(experience.cc98Url, experience.sourceUrl);
  assert.equal(store.listAuditLogs().length, 2);
  assert.equal(store.listAuditLogs()[0].actorName, actor.nickname);
});

test('batch retries replay identical ids without additional audits; request ids are account scoped', (t) => {
  const store = storeFor(t);
  const document = doc(note());
  const requestId = randomUUID();
  const first = importDocument(store, document, { requestId });
  const replay = importDocument(store, { items: [Object.fromEntries(Object.entries(note()).reverse())] }, { requestId });
  assert.equal(replay.status, 200);
  assert.equal(replay.result.replayed, true);
  assert.deepEqual(replay.result.items, first.result.items);
  assert.equal(importDocument(store, doc(note({ title: 'Changed' })), { requestId }).status, 409);
  assert.equal(store.listAdmin().length, 1);
  assert.equal(store.listAuditLogs().length, 1);
  assert.equal(importDocument(store, document, { requestId, user: { ...actor, id: 18 } }).status, 201);
  assert.equal(store.listAdmin().length, 2);
});

test('batch request replay persists across SQLite reopening', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'content-batch-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const filename = join(directory, 'content.sqlite');
  const store = createContentStore({ filename });
  store.initialize();
  const requestId = randomUUID();
  const first = importDocument(store, doc(note()), { requestId });
  store.close();
  const reopened = createContentStore({ filename });
  reopened.initialize();
  try {
    const retry = importDocument(reopened, doc(note()), { requestId });
    assert.deepEqual(retry.result.items, first.result.items);
    assert.equal(retry.result.replayed, true);
    assert.equal(reopened.listAuditLogs().length, 1);
  } finally { reopened.close(); }
});

test('batch inserts and audits rollback atomically and the request remains retryable', (t) => {
  const store = storeFor(t);
  const original = store.createAuditLog;
  let calls = 0;
  store.createAuditLog = function (...args) {
    if (++calls === 2) throw new Error('Simulated audit failure');
    return original.apply(this, args);
  };
  const requestId = randomUUID();
  const document = doc(note(), note({ title: 'Another note' }));
  assert.throws(() => importDocument(store, document, { requestId }), /Simulated audit failure/);
  assert.equal(store.listAdmin().length, 0);
  assert.equal(store.listAuditLogs().length, 0);
  assert.equal(store.findContentBatchRequest(actor.id, requestId), null);
  store.createAuditLog = original;
  assert.equal(importDocument(store, document, { requestId }).result.createdCount, 2);
});

test('batch permits multiple posts sharing one original-source URL', (t) => {
  const store = storeFor(t);
  importDocument(store, doc(note()));
  const preview = previewContentBatch(store, doc(note(), note(), note({ title: 'Another floor' })));
  assert.equal(preview.preview.invalidCount, 0);
  assert.equal(preview.preview.rows[0].warnings.length, 0);
  assert.equal(preview.preview.rows[1].warnings.length, 0);
  assert.equal(preview.preview.rows[2].warnings.length, 0);
  assert.equal(importDocument(store, doc(note({ title: 'Another floor' }))).status, 201);
});

test('batch accepts legacy CC98 URL fields and exports their normalized source metadata', (t) => {
  const store = storeFor(t);
  const legacy = note();
  delete legacy.sourceUrl;
  legacy.cc98Url = 'https://www.cc98.org/topic/12345';
  const result = importDocument(store, doc(legacy));
  store.setStatus(result.result.items[0].id, 'published', actor.id);
  const exported = exportContentBatch(store, { courseCodes: ['BIO2110F'] });
  assert.equal(exported.document.items[0].sourceUrl, legacy.cc98Url);
  assert.equal(exported.document.items[0].sourcePlatform, 'cc98');
  assert.equal('cc98Url' in exported.document.items[0], false);
});

test('batch catalog and export filter only published experiences/materials in overview courses', (t) => {
  const store = storeFor(t);
  store.createItem({ ...note(), status: 'published' });
  store.createItem({ ...note({ type: 'material', courseCode: 'BIO2011F' }), status: 'published' });
  store.createItem({ ...note({ courseCode: 'BIO2011F' }), status: 'draft' });
  store.createItem({ ...note({ type: 'material' }), status: 'archived' });
  store.createItem({ ...note({ type: 'paper' }), status: 'published' });
  store.createItem({ ...note({ courseCode: 'OTHER123' }), status: 'published' });
  const catalog = listContentBatchCourses(store);
  assert.equal(catalog.total, 2);
  assert.equal(catalog.courses.length, 2);
  assert.deepEqual(listContentBatchCourses(store, 'experience').courses.map((course) => course.code), ['BIO2110F']);
  assert.equal(exportContentBatch(store, {}).count, 2);
  assert.equal(exportContentBatch(store, { courseCodes: ['BIO2110F'], type: 'material' }).count, 0);
  assert.equal(exportContentBatch(store, { courseCodes: ['BIO2110F'] }).count, 1);
  for (const input of [{ type: 'paper' }, { type: 5 }, { courseCodes: 'BIO2110F' },
    { courseCodes: [null] }, { courseCodes: ['OTHER123'] }]) {
    assert.equal(exportContentBatch(store, input).status, 400);
  }
});

test('batch export strips private fields and converts stored or static PDFs to portable download URLs', (t) => {
  const store = storeFor(t);
  const uploaded = store.createItem({ ...note({ type: 'material', body: '' }),
    id: 'private-internal-id', status: 'published', ownerId: 20, sourcePath: '/private/path',
    file: { url: '/api/content/files/private-internal-id', storedName: 'hidden.pdf', fileName: 'Notes.pdf', size: 123 } });
  const staticItem = store.createItem({ ...note({ type: 'material', title: 'Static PDF', body: '' }),
    status: 'published', file: { url: '/resource/courses/BIO2110F/notes.pdf' } });
  const exported = exportContentBatch(store, { courseCodes: ['BIO2110F'], type: 'material' });
  assert.equal(exported.count, 2);
  const item = exported.document.items.find((record) => record.title === uploaded.title);
  assert.equal(item.externalUrl, 'https://bis.zju.edu.cn/zjubio/api/content/files/private-internal-id');
  assert.equal(exported.document.items.find((record) => record.title === staticItem.title).externalUrl,
    'https://bis.zju.edu.cn/zjubio/resource/courses/BIO2110F/notes.pdf');
  for (const key of ['id', 'ownerId', 'file', 'status', 'createdBy', 'sourcePath', 'routeId']) {
    assert.equal(key in item, false);
  }
  assert.equal(previewContentBatch(store, exported.document).preview.invalidCount, 0);
  const imported = importDocument(store, exported.document);
  assert.equal(imported.result.createdCount, 2);
  assert.equal(store.findById(imported.result.items[0].id).file, null);
});

test('batch export refuses oversized results rather than truncating them', (t) => {
  const store = storeFor(t);
  for (let index = 0; index <= MAX_BATCH_ITEMS; index += 1) {
    store.createItem({ ...note({ title: `Note ${index}` }), status: 'published' });
  }
  assert.equal(listContentBatchCourses(store).total, 201);
  assert.equal(exportContentBatch(store, {}).status, 413);
});

test('batch export enforces the downloaded pretty JSON size rather than compact response size', (t) => {
  const store = storeFor(t);
  const items = Array.from({ length: 100 }, (_, index) => store.createItem({
    ...note({ title: `Note ${index}`, body: '' }), status: 'published',
  }));
  const baseline = exportContentBatch(store, {}).document;
  const limit = 8 * 1024 * 1024;
  const bodyLength = Math.floor((limit - Buffer.byteLength(JSON.stringify(baseline), 'utf8')) / items.length) - 1;
  for (const item of baseline.items) item.body = 'x'.repeat(bodyLength);
  assert.ok(Buffer.byteLength(JSON.stringify(baseline), 'utf8') < limit);
  assert.ok(Buffer.byteLength(`${JSON.stringify(baseline, null, 2)}\n`, 'utf8') > limit);
  for (const item of items) store.updateItem(item.id, { body: 'x'.repeat(bodyLength) });
  assert.equal(exportContentBatch(store, {}).status, 413);
});
