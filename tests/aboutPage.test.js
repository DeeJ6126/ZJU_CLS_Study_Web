import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import { aboutSections } from '../src/data/config/aboutSections.js';
import { sanitizeHtmlFragment } from '../src/utils/htmlFragment.js';

test('about content sanitizer removes scriptable elements and inline handlers', () => {
  const dirty = [
    '<h2 onclick="alert(1)">标题</h2>',
    '<script>alert(2)</script>',
    '<style>body{display:none}</style>',
    '<iframe src="https://example.com"></iframe>',
    '<p>正文</p>',
  ].join('');

  const clean = sanitizeHtmlFragment(dirty);

  assert.match(clean, /<h2>标题<\/h2>/);
  assert.match(clean, /<p>正文<\/p>/);
  assert.doesNotMatch(clean, /<script/i);
  assert.doesNotMatch(clean, /<style/i);
  assert.doesNotMatch(clean, /<iframe/i);
  assert.doesNotMatch(clean, /onclick/i);
});

test('about content sanitizer drops dangerous urls and keeps external and anchor links', () => {
  const clean = sanitizeHtmlFragment(
    '<a href="javascript:alert(1)">x</a><a href="https://example.com">y</a><a href="#top">z</a>',
  );

  assert.doesNotMatch(clean, /javascript:/i);
  assert.match(clean, /href="https:\/\/example\.com"/);
  assert.match(clean, /href="#top"/);
});

test('about content sanitizer rewrites relative asset paths through the provided rewriter', () => {
  const clean = sanitizeHtmlFragment(
    '<img src="assets/about/team.webp" alt="团队"><a href="/assets/about/plan.pdf">方案</a>',
    { rewriteUrl: (value) => `/base/${value.replace(/^\/+/, '')}` },
  );

  assert.match(clean, /src="\/base\/assets\/about\/team\.webp"/);
  assert.match(clean, /href="\/base\/assets\/about\/plan\.pdf"/);
});

test('about content sanitizer accepts a full html document and returns a bare fragment', () => {
  const clean = sanitizeHtmlFragment(
    '<!doctype html><html><head><title>t</title></head><body><p>正文</p></body></html>',
  );

  assert.equal(clean, '<p>正文</p>');
});

test('about sections config declares the sidebar entries as data, not component literals', () => {
  assert.deepEqual(
    aboutSections.map((section) => section.id),
    ['about-us', 'about-site', 'thanks'],
  );
  assert.deepEqual(
    aboutSections.map((section) => section.label),
    ['关于我们', '关于网站', '致谢'],
  );

  for (const section of aboutSections) {
    assert.equal(
      existsSync(`public/${section.contentUrl}`),
      true,
      `missing content fragment: public/${section.contentUrl}`,
    );
    assert.doesNotMatch(section.contentUrl, /^\//);
  }
});

test('about page component renders a section sidebar driven by hash query state', () => {
  const component = readFileSync('src/components/AboutPage.vue', 'utf8');

  assert.match(component, /aboutSections/);
  assert.match(component, /about-nav/);
  assert.match(component, /aria-current/);
  assert.match(component, /getHashQuery/);
  assert.match(component, /buildHashWithQuery/);
  assert.match(component, /publicAssetPath/);
  assert.match(component, /sanitizeHtmlFragment/);
  assert.match(component, /v-html="html"/);
  assert.match(component, /关于页内容暂时无法读取/);
  // 单文件片段已被按栏目拆分的文件取代。
  assert.doesNotMatch(component, /content\/about\/about\.html/);
});

test('app renders the about page component instead of the old placeholder', () => {
  const app = readFileSync('src/App.vue', 'utf8');

  assert.match(app, /import AboutPage from '\.\/components\/AboutPage\.vue'/);
  assert.match(app, /<AboutPage v-else-if="activePage === 'about'" \/>/);
  assert.doesNotMatch(app, /生科智学会先把刷题和资源入口做稳/);
});

test('every about content fragment stays a sanitized safe fragment', () => {
  for (const section of aboutSections) {
    const file = `public/${section.contentUrl}`;
    const fragment = readFileSync(file, 'utf8');
    const rendered = sanitizeHtmlFragment(fragment, { rewriteUrl: (value) => `/base/${value}` });

    assert.doesNotMatch(rendered, /<script/i, file);
    assert.doesNotMatch(rendered, /<!--/, file);
    assert.doesNotMatch(rendered, /\son[a-z]+\s*=/i, file);

    // 「致谢」按需求暂时留空，允许渲染结果为空；有正文的栏目必须带标题和导语。
    if (!rendered.length) continue;
    assert.match(rendered, /<h2>/, `${file} should carry a section heading`);
    assert.match(rendered, /class="about-lead"/, `${file} should carry a lead paragraph`);
  }
});

test('the acknowledgements section is registered but intentionally empty', () => {
  const thanks = readFileSync('public/content/about/thanks.html', 'utf8');

  // 目前只有给编辑者看的注释，清洗后没有任何正文。
  assert.equal(sanitizeHtmlFragment(thanks), '');
});

test('the legacy single-fragment about file is gone', () => {
  assert.equal(existsSync('public/content/about/about.html'), false);
});

test('about stylesheet defines the sidebar grid and a narrow-screen fallback', () => {
  const css = readFileSync('src/styles/about.css', 'utf8');

  assert.match(css, /\.about-page\s*\{[^}]*grid-template-columns:\s*188px minmax\(0, 1fr\)/s);
  assert.match(css, /\.about-nav__item\.is-active/);
  assert.match(css, /@media\s*\(max-width:\s*860px\)/);
  assert.match(css, /\.about-page__body h2/);
  // 正文里的站内地址需要等宽样式，窄屏表格需要能横向滚动。
  assert.match(css, /\.about-page__body code\s*\{/);
  assert.match(css, /\.about-page__body table\s*\{[^}]*overflow-x:\s*auto/s);
});

test('about content only references routes the app can resolve', () => {
  const topLevelRoots = new Set(['home', 'overview', 'quiz', 'activities', 'about', 'profile']);
  const deepRoots = new Set(['resources', 'activity', 'notifications', 'admin']);
  const cjk = /[\u3400-\u9fff]/;

  const checked = [];

  for (const section of aboutSections) {
    const file = `public/${section.contentUrl}`;
    const fragment = readFileSync(file, 'utf8');
    const routes = [
      ...fragment.matchAll(/href="#([^"]+)"/g),
      ...fragment.matchAll(/<code>#([^<]+)<\/code>/g),
    ].map((match) => match[1]);

    for (const route of routes) {
      // 跳过 #课程代码 / #activity/活动标识 这类带中文占位的写法。
      if (cjk.test(route)) continue;
      const root = route.split('/')[0].split('?')[0];
      assert.ok(
        topLevelRoots.has(root) || deepRoots.has(root),
        `${file}: #${route} does not start with a known route root`,
      );
      checked.push(`#${route}`);
    }
  }

  // 「关于我们」没有站内链接，所以只要求全部片段合计存在可解析的地址。
  assert.ok(checked.length > 0, 'about content should reference site routes');
});

test('the about-site guide documents the real top-level navigation', () => {
  const guide = readFileSync('public/content/about/about-site.html', 'utf8');
  const topPages = readFileSync('src/data/quizDemo.js', 'utf8');

  for (const id of ['home', 'overview', 'quiz', 'activities', 'about', 'profile']) {
    assert.match(guide, new RegExp(`<code>#${id}</code>`), `guide should document #${id}`);
    assert.match(topPages, new RegExp(`id: '${id}'`), `#${id} should be a real top page`);
  }

  assert.match(guide, /#resources\/#/);
  // 文档只列顶部导航的页面；课程地址作为「怎么用」的示例保留。
  assert.doesNotMatch(guide, /<code>#notifications<\/code>/);
  assert.doesNotMatch(guide, /不在顶部导航/);
  assert.match(guide, /#admin/);
});
