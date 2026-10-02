import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 1000 } });
for (const role of ['student', 'admin']) test(`${role} header bell and personal account actions replace the account card`, async ({ page }) => {
  let signedIn = true, unread = 1;
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const user = { id: 'nav-user', publicId: 'nav-user', nickname: '导航同学', role, verifications: { email: true } };
  await page.route('**/api/**', async (route) => {
    const request = route.request(), path = new URL(request.url()).pathname.replace(/^\/zjubio/, '');
    let result = { items: [], activities: [], courses: [], initialized: true, favorites: [], submissions: [], applications: [], notifications: [], unreadCount: 0 };
    if (path === '/api/auth/me') result = { user: signedIn ? user : { id: 'guest', role: 'guest', nickname: '游客', verifications: {} } };
    if (path === '/api/consultation/status') result = { open: false, isMentor: false };
    if (path === '/api/account/profile') result = { user, posts: [], submissions: [], comments: [] };
    if (path.startsWith('/api/profiles/')) result = { profile: { ...user, publicId: 'other-user', nickname: '其他同学' }, posts: [] };
    if (path === '/api/account/notifications') result = { notifications: [{ id: 'nav-notice', title: '审核通过', body: '你的投稿已通过审核。', createdAt: '2026-10-02T00:00:00Z', readAt: unread ? '' : '2026-10-02T01:00:00Z' }], unreadCount: unread };
    if (path === '/api/account/notifications/read-all') { unread = 0; result = { ok: true, unreadCount: 0 }; }
    if (path === '/api/auth/logout') { signedIn = false; result = { ok: true }; }
    await route.fulfill({ json: result });
  });
  await page.goto('/');
  const bell = page.getByRole('button', { name: '站内消息', exact: true });
  await expect(bell).toBeVisible();
  await expect(bell.locator('svg')).toHaveCount(1);
  await expect(bell.locator('.demo-notification-bell__dot')).toHaveCount(1);
  await bell.click();
  await expect(page.locator('.notifications-page')).toContainText('审核通过');
  await page.getByRole('button', { name: '全部标为已读', exact: true }).click();
  await expect(bell.locator('.demo-notification-bell__dot')).toHaveCount(0);
  await page.getByRole('button', { name: '打开个人页面', exact: true }).click();
  await expect(page.locator('.profile-identity h1')).toHaveText(user.nickname);
  await expect(page.locator('.account-popover')).toHaveCount(0);
  const adminShortcut = page.locator('.profile-sidebar').getByRole('button', { name: '管理后台', exact: true });
  await expect(adminShortcut).toHaveCount(role === 'admin' ? 1 : 0);
  if (role === 'admin') { await adminShortcut.click(); await expect(page.locator('.admin-page')).toBeVisible(); await page.getByRole('button', { name: '打开个人页面', exact: true }).click(); }
  await expect(page.locator('.profile-account-footer').getByRole('button', { name: '退出登录', exact: true })).toBeVisible();
  await page.goto('/#profile/other-user');
  await expect(page.locator('.profile-identity h1')).toHaveText('其他同学');
  await expect(page.locator('.profile-account-footer')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '管理后台', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '打开个人页面', exact: true }).click();
  await page.locator('.profile-account-footer').getByRole('button', { name: '退出登录', exact: true }).click();
  await expect(page.locator('.demo-user-chip')).toHaveText('游客');
  await expect(bell).toHaveCount(0);
  await expect(page.locator('.home-page')).toBeVisible();
  expect(errors).toEqual([]);
});
