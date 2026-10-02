import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 1000 } });
test.setTimeout(60_000);
test('guest plain-text feedback appears privately and sidebar dots cover every submission category', async ({ page }) => {
  let role = 'guest', feedback = [], unread = 0, failNext = true;
  const writes = [], errors = [];
  const text = '**不是加粗**\n<b>不是HTML</b>\n建议完善课程资料。';
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/**', async (route) => {
    const req = route.request(), path = new URL(req.url()).pathname.replace(/^\/zjubio/, '');
    let data = { items: [], activities: [], courses: [], initialized: true, notifications: [], homepages: [], applications: [], submissions: [] };
    if (req.method() !== 'GET') writes.push(path);
    if (path === '/api/auth/me') data = { user: { id: role === 'guest' ? 'guest' : 'feedback-admin', publicId: 'feedback-admin', role, nickname: role === 'guest' ? '游客' : '反馈管理员', verifications: { email: role === 'admin' } } };
    if (path === '/api/consultation/status') data = { open: false, isMentor: false };
    if (path === '/api/feedback') {
      if (failNext) { failNext = false; await route.fulfill({ status: 503, json: { message: '测试发送失败' } }); return; }
      feedback.push({ id: 'feedback-one', body: req.postDataJSON().body, authorName: '游客', createdAt: '2026-10-02T00:00:00Z', readAt: '' }); unread++;
      data = { feedback: { id: 'feedback-one' } };
    }
    if (path === '/api/admin/feedback/count') data = { unreadCount: unread };
    if (path === '/api/admin/feedback') data = { items: feedback, total: feedback.length, unreadCount: unread };
    if (path === '/api/admin/feedback/read') { for (const row of feedback) if (req.postDataJSON().ids.includes(row.id)) row.readAt = '2026-10-02T01:00:00Z'; unread = feedback.filter((row) => !row.readAt).length; data = { unreadCount: unread }; }
    if (path === '/api/admin/submissions') data = { submissions: ['experience', 'material', 'paper'].map((type) => ({ id: type, type, status: 'pending', courseCode: 'BIO2011F', createdAt: '2026-10-02T00:00:00Z' })) };
    if (path === '/api/admin/student-homepages/applications') data = { applications: [{ id: 'homepage-one', status: 'pending', name: '主页投稿', href: 'https://example.org/' }] };
    await route.fulfill({ json: data });
  });
  await page.goto('/#about');
  await expect(page.locator('.about-nav__item').first()).toContainText('关于网站');
  await page.locator('.about-nav').getByRole('link', { name: /关于我们/ }).click();
  await expect(page.locator('.about-contact')).toBeVisible();
  await page.getByRole('button', { name: '反馈意见', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '意见反馈', exact: true });
  await expect(dialog.getByRole('textbox', { name: '意见内容', exact: true })).toBeFocused();
  await expect(dialog.locator('input, select, [role="tablist"]')).toHaveCount(0);
  await dialog.getByRole('textbox', { name: '意见内容', exact: true }).fill(text);
  await dialog.getByRole('button', { name: '发送', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('测试发送失败');
  await expect(dialog.locator('textarea')).toHaveValue(text);
  await dialog.getByRole('button', { name: '发送', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.feedback-entry [role="status"]')).toContainText('意见已发送');
  await expect(page.locator('.auth-dialog')).toHaveCount(0);
  role = 'admin'; await page.goto('/#admin'); await page.reload();
  const nav = page.locator('.admin-page__nav');
  for (const name of ['学习心得', '复习资料', '历年试卷', '更多', '意见反馈']) {
    const button = nav.getByRole('button', { name, exact: true });
    await expect(button.locator('.admin-sidebar-dot')).toHaveCount(1);
    const position = await button.evaluate((el) => { const b=el.getBoundingClientRect(), d=el.querySelector('.admin-sidebar-dot').getBoundingClientRect(); return { right:b.right-d.right, top:d.top-b.top }; });
    expect(position.right).toBeLessThan(12); expect(position.top).toBeLessThan(12);
  }
  await nav.getByRole('button', { name: '意见反馈', exact: true }).click();
  await expect(page.locator('.admin-feedback-item p')).toHaveText(text);
  await expect(page.locator('.admin-feedback-item b, .admin-feedback-item strong:not(header strong)')).toHaveCount(0);
  await expect(nav.getByRole('button', { name: '意见反馈', exact: true }).locator('.admin-sidebar-dot')).toHaveCount(0);
  await nav.getByRole('button', { name: '更多', exact: true }).click();
  await expect(page.locator('.admin-more-tabs .admin-sidebar-dot')).toHaveCount(1);
  expect(writes).toEqual(['/api/feedback', '/api/feedback', '/api/admin/feedback/read']);
  expect(errors).toEqual([]);
});
