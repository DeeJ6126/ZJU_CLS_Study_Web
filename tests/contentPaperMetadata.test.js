import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createContentStore } from '../server/content/contentStore.js';
import {
  createContentItem, updateContentItem, validateContentInput, toPublicContentItem,
} from '../server/content/contentService.js';
import { handleContentHttpRequest } from '../server/content/contentHttpService.js';
import { previewContentBatch, importContentBatch, exportContentBatch } from '../server/content/contentBatchService.js';

const paper = (changes = {}) => ({
  courseCode: 'BIO2110F', type: 'paper', title: 'Past paper', subtitle: 'Original forum title',
  body: '[b]Original post[/b]', supplementBody: '[b]Comment supplement[/b]', bodyFormat: 'ubb',
  ...changes,
});

function fixture(t) {
  const store = createContentStore({ filename: ':memory:' });
  store.initialize();
  t.after(() => store.close());
  return store;
}

test('content metadata keeps the original title and separate bodies through edits and public reads', (t) => {
  const store = fixture(t);
  const created = createContentItem(store, paper(), 7);
  assert.equal(created.status, 201);
  assert.equal(created.item.subtitle, 'Original forum title');
  assert.equal(created.item.supplementBody, '[b]Comment supplement[/b]');
  const updated = updateContentItem(store, created.item.id, { title: 'Edited paper' }, 7);
  assert.equal(updated.ok, true);
  assert.equal(updated.item.subtitle, created.item.subtitle);
  assert.equal(updated.item.supplementBody, created.item.supplementBody);
  assert.equal(updated.item.body, created.item.body);
  assert.equal(updated.item.bodyFormat, 'ubb');
  store.updateItem(created.item.id, { summary: 'Direct store edit' });
  store.attachFile(created.item.id, { fileName: 'paper.pdf', mimeType: 'application/pdf',
    size: 100, url: 'https://example.edu/paper.pdf' }, 7);
  store.setStatus(created.item.id, 'published', 7);
  const published = toPublicContentItem(store.listPublishedByCourse('BIO2110F')[0]);
  assert.equal(published.subtitle, created.item.subtitle);
  assert.equal(published.supplementBody, created.item.supplementBody);
  assert.equal(published.body, created.item.body);
  assert.equal(published.bodyFormat, 'ubb');
  assert.equal('storedName' in published, false);
  assert.equal('createdBy' in published, false);
  const cleared = updateContentItem(store, created.item.id, { subtitle: '', supplementBody: '' }, 7);
  assert.equal(cleared.ok, true);
  assert.equal(cleared.item.subtitle, '');
  assert.equal(cleared.item.supplementBody, '');
});

test('optional content metadata validates limits and shares the body format for every content type', (t) => {
  const store = fixture(t);
  for (const type of ['paper', 'experience', 'material']) {
    const valid = validateContentInput(paper({ type, subtitle: 's'.repeat(200), supplementBody: 'x'.repeat(100000) }));
    assert.equal(valid.ok, true, type);
    assert.equal(valid.value.subtitle.length, 200);
    assert.equal(valid.value.supplementBody.length, 100000);
    assert.equal(validateContentInput(paper({ type, subtitle: 's'.repeat(201) })).status, 400);
    assert.equal(validateContentInput(paper({ type, supplementBody: 'x'.repeat(100001) })).status, 400);
    assert.equal(validateContentInput(paper({ type, bodyFormat: 'html' })).status, 400);
    const legacy = createContentItem(store, { courseCode: 'BIO2110F', type, title: 'Legacy', body: 'Notes' }, 7);
    assert.equal(legacy.item.subtitle, '');
    assert.equal(legacy.item.supplementBody, '');
  }
  const created = createContentItem(store, paper(), 7).item;
  assert.equal(updateContentItem(store, created.id, { subtitle: 'x'.repeat(201) }, 7).status, 400);
  assert.equal(updateContentItem(store, created.id, { supplementBody: 'x'.repeat(100001) }, 7).status, 400);
  assert.equal(store.findById(created.id).supplementBody, created.supplementBody);
});

test('content schema migration adds empty metadata without rewriting legacy bodies', () => {
  const directory = mkdtempSync(join(tmpdir(), 'study-paper-metadata-'));
  const filename = join(directory, 'content.sqlite');
  let store = createContentStore({ filename });
  try {
    store.initialize();
    const original = store.createItem(paper({ status: 'published' }));
    store.close();
    const db = new DatabaseSync(filename);
    try {
      db.exec('alter table content_items drop column subtitle');
      db.exec('alter table content_items drop column supplement_body');
    } finally { db.close(); }
    store = createContentStore({ filename });
    store.initialize();
    store.initialize();
    const migrated = store.findById(original.id);
    assert.equal(migrated.subtitle, '');
    assert.equal(migrated.supplementBody, '');
    assert.equal(migrated.body, original.body);
    assert.equal(migrated.bodyFormat, original.bodyFormat);
    assert.equal(migrated.status, original.status);
    assert.equal(migrated.routeId, original.routeId);
    store.updateItem(original.id, { subtitle: original.subtitle, supplementBody: original.supplementBody });
    assert.equal(store.findById(original.id).subtitle, original.subtitle);
    assert.equal(store.findById(original.id).supplementBody, original.supplementBody);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('administrator HTTP accepts metadata and public HTTP returns only published separate bodies', async (t) => {
  const contentStore = fixture(t);
  async function request(method, path, body, user = { role: 'admin', nickname: 'Recorder' }) {
    let status;
    let payload;
    const handled = await handleContentHttpRequest({
      request: { method, headers: { 'content-type': 'application/json' } }, response: {},
      url: new URL(path, 'http://localhost'), user, userId: user ? 7 : null, contentStore,
      readJsonBody: async () => body,
      sendJson(_response, code, value) { status = code; payload = value; },
    });
    assert.equal(handled, true);
    return { status, payload };
  }
  const created = await request('POST', '/api/admin/content', paper());
  assert.equal(created.status, 201);
  assert.equal(created.payload.item.subtitle, 'Original forum title');
  const id = created.payload.item.id;
  assert.deepEqual((await request('GET', '/api/content/courses/BIO2110F', undefined, null)).payload.items, []);
  const edited = await request('PATCH', `/api/admin/content/${id}`, { title: 'Edited paper' });
  assert.equal(edited.payload.item.supplementBody, paper().supplementBody);
  assert.equal(edited.payload.item.subtitle, paper().subtitle);
  assert.equal((await request('PATCH', `/api/admin/content/${id}`, { subtitle: 'x'.repeat(201) })).status, 400);
  assert.equal((await request('PATCH', `/api/admin/content/${id}`, { supplementBody: 'x'.repeat(100001) })).status, 400);
  contentStore.attachFile(id, { fileName: 'paper.pdf', storedName: 'private-paper.pdf',
    mimeType: 'application/pdf', size: 100, url: `/api/content/files/${id}` }, 7);
  assert.equal((await request('POST', `/api/admin/content/${id}/publish`, {})).status, 200);
  const published = (await request('GET', '/api/content/courses/BIO2110F', undefined, null)).payload.items[0];
  assert.equal(published.body, paper().body);
  assert.equal(published.supplementBody, paper().supplementBody);
  assert.equal(published.subtitle, paper().subtitle);
  assert.equal(published.bodyFormat, 'ubb');
  assert.equal('storedName' in published.file, false);
  assert.equal(published.file.url, `/zjubio/api/content/files/${id}`);
});

test('existing batch JSON defaults optional metadata to empty and keeps its accepted schema', (t) => {
  const store = fixture(t);
  const item = { courseCode: 'BIO2110F', type: 'experience', title: 'Batch note', body: 'Notes' };
  const document = { version: 1, items: [item] };
  const preview = previewContentBatch(store, document);
  assert.equal(preview.preview.invalidCount, 0);
  const imported = importContentBatch(store, { document, fingerprint: preview.preview.fingerprint,
    requestId: '966c0daa-f1e0-4976-982d-4410b67d2cd3' }, { id: 7, role: 'admin', nickname: 'Recorder' });
  assert.equal(imported.ok, true);
  const importedItem = store.findById(imported.result.items[0].id);
  assert.equal(importedItem.subtitle, '');
  assert.equal(importedItem.supplementBody, '');
  store.setStatus(importedItem.id, 'published', 7);
  const exported = exportContentBatch(store, { courseCodes: ['BIO2110F'], type: 'experience' }).document.items[0];
  assert.equal('subtitle' in exported, false);
  assert.equal('supplementBody' in exported, false);
  for (const field of ['subtitle', 'supplementBody']) {
    const invalid = previewContentBatch(store, { items: [{ ...item, [field]: 'unsupported' }] });
    assert.equal(invalid.preview.invalidCount, 1);
  }
});
