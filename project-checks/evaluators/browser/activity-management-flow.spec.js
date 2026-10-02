import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test.use({ viewport: { width: 1440, height: 1000 } });

const catalog = JSON.parse(readFileSync(new URL('../../../public/content/activities/catalog.json', import.meta.url), 'utf8'));
const guest = { id: 'guest', nickname: '游客', role: 'guest', verifications: { email: false } };
const admin = { id: 'activity-test-admin', nickname: '活动管理员', role: 'admin', verifications: { email: true } };

async function activityFixture(page, user = guest) {
  const activities = catalog.articles.map((item) => ({ ...item }));
  const writes = [];
  const unexpectedWrites = [];
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/zjubio/, '');
    if (!['GET', 'HEAD'].includes(request.method())) {
      if (user.role === 'admin' && path.startsWith('/api/admin/activities') && ['POST', 'PATCH'].includes(request.method())) {
        const input = request.postDataJSON();
        writes.push({ method: request.method(), path, input });
        const existing = request.method() === 'PATCH' ? activities.find((item) => path.endsWith(`/${item.id}`)) : null;
        const activity = { ...(existing ?? { id: 'activity-test-created', status: 'published' }), ...input };
        if (existing) Object.assign(existing, activity);
        else activities.push(activity);
        await route.fulfill({ json: { activity } });
      } else {
        unexpectedWrites.push({ method: request.method(), path });
        await route.fulfill({ status: 405, json: { message: '只允许隔离的活动测试写入' } });
      }
      return;
    }
    let payload = { items: [], courses: [], initialized: true, submissions: [], notifications: [], unreadCount: 0 };
    if (path === '/api/auth/me') payload = { user };
    if (path === '/api/consultation/status') payload = { open: false, isMentor: false };
    if (path === '/api/quiz/recent') payload = { recent: null };
    if (path === '/api/activities') payload = { activities };
    if (path === '/api/admin/activities') payload = { activities: activities.filter((item) => item.programId === url.searchParams.get('programId')) };
    await route.fulfill({ json: payload });
  });
  return { activities, writes, unexpectedWrites };
}

test('activity directory links its source-backed articles and current program details', async ({ page }) => {
  const state = await activityFixture(page);
  await page.goto('/#activities');
  await expect(page.locator('.activity-program')).toHaveCount(6);
  const program = page.locator('#activity-program-laboratory-open-day');
  const article = catalog.articles[0];
  const articleLink = program.locator('.activity-directory__list a').filter({ hasText: article.title });
  await expect(articleLink).toHaveAttribute('href', article.externalUrl);
  await expect(articleLink).toHaveAttribute('rel', 'noopener noreferrer');
  await program.getByRole('link', { name: '实验室开放日', exact: true }).click();
  await expect(page).toHaveURL(/#activity\/laboratory-open-day$/);
  await expect(page.locator('.activity-detail-page__head h1')).toHaveText('实验室开放日');
  await expect(page.locator('.activity-detail-page__head')).toContainText('走进科研一线');
  const image = page.locator('.activity-detail-page__hero img');
  await expect(image).toHaveAttribute('alt', '生命科学学院实验室开放日师生合影');
  await expect.poll(() => image.evaluate((element) => element.complete && element.naturalWidth > 0)).toBe(true);
  await expect(page.locator('.activity-detail-page__articles').getByRole('link', { name: article.title, exact: false })).toHaveAttribute('href', article.externalUrl);
  await page.getByRole('link', { name: '返回活动', exact: false }).click();
  await expect(page.locator('.activities-page')).toBeVisible();
  expect(state.writes).toEqual([]);
  expect(state.unexpectedWrites).toEqual([]);
});

test('administrator creates and edits categorized activity articles using isolated API mocks', async ({ page }) => {
  const state = await activityFixture(page, admin);
  await page.goto('/#admin');
  await page.locator('.admin-page__nav').getByRole('button', { name: '活动管理', exact: true }).click();
  await page.locator('.admin-activity-programs').getByRole('button', { name: '实验室开放日', exact: true }).click();
  const row = page.locator('.admin-content-table__row').filter({ hasText: catalog.articles[0].title });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: '编辑' }).click();
  const editor = page.getByRole('region', { name: '活动编辑器', exact: true });
  await expect(editor.getByRole('combobox', { name: '封面', exact: true })).toHaveValue(catalog.articles[0].imageUrl);
  await expect(editor.getByRole('checkbox')).toHaveCount(0);
  const edited = { title: '实验室开放日｜阅读回归', programId: 'laboratory-open-day', imageUrl: '/assets/activities/laboratory-open-day.webp', externalUrl: 'https://mp.weixin.qq.com/s/test-laboratory' };
  await editor.getByRole('textbox', { name: '标题', exact: true }).fill(edited.title);
  await editor.getByRole('textbox', { name: '推文链接', exact: true }).fill(edited.externalUrl);
  await editor.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(page.locator('.admin-notice')).toContainText('推文修改已保存');
  await expect(page.locator('.admin-content-table__row').filter({ hasText: edited.title })).toBeVisible();
  expect(state.writes[0]).toEqual({ method: 'PATCH', path: `/api/admin/activities/${catalog.articles[0].id}`, input: edited });

  await page.locator('.admin-activity-programs').getByRole('button', { name: '朋辈辅学', exact: true }).click();
  await page.getByRole('button', { name: '新增推文', exact: true }).click();
  const created = { title: '朋辈辅学｜课程交流', programId: 'peer-learning', imageUrl: '/assets/activities/peer-learning.webp', externalUrl: 'https://mp.weixin.qq.com/s/test-peer-learning' };
  await editor.getByRole('textbox', { name: '标题', exact: true }).fill(created.title);
  await editor.getByRole('combobox', { name: '封面', exact: true }).fill(created.imageUrl);
  await editor.getByRole('textbox', { name: '推文链接', exact: true }).fill(created.externalUrl);
  await editor.getByRole('button', { name: '添加到目录', exact: true }).click();
  await expect(page.locator('.admin-content-table__row').filter({ hasText: created.title })).toBeVisible();
  expect(state.writes[1]).toEqual({ method: 'POST', path: '/api/admin/activities', input: created });
  expect(state.writes).toHaveLength(2);
  expect(state.unexpectedWrites).toEqual([]);
  await page.goto('/#activities');
  await expect(page.locator('#activity-program-peer-learning .activity-directory__list a').filter({ hasText: created.title })).toHaveAttribute('href', created.externalUrl);
});
