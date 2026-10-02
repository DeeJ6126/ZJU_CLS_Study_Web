import { expect, test } from '@playwright/test';

const guest = { id: 'guest', nickname: '游客', role: 'guest', verifications: { email: false } };
const admin = { id: 'production-admin', publicId: 'production-admin', nickname: '真实管理员', role: 'admin', verifications: { email: true } };

async function productionFixture(page, user, staleIdentity) {
  const writes = [];
  await page.addInitScript((identity) => localStorage.setItem('study-platform-demo-identity', identity), staleIdentity);
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/zjubio/, '');
    if (!['GET', 'HEAD'].includes(request.method())) {
      writes.push(path);
      await route.fulfill({ status: 405, json: { message: '只读测试' } });
      return;
    }
    let payload = { items: [], activities: [], submissions: [], notifications: [], unreadCount: 0, courses: [], initialized: true };
    if (path === '/api/auth/me') payload = { user };
    if (path === '/api/consultation/status') payload = { open: false, isMentor: false };
    if (path === '/api/quiz/recent') payload = { recent: null };
    await route.fulfill({ json: payload });
  });
  return writes;
}

test('production guest ignores a stale demo administrator and exposes only real account access', async ({ page }) => {
  const writes = await productionFixture(page, guest, 'admin');
  await page.goto('/');
  await expect(page.locator('.demo-user-chip')).toContainText('游客');
  await page.locator('.demo-user-chip').click();
  const menu = page.locator('.account-popover');
  await expect(menu).toBeVisible();
  await expect(page.locator('.account-switcher')).toHaveCount(0);
  await expect(page.locator('.demo-user-chip__tag')).toHaveCount(0);
  await expect(menu.getByRole('button', { name: '管理后台', exact: true })).toHaveCount(0);
  await expect(menu.getByRole('button', { name: '登录', exact: true })).toBeVisible();
  await expect(menu.getByRole('button', { name: '学号认证注册', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('study-platform-demo-identity'))).toBeNull();
  await page.goto('/#admin');
  await expect(page.locator('.admin-auth')).toBeVisible();
  await expect(page.getByRole('button', { name: '登录管理平台', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '新增内容', exact: true })).toHaveCount(0);
  expect(writes).toEqual([]);
});

test('production administrator has real management access without a demo identity switcher', async ({ page }) => {
  const writes = await productionFixture(page, admin, 'email');
  await page.goto('/');
  await expect(page.locator('.demo-user-chip')).toContainText(admin.nickname);
  await page.locator('.demo-user-chip').click();
  const menu = page.locator('.account-popover');
  await expect(menu).toBeVisible();
  await expect(page.locator('.account-switcher')).toHaveCount(0);
  await expect(page.locator('.demo-user-chip__tag')).toHaveCount(0);
  await expect(menu.getByRole('button', { name: '退出登录', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('study-platform-demo-identity'))).toBeNull();
  await menu.getByRole('button', { name: '管理后台', exact: true }).click();
  await expect(page.locator('.admin-page')).toBeVisible();
  await expect(page.locator('.admin-auth')).toHaveCount(0);
  await expect(page.locator('.admin-page__nav').getByRole('button', { name: '活动管理', exact: true })).toBeVisible();
  await expect(page.locator('.admin-page__nav').getByRole('button', { name: /投稿审核/ })).toHaveCount(0);
  expect(writes).toEqual([]);
});
