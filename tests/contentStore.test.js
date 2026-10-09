import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

import { createContentStore } from '../server/content/contentStore.js';
import {
  archiveContentItem,
  createContentItem,
  publishContentItem,
  updateContentItem,
  toPublicContentItem,
} from '../server/content/contentService.js';
import { importStaticCourseContent } from '../server/content/contentImportService.js';

function createTestStore() {
  const store = createContentStore({ filename: ':memory:' });
  store.initialize();
  return store;
}

test('draft content stays private until publish and disappears after archive', () => {
  const store = createTestStore();
  const created = createContentItem(store, {
    courseCode: 'BIO2110F',
    type: 'experience',
    title: '期末复习节奏',
    summary: '按章节逐步检查薄弱点。',
    author: '测试同学',
    body: '先复习，再刷题。',
    cc98Url: 'https://www.cc98.org/topic/456',
    gpa: '4.10',
  }, 7);

  assert.equal(created.ok, true);
  assert.equal(created.item.status, 'draft');
  assert.equal(created.item.cc98Url, 'https://www.cc98.org/topic/456');
  assert.equal(created.item.gpa, '4.10');
  assert.equal(store.listPublishedByCourse('BIO2110F').length, 0);

  const published = publishContentItem(store, created.item.id, 7);
  assert.equal(published.ok, true);
  assert.equal(store.listPublishedByCourse('BIO2110F').length, 1);

  const archived = archiveContentItem(store, created.item.id, 7);
  assert.equal(archived.item.status, 'archived');
  assert.equal(store.listPublishedByCourse('BIO2110F').length, 0);
  store.close();
});

test('content validation enforces type-specific fields and safe external links', () => {
  const store = createTestStore();
  const invalidUrl = createContentItem(store, {
    courseCode: 'BIO2110F',
    type: 'material',
    title: '资料',
    summary: '摘要',
    author: '整理组',
    externalUrl: 'javascript:alert(1)',
  }, 1);
  assert.equal(invalidUrl.status, 400);

  const paper = createContentItem(store, {
    courseCode: 'BIO2110F',
    type: 'paper',
    title: '期中试卷',
    summary: '测试卷',
    year: '2025-2026',
    teacher: '吕老师',
  }, 1);
  assert.equal(paper.ok, true);
  assert.equal(publishContentItem(store, paper.item.id, 1).status, 400);

  const invalidUpdate = updateContentItem(store, paper.item.id, { title: '' }, 1);
  assert.equal(invalidUpdate.status, 400);

  const material = createContentItem(store, {
    courseCode: 'BIO2110F', type: 'material', title: '复习资料', summary: '摘要', body: '正文',
  }, 1);
  assert.equal(publishContentItem(store, material.item.id, 1).ok, true);
  assert.equal(updateContentItem(store, material.item.id, { body: '', externalUrl: '' }, 1).status, 400);
  store.close();
});

test('static course import is idempotent and keeps existing microbiology resources', () => {
  const store = createTestStore();
  const rootDirectory = fileURLToPath(new URL('../public/resource/courses', import.meta.url));

  const first = importStaticCourseContent(store, { rootDirectory });
  const second = importStaticCourseContent(store, { rootDirectory });
  const items = store.listAdmin({ courseCode: 'BIO2110F' });

  assert.equal(first.imported, 7);
  assert.equal(second.imported, 0);
  assert.equal(items.filter((item) => item.type === 'experience').length, 3);
  assert.equal(items.filter((item) => item.type === 'material').length, 3);
  assert.equal(items.filter((item) => item.type === 'paper').length, 1);
  assert.equal(items.every((item) => item.status === 'published'), true);
  assert.deepEqual(
    items.filter((item) => item.type === 'experience').map((item) => item.routeId).sort(),
    ['1', '2', '3'],
  );
  assert.match(items.find((item) => item.type === 'paper').file.url, /25-26-midterm-lv\.pdf$/);
  store.close();
});

test('administrator sources retain original authors and survive edit and publication', () => {
  const store = createTestStore();
  try {
    const legacy = createContentItem(store, {
      courseCode: 'BIO2110F', type: 'experience', title: 'Legacy', body: 'Notes', cc98Url: 'https://www.cc98.org/topic/1',
    }, 9).item;
    assert.equal(legacy.sourcePlatform, 'cc98');
    assert.equal(legacy.sourceUrl, legacy.cc98Url);
    const created = createContentItem(store, {
      courseCode: 'BIO2110F', type: 'experience', title: 'Imported', author: 'Original author', body: 'Notes',
      sourcePlatform: 'duoduo', sourceUrl: 'https://duoduo.example/topic/1',
    }, 9).item;
    assert.equal(created.ownerId, null);
    assert.equal(created.createdBy, 9);
    assert.equal(created.cc98Url, '');
    const edited = updateContentItem(store, created.id, { summary: 'Updated' }, 10).item;
    assert.equal(edited.sourceUrl, created.sourceUrl);
    assert.equal(edited.sourcePlatform, 'duoduo');
    assert.equal(edited.author, 'Original author');
    const published = publishContentItem(store, created.id, 10).item;
    assert.equal(toPublicContentItem(published).sourceUrl, created.sourceUrl);
    assert.equal(toPublicContentItem(published).owner, null);
    assert.equal(updateContentItem(store, created.id, { sourceUrl: 'javascript:alert(1)' }, 10).status, 400);
    assert.equal(updateContentItem(store, created.id, { sourcePlatform: 'unknown' }, 10).status, 400);
  } finally { store.close(); }
});

test('administrator create retries are actor-scoped and stale updates are rejected', () => {
  const store = createTestStore();
  try {
    const input = { courseCode: 'BIO2110F', type: 'experience', title: 'Imported', body: 'Notes', requestId: 'draft-request-123456' };
    const created = createContentItem(store, input, 9);
    const retry = createContentItem(store, input, 9);
    assert.equal(created.status, 201);
    assert.equal(retry.status, 200);
    assert.equal(retry.replayed, true);
    assert.equal(retry.item.id, created.item.id);
    assert.notEqual(createContentItem(store, input, 10).item.id, created.item.id);
    assert.equal(createContentItem(store, { ...input, requestId: 'invalid' }, 9).status, 400);
    assert.equal(store.listAdmin({}).length, 2);
    assert.equal(updateContentItem(store, created.item.id, { title: 'Overwrite', expectedUpdatedAt: 'stale' }, 9).status, 409);
    assert.equal(store.findById(created.item.id).title, 'Imported');
    assert.equal(updateContentItem(store, created.item.id, { title: 'Valid', expectedUpdatedAt: created.item.updatedAt }, 9).ok, true);
  } finally { store.close(); }
});

test('source schema upgrade preserves legacy data without assigning an administrator owner', () => {
  const directory = mkdtempSync(join(tmpdir(), 'study-content-source-'));
  const filename = join(directory, 'content.sqlite');
  let store = createContentStore({ filename });
  try {
    store.initialize();
    const legacy = store.createItem({ courseCode: 'BIO2110F', type: 'experience', title: 'Legacy',
      author: 'Original author', body: 'Notes', status: 'published', cc98Url: 'https://www.cc98.org/topic/1', createdBy: 9 });
    store.close();
    const db = new DatabaseSync(filename);
    try {
      db.exec('drop index content_create_request_idx');
      for (const column of ['source_platform', 'source_url', 'create_request_id']) db.exec(`alter table content_items drop column ${column}`);
      for (const column of ['source_platform', 'source_url']) db.exec(`alter table content_submissions drop column ${column}`);
    } finally { db.close(); }
    store = createContentStore({ filename });
    store.initialize();
    store.initialize();
    const upgraded = store.findById(legacy.id);
    assert.equal(upgraded.sourcePlatform, 'cc98');
    assert.equal(upgraded.sourceUrl, legacy.cc98Url);
    assert.equal(upgraded.ownerId, null);
    assert.equal(upgraded.author, 'Original author');
    assert.equal(upgraded.status, 'published');
    assert.equal(upgraded.routeId, legacy.routeId);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
