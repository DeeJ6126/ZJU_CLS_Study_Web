import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test.use({ viewport: { width: 1440, height: 1000 } });
test.setTimeout(90_000);

const catalog = JSON.parse(readFileSync(new URL('../../../public/content/activities/catalog.json', import.meta.url), 'utf8'));
const guest = { id: 'guest', role: 'guest', nickname: '游客', verifications: { email: false } };
const student = { id: 'theme-student', publicId: 'theme-student', nickname: '视觉测试学生', role: 'student', email: '324***@zju.edu.cn', verifications: { email: true }, grade: '2025' };
const notice = { id: 'theme-notice', title: '测试通知：学业交流报名', summary: '仅供浏览器视觉验证，不会发布或修改真实通知。', category: 'general', publisher: '测试单位', status: 'published', pinned: true, publishedDate: '2026-10-01', deadline: '2080-10-01T15:59:00.000Z', majorIds: ['biology'], cohortYears: [2025], sourceUrl: 'https://www.zju.edu.cn/', body: '## 材料要求\n\n请核对**个人信息**。\n\n| 项目 | 要求 |\n| --- | --- |\n| 姓名 | 真实姓名 |\n\n> 此内容仅供测试。', attachments: [{ id: 'theme-file', fileName: '测试材料.pdf', size: 2048, mimeType: 'application/pdf', url: '/zjubio/api/notices/theme-notice/attachments/theme-file' }] };

async function fixture(page, { role = 'guest', mentor = false, consultationOpen = false, activityFallback = false } = {}) {
  const errors = [];
  const writes = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const user = role === 'guest' ? guest : { ...student, role };
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/zjubio/, '');
    if (!['GET', 'HEAD'].includes(request.method())) {
      writes.push({ method: request.method(), path });
      await route.fulfill({ status: 405, contentType: 'application/json', body: JSON.stringify({ message: 'Read-only visual fixture' }) });
      return;
    }
    if (activityFallback && path === '/api/activities') {
      await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
      return;
    }
    let payload = { items: [], total: 0, activities: catalog.articles, homepages: [], courses: [], courseCodes: [], favorites: [], notifications: [], submissions: [], logs: [], collections: [], recent: null };
    if (path === '/api/auth/me') payload = { user };
    if (path === '/api/account/profile') payload = { user, posts: [], submissions: [], comments: [] };
    if (path.startsWith('/api/profiles/')) payload = { profile: student, posts: [] };
    if (path === '/api/account/courses') payload = { courses: [{ courseCode: 'BIO2110F', courseName: '微生物学（甲）', catalogMatched: true }], initialized: true };
    if (path === '/api/notices' || path === '/api/admin/notices') payload = { items: [notice], total: 1 };
    if (path === '/api/notices/theme-notice' || path === '/api/admin/notices/theme-notice') payload = { notice };
    if (path === '/api/consultation/status') payload = { open: consultationOpen, isMentor: mentor, mentor: { nickname: '测试指导学长' }, session: { endsAt: '2080-10-01T15:59:00.000Z' } };
    if (path === '/api/consultation/conversations/current') payload = { conversation: { id: 'theme-conversation', participantName: '视觉测试学生' } };
    if (path === '/api/consultation/conversations') payload = { conversations: [{ id: 'theme-conversation', participantName: '视觉测试学生', unreadCount: 2, latestMessage: { text: '请问如何选择课程？' } }] };
    if (path.endsWith('/messages')) payload = { messages: [{ id: 'message-1', sender: 'visitor', text: '请问如何选择课程？', createdAt: '2026-10-02T03:00:00.000Z' }, { id: 'message-2', sender: 'mentor', text: '可以结合培养方案与个人兴趣进行安排。', createdAt: '2026-10-02T03:01:00.000Z' }] };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
  });
  return { errors, writes };
}

async function theme(page, mode) {
  await expect(page.locator('.theme-switch')).toBeVisible();
  if ((await page.locator('html').getAttribute('data-theme') === 'dark') !== (mode === 'dark')) await page.locator('.theme-switch').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
}

async function checkView(page, name, textSelector) {
  const metrics = await page.evaluate((selector) => {
    const parse = (color) => color.match(/[\d.]+/g)?.map(Number) ?? [];
    const luminance = (rgb) => rgb.slice(0, 3).map((value) => value / 255).map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((total, value, index) => total + value * [.2126, .7152, .0722][index], 0);
    const samples = [...document.querySelectorAll(selector)].filter((element) => element.getBoundingClientRect().width && element.textContent.trim()).map((element) => {
      const color = parse(getComputedStyle(element).color);
      let background = element;
      while (background && (parse(getComputedStyle(background).backgroundColor)[3] ?? 1) === 0) background = background.parentElement;
      const bg = parse(getComputedStyle(background ?? document.body).backgroundColor);
      const values = [luminance(color), luminance(bg)].sort((a, b) => b - a);
      return { text: element.textContent.trim().slice(0, 45), contrast: (values[0] + .05) / (values[1] + .05) };
    });
    return { width: document.documentElement.scrollWidth, viewport: innerWidth, samples };
  }, textSelector);
  expect(metrics.width, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.viewport + 1);
  expect(metrics.samples.length).toBeGreaterThan(0);
  for (const sample of metrics.samples) expect(sample.contrast, `${name}: ${sample.text}`).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({ path: `project-checks/artifacts/secondary-${name}.png`, fullPage: true });
}

test('about sections and source-backed activities remain readable in desktop light and dark themes', async ({ page }) => {
  const state = await fixture(page, { activityFallback: true });
  for (const mode of ['light', 'dark']) {
    await page.goto('/#about?section=about-us');
    await theme(page, mode);
    await expect(page.locator('.about-page__body')).not.toBeEmpty();
    await checkView(page, `about-us-${mode}`, '.about-page__body p, .about-page__body h2');
    await page.locator('.about-nav__item').filter({ hasText: '关于网站' }).click();
    await expect(page.locator('.about-page__body table')).toHaveCount(2);
    await expect(page.locator('.about-page__body table').first()).toBeVisible();
    await checkView(page, `about-site-${mode}`, '.about-page__body p, .about-page__body td');
    await page.locator('.about-nav__item').filter({ hasText: '贡献者' }).click();
    await expect(page.locator('.about-nav__item').filter({ hasText: '贡献者' })).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.about-page__head h1')).toHaveText('关于生科智学');
    await expect(page.locator('.about-page__status')).toHaveCount(0);
    await expect(page.locator('.about-contributor strong')).toHaveText(['DeeJ6126', 'somnis7', 'serashikan']);
    await page.goto('/#activities');
    await expect(page.locator('.activity-program')).toHaveCount(5);
    await expect(page.locator('.activity-directory__list a').first()).toBeVisible();
    await expect(page.locator('.activity-program__intro figure img')).toHaveCount(5);
    for (const image of await page.locator('.activities-page img').all()) {
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((element) => element.complete && element.naturalWidth > 0), { timeout: 15_000 }).toBe(true);
    }
    await checkView(page, `activities-${mode}`, '.activity-program__intro p, .activity-directory__list strong');
    await page.goto('/#activity/laboratory-open-day');
    await expect(page.locator('.activity-detail-page__articles li')).not.toHaveCount(0);
    await expect.poll(() => page.locator('.activity-detail-page__hero img').evaluate((image) => image.complete && image.naturalWidth > 0), { timeout: 15_000 }).toBe(true);
    await checkView(page, `activity-detail-${mode}`, '.activity-detail-page__head p, .activity-detail-page__articles strong');
  }
  expect(state.errors).toEqual([]);
  expect(state.writes).toEqual([]);
});

test('account menu and all auth modes keep desktop dialogs centered in both themes', async ({ page }) => {
  const state = await fixture(page);
  for (const mode of ['light', 'dark']) {
    await page.goto('/#about');
    await theme(page, mode);
    await page.locator('.demo-user-chip').click();
    expect(state.errors).toEqual([]);
    await expect(page.locator('.account-popover')).toBeVisible();
    await checkView(page, `account-menu-${mode}`, '.account-popover dd, .account-popover button');
    await page.locator('.account-popover').getByRole('button', { name: '登录', exact: true }).click();
    for (const authMode of ['login', 'reset', 'register']) {
      if (authMode === 'reset') await page.getByRole('button', { name: '忘记密码', exact: true }).click();
      if (authMode === 'register') {
        await page.getByRole('button', { name: '关闭登录对话框' }).click();
        await page.locator('.demo-user-chip').click();
        await page.locator('.account-popover').getByRole('button', { name: '学号认证注册', exact: true }).click();
      }
      await expect(page.locator('.auth-dialog')).toBeVisible();
      const position = await page.locator('.auth-dialog').evaluate((element) => { const rect = element.getBoundingClientRect(); return { x: Math.abs(rect.x + rect.width / 2 - innerWidth / 2), y: Math.abs(rect.y + rect.height / 2 - innerHeight / 2) }; });
      expect(position.x).toBeLessThan(2);
      expect(position.y).toBeLessThan(2);
      await checkView(page, `auth-${authMode}-${mode}`, '.auth-dialog label span:not(.auth-dialog__email-field), .auth-dialog button');
    }
    await page.getByRole('button', { name: '关闭登录对话框' }).click();
  }
  expect(state.errors).toEqual([]);
  expect(state.writes).toEqual([]);
});

test('owner profile sections remain usable without API writes in both themes', async ({ page }) => {
  const state = await fixture(page, { role: 'student' });
  for (const mode of ['light', 'dark']) {
    await page.goto('/#profile/theme-student');
    await theme(page, mode);
    await page.locator('.profile-sidebar').getByRole('button', { name: '账号资料', exact: true }).click();
    await expect(page.locator('.profile-identity h1')).toHaveText(student.nickname);
    await checkView(page, `profile-${mode}`, '.profile-identity p, .profile-nickname-form label, .profile-grade-form button');
    for (const label of ['我的课程', '我的收藏', '我的帖子', '我的评论']) {
      await page.locator('.profile-sidebar').getByRole('button', { name: label, exact: true }).click();
      await checkView(page, `profile-${label}-${mode}`, '.profile-management h1, .profile-posts h2');
    }
  }
  expect(state.errors).toEqual([]);
  expect(state.writes).toEqual([]);
});

test('public and admin notices show safe readable details and previews in both themes', async ({ page }) => {
  const state = await fixture(page, { role: 'admin' });
  for (const mode of ['light', 'dark']) {
    await page.goto('/#notices');
    await theme(page, mode);
    await expect(page.locator('.notice-list-item')).toHaveCount(1);
    await checkView(page, `notices-${mode}`, '.notice-list-item__summary, .notice-labels span');
    await page.getByRole('link', { name: notice.title, exact: true }).click();
    await expect(page.locator('.notice-body table')).toBeVisible();
    await expect(page.locator('.notice-attachments li')).toHaveCount(1);
    await checkView(page, `notice-detail-${mode}`, '.notice-detail__facts dd, .notice-body p, .notice-attachment-download');
    await page.goto('/#admin');
    await page.locator('.admin-page__nav').getByRole('button', { name: '通知', exact: true }).click();
    await expect(page.locator('.notice-admin__row')).toHaveCount(1);
    await checkView(page, `notice-admin-list-${mode}`, '.notice-admin__row strong, .notice-admin__status');
    await page.locator('.notice-admin__row').getByRole('button', { name: '编辑', exact: true }).click();
    await page.getByRole('tab', { name: '预览', exact: true }).click();
    await expect(page.locator('.notice-admin__preview')).toContainText(notice.title);
    await checkView(page, `notice-admin-preview-${mode}`, '.notice-admin__preview p, .notice-admin__fields label');
  }
  expect(state.errors).toEqual([]);
  expect(state.writes).toEqual([]);
});

for (const mentor of [false, true]) test(`consultation ${mentor ? 'mentor inbox' : 'visitor chat'} stays readable in both themes`, async ({ page }) => {
  const state = await fixture(page, { role: 'student', consultationOpen: true, mentor });
  for (const mode of ['light', 'dark']) {
    await page.goto('/#consultation');
    await theme(page, mode);
    await expect(page.locator('.consultation-bubble')).toHaveCount(2);
    await checkView(page, `consultation-${mentor ? 'mentor' : 'visitor'}-${mode}`, '.consultation-bubble, .consultation-chat-header p');
    await page.getByRole('textbox', { name: '咨询消息', exact: true }).fill('仅输入，不发送');
    await expect(page.getByRole('button', { name: '发送', exact: true })).toBeEnabled();
  }
  expect(state.errors).toEqual([]);
  expect(state.writes).toEqual([]);
});
