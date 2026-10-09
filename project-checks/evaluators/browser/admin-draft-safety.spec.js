import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 1000 } });

const admin = { id: 18, publicId: 'draft-safety-admin', role: 'admin', nickname: '草稿管理员', verifications: { email: true } };
const draftPrefix = 'zjubio:admin-drafts:v1:';

async function fixture(page) {
  const state = { items: [], writes: [], errors: [], holdCreate: false, releaseCreate: null, version: 0 };
  const stamp = () => `2026-10-09T02:00:${String(++state.version).padStart(2, '0')}.000Z`;
  page.on('pageerror', (error) => state.errors.push(error.message));
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/zjubio/, '');
    const method = request.method();
    const body = request.headers()['content-type']?.includes('application/json') ? request.postDataJSON() : null;
    if (method !== 'GET') state.writes.push({ path, method, body });
    let payload = { items: [], activities: [], courses: [], initialized: true, submissions: [], notifications: [], homepages: [], applications: [], favorites: [], pendingCount: 0, unreadCount: 0 };
    if (path === '/api/auth/me') payload = { user: admin };
    if (path === '/api/consultation/status') payload = { open: false, isMentor: false };
    if (path === '/api/quiz/recent') payload = { recent: null };
    if (path === '/api/admin/content' && method === 'GET') payload = { items: state.items.filter((item) => ['courseCode', 'type', 'status'].every((key) => !url.searchParams.get(key) || item[key] === url.searchParams.get(key))) };
    if (path === '/api/admin/content' && method === 'POST') {
      if (state.holdCreate) await new Promise((resolve) => { state.releaseCreate = resolve; });
      const item = { ...body, id: `safety-${state.items.length + 1}`, routeId: `safety-${state.items.length + 1}`, status: 'draft', file: null, createdAt: stamp(), updatedAt: stamp() };
      state.items.push(item);
      await route.fulfill({ status: 201, json: { item } });
      return;
    }
    const match = path.match(/^\/api\/admin\/content\/([^/]+)(?:\/(publish|file))?$/);
    if (match && method !== 'GET') {
      const item = state.items.find((entry) => entry.id === match[1]);
      if (!item) { await route.fulfill({ status: 404, json: { message: '测试内容不存在' } }); return; }
      if (match[2] === 'file' && !['paper', 'material'].includes(item.type)) {
        await route.fulfill({ status: 404, json: { message: '心得不能上传 PDF' } }); return;
      }
      if (method === 'PATCH') Object.assign(item, body);
      if (match[2] === 'publish') item.status = 'published';
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
  await editor.getByRole('textbox', { name: '标题', exact: true }).fill('草稿安全测试');
  await editor.locator('textarea').last().fill('待核对的论坛正文。');
  return editor;
}

async function localDraftCount(page) {
  return page.evaluate((prefix) => Object.keys(localStorage).filter((key) => key.startsWith(prefix))
    .reduce((count, key) => count + JSON.parse(localStorage.getItem(key)).length, 0), draftPrefix);
}

test('clearing all content removes the previously autosaved local draft', async ({ page }) => {
  const state = await fixture(page);
  const editor = await newEntry(page);
  await expect.poll(() => localDraftCount(page)).toBe(1);
  await editor.getByRole('textbox', { name: '标题', exact: true }).fill('');
  await editor.locator('textarea').last().fill('');
  await expect.poll(() => localDraftCount(page)).toBe(0);
  await editor.getByRole('button', { name: '返回列表', exact: true }).click();
  await expect(page.getByRole('region', { name: '本机未完成草稿', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: '新增内容', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: '本机未完成草稿', exact: true })).toHaveCount(0);
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

test('changing a PDF entry to experience clears the hidden file before saving', async ({ page }) => {
  const state = await fixture(page);
  const editor = await newEntry(page, 'paper');
  await editor.locator('input[type="file"]').setInputFiles({ name: 'before-switch.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\ntest\n%%EOF') });
  await expect(editor.locator('.admin-file-field')).toContainText('before-switch.pdf');
  await editor.getByRole('combobox', { name: '内容类型', exact: true }).selectOption('experience');
  await expect(editor.locator('input[type="file"]')).toHaveCount(0);
  await expect.poll(async () => page.evaluate((prefix) => Object.keys(localStorage).filter((key) => key.startsWith(prefix))
    .flatMap((key) => JSON.parse(localStorage.getItem(key))).map((draft) => draft.pendingFileName), draftPrefix)).toEqual(['']);
  await editor.getByRole('button', { name: '发布', exact: true }).click();
  await expect(page.locator('.admin-notice')).toContainText('内容已发布');
  expect(state.items).toHaveLength(1);
  expect(state.items[0]).toMatchObject({ type: 'experience', status: 'published', file: null });
  expect(state.writes.filter((write) => write.path.endsWith('/file'))).toEqual([]);
  expect(state.errors).toEqual([]);
});

test('local storage write failure reports failure and retains editable input', async ({ page }) => {
  const state = await fixture(page);
  await page.addInitScript((prefix) => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (String(key).startsWith(prefix)) throw new DOMException('Storage full', 'QuotaExceededError');
      return setItem.call(this, key, value);
    };
  }, draftPrefix);
  const editor = await newEntry(page);
  await expect(editor.locator('.admin-draft-status')).toContainText('自动保存失败');
  await expect(editor.getByRole('textbox', { name: '标题', exact: true })).toHaveValue('草稿安全测试');
  await expect(editor.locator('textarea').last()).toHaveValue('待核对的论坛正文。');
  await expect(editor.getByRole('textbox', { name: '标题', exact: true })).toBeEnabled();
  await expect.poll(() => localDraftCount(page)).toBe(0);
  await editor.locator('textarea').last().fill('存储失败后继续输入的正文。');
  await expect(editor.locator('.admin-draft-status')).toContainText('自动保存失败');
  await expect(editor.locator('textarea').last()).toHaveValue('存储失败后继续输入的正文。');
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

test('an in-flight save locks fields duplicate submits and editor navigation', async ({ page }) => {
  const state = await fixture(page);
  state.holdCreate = true;
  const editor = await newEntry(page);
  const publish = editor.getByRole('button', { name: '发布并录入下一条', exact: true });
  await publish.click();
  await expect.poll(() => Boolean(state.releaseCreate)).toBe(true);
  await expect(editor.getByRole('textbox', { name: '标题', exact: true })).toBeDisabled();
  await expect(editor.getByRole('button', { name: '关闭', exact: true })).toBeDisabled();
  await expect(editor.getByRole('button', { name: '返回列表', exact: true })).toBeDisabled();
  await expect(publish).toBeDisabled();
  await publish.evaluate((button) => { button.click(); button.click(); });
  await page.locator('.admin-page__nav').getByRole('button', { name: '活动管理', exact: true }).click();
  await expect(editor).toBeVisible();
  await page.locator('.demo-topnav').getByRole('link', { name: '首页', exact: true }).click();
  await expect(page).toHaveURL(/#admin$/);
  expect(state.writes.filter((write) => write.path === '/api/admin/content' && write.method === 'POST')).toHaveLength(1);
  state.holdCreate = false;
  state.releaseCreate();
  await expect(page.locator('.admin-notice')).toContainText('已发布，可以录入下一条');
  await expect(editor.getByRole('textbox', { name: '标题', exact: true })).toBeEnabled();
  await expect(editor.getByRole('textbox', { name: '标题', exact: true })).toHaveValue('');
  expect(state.items).toHaveLength(1);
  expect(state.errors).toEqual([]);
});

for (const mode of ['light', 'dark']) {
  test(`desktop ${mode} keeps the action bar visible during long-form entry`, async ({ page }) => {
    const state = await fixture(page);
    const editor = await newEntry(page);
    if ((await page.locator('html').getAttribute('data-theme') === 'dark') !== (mode === 'dark')) await page.locator('.theme-switch').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
    await expect(page.locator('html')).not.toHaveClass(/theme-transitioning/);
    await editor.locator('textarea').last().fill('长正文的人工录入核对。\n'.repeat(200));
    const actions = editor.locator('.admin-editor__actions');
    await actions.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -250));
    await expect(actions.getByRole('button', { name: '发布并录入下一条', exact: true })).toBeVisible();
    const geometry = await actions.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const button = element.querySelector('button[value="publish-next"]');
      const box = button.getBoundingClientRect();
      return { position: getComputedStyle(element).position, top: rect.top, bottom: rect.bottom, height: innerHeight,
        unobscured: button.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)) };
    });
    expect(geometry.position).toBe('sticky');
    expect(geometry.top).toBeGreaterThanOrEqual(0);
    expect(geometry.bottom).toBeLessThanOrEqual(geometry.height + 1);
    expect(geometry.unobscured).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `project-checks/artifacts/admin-draft-actions-${mode}.png`, animations: 'disabled' });
    expect(state.writes).toEqual([]);
    expect(state.errors).toEqual([]);
  });
}
