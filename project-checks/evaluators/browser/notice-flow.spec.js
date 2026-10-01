import { expect, test } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createContentStore } from '../../../server/content/contentStore.js';
import { handleNoticeHttpRequest } from '../../../server/notice/noticeHttpService.js';

async function noticeFixture(page, admin = false) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const store = createContentStore({ filename: ':memory:' });
  store.initialize();
  const uploadDirectory = mkdtempSync(join(tmpdir(), 'zjubio-notice-browser-'));
  const user = admin
    ? { id: 'notice-admin', role: 'admin', nickname: '通知管理员', verifications: { email: true } }
    : { id: 'guest', role: 'guest', nickname: '游客', verifications: {} };
  async function readBody(request, limit = 1200000) {
    const chunks = [];
    let length = 0;
    for await (const chunk of request) {
      length += chunk.length;
      if (length > limit) return null;
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
  const sendJson = (response, status, data) => {
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(data));
  };
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://test');
      url.pathname = url.pathname.replace(/^\/zjubio\/api/, '/api');
      if (!/^\/api\/(admin\/)?notices(?:\/|$)/.test(url.pathname)) {
        const source = await fetch(`http://127.0.0.1:5174${request.url}`);
        response.writeHead(source.status, { 'content-type': source.headers.get('content-type') || 'text/plain' });
        response.end(Buffer.from(await source.arrayBuffer()));
        return;
      }
      await handleNoticeHttpRequest({ request, response, url,
        user, userId: admin ? 1 : null, contentStore: store, uploadDirectory, sendJson,
        readJsonBody: async (req) => JSON.parse((await readBody(req)).toString()), readBinaryBody: readBody });
    } catch (error) { sendJson(response, 500, { message: error.message }); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const host = `127.0.0.1:${server.address().port}`;
  await page.route('**/zjubio/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/zjubio', '');
    if (/^\/api\/(admin\/)?notices(?:\/|$)/.test(path)) {
      await route.continue();
      return;
    }
    let payload = { items: [], total: 0, activities: [], homepages: [], courseCodes: [], courses: [], notifications: [], submissions: [], favorites: [], logs: [] };
    if (path === '/api/auth/me') payload = { user };
    if (path === '/api/consultation/status') payload = { open: false, isMentor: false };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
  });
  return { store, errors, baseUrl: `http://${host}`, close: async () => {
    await new Promise((resolve) => server.close(resolve));
    store.close();
    rmSync(uploadDirectory, { recursive: true, force: true });
  } };
}

test('public notices filter and paginate real records, show safe details and work across viewports', async ({ page }) => {
  const fixture = await noticeFixture(page);
  try {
    for (let i = 0; i < 25; i++) fixture.store.createNotice({
      id: `fixture-${i}`, title: `模拟通知 ${i}`, summary: '浏览器测试摘要', body: '## 材料要求\n**加粗说明**\n<script>alert(1)</script>',
      category: i === 0 ? 'awards' : 'general', publishedDate: '2026-10-01', publisher: '测试单位',
      pinned: i === 0, status: 'published', sourceUrl: 'https://www.zju.edu.cn/',
      majorIds: i === 0 ? ['biology'] : ['ecology'], cohortYears: [2025],
      deadline: i === 0 ? '2080-10-01T15:59:00.000Z' : '2020-01-01T00:00:00.000Z',
    });
    fixture.store.createNotice({ id: 'hidden', title: '模拟草稿不可公开', category: 'general', publishedDate: '2026-10-01' });
    await page.goto(`${fixture.baseUrl}/#notices`);
    await expect(page.locator('.notice-list-item')).toHaveCount(12);
    await expect(page.locator('.notice-list-item').first()).toContainText('模拟通知 0');
    await expect(page.locator('.notices-page')).not.toContainText('模拟草稿不可公开');
    await page.getByRole('button', { name: '下一页', exact: true }).click();
    await expect(page.getByText('第 2 / 3 页', { exact: true })).toBeVisible();
    await page.getByRole('combobox', { name: '分类', exact: true }).selectOption('awards');
    await expect(page.locator('.notice-list-item')).toHaveCount(1);
    await page.getByRole('combobox', { name: '专业', exact: true }).selectOption('biology');
    await page.getByRole('combobox', { name: '年级', exact: true }).selectOption('2025');
    await page.getByRole('combobox', { name: '截止状态', exact: true }).selectOption('active');
    await expect(page.locator('.notice-list-item')).toHaveCount(1);
    await page.screenshot({ path: 'project-checks/artifacts/notices-desktop.png', fullPage: true });
    for (const width of [768, 390]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    }
    await page.screenshot({ path: 'project-checks/artifacts/notices-mobile.png', fullPage: true });
    await page.getByRole('link', { name: '模拟通知 0', exact: true }).click();
    await expect(page.locator('.notice-detail h1')).toHaveText('模拟通知 0');
    await expect(page.locator('.notice-body h2')).toHaveText('材料要求');
    await expect(page.locator('.notice-body strong')).toHaveText('加粗说明');
    await expect(page.locator('.notice-body script')).toHaveCount(0);
    await expect(page.getByRole('link', { name: '查看原文' })).toHaveAttribute('href', 'https://www.zju.edu.cn/');
    expect(await page.locator('.notices-page').getByRole('button', { name: /投稿|评论|申请/ }).count()).toBe(0);
    await page.locator('.theme-switch').click();
    await page.screenshot({ path: 'project-checks/artifacts/notices-dark-detail.png', fullPage: true });
    await page.goto(`${fixture.baseUrl}/#notices/hidden`);
    await expect(page.getByText('通知不存在或已下架', { exact: true })).toBeVisible();
    expect(fixture.errors).toEqual([]);
  } finally { await fixture.close(); }
});

test('administrator saves previews uploads publishes and archives notices using real APIs', async ({ page }) => {
  const fixture = await noticeFixture(page, true);
  try {
    await page.goto(`${fixture.baseUrl}/#admin`);
    await page.locator('.admin-page__nav').getByRole('button', { name: '通知', exact: true }).click();
    const panel = page.locator('.notice-admin');
    await panel.getByRole('button', { name: '新建通知', exact: true }).click();
    await panel.getByRole('textbox', { name: '标题', exact: true }).fill('模拟评优通知');
    await panel.getByRole('combobox', { name: '分类', exact: true }).selectOption('awards');
    await panel.getByRole('textbox', { name: '摘要', exact: true }).fill('模拟测试摘要，不作为实际通知发布。');
    await panel.getByRole('textbox', { name: '发布单位', exact: true }).fill('测试单位');
    await panel.getByRole('textbox', { name: '原文链接（选填）', exact: true }).fill('https://www.zju.edu.cn/');
    await panel.getByRole('checkbox', { name: '生物科学', exact: true }).check();
    await panel.getByRole('textbox', { name: '入学年级（留空则为全部年级）' }).fill('2025');
    await panel.getByLabel('截止时间（北京时间，选填）').fill('2080-10-01T23:59');
    await panel.getByRole('checkbox', { name: '置顶', exact: true }).check();
    await panel.getByRole('tab', { name: '预览', exact: true }).click();
    await expect(panel.locator('.notice-admin__preview')).toContainText('模拟评优通知');
    await page.screenshot({ path: 'project-checks/artifacts/notices-admin-preview.png', fullPage: true });
    await panel.getByRole('button', { name: '保存草稿', exact: true }).click();
    await expect(panel.getByText('通知已保存。', { exact: true })).toBeVisible();
    const saved = fixture.store.listNotices({}).items[0];
    expect(saved.status).toBe('draft');
    expect(saved.deadline).toBe('2080-10-01T15:59:00.000Z');
    expect(fixture.store.listNotices({ publicOnly: true }).total).toBe(0);
    const pdf = Buffer.from('%PDF-1.4\n% browser fixture\n%%EOF');
    await panel.getByLabel('选择通知附件').setInputFiles({ name: '模拟附件.pdf', mimeType: 'application/pdf', buffer: pdf });
    await expect(panel.getByText('已上传 1 个附件。', { exact: true })).toBeVisible();
    await panel.getByRole('textbox', { name: '原文链接（选填）', exact: true }).fill('');
    page.once('dialog', (dialog) => dialog.dismiss());
    await page.locator('.demo-topnav').getByRole('link', { name: '通知', exact: true }).click();
    await expect(panel).toBeVisible();
    await panel.getByRole('button', { name: '保存并发布', exact: true }).click();
    await expect(panel.getByText('通知已发布。', { exact: true })).toBeVisible();
    expect(fixture.store.findNoticeById(saved.id).status).toBe('published');
    await page.setViewportSize({ width: 390, height: 844 });
    const overflow = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth,
      nodes: [...document.querySelectorAll('.admin-page *')].map((el) => ({ element: el.tagName, className: el.className, width: el.getBoundingClientRect().width, right: el.getBoundingClientRect().right + scrollX }))
        .filter((item) => item.right > innerWidth + 1).slice(0, 15) }));
    expect(overflow.width, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.viewport + 1);
    await page.screenshot({ path: 'project-checks/artifacts/notices-admin-mobile.png', fullPage: true });
    await page.locator('.demo-topnav').getByRole('link', { name: '通知', exact: true }).click();
    await page.getByRole('link', { name: '模拟评优通知', exact: true }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('link', { name: '下载 模拟附件.pdf', exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('模拟附件.pdf');
    expect(readFileSync(await download.path())).toEqual(pdf);
    await page.goto(`${fixture.baseUrl}/#admin`);
    await page.locator('.admin-page__nav').getByRole('button', { name: '通知', exact: true }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('.notice-admin__row').getByRole('button', { name: '下架', exact: true }).click();
    await expect(panel.getByText('通知已下架。', { exact: true })).toBeVisible();
    await page.goto(`${fixture.baseUrl}/#notices/${saved.id}`);
    await expect(page.getByText('通知不存在或已下架', { exact: true })).toBeVisible();
    expect(fixture.errors).toEqual([]);
  } finally { await fixture.close(); }
});

test('link-only notices publish and public error retries remain usable', async ({ page }) => {
  const fixture = await noticeFixture(page, true);
  try {
    await page.goto(`${fixture.baseUrl}/#admin`);
    await page.locator('.admin-page__nav').getByRole('button', { name: '通知', exact: true }).click();
    const panel = page.locator('.notice-admin');
    await panel.getByRole('button', { name: '新建通知', exact: true }).click();
    await panel.getByRole('textbox', { name: '标题', exact: true }).fill('模拟原文通知');
    await panel.getByRole('textbox', { name: '摘要', exact: true }).fill('测试原文摘要');
    await panel.getByRole('textbox', { name: '原文链接（选填）', exact: true }).fill('https://www.zju.edu.cn/');
    await panel.getByRole('button', { name: '保存并发布', exact: true }).click();
    await expect(panel.getByText('通知已发布。', { exact: true })).toBeVisible();
    await page.route('**/zjubio/api/notices?*', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: '模拟临时不可用' }) }));
    await page.goto(`${fixture.baseUrl}/#notices`);
    await expect(page.getByRole('alert')).toContainText('模拟临时不可用');
    await page.unroute('**/zjubio/api/notices?*');
    await page.getByRole('button', { name: '重试', exact: true }).click();
    await expect(page.locator('.notice-list-item')).toHaveCount(1);
    expect(fixture.errors).toEqual([]);
  } finally { await fixture.close(); }
});
