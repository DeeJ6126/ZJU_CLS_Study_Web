import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createResourceSearchApiClient } from '../src/services/resourceSearchApiClient.js';

const records = Array.from({ length: 247 }, (_, index) => ({
  id: index + 1,
  routeId: String(index + 1),
  courseCode: index % 2 ? 'BIO2110F' : 'BIO2023M',
  courseName: index % 2 ? '微生物学' : '分子生物学',
  type: index % 3 ? 'material' : 'paper',
  title: `资料 ${index + 1}`,
  summary: `第 ${index + 1} 份资料`,
  author: '同学',
  teacher: index % 2 ? '李老师' : '王老师',
  year: String(2024 + (index % 3)),
  updatedAt: '2026-09-29T00:00:00.000Z',
  href: `#resources/#BIO2110F/#materials/#${index + 1}`,
}));

test('resource search client sends all filters and pages a large in-memory catalog', async () => {
  const requests = [];
  const client = createResourceSearchApiClient({
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      const params = new URL(url, 'https://example.test').searchParams;
      const filtered = records.filter((item) =>
        (!params.get('course') || `${item.courseCode} ${item.courseName}`.includes(params.get('course')))
        && (!params.get('type') || item.type === params.get('type'))
        && (!params.get('teacher') || item.teacher.includes(params.get('teacher')))
        && (!params.get('year') || item.year === params.get('year'))
        && (!params.get('q') || item.title.includes(params.get('q'))),
      );
      const page = Number(params.get('page'));
      const pageSize = Number(params.get('pageSize'));
      return { ok: true, status: 200, json: async () => ({
        query: params.get('q'), total: filtered.length, page, pageSize,
        items: filtered.slice((page - 1) * pageSize, page * pageSize),
      }) };
    },
  });

  const recent = await client.search();
  assert.equal(recent.total, 247);
  assert.equal(recent.items.length, 10);
  const last = await client.search({ page: 25, pageSize: 10 });
  assert.equal(last.items.length, 7);
  assert.equal(last.items[0].id, 241);

  const controller = new AbortController();
  const filtered = await client.search({ query: '资料', course: 'BIO2110F', type: 'material', teacher: '李', year: '2025', page: 2, pageSize: 5, signal: controller.signal });
  assert.equal(filtered.ok, true);
  assert.equal(filtered.items.length, Math.min(5, Math.max(0, filtered.total - 5)));
  assert.match(requests.at(-1).url, /^\/zjubio\/api\/search\/resources\?/);
  assert.equal(requests.at(-1).options.signal, controller.signal);
  assert.equal(requests.at(-1).options.credentials, 'include');
  assert.equal(new URL(requests.at(-1).url, 'https://example.test').searchParams.get('teacher'), '李');
});

test('resource search client reports failures and invalid payloads without a static fallback', async () => {
  const failing = createResourceSearchApiClient({ fetchImpl: async () => { throw new Error('offline'); } });
  const invalid = createResourceSearchApiClient({ fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ items: [] }) }) });
  assert.equal((await failing.search()).ok, false);
  assert.equal((await invalid.search()).ok, false);
});

test('homepage resource mode uses backend results, filters and direct item links', async () => {
  const source = await readFile(new URL('../src/components/HomePage.vue', import.meta.url), 'utf8');
  assert.match(source, /activeResourceSearchClient\.value\.search/);
  assert.match(source, /resourceSearchController\?\.abort\(\)/);
  assert.match(source, /sequence !== resourceSearchSequence/);
  assert.match(source, /v-model\.trim="resourceFilters\.course"/);
  assert.match(source, /v-model="resourceFilters\.type"/);
  assert.match(source, /v-model\.trim="resourceFilters\.teacher"/);
  assert.match(source, /v-model\.trim="resourceFilters\.year"/);
  assert.match(source, /:href="item\.href" class="home-resource-search__item"/);
  assert.doesNotMatch(source, /homeResourceSearchItems/);
});
