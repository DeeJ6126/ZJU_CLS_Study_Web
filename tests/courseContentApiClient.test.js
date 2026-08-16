import test from 'node:test';
import assert from 'node:assert/strict';

import { loadCourseContent } from '../src/services/courseContentApiClient.js';

const course = {
  code: 'BIO2110F',
  experiences: [{ id: '1', url: '/resource/experience-1.md' }],
  materials: [],
  papers: [],
};

test('course content client maps published API items to existing course routes', async () => {
  const result = await loadCourseContent(course, {
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          items: [{
            id: 'database-id', routeId: 'managed-1', courseCode: 'BIO2110F', type: 'experience',
            title: '新增心得', summary: '摘要', author: '学术部', body: '第一段\n\n第二段',
            status: 'published', file: null,
          }],
        };
      },
    }),
  });

  assert.equal(result.source, 'api');
  assert.equal(result.experiences[0].href, '#resources/#BIO2110F/#experiences/#managed-1');
  assert.deepEqual(result.experiences[0].paragraphs, ['第一段', '第二段']);
  assert.deepEqual(result.materials, []);
});

test('a successful empty API response stays empty instead of restoring static content', async () => {
  const result = await loadCourseContent(course, {
    fetchImpl: async () => ({ ok: true, async json() { return { items: [] }; } }),
  });
  assert.equal(result.source, 'api');
  assert.deepEqual(result.experiences, []);
});

test('course content client falls back to static markdown only when the API is unavailable', async () => {
  const calls = [];
  const result = await loadCourseContent(course, {
    fetchImpl: async (url) => {
      calls.push(url);
      if (String(url).includes('api/content')) {
        throw new Error('offline');
      }
      return {
        ok: true,
        async text() {
          return '---\nid: 1\nauthor: 测试同学\ntitle: 静态心得\nsummary: 回退内容\n---\n\n正文';
        },
      };
    },
  });

  assert.equal(result.source, 'static');
  assert.equal(result.experiences[0].title, '静态心得');
  assert.equal(calls.length, 2);
});
