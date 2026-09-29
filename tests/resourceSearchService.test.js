import test from 'node:test';
import assert from 'node:assert/strict';

import { createContentStore } from '../server/content/contentStore.js';
import { searchResources } from '../server/search/resourceSearchService.js';
import { handleSearchHttpRequest } from '../server/search/searchHttpService.js';
import { parseResourceHash } from '../src/data/courses/resourcePaths.js';

const courseCatalog = {
  courses: [
    { code: 'BIO2110F', name: '微生物学' },
    { code: 'BIO2028M', name: '生物化学' },
  ],
};

function createStore() {
  const store = createContentStore({ filename: ':memory:' });
  store.initialize();
  return store;
}

test('resource search counts and pages thousands of published rows without exposing bodies', () => {
  const store = createStore();
  for (let index = 0; index < 1205; index += 1) {
    store.createItem({
      id: `item-${String(index).padStart(4, '0')}`,
      routeId: `route-${index}`,
      courseCode: 'BIO2110F',
      type: 'material',
      title: '资源楼',
      summary: '章节资料',
      author: '资料组',
      teacher: '李老师',
      year: '2025-2026',
      body: 'Private search payload must not include this text',
      status: 'published',
      updatedAt: new Date(Date.UTC(2025, 0, 1, 0, 0, index)).toISOString(),
    });
  }
  store.createItem({
    id: 'draft', courseCode: 'BIO2110F', type: 'material', title: '资源楼',
    body: 'draft body', status: 'draft',
  });
  const result = searchResources({ query: '微生物学 李老师', page: 2, pageSize: 30, contentStore: store, courseCatalog });
  assert.equal(result.total, 1205);
  assert.equal(result.page, 2);
  assert.equal(result.items.length, 30);
  assert.equal(result.items[0].id, 'item-1174');
  assert.equal(result.items[0].courseName, '微生物学');
  assert.equal(result.items[0].href, '#resources/#BIO2110F/#materials/#route-1174');
  assert.deepEqual(parseResourceHash(result.items[0].href), {
    section: 'resources', courseCode: 'BIO2110F', tabId: 'materials', itemId: 'route-1174',
  });
  assert.equal(Object.hasOwn(result.items[0], 'body'), false);
  assert.deepEqual(Object.keys(result.items[0]), [
    'id', 'routeId', 'courseCode', 'courseName', 'type', 'title', 'summary',
    'author', 'teacher', 'year', 'updatedAt', 'href',
  ]);
  store.close();
});

test('resource search combines filters, has recent default, and treats LIKE wildcards literally', () => {
  const store = createStore();
  store.createItem({ id: 'one', routeId: '1', courseCode: 'BIO2110F', type: 'paper', title: '资源楼', summary: '期末', teacher: '李老师', year: '2025-2026', status: 'published', updatedAt: '2026-01-02T00:00:00.000Z' });
  store.createItem({ id: 'two', routeId: '2', courseCode: 'BIO2028M', type: 'experience', title: '复习计划', summary: '期末', teacher: '王老师', year: '2024-2025', status: 'published', updatedAt: '2026-01-03T00:00:00.000Z' });
  store.createItem({ id: 'three', courseCode: 'BIO2028M', type: 'paper', title: '50% 提升', status: 'published', updatedAt: '2026-01-04T00:00:00.000Z' });
  store.createItem({ id: 'hidden', courseCode: 'BIO2110F', type: 'paper', title: '资源楼', status: 'archived' });

  const recent = searchResources({ contentStore: store, courseCatalog });
  assert.equal(recent.total, 3);
  assert.deepEqual(recent.items.map((item) => item.id), ['three', 'two', 'one']);
  const filtered = searchResources({ query: '微生物学 期末', course: 'bio2110', type: 'paper', teacher: '李', year: '2025', contentStore: store, courseCatalog });
  assert.deepEqual(filtered.items.map((item) => item.id), ['one']);
  assert.equal(searchResources({ query: '%', contentStore: store, courseCatalog }).total, 1);
  assert.equal(searchResources({ course: '生物化', contentStore: store, courseCatalog }).total, 2);
  assert.equal(searchResources({ type: 'wrong', contentStore: store, courseCatalog }).total, 0);
  store.close();
});

test('split microbiology courses find historical posts without changing their original routes', () => {
  const store = createStore();
  const splitCatalog = { courses: [
    { code: 'BIO2009F', name: '微生物学及实验（甲）' },
    { code: 'BIO2110F', name: '微生物学（甲）' },
    { code: 'BIO2113F', name: '微生物学实验' },
    { code: 'BIO2028M', name: '生物化学' },
  ] };
  store.createItem({ id: 'old', routeId: '5', courseCode: 'BIO2009F', type: 'experience', title: '资源楼', status: 'published' });
  store.createItem({ id: 'new', routeId: '7', courseCode: 'BIO2110F', type: 'experience', title: '资源楼', status: 'published' });
  store.createItem({ id: 'other', courseCode: 'BIO2028M', type: 'experience', title: '资源楼', status: 'published' });

  const theory = searchResources({ course: 'BIO2110F', contentStore: store, courseCatalog: splitCatalog });
  assert.deepEqual(theory.items.map((item) => item.id).sort(), ['new', 'old']);
  const historical = theory.items.find((item) => item.id === 'old');
  assert.equal(historical.courseCode, 'BIO2009F');
  assert.equal(historical.href, '#resources/#BIO2009F/#experiences/#5');
  assert.equal(historical.courseName, '微生物学及实验（甲）');
  assert.deepEqual(searchResources({ course: '微生物学实验', contentStore: store, courseCatalog: splitCatalog }).items.map((item) => item.id), ['old']);
  assert.deepEqual(searchResources({ query: 'BIO2113F', contentStore: store, courseCatalog: splitCatalog }).items.map((item) => item.id), ['old']);
  assert.deepEqual(searchResources({ query: '微生物学（甲）', contentStore: store, courseCatalog: splitCatalog }).items.map((item) => item.id).sort(), ['new', 'old']);
  assert.deepEqual(searchResources({ course: 'BIO2028M', contentStore: store, courseCatalog: splitCatalog }).items.map((item) => item.id), ['other']);
  store.close();
});

test('resource search bounds malformed pagination and query, and HTTP handler exposes endpoint', () => {
  const store = createStore();
  store.createItem({ id: 'one', courseCode: 'BIO2110F', type: 'experience', title: '复习', status: 'published' });
  const oversized = searchResources({ query: 'x'.repeat(100), page: '-1', pageSize: '999', contentStore: store, courseCatalog });
  assert.equal(oversized.query.length, 64);
  assert.equal(oversized.page, 1);
  assert.equal(oversized.pageSize, 30);
  assert.equal(searchResources({ page: 'Infinity', pageSize: 'abc', contentStore: store, courseCatalog }).pageSize, 20);
  assert.equal(searchResources({ page: '9999999999', contentStore: store, courseCatalog }).page, 1000);

  let sent;
  const handled = handleSearchHttpRequest({
    request: { method: 'GET' }, response: {},
    url: new URL('http://localhost/api/search/resources?q=%E5%A4%8D%E4%B9%A0&pageSize=2'),
    contentStore: store, courseCatalog,
    sendJson: (_response, status, payload) => { sent = { status, payload }; },
  });
  assert.equal(handled, true);
  assert.equal(sent.status, 200);
  assert.deepEqual(sent.payload.items.map((item) => item.id), ['one']);
  store.close();
});
