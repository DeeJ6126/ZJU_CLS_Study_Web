import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 1000 } });
async function fixture(page, owner = false) {
  const state = { errors: [], queries: [], grants: [], fail: false };
  const logs = [
    { id: 'l1', action: 'content.update', targetTitle: '管理员甲修改的资料', actorId: 1, actorName: 'Dee', courseCode: 'BIO2110F', createdAt: '2026-10-12T08:00:00Z' },
    { id: 'l2', action: 'content.publish', targetTitle: '管理员乙发布的心得', actorId: 2, actorName: '另一管理员', courseCode: 'BIO2011F', createdAt: '2026-10-12T08:01:00Z' },
  ];
  page.on('pageerror', error => state.errors.push(error.message));
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname.replace(/^\/zjubio/, '');
    let result = { items: [], courses: [], activities: [], notifications: [], favorites: [], initialized: true, submissions: [], homepages: [], applications: [], unreadCount: 0 };
    if (path === '/api/auth/me') result = { user: { id: 1, publicId: 'audit-user', nickname: owner ? 'Dee' : '普通管理员', role: 'admin', verifications: { email: true }, canManageAdministrators: owner } };
    if (path === '/api/consultation/status') result = { open: false, isMentor: false };
    if (path === '/api/admin/audit-logs') {
      state.queries.push(url.searchParams.get('actorName'));
      result = { logs: logs.filter(log => !url.searchParams.get('actorName') || log.actorName.includes(url.searchParams.get('actorName'))) };
    }
    if (path === '/api/admin/administrators') {
      state.grants.push(request.postDataJSON());
      if (state.fail) { state.fail = false; await route.fulfill({ status: 503, json: { message: '测试保存失败' } }); return; }
      result = { registered: false, message: '资格已保存，该学号完成注册认证后将成为管理员。' };
    }
    await route.fulfill({ json: result });
  });
  return state;
}

test('audit logs show the acting nickname and narrow results using the separate administrator filter', async ({ page }) => {
  const state = await fixture(page);
  await page.goto('/#admin');
  await page.getByRole('button', { name: '操作日志', exact: true }).click();
  await expect(page.locator('.admin-audit-list')).toContainText('操作者：Dee');
  await expect(page.locator('.admin-audit-list')).toContainText('操作者：另一管理员');
  await expect(page.getByRole('button', { name: '增加管理员', exact: true })).toHaveCount(0);
  await page.getByRole('searchbox', { name: '管理员昵称', exact: true }).fill('Dee');
  await expect(page.locator('.admin-audit-row')).toHaveCount(1);
  await expect(page.locator('.admin-audit-row')).toContainText('管理员甲修改的资料');
  expect(state.queries).toContain('Dee');
  expect(state.errors).toEqual([]);
  expect(state.grants).toEqual([]);
});

for (const theme of ['light', 'dark']) {
  test(`owner grants administrator qualification with failure retention in ${theme}`, async ({ page }) => {
    const state = await fixture(page, true);
    state.fail = true;
    await page.goto('/#admin');
    if (await page.locator('html').getAttribute('data-theme') !== theme) await page.locator('.theme-switch').click();
    await page.getByRole('button', { name: '操作日志', exact: true }).click();
    await expect(page.getByRole('searchbox', { name: '管理员昵称', exact: true })).toBeVisible();
    await page.screenshot({ path: `project-checks/artifacts/admin-audit-${theme}.png` });
    await page.getByRole('button', { name: '增加管理员', exact: true }).click();
    const panel = page.getByRole('region', { name: '增加管理员', exact: true });
    await panel.getByRole('textbox', { name: '学号', exact: true }).fill('3250100007');
    await panel.getByRole('button', { name: '确认增加管理员', exact: true }).click();
    await expect(panel).toContainText('测试保存失败');
    await expect(panel.getByRole('textbox', { name: '学号', exact: true })).toHaveValue('3250100007');
    await panel.getByRole('button', { name: '确认增加管理员', exact: true }).click();
    await expect(panel).toContainText('完成注册认证后将成为管理员');
    await expect(panel.getByRole('textbox', { name: '学号', exact: true })).toHaveValue('');
    expect(state.grants).toEqual([{ studentId: '3250100007' }, { studentId: '3250100007' }]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `project-checks/artifacts/admin-grant-${theme}.png` });
    expect(state.errors).toEqual([]);
  });
}
