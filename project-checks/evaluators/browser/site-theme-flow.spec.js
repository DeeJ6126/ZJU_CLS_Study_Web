import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test.use({ viewport: { width: 1440, height: 1000 } });
test.setTimeout(60_000);
const catalog = JSON.parse(readFileSync(new URL('../../../public/content/activities/catalog.json', import.meta.url), 'utf8'));
const guest = { id: 'guest', nickname: '游客', role: 'guest', verifications: { email: false } };
const admin = { id: 'theme-admin', publicId: 'theme-admin', nickname: '样式管理员', role: 'admin', verifications: { email: true }, majorId: 'biology', grade: 2025 };
const markdown = '## 复习要点\n\n**加粗**、*斜体*、~~删除~~和[资料链接](https://www.zju.edu.cn/)。\n\n> 引用的说明\n\n- 第一项\n- 第二项\n\n```js\nconst course = "BIO2011F";\n```\n\n| 内容 | 年份 |\n| --- | --- |\n| 复习方法 | 2025 |';
const ubb = '[b]加粗[/b] [i]斜体[/i] [u]下划线[/u] [del]删除线[/del]\n\n[align=center][size=5][color=#ff0000]作者指定的格式[/color][/size][/align]\n\n[color=black]随主题切换的正文[/color]\n\n[url=https://www.zju.edu.cn/]资料链接[/url]\n\n[img]https://file.cc98.org/theme-test.png[/img]';
const posts = [
  { id: 'theme-note', routeId: 'theme-note', courseCode: 'BIO2011F', type: 'experience', title: '生化学习心得', summary: '复习方法与课程建议', author: '同学', teacher: '陈才勇', year: '2025-2026', body: markdown, bodyFormat: 'markdown', gradePercentage: 95, likeCount: 2, cc98Url: 'https://www.cc98.org/topic/6003753', status: 'published', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' },
  { id: 'theme-material', routeId: 'theme-material', courseCode: 'BIO2011F', type: 'material', title: '复习资料示例', summary: '格式保留测试', author: '同学', teacher: '陈才勇', year: '2025-2026', body: ubb, bodyFormat: 'ubb', status: 'published' },
  { id: 'theme-paper', routeId: 'theme-paper', courseCode: 'BIO2011F', type: 'paper', title: '2025 历年试卷', year: '2025', teacher: '陈才勇', body: '', status: 'published', file: { url: '/zjubio/api/theme.pdf', fileName: '测试试卷.pdf' } },
];
const pending = { ...posts[0], id: 'pending-note', title: '待审核的学习心得', status: 'pending', submitterName: '测试同学', createdAt: '2026-10-01T01:00:00Z' };

async function fixture(page, role = 'guest') {
  const errors = [];
  const writes = [];
  const searches = [];
  const fontRequests = [];
  let failSearch = false;
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => { if (/woff2|fonts\.google/.test(request.url())) fontRequests.push(request.url()); });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => {
    if (!localStorage.getItem('zjubio:local-workspace:v1:guest')) localStorage.setItem('zjubio:local-workspace:v1:guest', JSON.stringify({
      majorId: 'biology', cohortYear: 2025, onboardingDismissed: true, coursesInitialized: true,
      myCourses: [{ courseCode: 'BIO2011F', courseName: '生物化学（甲）', catalogMatched: true }, { courseCode: 'BIO2012F', courseName: '生物化学实验（甲）', catalogMatched: true }],
    }));
  });
  await page.route('https://file.cc98.org/theme-test.png', (route) => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9YGhZmcAAAAASUVORK5CYII=', 'base64') }));
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/zjubio/, '');
    if (request.method() !== 'GET') {
      writes.push(path);
      await route.fulfill({ status: 405, json: { message: '只读测试数据' } });
      return;
    }
    let payload = { items: [], total: 0, courses: [], courseCodes: [], favorites: [], notifications: [], unreadCount: 0, submissions: [], logs: [], activities: [], homepages: [], applications: [], posts: [], comments: [] };
    if (path === '/api/auth/me') payload = { user: role === 'admin' ? admin : guest };
    if (path === '/api/consultation/status' || path === '/api/admin/consultation/status') payload = { open: false, isMentor: false };
    if (path === '/api/quiz/recent') payload = { recent: null };
    if (path === '/api/account/courses') payload = { courses: [{ courseCode: 'BIO2011F', courseName: '生物化学（甲）', catalogMatched: true }], initialized: true };
    if (path === '/api/activities' || path === '/api/admin/activities') payload = { activities: catalog.articles.slice(0, 3).map((item) => ({ ...item, featured: true })) };
    if (path.startsWith('/api/course-favorite-counts/')) payload = { count: 2 };
    if (path.startsWith('/api/content/courses/')) payload = { items: path.endsWith('/BIO2011F') ? posts : [] };
    if (path === '/api/search/resources') {
      searches.push(Object.fromEntries(url.searchParams));
      if (failSearch) { failSearch = false; await route.fulfill({ status: 503, json: { message: '模拟搜索失败' } }); return; }
      const pageNumber = Number(url.searchParams.get('page') || 1);
      payload = { total: 12, items: Array.from({ length: pageNumber === 1 ? 10 : 2 }, (_, index) => ({ ...posts[0], id: `search-${pageNumber}-${index}`, title: `生化心得 ${index + (pageNumber - 1) * 10 + 1}`, courseName: '生物化学（甲）', href: '#resources/#BIO2011F/#experiences/#theme-note' })) };
    }
    if (path === '/api/admin/content') payload = { items: posts.filter((post) => post.type === (url.searchParams.get('type') || 'experience')) };
    if (path === '/api/admin/submissions') payload = { submissions: [pending] };
    if (path === '/api/admin/student-homepages') payload = { homepages: [{ id: 'homepage-test', name: '同学主页测试', href: 'https://example.org/', status: 'approved' }] };
    await route.fulfill({ status: 200, json: payload });
  });
  return { errors, writes, searches, fontRequests, failNextSearch: () => { failSearch = true; } };
}

async function setTheme(page, mode) {
  if ((await page.locator('html').getAttribute('data-theme') === 'dark') !== (mode === 'dark')) await page.locator('.theme-switch').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
  await expect(page.locator('html')).not.toHaveClass(/theme-transitioning/);
}

async function readable(page, selector, name) {
  const samples = await page.locator(selector).evaluateAll((elements) => {
    const rgb = (value) => value.match(/[\d.]+/g)?.map(Number) ?? [];
    const lum = (color) => color.slice(0, 3).map((v) => v / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    return elements.filter((element) => element.getBoundingClientRect().width && element.textContent.trim()).map((element) => {
      let parent = element;
      while (parent && rgb(getComputedStyle(parent).backgroundColor)[3] === 0) parent = parent.parentElement;
      const values = [lum(rgb(getComputedStyle(element).color)), lum(rgb(getComputedStyle(parent || document.body).backgroundColor))].sort((a, b) => b - a);
      return { text: element.textContent.trim().slice(0, 60), ratio: (values[0] + .05) / (values[1] + .05) };
    });
  });
  expect(samples.length, name).toBeGreaterThan(0);
  for (const sample of samples) expect(sample.ratio, `${name}: ${sample.text}`).toBeGreaterThanOrEqual(4.5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: `project-checks/artifacts/site-theme-${name}.png`, fullPage: true, animations: 'disabled' });
}

for (const mode of ['light', 'dark']) {
  test(`homepage and overview preserve search, filters and local favorites in ${mode}`, async ({ page }) => {
    const state = await fixture(page);
    await page.goto('/');
    await setTheme(page, mode);
    await expect(page.locator('.home-study .my-course-card')).toHaveCount(2);
    const searchBounds = await page.locator('.home-search').boundingBox();
    const courseBounds = await page.locator('.home-study').boundingBox();
    expect(Math.abs(searchBounds.x - courseBounds.x)).toBeLessThan(1);
    expect(Math.abs(searchBounds.width - courseBounds.width)).toBeLessThan(1);
    await expect(page.locator('.home-activity-grid article')).toHaveCount(3);
    for (const image of await page.locator('.home-activity-card__image img').all()) await expect.poll(() => image.evaluate((el) => el.complete && el.naturalWidth > 0)).toBe(true);
    await expect(page.getByText('同学主页', { exact: true })).toHaveCount(0);
    await page.getByRole('searchbox', { name: '搜索课程或资料' }).fill('BIO2011F');
    await page.getByRole('button', { name: '搜索', exact: true }).click();
    await expect(page.locator('.home-search__results')).toContainText('生物化学');
    await page.getByRole('button', { name: '活动', exact: true }).click();
    await page.getByRole('searchbox', { name: '搜索课程或资料' }).fill(catalog.articles[0].title);
    await expect(page.locator('.home-search__results a').first()).toContainText(catalog.articles[0].title);
    await readable(page, '.home-study h2, .home-study strong, .home-activity-grid h3', `home-${mode}`);
    await page.getByRole('button', { name: '资料', exact: true }).click();
    await expect(page.locator('.home-resource-search__item')).toHaveCount(10);
    const previous = page.getByRole('button', { name: '上一页', exact: true });
    const next = page.getByRole('button', { name: '下一页', exact: true });
    await expect(previous).toBeDisabled();
    await expect(previous).toHaveCSS('opacity', '0.5');
    await next.click();
    await expect(page.locator('.home-resource-search__item')).toHaveCount(2);
    await expect(next).toBeDisabled();
    const filters = page.locator('.home-resource-search__filters');
    await filters.getByRole('searchbox', { name: '课程', exact: true }).fill('BIO2011F');
    await filters.getByRole('combobox', { name: '类型', exact: true }).selectOption('experience');
    await expect.poll(() => state.searches.at(-1)?.course).toBe('BIO2011F');
    await expect.poll(() => state.searches.at(-1)?.type).toBe('experience');
    state.failNextSearch();
    await page.getByRole('button', { name: '搜索', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('模拟搜索失败');
    await page.getByRole('button', { name: '重试', exact: true }).click();
    await expect(page.locator('.home-resource-search__item')).toHaveCount(10);
    await readable(page, '.home-resource-search__item small, .home-resource-search__item strong, .home-resource-search__filters label', `search-${mode}`);
    await page.goto('/#overview?major=biology-qiangji&program=2024');
    await expect(page.locator('.overview-contents')).toBeVisible();
    await expect(page.locator('.overview-outline')).toBeVisible();
    await page.locator('.overview-modules button').last().click();
    await expect(page.locator('.overview-modules button').last()).toHaveClass(/is-active/);
    await readable(page, '.overview-outline__head, .overview-course-grid strong, .overview-course-grid small', `overview-outline-${mode}`);
    await page.getByRole('button', { name: '按学期', exact: true }).click();
    await expect(page.locator('.overview-sections')).toBeVisible();
    await page.locator('.overview-controls').getByRole('combobox', { name: '专业', exact: true }).selectOption('biology');
    await page.locator('.overview-controls').getByRole('combobox', { name: '培养方案', exact: true }).selectOption('2025');
    const card = page.locator('.overview-course-grid article').filter({ hasText: 'BIO2011F' }).first();
    await card.getByRole('button', { name: '收藏', exact: true }).click();
    await expect(card.getByRole('button', { name: '取消收藏', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('checkbox', { name: '仅展示有资料的课程' }).check();
    await expect(page.locator('.overview-course-grid article').filter({ hasText: 'BIO2011F' })).toHaveCount(1);
    await readable(page, '.overview-section__head strong, .overview-course-grid strong, .overview-course-grid small', `overview-semester-${mode}`);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
    await expect(card.getByRole('button', { name: '取消收藏', exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.fonts.check('16px Outfit') && document.fonts.check('16px "Space Grotesk"'))).toBe(true);
    expect(state.fontRequests.some((url) => /outfit-latin(?:-[\w-]+)?\.woff2/.test(url))).toBe(true);
    expect(state.fontRequests.some((url) => /space-grotesk-latin(?:-[\w-]+)?\.woff2/.test(url))).toBe(true);
    expect(state.fontRequests.some((url) => /fonts\.google/.test(url))).toBe(false);
    expect(state.errors).toEqual([]);
    expect(state.writes).toEqual([]);
  });

  test(`course content and contribution formats remain consistent in ${mode}`, async ({ page }) => {
    const state = await fixture(page);
    await page.goto('/#resources/#BIO2011F');
    await setTheme(page, mode);
    await expect(page.locator('.course-teachers')).toContainText('陈才勇');
    await readable(page, '.course-detail__hero-main p, .course-detail__facts dd, .course-teachers li', `course-${mode}`);
    await page.locator('.course-tabs').getByRole('link', { name: /学习心得/ }).click();
    await expect(page.locator('.learning-card__metadata')).toContainText('2025-2026');
    await page.locator('.learning-card__main-link').click();
    const body = page.locator('.article-body');
    await expect(body.locator('h2')).toHaveText('复习要点');
    await expect(body.locator('strong')).toHaveText('加粗');
    await expect(body.locator('em')).toHaveText('斜体');
    await expect(body.locator('del')).toHaveText('删除');
    await expect(body.locator('blockquote')).toContainText('引用的说明');
    await expect(body.locator('li')).toHaveCount(2);
    await expect(body.locator('pre code')).toContainText('BIO2011F');
    await expect(body.locator('table')).toBeVisible();
    expect(await body.locator('code').evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/Consolas|monospace/);
    await expect(page.getByRole('button', { name: '查看成绩', exact: true })).toHaveAttribute('aria-expanded', 'false');
    await page.getByRole('button', { name: '查看成绩', exact: true }).click();
    await expect(page.getByRole('button', { name: '隐藏成绩', exact: true })).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.article-action-button')).toBeDisabled();
    await page.getByRole('button', { name: '收藏', exact: true }).click();
    await expect(page.getByRole('button', { name: '取消收藏', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.comment-section')).toHaveCount(0);
    await readable(page, '.article-body p, .article-body h2, .article-body td, .article-detail-card__context', `markdown-${mode}`);
    await page.locator('.course-tabs').getByRole('link', { name: /复习资料/ }).click();
    await page.locator('.learning-card__main-link').click();
    await expect(body.locator('.ubb-align')).toHaveCSS('text-align', 'center');
    await expect(body.locator('.ubb-color').first()).toHaveCSS('color', 'rgb(255, 0, 0)');
    await expect(body.locator('.ubb-size-5')).toHaveCSS('font-size', '20px');
    await expect(body.locator('.ubb-color').nth(1)).toHaveCSS('color', mode === 'light' ? 'rgb(33, 49, 57)' : 'rgb(241, 245, 246)');
    await expect(body.locator('u')).toHaveText('下划线');
    await expect(body.locator('s')).toHaveText('删除线');
    await expect.poll(() => body.locator('img').evaluate((el) => el.complete && el.naturalWidth > 0)).toBe(true);
    await expect(page.locator('.comment-section')).toHaveCount(0);
    await readable(page, '.article-detail-card__context, .article-detail-card__author', `ubb-${mode}`);
    for (const tab of ['experiences', 'materials', 'papers']) {
      await page.goto(`/#resources/#BIO2011F/#${tab}`);
      await page.getByRole('button', { name: '投稿', exact: true }).click();
      const panel = page.locator('.contribution-modal__panel');
      await expect(panel).toBeVisible();
      const bounds = await panel.boundingBox();
      expect(bounds.width).toBeGreaterThan(1000);
      expect(Math.abs(bounds.x + bounds.width / 2 - 720)).toBeLessThan(2);
      if (tab === 'papers') {
        await expect(panel.locator('textarea')).toHaveCount(0);
        await panel.getByRole('textbox', { name: '年份', exact: true }).fill('2025');
        await panel.getByLabel('选择 PDF 文件').setInputFiles({ name: '测试.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF') });
        await expect(panel.locator('.contribution-form__dropzone')).toContainText('测试.pdf');
      } else {
        await panel.getByRole('textbox', { name: '标题', exact: true }).fill('样式测试');
        await panel.getByRole('tab', { name: 'UBB（论坛格式）', exact: true }).click();
        await expect(panel.getByRole('combobox', { name: '字号大小' })).toBeVisible();
        await panel.getByRole('tab', { name: 'Markdown', exact: true }).click();
        await panel.getByRole('button', { name: '加粗', exact: true }).click();
        await expect(panel.locator('textarea')).toHaveValue('****');
      }
      await readable(page, '.contribution-modal__panel label > span, .contribution-form__actions button', `submission-${tab}-${mode}`);
      await panel.getByRole('button', { name: '取消', exact: true }).click();
    }
    expect(state.errors).toEqual([]);
    expect(state.writes).toEqual([]);
  });

  test(`administrator course review and directory management remain usable in ${mode}`, async ({ page }) => {
    const state = await fixture(page, 'admin');
    await page.goto('/#admin');
    await setTheme(page, mode);
    await expect(page.locator('.admin-page__nav .admin-pending-dot')).toHaveCount(1);
    const course = page.locator('.admin-list__filters--course .admin-course-combobox input');
    await course.fill('BIO2011F');
    await page.getByRole('option', { name: /BIO2011F/ }).click();
    await expect(page.getByRole('combobox', { name: '状态', exact: true })).toHaveValue('pending');
    await expect(page.locator('.admin-content-table__row')).toContainText(pending.title);
    await page.getByRole('button', { name: '审核', exact: true }).click();
    await expect(page.getByRole('button', { name: '通过并发布', exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: '拒绝原因', exact: true }).fill('仅输入，不提交');
    await readable(page, '.admin-submission-editor label > span, .admin-submission-editor button', `admin-review-${mode}`);
    await page.getByRole('button', { name: '返回列表', exact: true }).click();
    await page.getByRole('combobox', { name: '状态', exact: true }).selectOption('published');
    await page.getByRole('button', { name: '编辑', exact: true }).click();
    await expect(page.getByRole('textbox', { name: '正文', exact: true })).toHaveValue(markdown);
    await readable(page, '.admin-editor label > span, .admin-editor__actions button', `admin-content-${mode}`);
    await page.getByRole('button', { name: '关闭', exact: true }).click();
    await page.locator('.admin-page__nav').getByRole('button', { name: '活动管理', exact: true }).click();
    await expect(page.locator('.admin-activity-programs button')).toHaveCount(6);
    await page.getByRole('button', { name: '新增推文', exact: true }).click();
    await expect(page.getByRole('textbox', { name: '推文链接', exact: true })).toBeVisible();
    await readable(page, '.admin-editor label > span, .admin-editor__actions button', `admin-activity-${mode}`);
    await page.getByRole('button', { name: '关闭', exact: true }).click();
    await page.locator('.admin-page__nav').getByRole('button', { name: '更多', exact: true }).click();
    await expect(page.locator('.admin-homepage-row')).toContainText('同学主页测试');
    await page.getByRole('button', { name: '新增主页', exact: true }).click();
    await readable(page, '.admin-editor label > span, .admin-editor__actions button', `admin-homepage-${mode}`);
    expect(state.errors).toEqual([]);
    expect(state.writes).toEqual([]);
  });
}
