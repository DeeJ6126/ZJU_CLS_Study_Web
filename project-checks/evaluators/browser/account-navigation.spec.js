import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 1000 } });
for (const role of ['student', 'admin']) test(`${role} header bell and personal account actions replace the account card`, async ({ page }) => {
  let signedIn = true, unread = 1;
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const user = { id: 'nav-user', publicId: 'nav-user', nickname: '导航同学', role, grade: 2024, majorId: 'biology', verifications: { email: true } };
  await page.route('**/api/**', async (route) => {
    const request = route.request(), path = new URL(request.url()).pathname.replace(/^\/zjubio/, '');
    let result = { items: [], activities: [], courses: [], initialized: true, favorites: [], submissions: [], applications: [], notifications: [], unreadCount: 0 };
    if (path === '/api/auth/me') result = { user: signedIn ? user : { id: 'guest', role: 'guest', nickname: '游客', verifications: {} } };
    if (path === '/api/consultation/status') result = { open: false, isMentor: false };
    if (path === '/api/account/profile') {
      if (request.method() === 'PATCH') {
        const draft = request.postDataJSON();
        if (draft.nickname === '已占用昵称') return route.fulfill({ status: 409, json: { message: '该昵称已被使用。' } });
        user.nickname = draft.nickname;
      }
      result = { user, posts: [], submissions: [], comments: [] };
    }
    if (path.startsWith('/api/profiles/')) result = { profile: { ...user, publicId: 'other-user', nickname: '其他同学' }, posts: [] };
    if (path === '/api/account/profile/avatar' && request.method() === 'PUT') {
      expect(request.headers()['x-profile-upload']).toBe('avatar');
      expect(request.headers()['content-type']).toBe('image/png');
      user.avatarUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZKkUAAAAASUVORK5CYII=';
      result = { user };
    }
    if (path === '/api/account/notifications') result = { notifications: [{ id: 'nav-notice', title: '审核通过', body: '你的投稿已通过审核。', createdAt: '2026-10-02T00:00:00Z', readAt: unread ? '' : '2026-10-02T01:00:00Z' }], unreadCount: unread };
    if (path === '/api/account/notifications/read-all') {
      expect(request.headers()['content-type']).toContain('application/json');
      expect(request.postDataJSON()).toEqual({});
      unread = 0; result = { ok: true, unreadCount: 0 };
    }
    if (path === '/api/auth/logout') { signedIn = false; result = { ok: true }; }
    await route.fulfill({ json: result });
  });
  await page.goto('/');
  await expect(page.locator('.demo-topnav a').last()).toHaveText('关于');
  await page.getByRole('button', { name: '修改专业', exact: true }).click();
  await expect(page.locator('.home-study__setup select')).toHaveCount(1);
  await expect(page.locator('.home-study__cohort')).toContainText('2024 级');
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
  await expect(page.locator('.profile-identity input:not([type="file"]), .profile-identity select')).toHaveCount(0);
  await expect(page.locator('.profile-cohort')).toContainText('2024 级');
  const uploadHint = page.locator('.profile-avatar-upload > span');
  await expect(uploadHint).toHaveCSS('opacity', '0');
  await page.locator('.profile-avatar').hover();
  await expect(uploadHint).toHaveCSS('opacity', '1');
  await page.locator('.profile-identity h1').hover();
  await expect(uploadHint).toHaveCSS('opacity', '0');
  await page.getByLabel('上传头像', { exact: true }).focus();
  await expect(uploadHint).toHaveCSS('opacity', '1');
  await page.getByLabel('上传头像', { exact: true }).setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZKkUAAAAASUVORK5CYII=', 'base64') });
  await expect(page.locator('.profile-avatar > img')).toHaveAttribute('src', user.avatarUrl);
  await expect(page.getByRole('button', { name: '保存昵称', exact: true })).toHaveCount(0);
  await page.locator('.profile-account-footer').getByRole('button', { name: '修改昵称', exact: true }).click();
  await page.getByLabel('新昵称', { exact: true }).fill('已占用昵称');
  await page.getByRole('button', { name: '保存昵称', exact: true }).click();
  await expect(page.locator('.profile-notice')).toContainText('该昵称已被使用');
  await expect(page.getByLabel('新昵称', { exact: true })).toHaveValue('已占用昵称');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.locator('.profile-nickname-form')).toHaveCount(0);
  await expect(page.locator('.profile-identity h1')).toHaveText('导航同学');
  await page.getByRole('button', { name: '修改昵称', exact: true }).click();
  await page.getByLabel('新昵称', { exact: true }).fill('新导航同学');
  await page.getByRole('button', { name: '保存昵称', exact: true }).click();
  await expect(page.locator('.profile-identity h1')).toHaveText('新导航同学');
  await expect(page.locator('.demo-user-chip')).toHaveText('新导航同学');
  await expect(page.locator('.profile-nickname-form')).toHaveCount(0);
  await page.screenshot({ path: `project-checks/artifacts/profile-account-${role}.png`, fullPage: true });
  await expect(page.locator('.account-popover')).toHaveCount(0);
  const adminShortcut = page.locator('.profile-sidebar').getByRole('button', { name: '管理后台', exact: true });
  await expect(adminShortcut).toHaveCount(role === 'admin' ? 1 : 0);
  if (role === 'admin') { await adminShortcut.click(); await expect(page.locator('.admin-page')).toBeVisible(); await page.getByRole('button', { name: '打开个人页面', exact: true }).click(); }
  await expect(page.locator('.profile-account-footer').getByRole('button', { name: '退出登录', exact: true })).toBeVisible();
  await page.goto('/#profile/other-user');
  await expect(page.locator('.profile-identity h1')).toHaveText('其他同学');
  await expect(page.locator('.profile-account-footer')).toHaveCount(0);
  await expect(page.locator('.profile-avatar-upload')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '管理后台', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '打开个人页面', exact: true }).click();
  await page.locator('.profile-account-footer').getByRole('button', { name: '退出登录', exact: true }).click();
  await expect(page.locator('.demo-user-chip')).toHaveText('游客');
  await expect(bell).toHaveCount(0);
  await expect(page.locator('.home-page')).toBeVisible();
  expect(errors).toEqual([]);
});
