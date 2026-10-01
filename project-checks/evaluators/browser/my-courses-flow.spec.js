import { expect, test } from '@playwright/test';
import { loadServerCourseCatalog } from '../../../server/account/courseCatalogService.js';
import { courseListPreset } from '../../../src/services/myCourseService.js';

const { allCourses: catalog } = loadServerCourseCatalog();
const fixedNow = '2026-10-01T00:00:00+08:00';

async function fixture(page, signedIn = false) {
  const writes = [];
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let user = { id: 'courses-user', publicId: 'courses-public', nickname: '课程同学', role: 'student', majorId: 'biology', grade: 2025, verifications: { email: true } };
  const preset = () => courseListPreset({ majorId: user.majorId, cohortYear: user.grade, courses: catalog, now: fixedNow }).courses;
  let courses = preset();
  let failNext = false;
  await page.clock.setFixedTime(new Date(fixedNow));
  await page.route('**/zjubio/api/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace('/zjubio', '');
    let payload = { items: [], activities: [], homepages: [], courses: [], favorites: [], courseCodes: [], notifications: [], posts: [], submissions: [], comments: [] };
    if (req.method() !== 'GET') writes.push(path);
    if (path === '/api/auth/me') payload = { user: signedIn ? user : { id: 'guest', role: 'guest', nickname: '游客', verifications: {} } };
    if (path === '/api/consultation/status') payload = { open: false, isMentor: false };
    if (path === '/api/account/profile') payload = { ...payload, user };
    if (path === '/api/auth/logout') { signedIn = false; payload = { ok: true }; }
    if (path === '/api/account/profile/study') { user = { ...user, ...req.postDataJSON() }; payload = { user }; }
    if (path.startsWith('/api/account/courses')) {
      if (failNext && req.method() !== 'GET') {
        failNext = false;
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: '模拟保存失败' }) });
        return;
      }
      if (path.endsWith('/preset')) courses = preset();
      else if (req.method() === 'POST') {
        const code = decodeURIComponent(path.split('/').at(-1));
        courses = [...courses.filter((course) => course.courseCode !== code), { ...req.postDataJSON(), courseCode: code }];
      } else if (req.method() === 'DELETE') courses = courses.filter((course) => course.courseCode !== decodeURIComponent(path.split('/').at(-1)));
      else if (req.method() === 'PUT') courses = req.postDataJSON().courses;
      payload = { courses };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
  });
  return { writes, errors, getCourses: () => courses, failNext: () => { failNext = true; } };
}

async function removeCard(page, name) {
  const card = page.locator('.my-course-card').filter({ has: page.getByText(name, { exact: true }) });
  await card.hover();
  await card.getByRole('button', { name: `删除课程 ${name}`, exact: true }).click();
  await expect(card).toHaveCount(0);
}

test('guest my courses preset then edits persist across homepage personal view and reload', async ({ page }) => {
  const state = await fixture(page);
  await page.goto('/');
  await page.locator('.home-study__setup').getByRole('combobox', { name: '专业', exact: true }).selectOption('biology');
  await page.locator('.home-study__setup').getByRole('combobox', { name: '入学年级', exact: true }).selectOption('2025');
  await page.locator('.home-study__setup').getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('.home-study .my-course-card')).toHaveCount(4);
  await expect(page.locator('.home-study')).not.toContainText('英语口语');
  await page.screenshot({ path: 'project-checks/artifacts/my-courses-home.png', fullPage: true });
  await removeCard(page, '生物化学（甲）');
  await page.locator('.demo-topnav').getByRole('link', { name: '个人', exact: true }).click();
  await expect(page.locator('.my-courses-page .my-course-card')).toHaveCount(3);
  await page.getByRole('searchbox', { name: '添加课程', exact: true }).fill('英语口语');
  await page.locator('.my-course-editor__results').getByRole('button', { name: '添加', exact: true }).click();
  await expect(page.locator('.my-course-editor__results').getByRole('button', { name: '已添加', exact: true })).toBeDisabled();
  await page.getByRole('searchbox', { name: '添加课程', exact: true }).fill('BIO2011F');
  await page.locator('.my-course-editor__results').getByRole('button', { name: '添加', exact: true }).click();
  await page.locator('.demo-topnav').getByRole('link', { name: '首页', exact: true }).click();
  await expect(page.locator('.home-study .my-course-card')).toHaveCount(5);
  await expect(page.locator('.home-study')).toContainText('英语口语');
  await page.reload();
  await expect(page.locator('.home-study .my-course-card')).toHaveCount(5);
  while (await page.locator('.home-study .my-course-card').count()) {
    const card = page.locator('.home-study .my-course-card').first();
    const name = await card.locator('strong').textContent();
    await removeCard(page, name);
  }
  await page.reload();
  await expect(page.locator('.home-study .my-course-card')).toHaveCount(0);
  await page.getByRole('link', { name: '设置我的课程', exact: true }).click();
  await expect(page.getByText('暂无课程。', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '重新预置本学期课程', exact: true }).click();
  await expect(page.locator('.my-course-card')).toHaveCount(4);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
  await page.screenshot({ path: 'project-checks/artifacts/my-courses-mobile.png', fullPage: true });
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

test('account profile and homepage share courses and preserve data on failed saves and cancelled preset', async ({ page }) => {
  const state = await fixture(page, true);
  await page.goto('/');
  await expect(page.locator('.home-study .my-course-card')).toHaveCount(4);
  await page.locator('.demo-topnav').getByRole('link', { name: '个人', exact: true }).click();
  await page.locator('.profile-sidebar').getByRole('button', { name: '我的课程', exact: true }).click();
  await expect(page.locator('.profile-management .my-course-card')).toHaveCount(4);
  await page.getByRole('searchbox', { name: '添加课程', exact: true }).fill('BIO3066M');
  state.failNext();
  await page.locator('.my-course-editor__results').getByRole('button', { name: '添加', exact: true }).click();
  await expect(page.getByText('模拟保存失败', { exact: true })).toBeVisible();
  await expect(page.locator('.my-course-card')).toHaveCount(4);
  await page.locator('.my-course-editor__results').getByRole('button', { name: '添加', exact: true }).click();
  await expect(page.locator('.my-course-card')).toHaveCount(5);
  await removeCard(page, '生物化学（甲）');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: '重新预置本学期课程', exact: true }).click();
  expect(state.getCourses().some((course) => course.courseName === '英语口语')).toBe(true);
  await page.locator('.demo-topnav').getByRole('link', { name: '首页', exact: true }).click();
  await expect(page.locator('.home-study .my-course-card')).toHaveCount(4);
  await expect(page.locator('.home-study')).toContainText('英语口语');
  await expect(page.locator('.home-study')).not.toContainText('生物化学（甲）');
  await page.reload();
  await expect(page.locator('.home-study')).toContainText('英语口语');
  await page.getByRole('button', { name: '打开账号面板' }).click();
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await expect(page.locator('.home-study .my-course-card')).toHaveCount(0);
  expect(state.errors).toEqual([]);
});

test('touch devices expose course removal without hover', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5174', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    await fixture(page);
    await page.addInitScript(() => localStorage.setItem('zjubio:local-workspace:v1:guest', JSON.stringify({
      majorId: 'biology', cohortYear: 2025, coursesInitialized: true,
      myCourses: [{ courseCode: 'BIO2011F', courseName: '生物化学（甲）' }],
    })));
    await page.goto('/#my-courses');
    const remove = page.getByRole('button', { name: '删除课程 生物化学（甲）', exact: true });
    await expect(remove).toHaveCSS('opacity', '1');
    const control = await remove.evaluate((el) => { const s = getComputedStyle(el), r = el.getBoundingClientRect(); return { pointer: s.pointerEvents, zIndex: s.zIndex, position: s.position, color: s.color, rect: r.toJSON(), hit: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.outerHTML }; });
    expect(control.pointer, JSON.stringify(control)).toBe('auto');
    expect(control.hit, JSON.stringify(control)).toContain('my-course-card__remove');
    await page.screenshot({ path: 'project-checks/artifacts/my-courses-touch.png' });
    await remove.tap();
    await expect(page.locator('.my-course-card')).toHaveCount(0);
  } finally { await context.close(); }
});
