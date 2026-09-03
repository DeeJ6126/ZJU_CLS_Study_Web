import test from 'node:test';
import assert from 'node:assert/strict';

import { searchAll } from '../server/search/searchService.js';

function createContentStore(items = [], activities = []) {
  return {
    listAdmin: ({ status } = {}) => (status ? items.filter((item) => item.status === status) : items),
    listAdminActivities: ({ status } = {}) => (status ? activities.filter((item) => item.status === status) : activities),
  };
}

function createHomepageStore(items = []) {
  return {
    listHomepages: () => items,
  };
}

const catalog = {
  courses: [
    { code: 'BIO2110F', name: '微生物学', englishName: 'Microbiology', introduction: '微生物学课程是国家理科基地生物学专业的主干课程。', tag: '专业基础', category: 'basic', href: '/#/resources/#BIO2110F' },
    { code: 'BIO2028M', name: '生物化学', englishName: 'Biochemistry', introduction: '生物大分子结构与功能。', tag: '专业必修', category: 'major', href: '/#/resources/#BIO2028M' },
  ],
};

test('search returns empty groups when query is empty', () => {
  const result = searchAll({
    query: '   ',
    contentStore: createContentStore(),
    courseCatalog: catalog,
    studentHomepageStore: createHomepageStore(),
  });
  assert.equal(result.query, '');
  assert.equal(result.total, 0);
  assert.deepEqual(result.results, { courses: [], content: [], activities: [], homepages: [] });
});

test('search matches courses by code, name, and englishName', () => {
  const store = searchAll({
    query: '微生物',
    contentStore: createContentStore(),
    courseCatalog: catalog,
    studentHomepageStore: createHomepageStore(),
  });
  assert.equal(store.results.courses.length, 1);
  assert.equal(store.results.courses[0].code, 'BIO2110F');

  const byCode = searchAll({
    query: 'bio2028m',
    contentStore: createContentStore(),
    courseCatalog: catalog,
    studentHomepageStore: createHomepageStore(),
  });
  assert.equal(byCode.results.courses[0].code, 'BIO2028M');

  const byEnglish = searchAll({
    query: 'micro',
    contentStore: createContentStore(),
    courseCatalog: catalog,
    studentHomepageStore: createHomepageStore(),
  });
  assert.equal(byEnglish.results.courses[0].code, 'BIO2110F');
});

test('search matches content items by title, summary, author, and courseCode', () => {
  const items = [
    { id: 'a', type: 'experience', title: '微生心得', summary: '期末复习', author: '张三', courseCode: 'BIO2110F', status: 'published' },
    { id: 'b', type: 'material', title: '实验讲义', summary: '培养皿使用', author: '李四', courseCode: 'BIO2028M', status: 'published' },
    { id: 'c', type: 'paper', title: '其他', summary: '无关', author: '王五', courseCode: 'BIO3015F', status: 'draft' },
  ];
  const result = searchAll({
    query: '微生',
    contentStore: createContentStore(items),
    courseCatalog: catalog,
    studentHomepageStore: createHomepageStore(),
  });
  assert.equal(result.results.content.length, 1);
  assert.equal(result.results.content[0].id, 'a');
  assert.match(result.results.content[0].href, /#\/resources\/#BIO2110F\/experiences\/a/);

  const byAuthor = searchAll({
    query: '李四',
    contentStore: createContentStore(items),
    courseCatalog: catalog,
    studentHomepageStore: createHomepageStore(),
  });
  assert.equal(byAuthor.results.content[0].id, 'b');
  assert.match(byAuthor.results.content[0].href, /materials\/b/);

  const byCode = searchAll({
    query: 'BIO2110F',
    contentStore: createContentStore(items),
    courseCatalog: catalog,
    studentHomepageStore: createHomepageStore(),
  });
  assert.equal(byCode.results.content[0].id, 'a');
});

test('draft content items are excluded from search', () => {
  const items = [
    { id: 'draft', type: 'experience', title: '草稿', summary: '不要看到我', author: '', courseCode: 'BIO2110F', status: 'draft' },
  ];
  const result = searchAll({
    query: '草稿',
    contentStore: createContentStore(items),
    courseCatalog: catalog,
    studentHomepageStore: createHomepageStore(),
  });
  assert.equal(result.results.content.length, 0);
});

test('search matches activities by title and category', () => {
  const activities = [
    { slug: 'a1', title: '学术沙龙', summary: '邀请教授', category: 'learning', status: 'published' },
    { slug: 'a2', title: '期末经验', summary: '另一条', category: 'community', status: 'published' },
  ];
  const result = searchAll({
    query: '学术',
    contentStore: createContentStore([], activities),
    courseCatalog: catalog,
    studentHomepageStore: createHomepageStore(),
  });
  assert.equal(result.results.activities.length, 1);
  assert.equal(result.results.activities[0].slug, 'a1');
  assert.equal(result.results.activities[0].href, '#/activity/a1');
});

test('search matches student homepages by name and href', () => {
  const homepages = [
    { id: '1', name: '张明远', href: 'https://example.com/~zhangmy', sortOrder: 0 },
    { id: '2', name: '李雨桐', href: 'https://example.com/~liyutong', sortOrder: 1 },
  ];
  const byName = searchAll({
    query: '雨桐',
    contentStore: createContentStore(),
    courseCatalog: catalog,
    studentHomepageStore: createHomepageStore(homepages),
  });
  assert.equal(byName.results.homepages.length, 1);
  assert.equal(byName.results.homepages[0].name, '李雨桐');

  const byHref = searchAll({
    query: 'zhangmy',
    contentStore: createContentStore(),
    courseCatalog: catalog,
    studentHomepageStore: createHomepageStore(homepages),
  });
  assert.equal(byHref.results.homepages[0].name, '张明远');
});

test('search respects limit and trims oversized query', () => {
  const items = Array.from({ length: 25 }, (_, i) => ({
    id: `c${i}`,
    type: 'experience',
    title: `微生物心得 ${i}`,
    summary: '',
    author: '',
    courseCode: 'BIO2110F',
    status: 'published',
  }));
  const small = searchAll({
    query: '微生物',
    limit: 5,
    contentStore: createContentStore(items),
    courseCatalog: catalog,
    studentHomepageStore: createHomepageStore(),
  });
  assert.equal(small.results.content.length, 5);
  assert.equal(small.results.content[0].id, 'c0');

  const long = searchAll({
    query: 'a'.repeat(200),
    contentStore: createContentStore(items),
    courseCatalog: catalog,
    studentHomepageStore: createHomepageStore(),
  });
  assert.equal(long.query.length, 64);
  assert.equal(long.results.content.length, 0);
});

test('search total sums across all four groups', () => {
  const result = searchAll({
    query: '微',
    contentStore: createContentStore([
      { id: 'c1', type: 'experience', title: '微生物心得', summary: '', author: '', courseCode: 'BIO2110F', status: 'published' },
    ], [
      { slug: 'a1', title: '微生物前沿', summary: '', category: 'learning', status: 'published' },
    ]),
    courseCatalog: catalog,
    studentHomepageStore: createHomepageStore([
      { id: 'h1', name: '微生物王', href: 'https://example.com/~wsm', sortOrder: 0 },
    ]),
  });
  assert.equal(result.results.courses.length, 1);
  assert.equal(result.results.content.length, 1);
  assert.equal(result.results.activities.length, 1);
  assert.equal(result.results.homepages.length, 1);
  assert.equal(result.total, 4);
});
