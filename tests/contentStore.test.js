import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { createContentStore } from '../server/content/contentStore.js';
import {
  archiveContentItem,
  createContentItem,
  publishContentItem,
  updateContentItem,
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
