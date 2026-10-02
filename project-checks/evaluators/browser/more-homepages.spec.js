import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test.use({ viewport: { width: 1440, height: 1000 } });
test.setTimeout(60_000);
const guest = { id: 'guest', role: 'guest', nickname: '游客', verifications: { email: false } };
const student = { id: 'more-student', publicId: 'more-student', role: 'student', nickname: '主页同学', verifications: { email: true } };
const dee = { id: 'dee', name: 'Dee', href: 'https://deej6126.github.io/', avatarUrl: '/zjubio/resource/homepages/dee.png', status: 'approved' };
const avatar = readFileSync(new URL('../../../public/resource/homepages/dee.png', import.meta.url));

async function fixture(page, role = 'guest') {
  const errors = [], writes = [];
  const homepages = [dee, { id: 'empty-1', name: '待收录 · 01', href: '', avatarUrl: '', status: 'approved' }];
  let applications = [], failRead = false, failSubmission = false;
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/**', async (route) => {
    const request = route.request(), path = new URL(request.url()).pathname.replace(/^\/zjubio/, '');
    const method = request.method();
    const user = role === 'guest' ? guest : { ...student, role };
    let payload = { items: [], activities: [], courses: [], initialized: true, submissions: [], notifications: [], homepages: [], applications: [] };
    if (method !== 'GET') writes.push({ path, method, body: request.postDataJSON() });
    if (path === '/api/auth/me') payload = { user };
    if (path === '/api/consultation/status') payload = { open: false, isMentor: false };
    if (path === '/api/quiz/recent') payload = { recent: null };
    if (path === '/api/student-homepages') {
      if (failRead) { failRead = false; await route.fulfill({ status: 503, json: { message: '测试读取失败' } }); return; }
      payload = { homepages };
    }
    if (path === '/api/student-homepages/applications' && method === 'POST') {
      if (failSubmission) { failSubmission = false; await route.fulfill({ status: 503, json: { message: '测试投稿失败' } }); return; }
      const application = { id: 'pending-homepage', ...request.postDataJSON(), status: 'pending', applicantNickname: student.nickname };
      applications.push(application); payload = { application };
    }
    if (path === '/api/admin/student-homepages') {
      if (method === 'POST') { const homepage = { id: 'manual-homepage', ...request.postDataJSON() }; homepages.push(homepage); payload = { homepage }; }
      else payload = { homepages };
    }
    if (path === '/api/admin/student-homepages/applications') payload = { applications };
    if (/\/applications\/[^/]+\/(approve|reject)$/.test(path) && method === 'POST') {
      const application = applications.find((item) => item.id === path.split('/').at(-2));
      application.status = path.endsWith('/approve') ? 'approved' : 'rejected';
      if (application.status === 'approved') homepages.push({ ...application, id: 'approved-homepage' });
      payload = { application };
    }
    await route.fulfill({ json: payload });
  });
  return { errors, writes, applications, setRole: (value) => { role = value; }, failRead: () => { failRead = true; }, failSubmission: () => { failSubmission = true; } };
}

test('guest reads external homepages in More, retries failures and uses the shared login entry', async ({ page }) => {
  const state = await fixture(page);
  state.failRead();
  await page.goto('/');
  const labels = await page.locator('.demo-topnav a').allTextContents();
  expect(labels.indexOf('更多')).toBe(labels.indexOf('关于') + 1);
  await page.locator('.demo-topnav').getByRole('link', { name: '更多', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('测试读取失败');
  await page.getByRole('button', { name: '重试', exact: true }).click();
  const link = page.locator('a.more-homepage-row');
  await expect(link).toHaveAttribute('href', dee.href);
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  await expect.poll(() => link.locator('img').evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(page.locator('.more-homepage-row.is-placeholder')).toHaveCount(1);
  for (const mode of ['light', 'dark']) {
    if ((await page.locator('html').getAttribute('data-theme') === 'dark') !== (mode === 'dark')) await page.locator('.theme-switch').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `project-checks/artifacts/more-homepages-${mode}.png`, fullPage: true });
  }
  await page.reload();
  await expect(link).toBeVisible();
  await page.getByRole('button', { name: '投稿', exact: true }).click();
  await expect(page.locator('.auth-dialog')).toBeVisible();
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

test('student submits only name avatar and link; More admin manages and reviews the same records', async ({ page }) => {
  const state = await fixture(page, 'student');
  await page.goto('/#more');
  await page.getByRole('button', { name: '投稿', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '投稿同学主页', exact: true });
  await expect(dialog.getByRole('textbox', { name: '名称', exact: true })).toBeFocused();
  await dialog.getByRole('textbox', { name: '名称', exact: true }).fill('提交测试');
  await dialog.getByLabel('头像', { exact: true }).setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: avatar });
  await expect(dialog.getByAltText('头像预览')).toBeVisible();
  await dialog.getByRole('textbox', { name: '主页链接', exact: true }).fill('https://example.org/student');
  state.failSubmission();
  await dialog.getByRole('button', { name: '提交审核', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('测试投稿失败');
  await expect(dialog.getByRole('textbox', { name: '名称', exact: true })).toHaveValue('提交测试');
  await dialog.getByRole('button', { name: '提交审核', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('审核通过');
  expect(Object.keys(state.writes.at(-1).body).sort()).toEqual(['avatarUrl', 'href', 'name']);
  expect(state.writes.at(-1).body.avatarUrl).toMatch(/^data:image\/webp;base64,/);
  await expect(page.locator('.more-homepage-row')).toHaveCount(2);
  state.setRole('admin');
  await page.goto('/#admin'); await page.reload();
  const nav = page.locator('.admin-page__nav');
  await expect(nav.getByRole('button', { name: '同学主页', exact: true })).toHaveCount(0);
  await nav.getByRole('button', { name: '更多', exact: true }).click();
  await expect(page.getByRole('tab', { name: '同学主页', exact: true })).toBeVisible();
  const pending = page.locator('.admin-homepage-row').filter({ hasText: '提交测试' });
  page.once('dialog', (dialog) => dialog.accept());
  await pending.getByRole('button', { name: '通过', exact: true }).click();
  await expect(page.locator('.admin-notice')).toContainText('投稿已通过');
  await page.getByRole('button', { name: '新增主页', exact: true }).click();
  const form = page.locator('.admin-editor');
  await form.getByRole('textbox', { name: '名称', exact: true }).fill('管理员新增');
  await form.getByRole('textbox', { name: '主页链接', exact: true }).fill('https://example.org/admin');
  await form.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('.admin-homepage-row').filter({ hasText: '管理员新增' })).toBeVisible();
  state.applications.push({ id: 'reject-me', name: '拒绝测试', href: 'https://example.org/reject', avatarUrl: dee.avatarUrl, status: 'pending' });
  await page.goto('/#more');
  await page.goto('/#admin');
  await nav.getByRole('button', { name: '更多', exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('.admin-homepage-row').filter({ hasText: '拒绝测试' }).getByRole('button', { name: '拒绝', exact: true }).click();
  await expect(page.locator('.admin-notice')).toContainText('投稿已拒绝');
  await page.goto('/#more');
  await expect(page.locator('.more-homepage-row')).toHaveCount(4);
  await expect(page.locator('.more-homepage-row').filter({ hasText: '提交测试' })).toBeVisible();
  await expect(page.locator('.more-homepage-row').filter({ hasText: '拒绝测试' })).toHaveCount(0);
  expect(state.errors).toEqual([]);
});
