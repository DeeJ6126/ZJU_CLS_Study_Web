import test from 'node:test';
import assert from 'node:assert/strict';

import { getLegacyCourseRedirect, loadCourseContent } from '../src/services/courseContentApiClient.js';
import { parseResourceHash } from '../src/data/courses/resourcePaths.js';

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

test('legacy microbiology article routes resolve to the migrated course without changing content identity', async () => {
  const result = await loadCourseContent({ ...course, code: 'BIO2009F' }, {
    fetchImpl: async (url) => {
      assert.match(String(url), /api\/content\/courses\/BIO2009F$/);
      return { ok: true, json: async () => ({ items: [
        { id: 'theory-original', routeId: 'theory-route', courseCode: 'BIO2110F', type: 'material' },
        { id: 'lab-original', routeId: 'lab-route', courseCode: 'BIO2113F', type: 'paper' },
      ] }) };
    },
  });
  assert.equal(result.papers[0].contentId, 'lab-original');
  assert.equal(result.papers[0].id, 'lab-route');
  assert.equal(result.papers[0].href, '#resources/#BIO2113F/#papers/#lab-route');
  for (const itemId of ['lab-route', 'lab-original']) {
    const href = getLegacyCourseRedirect({ courseCode: 'BIO2009F', tabId: 'papers', itemId }, result);
    assert.deepEqual(parseResourceHash(href), {
      section: 'resources', courseCode: 'BIO2113F', tabId: 'papers', itemId: 'lab-route',
    });
  }
  assert.equal(getLegacyCourseRedirect({ courseCode: 'BIO2009F', tabId: 'materials', itemId: 'theory-route' }, result),
    '#resources/#BIO2110F/#materials/#theory-route');
  assert.equal(getLegacyCourseRedirect({ courseCode: 'BIO2009F', tabId: 'papers', itemId: 'missing' }, result), '');
  assert.equal(getLegacyCourseRedirect({ courseCode: 'BIO2110F', tabId: 'papers', itemId: 'lab-route' }, result), '');
  assert.equal(getLegacyCourseRedirect({ courseCode: 'BIO2009F', tabId: 'papers', itemId: 'lab-original' }, {
    papers: [{ id: 'lab-original', contentId: 'another-item', courseCode: 'BIO2110F', href: 'wrong-route' }, ...result.papers],
  }), '#resources/#BIO2113F/#papers/#lab-route');
});

test('legacy microbiology directory routes default to the theory course and unmatched old records stay available', () => {
  for (const tabId of ['overview', 'materials', 'papers', 'experiences']) {
    const href = getLegacyCourseRedirect({ courseCode: 'BIO2009F', tabId, itemId: '' });
    assert.equal(parseResourceHash(href).courseCode, 'BIO2110F');
    assert.equal(parseResourceHash(href).tabId, tabId);
  }
  assert.equal(getLegacyCourseRedirect({ courseCode: 'BIO2009F', tabId: 'papers', itemId: 'old' }, {
    papers: [{ id: 'old', contentId: 'old-id', courseCode: 'BIO2009F', href: '#resources/#BIO2009F/#papers/#old' }],
  }), '');
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

test('course content client keeps legacy CC98 sources and generic forum links separate', async () => {
  const result = await loadCourseContent(course, {
    fetchImpl: async () => ({ ok: true, json: async () => ({ items: [
      { id: 'legacy', type: 'experience', cc98Url: 'https://www.cc98.org/topic/1' },
      { id: 'generic', type: 'experience', sourcePlatform: 'duoduo', sourceUrl: 'https://duoduo.example/topic/2' },
      { id: 'unsafe', type: 'experience', sourcePlatform: 'other', sourceUrl: 'javascript:alert(1)' },
    ] }) }),
  });
  assert.equal(result.experiences[0].sourcePlatform, 'cc98');
  assert.equal(result.experiences[0].sourceUrl, 'https://www.cc98.org/topic/1');
  assert.equal(result.experiences[1].sourcePlatform, 'duoduo');
  assert.equal(result.experiences[1].cc98Url, '');
  assert.equal(result.experiences[1].sourceUrl, 'https://duoduo.example/topic/2');
  assert.equal(result.experiences[2].sourceUrl, '');
});

test('API and static paper content preserve the original title, format and supplementary body', async () => {
  const metadata = { subtitle: '原帖标题', supplementBody: '[b]补充正文[/b]', bodyFormat: 'ubb' };
  const api = await loadCourseContent(course, { fetchImpl: async () => ({ ok: true,
    json: async () => ({ items: [{ id: 'paper', type: 'paper', body: '[b]主文[/b]', ...metadata }] }) }) });
  for (const [field, value] of Object.entries(metadata)) assert.equal(api.papers[0][field], value);
  const fallback = await loadCourseContent({ ...course, experiences: [], papers: [{ id: 'paper', url: '/paper.md' }] }, {
    fetchImpl: async url => String(url).includes('api/content') ? { ok: false } : {
      ok: true, text: async () => '---\nid: paper\nsubtitle: 原帖标题\nsupplementBody: [b]补充正文[/b]\nbodyFormat: ubb\n---\n[b]主文[/b]',
    },
  });
  for (const [field, value] of Object.entries(metadata)) assert.equal(fallback.papers[0][field], value);
  assert.equal(fallback.papers[0].body, '[b]主文[/b]');
});
