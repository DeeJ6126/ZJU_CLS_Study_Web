import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 1000 } });

const admin = {
  id: 9, publicId: 'entry-admin', role: 'admin', nickname: '录入管理员',
  verifications: { email: true },
};
const copy = (value) => JSON.parse(JSON.stringify(value));

async function fixture(page) {
  const state = {
    items: [], writes: [], errors: [], publishFailures: 0, uploadFailures: 0,
    loseCreateResponse: false, version: 0,
  };
  const stamp = () => `2026-10-09T00:00:${String(++state.version).padStart(2, '0')}.000Z`;
  page.on('pageerror', (error) => state.errors.push(error.message));
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/zjubio/, '');
    const method = request.method();
    const body = request.headers()['content-type']?.includes('application/json') ? request.postDataJSON() : null;
    if (method !== 'GET') state.writes.push({ path, method, body });
    let payload = {
      items: [], activities: [], courses: [], initialized: true, submissions: [], notifications: [],
      homepages: [], applications: [], favorites: [], pendingCount: 0, unreadCount: 0,
    };
    if (path === '/api/auth/me') payload = { user: admin };
    if (path === '/api/consultation/status') payload = { open: false, isMentor: false };
    if (path === '/api/quiz/recent') payload = { recent: null };
    if (path.startsWith('/api/content/courses/') && method === 'GET') {
      const courseCode = decodeURIComponent(path.split('/').at(-1));
      payload = { items: state.items.filter((item) => item.courseCode === courseCode && item.status === 'published') };
    }
    if (path === '/api/admin/content' && method === 'GET') {
      payload = { items: state.items.filter((item) => ['courseCode', 'type', 'status'].every((key) => !url.searchParams.get(key) || item[key] === url.searchParams.get(key))) };
    }
    if (path === '/api/admin/content' && method === 'POST') {
      const previous = state.items.find((item) => item.requestId === body.requestId);
      const createdAt = previous?.createdAt ?? stamp();
      const item = previous ?? {
        ...copy(body), id: `entry-${state.items.length + 1}`, routeId: `entry-${state.items.length + 1}`,
        status: 'draft', file: null, ownerId: null, createdBy: admin.id, updatedBy: admin.id,
        createdAt, updatedAt: createdAt,
      };
      if (!previous) state.items.push(item);
      if (state.loseCreateResponse) {
        state.loseCreateResponse = false;
        await route.abort('failed');
        return;
      }
      await route.fulfill({ status: previous ? 200 : 201, json: { item, ...(previous ? { replayed: true } : {}) } });
      return;
    }
    const match = path.match(/^\/api\/admin\/content\/([^/]+)(?:\/(publish|file))?$/);
    if (match && method !== 'GET') {
      const item = state.items.find((entry) => entry.id === match[1]);
      if (!item) { await route.fulfill({ status: 404, json: { message: '测试内容不存在' } }); return; }
      if (match[2] === 'publish' && state.publishFailures > 0) {
        state.publishFailures -= 1;
        await route.fulfill({ status: 503, json: { message: '测试发布失败' } });
        return;
      }
      if (match[2] === 'file' && state.uploadFailures > 0) {
        state.uploadFailures -= 1;
        await route.fulfill({ status: 503, json: { message: '测试上传失败' } });
        return;
      }
      if (method === 'PATCH') {
        if (body.expectedUpdatedAt !== item.updatedAt) {
          await route.fulfill({ status: 409, json: { message: '测试内容版本冲突' } });
          return;
        }
        Object.assign(item, body);
        delete item.expectedUpdatedAt;
      }
      if (match[2] === 'publish') item.status = 'published';
      if (match[2] === 'file') item.file = {
        fileName: decodeURIComponent(request.headers()['x-file-name']), mimeType: 'application/pdf',
        size: request.postDataBuffer().length, url: `/zjubio/api/content/files/${item.id}`,
      };
      item.updatedAt = stamp();
      payload = { item };
    }
    await route.fulfill({ json: payload });
  });
  return state;
}

async function newEntry(page, type = 'experience') {
  await page.goto('/#admin');
  await page.getByRole('button', { name: '新增内容', exact: true }).click();
  const editor = page.getByRole('region', { name: '内容编辑器', exact: true });
  await editor.locator('.admin-course-combobox input').fill('BIO2110F');
  await editor.getByRole('option').filter({ hasText: 'BIO2110F' }).click();
  await editor.getByRole('combobox', { name: '内容类型', exact: true }).selectOption(type);
  await editor.getByLabel('标题', { exact: true }).fill('人工导入测试');
  await editor.getByLabel('作者或整理者', { exact: true }).fill('原帖作者');
  await editor.getByRole('combobox', { name: '来源平台', exact: true }).selectOption('duoduo');
  await editor.getByLabel('原帖链接（选填）', { exact: true }).fill('https://forum.example/topic/1');
  if (type !== 'paper') await editor.locator('textarea').last().fill('第一条论坛心得正文。');
  return editor;
}

const createWrites = (state) => state.writes.filter((write) => write.path === '/api/admin/content' && write.method === 'POST');
const publishWrites = (state) => state.writes.filter((write) => write.path.endsWith('/publish'));

test('publish and next retains course type and source platform while clearing per-entry data', async ({ page }) => {
  const state = await fixture(page);
  const editor = await newEntry(page);
  await editor.getByLabel('摘要', { exact: true }).fill('第一条摘要');
  await editor.getByRole('combobox', { name: '老师姓名（选填）', exact: true }).fill('测试老师');
  await editor.getByLabel('绩点（选填）', { exact: true }).fill('4.20');
  await editor.getByRole('button', { name: '发布并录入下一条', exact: true }).click();
  await expect(page.locator('.admin-notice')).toContainText('已发布，可以录入下一条');
  await expect(editor).toBeVisible();
  await expect(editor.locator('.admin-course-combobox input')).toHaveValue(/BIO2110F/);
  await expect(editor.getByRole('combobox', { name: '内容类型', exact: true })).toHaveValue('experience');
  await expect(editor.getByRole('combobox', { name: '来源平台', exact: true })).toHaveValue('duoduo');
  for (const name of ['标题', '摘要', '作者或整理者', '原帖链接（选填）', '绩点（选填）']) {
    await expect(editor.getByLabel(name, { exact: true })).toHaveValue('');
  }
  await expect(editor.getByRole('combobox', { name: '老师姓名（选填）', exact: true })).toHaveValue('');
  await expect(editor.locator('textarea').last()).toHaveValue('');
  expect(state.items).toHaveLength(1);
  expect(state.items[0]).toMatchObject({ status: 'published', author: '原帖作者', sourcePlatform: 'duoduo', cc98Url: '' });
  expect(createWrites(state)).toHaveLength(1);
  expect(state.errors).toEqual([]);
});

test('immediate reload preserves an unsent draft and restores every populated field', async ({ page }) => {
  const state = await fixture(page);
  const editor = await newEntry(page);
  await editor.locator('textarea').last().fill('立即刷新前的最后一笔修改。');
  await page.reload();
  const drafts = page.getByRole('region', { name: '本机未完成草稿', exact: true });
  await expect(drafts).toContainText('人工导入测试');
  await drafts.getByRole('button', { name: '继续录入', exact: true }).click();
  await expect(editor.getByLabel('标题', { exact: true })).toHaveValue('人工导入测试');
  await expect(editor.getByLabel('作者或整理者', { exact: true })).toHaveValue('原帖作者');
  await expect(editor.getByRole('combobox', { name: '来源平台', exact: true })).toHaveValue('duoduo');
  await expect(editor.getByLabel('原帖链接（选填）', { exact: true })).toHaveValue('https://forum.example/topic/1');
  await expect(editor.locator('textarea').last()).toHaveValue('立即刷新前的最后一笔修改。');
  await expect(editor.locator('.admin-course-combobox input')).toHaveValue(/BIO2110F/);
  expect(createWrites(state)).toHaveLength(0);
  expect(state.errors).toEqual([]);
});

test('publication failure retains input and retries by updating the created content ID', async ({ page }) => {
  const state = await fixture(page);
  state.publishFailures = 1;
  const editor = await newEntry(page);
  await editor.getByRole('button', { name: '发布并录入下一条', exact: true }).click();
  await expect(page.locator('.admin-notice')).toContainText('测试发布失败');
  await expect(editor.getByLabel('标题', { exact: true })).toHaveValue('人工导入测试');
  await expect(editor.locator('textarea').last()).toHaveValue('第一条论坛心得正文。');
  expect(createWrites(state)).toHaveLength(1);
  await editor.locator('textarea').last().fill('保留正文并补充核对结果。');
  await editor.getByRole('button', { name: '发布并录入下一条', exact: true }).click();
  await expect(page.locator('.admin-notice')).toContainText('已发布，可以录入下一条');
  expect(createWrites(state)).toHaveLength(1);
  expect(publishWrites(state).map((write) => write.path)).toEqual(['/api/admin/content/entry-1/publish', '/api/admin/content/entry-1/publish']);
  expect(state.items).toHaveLength(1);
  expect(state.items[0]).toMatchObject({ status: 'published', body: '保留正文并补充核对结果。' });
  expect(state.errors).toEqual([]);
});

test('failed PDF upload preserves the created ID across reload before publication retry', async ({ page }) => {
  const state = await fixture(page);
  state.uploadFailures = 1;
  const editor = await newEntry(page, 'paper');
  const pdf = { name: 'forum-paper.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\ntest\n%%EOF') };
  await editor.getByLabel('学年', { exact: true }).fill('2025-2026');
  await editor.locator('.admin-file-field input[type="file"]').setInputFiles(pdf);
  await editor.getByRole('button', { name: '发布', exact: true }).click();
  await expect(page.locator('.admin-notice')).toContainText('测试上传失败');
  expect(createWrites(state)).toHaveLength(1);
  expect(publishWrites(state)).toHaveLength(0);
  await page.reload();
  await page.getByRole('region', { name: '本机未完成草稿', exact: true }).getByRole('button', { name: '继续录入', exact: true }).click();
  await expect(editor.getByLabel('标题', { exact: true })).toHaveValue('人工导入测试');
  await expect(editor.getByRole('combobox', { name: '内容类型', exact: true })).toBeDisabled();
  await expect(editor.locator('.admin-file-field')).toContainText('请重新选择：forum-paper.pdf');
  await editor.locator('.admin-file-field input[type="file"]').setInputFiles(pdf);
  await editor.getByRole('button', { name: '发布', exact: true }).click();
  await expect(page.locator('.admin-notice')).toContainText('内容已发布');
  expect(createWrites(state)).toHaveLength(1);
  expect(state.items).toHaveLength(1);
  expect(state.items[0]).toMatchObject({ status: 'published', file: { fileName: 'forum-paper.pdf' } });
  expect(state.writes.filter((write) => write.method === 'PUT').map((write) => write.path)).toEqual(['/api/admin/content/entry-1/file', '/api/admin/content/entry-1/file']);
  expect(state.errors).toEqual([]);
});

test('a lost create response reuses its request token and updates the returned record before publishing', async ({ page }) => {
  const state = await fixture(page);
  state.loseCreateResponse = true;
  const editor = await newEntry(page);
  await editor.getByRole('button', { name: '发布', exact: true }).click();
  await expect(page.locator('.admin-notice')).toContainText('管理服务暂时无法连接');
  await editor.locator('textarea').last().fill('响应丢失后继续补充的正文。');
  await editor.getByRole('button', { name: '发布', exact: true }).click();
  await expect(page.locator('.admin-notice')).toContainText('内容已发布');
  const writes = createWrites(state);
  expect(writes).toHaveLength(2);
  expect(writes[0].body.requestId).toBe(writes[1].body.requestId);
  expect(state.items).toHaveLength(1);
  expect(state.items[0]).toMatchObject({ status: 'published', body: '响应丢失后继续补充的正文。' });
  expect(state.errors).toEqual([]);
});

test('public article sources preserve imported authors and distinguish generic links from legacy CC98 icons', async ({ page }) => {
  const state = await fixture(page);
  state.items.push(
    {
      id: 'imported-duoduo', routeId: 'duoduo-source', courseCode: 'BIO2110F', type: 'experience',
      title: '朵朵心得', author: '朵朵原作者', body: '原论坛心得正文。', status: 'published',
      sourcePlatform: 'duoduo', sourceUrl: 'https://forum.example/original/2', cc98Url: '', owner: null,
    },
    {
      id: 'imported-legacy', routeId: 'cc98-source', courseCode: 'BIO2110F', type: 'experience',
      title: '旧 CC98 心得', author: 'CC98 原作者', body: '旧心得正文。', status: 'published',
      cc98Url: 'https://www.cc98.org/topic/123/1#2', owner: null,
    },
  );
  await page.goto('/#resources/#BIO2110F/#experiences/#duoduo-source');
  const articleAuthor = page.locator('.article-detail-card__author');
  await expect(articleAuthor.locator('strong')).toHaveText('朵朵原作者');
  await expect(articleAuthor).not.toContainText(admin.nickname);
  const source = articleAuthor.getByRole('link', { name: '查看作者的朵朵帖子', exact: true });
  await expect(source).toHaveAttribute('href', 'https://forum.example/original/2');
  await expect(source).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(source.locator('svg')).toHaveCount(1);
  await expect(source.locator('img.cc98-icon')).toHaveCount(0);
  await page.goto('/#resources/#BIO2110F/#experiences/#cc98-source');
  await expect(articleAuthor.locator('strong')).toHaveText('CC98 原作者');
  await expect(articleAuthor).not.toContainText(admin.nickname);
  const legacySource = articleAuthor.getByRole('link', { name: '查看作者的 CC98 帖子', exact: true });
  await expect(legacySource).toHaveAttribute('href', 'https://www.cc98.org/topic/123/1#2');
  await expect(legacySource.locator('img.cc98-icon')).toBeVisible();
  await expect(legacySource.locator('svg')).toHaveCount(0);
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

test('canceling a replay overwrite confirmation retains input and requires confirmation again', async ({ page }) => {
  const state = await fixture(page);
  state.loseCreateResponse = true;
  const editor = await newEntry(page);
  await editor.getByRole('button', { name: '发布', exact: true }).click();
  await expect(page.locator('.admin-notice')).toContainText('管理服务暂时无法连接');
  Object.assign(state.items[0], { body: '另一位管理员已校正的正文。', updatedAt: '2026-10-09T00:01:00.000Z' });
  await editor.locator('textarea').last().fill('当前管理员仍未提交的正文。');
  const confirmations = [];
  page.on('dialog', async (dialog) => { confirmations.push(dialog.message()); await dialog.dismiss(); });
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await editor.getByRole('button', { name: '发布', exact: true }).click();
    await expect.poll(() => confirmations.length).toBe(attempt);
    await expect(page.locator('.admin-notice')).toContainText('已保留当前输入，请核对服务器内容后再继续');
    await expect(editor.locator('textarea').last()).toHaveValue('当前管理员仍未提交的正文。');
    await expect(editor.getByLabel('标题', { exact: true })).toHaveValue('人工导入测试');
    await expect(editor.getByRole('combobox', { name: '内容类型', exact: true })).toBeEnabled();
  }
  expect(confirmations.every((message) => message.includes('服务器内容已有后续更新'))).toBe(true);
  expect(state.writes.filter((write) => write.method === 'PATCH')).toEqual([]);
  expect(publishWrites(state)).toEqual([]);
  expect(createWrites(state)).toHaveLength(3);
  expect(new Set(createWrites(state).map((write) => write.body.requestId)).size).toBe(1);
  expect(state.items).toHaveLength(1);
  expect(state.items[0]).toMatchObject({ status: 'draft', body: '另一位管理员已校正的正文。' });
  expect(state.errors).toEqual([]);
});
