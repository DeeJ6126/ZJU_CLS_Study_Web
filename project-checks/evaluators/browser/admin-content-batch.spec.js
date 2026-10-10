import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 1000 } });

const admin = { id: 31, publicId: 'batch-admin', role: 'admin', nickname: '批量管理员', verifications: { email: true } };
const names = { BIO2110F: '微生物学', BIO2019F: '植物学', BIO2011F: '生物化学' };
const documentFixture = {
  version: 1,
  items: [
    { courseCode: 'BIO2110F', type: 'experience', title: '论坛学习心得', author: '原帖作者', summary: '课程复习经验', teacher: '测试老师', sourcePlatform: 'cc98', sourceUrl: 'https://www.cc98.org/topic/123/1#2', bodyFormat: 'markdown', body: '### 复习\n\n测试正文。' },
    { courseCode: 'BIO2110F', type: 'material', title: '复习提纲', author: '资料整理者', summary: '知识点提纲', teacher: '', sourcePlatform: 'other', sourceUrl: 'https://forum.example/material', bodyFormat: 'ubb', body: '[b]测试资料正文[/b]', externalUrl: 'https://example.test/zjubio/api/content/files/material-1' },
    { courseCode: 'BIO2019F', type: 'material', title: '植物学笔记', author: '笔记整理者', bodyFormat: 'markdown', body: '植物学测试笔记。' },
    { courseCode: 'BIO2011F', type: 'experience', title: '生化学习心得', author: '生化原作者', bodyFormat: 'markdown', body: '生化测试心得。' },
  ],
};
const copy = (value) => JSON.parse(JSON.stringify(value));
const batchRequests = (state, action) => state.requests.filter((request) => request.path === `/api/admin/content-batch/${action}`);

async function fixture(page) {
  const state = { requests: [], errors: [], items: [], importResults: [], importFailures: 0, loseImportResponse: false, holdImport: false, releaseImport: null, imported: new Map() };
  page.on('pageerror', (error) => state.errors.push(error.message));
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/zjubio/, '');
    const method = request.method();
    const body = request.headers()['content-type']?.includes('application/json') ? request.postDataJSON() : null;
    state.requests.push({ path, method, body, type: url.searchParams.get('type') ?? '' });
    let payload = { items: [], activities: [], courses: [], initialized: true, submissions: [], notifications: [], homepages: [], applications: [], favorites: [], pendingCount: 0, unreadCount: 0 };
    if (path === '/api/auth/me') payload = { user: admin };
    if (path === '/api/consultation/status') payload = { open: false, isMentor: false };
    if (path === '/api/quiz/recent') payload = { recent: null };
    if (path === '/api/admin/content' && method === 'GET') payload = { items: state.items };
    if (path === '/api/admin/content-batch/preview' && method === 'POST') {
      const rows = body.document.items.map((item, index) => ({
        index: index + 1, courseCode: item.courseCode, courseName: names[item.courseCode] ?? '',
        type: item.type, title: item.title, author: item.author, bodyFormat: item.bodyFormat,
        errors: names[item.courseCode] ? [] : ['课程代码不存在'], warnings: [],
      }));
      const invalidCount = rows.filter((row) => row.errors.length).length;
      payload = { preview: { fingerprint: 'fixture-fingerprint', total: rows.length, validCount: rows.length - invalidCount, invalidCount, rows } };
    }
    if (path === '/api/admin/content-batch/import' && method === 'POST') {
      if (state.holdImport) await new Promise((resolve) => { state.releaseImport = resolve; });
      if (state.importFailures > 0) {
        state.importFailures -= 1;
        await route.fulfill({ status: 503, json: { message: '测试批量导入失败' } });
        return;
      }
      const previous = state.imported.get(body.requestId);
      const items = previous ?? body.document.items.map((item, index) => ({ ...copy(item), id: `batch-${index + 1}`, routeId: `batch-${index + 1}`, status: 'draft', createdAt: '2026-10-10T00:00:00.000Z', updatedAt: '2026-10-10T00:00:00.000Z' }));
      if (!previous) { state.items.push(...items); state.imported.set(body.requestId, items); }
      if (state.loseImportResponse) {
        state.loseImportResponse = false;
        await route.abort('failed');
        return;
      }
      payload = { result: { createdCount: items.length, replayed: Boolean(previous), items } };
      state.importResults.push(payload.result);
    }
    if (path === '/api/admin/content-batch/catalog' && method === 'GET') {
      const items = documentFixture.items.filter((item) => !url.searchParams.get('type') || item.type === url.searchParams.get('type'));
      payload = { courses: Object.entries(names).map(([code, name]) => ({ code, name, count: items.filter((item) => item.courseCode === code).length })).filter((course) => course.count), total: items.length };
    }
    if (path === '/api/admin/content-batch/export' && method === 'POST') {
      const items = documentFixture.items.filter((item) => body.courseCodes.includes(item.courseCode) && (!body.type || item.type === body.type));
      payload = { document: { version: 1, items: copy(items) }, count: items.length };
    }
    await route.fulfill({ json: payload });
  });
  return state;
}

async function openImport(page, document = documentFixture) {
  await page.goto('/#admin');
  await page.getByRole('button', { name: '批量导入', exact: true }).click();
  const panel = page.getByRole('region', { name: '批量导入', exact: true });
  await panel.getByLabel('选择 JSON 文件', { exact: true }).setInputFiles({ name: 'batch.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(document)) });
  return panel;
}

async function preview(panel) {
  await panel.getByRole('button', { name: '校验并预览', exact: true }).click();
  await expect(panel).toContainText('论坛学习心得');
}

async function openExport(page) {
  await page.goto('/#admin');
  await page.getByRole('button', { name: '批量导出', exact: true }).click();
  const panel = page.getByRole('region', { name: '批量导出', exact: true });
  await expect(panel.getByRole('checkbox', { name: '微生物学 [2]', exact: true })).toBeVisible();
  return panel;
}

async function downloadDocument(page, panel) {
  const pending = page.waitForEvent('download');
  await panel.getByRole('button', { name: '导出 JSON', exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(/\.json$/i);
  const chunks = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

test('preview shows metadata without creating records and invalid rows block import', async ({ page }) => {
  const state = await fixture(page);
  const document = copy(documentFixture);
  document.items[1].courseCode = 'UNKNOWN';
  const panel = await openImport(page, document);
  await preview(panel);
  await expect(panel).toContainText('原帖作者');
  await expect(panel).toContainText('微生物学');
  await expect(panel).toContainText('课程代码不存在');
  await expect(panel.getByRole('button', { name: '确认生成草稿', exact: true })).toBeDisabled();
  expect(batchRequests(state, 'preview')).toHaveLength(1);
  expect(batchRequests(state, 'preview')[0].body).toEqual({ document });
  expect(batchRequests(state, 'import')).toEqual([]);
  expect(state.items).toEqual([]);
  expect(state.errors).toEqual([]);
});

test('confirmation creates only drafts with the reviewed document and fingerprint', async ({ page }) => {
  const state = await fixture(page);
  const panel = await openImport(page);
  await preview(panel);
  expect(state.items).toEqual([]);
  await panel.getByRole('button', { name: '确认生成草稿', exact: true }).click();
  await expect.poll(() => state.items.length).toBe(4);
  const [request] = batchRequests(state, 'import');
  expect(request.body).toMatchObject({ document: documentFixture, fingerprint: 'fixture-fingerprint' });
  expect(request.body.requestId).toEqual(expect.any(String));
  expect(request.body.requestId.length).toBeGreaterThan(0);
  expect(state.items.every((item) => item.status === 'draft')).toBe(true);
  expect(state.requests.filter((request) => request.path.endsWith('/publish'))).toEqual([]);
  expect(state.errors).toEqual([]);
});

test('failed import retains preview and retries with the same request token', async ({ page }) => {
  const state = await fixture(page);
  state.importFailures = 1;
  const panel = await openImport(page);
  await preview(panel);
  await panel.getByRole('button', { name: '确认生成草稿', exact: true }).click();
  await expect(panel).toContainText('测试批量导入失败');
  await expect(panel).toContainText('论坛学习心得');
  await expect(panel.getByRole('button', { name: '确认生成草稿', exact: true })).toBeEnabled();
  expect(state.items).toEqual([]);
  await panel.getByRole('button', { name: '确认生成草稿', exact: true }).click();
  await expect.poll(() => state.items.length).toBe(4);
  const requests = batchRequests(state, 'import');
  expect(requests).toHaveLength(2);
  expect(requests[1].body).toEqual(requests[0].body);
  expect(batchRequests(state, 'preview')).toHaveLength(1);
  expect(state.errors).toEqual([]);
});

test('lost import response recovers its request token after reload without duplicate drafts', async ({ page }) => {
  const state = await fixture(page);
  state.loseImportResponse = true;
  const panel = await openImport(page);
  await preview(panel);
  await panel.getByRole('button', { name: '确认生成草稿', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('管理服务暂时无法连接');
  await expect(panel.getByRole('button', { name: '确认生成草稿', exact: true })).toBeEnabled();
  expect(state.items).toHaveLength(4);
  const firstRequestId = batchRequests(state, 'import')[0].body.requestId;
  await page.reload();
  const restoredPanel = await openImport(page);
  await preview(restoredPanel);
  await restoredPanel.getByRole('button', { name: '确认生成草稿', exact: true }).click();
  await expect(restoredPanel.getByRole('status')).toContainText('已生成 4 条草稿');
  const requests = batchRequests(state, 'import');
  expect(requests).toHaveLength(2);
  expect(requests[1].body.requestId).toBe(firstRequestId);
  expect(requests[1].body).toEqual(requests[0].body);
  expect(state.importResults).toHaveLength(1);
  expect(state.importResults[0]).toMatchObject({ replayed: true, createdCount: 4 });
  expect(state.items).toHaveLength(4);
  expect(new Set(state.items.map((item) => item.id)).size).toBe(4);
  expect(state.items.every((item) => item.status === 'draft')).toBe(true);
  expect(state.errors).toEqual([]);
});

test('export category and course filters update labels counts and downloaded JSON', async ({ page }) => {
  const state = await fixture(page);
  const panel = await openExport(page);
  await expect(panel.getByRole('button', { name: '导出 JSON', exact: true })).toBeDisabled();
  await expect(panel.locator('.admin-batch-actions')).toContainText('已选 0 条');
  expect(await panel.getByRole('checkbox').evaluateAll((elements) => elements.map((element) => element.closest('label').textContent))).toEqual(expect.arrayContaining(['微生物学 [2]', '植物学 [1]', '生物化学 [1]']));
  await panel.getByLabel('筛选导出课程', { exact: true }).fill('微生物');
  await expect(panel.getByRole('checkbox')).toHaveCount(1);
  await panel.getByRole('checkbox', { name: '微生物学 [2]', exact: true }).check();
  await expect(panel.locator('.admin-batch-actions')).toContainText('已选 2 条');
  const exported = await downloadDocument(page, panel);
  expect(exported).toEqual({ version: 1, items: documentFixture.items.slice(0, 2) });
  expect(batchRequests(state, 'export')[0].body).toMatchObject({ courseCodes: ['BIO2110F'] });
  await panel.getByLabel('筛选导出课程', { exact: true }).fill('');
  await panel.getByRole('combobox', { name: '导出类别', exact: true }).selectOption('material');
  await expect(panel.getByRole('checkbox', { name: '微生物学 [1]', exact: true })).toBeVisible();
  await expect(panel.getByRole('checkbox', { name: /生物化学/ })).toHaveCount(0);
  await expect(panel.locator('.admin-batch-actions')).toContainText('已选 0 条');
  await panel.getByRole('button', { name: '选择全部', exact: true }).click();
  await expect(panel.locator('.admin-batch-actions')).toContainText('已选 2 条');
  const materials = await downloadDocument(page, panel);
  expect(materials).toEqual({ version: 1, items: documentFixture.items.filter((item) => item.type === 'material') });
  expect(batchRequests(state, 'export')[1].body).toEqual({ type: 'material', courseCodes: ['BIO2110F', 'BIO2019F'] });
  expect(batchRequests(state, 'catalog').some((request) => request.type === 'material')).toBe(true);
  await panel.getByRole('button', { name: '清空选择', exact: true }).click();
  await expect(panel.getByRole('button', { name: '导出 JSON', exact: true })).toBeDisabled();
  await expect(panel.locator('.admin-batch-actions')).toContainText('已选 0 条');
  expect(batchRequests(state, 'import')).toEqual([]);
  expect(state.errors).toEqual([]);
});

test('in-flight import locks duplicate submits file changes and navigation', async ({ page }) => {
  const state = await fixture(page);
  state.holdImport = true;
  const panel = await openImport(page);
  await preview(panel);
  const confirm = panel.locator('.admin-primary-action').last();
  await confirm.click();
  await expect.poll(() => Boolean(state.releaseImport)).toBe(true);
  await expect(confirm).toBeDisabled();
  await expect(panel.getByLabel('选择 JSON 文件', { exact: true })).toBeDisabled();
  await expect(panel.getByRole('button', { name: '关闭', exact: true })).toBeDisabled();
  expect(await page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  })).toBe(true);
  await confirm.evaluate((button) => { button.click(); button.click(); });
  await page.locator('.admin-page__nav').getByRole('button', { name: '活动管理', exact: true }).click();
  await expect(panel).toBeVisible();
  await page.locator('.demo-topnav').getByRole('link', { name: '首页', exact: true }).click();
  await expect(page).toHaveURL(/#admin$/);
  expect(batchRequests(state, 'import')).toHaveLength(1);
  state.holdImport = false;
  state.releaseImport();
  await expect.poll(() => state.items.length).toBe(4);
  expect(state.errors).toEqual([]);
});

for (const mode of ['light', 'dark']) {
  test(`desktop ${mode} batch tools fit the shared theme without overflow`, async ({ page }) => {
    const state = await fixture(page);
    const panel = await openImport(page);
    if ((await page.locator('html').getAttribute('data-theme') === 'dark') !== (mode === 'dark')) await page.locator('.theme-switch').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
    await expect(page.locator('html')).not.toHaveClass(/theme-transitioning/);
    await preview(panel);
    await expect(panel.getByRole('button', { name: '确认生成草稿', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `project-checks/artifacts/admin-content-batch-import-${mode}.png`, fullPage: true, animations: 'disabled' });
    page.once('dialog', (dialog) => dialog.accept());
    await panel.getByRole('button', { name: '关闭', exact: true }).click();
    await page.getByRole('button', { name: '批量导出', exact: true }).click();
    const exporter = page.getByRole('region', { name: '批量导出', exact: true });
    await expect(exporter.getByRole('checkbox', { name: '微生物学 [2]', exact: true })).toBeVisible();
    await exporter.getByRole('button', { name: '选择全部', exact: true }).click();
    await expect(exporter.getByRole('button', { name: '导出 JSON', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `project-checks/artifacts/admin-content-batch-export-${mode}.png`, fullPage: true, animations: 'disabled' });
    expect(batchRequests(state, 'import')).toEqual([]);
    expect(state.errors).toEqual([]);
  });
}
