import { expect, test } from '@playwright/test';

async function selectDemoIdentity(page, identityId) {
  await page.locator('.demo-user-chip').click();
  await page.locator('.account-switcher select').selectOption(identityId);
}

test('demo student profile supports isolated persistent local actions', async ({ page }) => {
  const apiWrites = [];
  page.on('request', (request) => {
    if (/\/api\//.test(request.url()) && !['GET', 'HEAD'].includes(request.method())) apiWrites.push(request.url());
  });
  await page.goto('/');
  await selectDemoIdentity(page, 'email');
  await expect(page.locator('.demo-user-chip')).toContainText('演示·蓝桥');

  await page.getByRole('button', { name: '个人主页' }).click();
  await expect(page.locator('.profile-demo-notice')).toContainText('不会提交到服务器');
  await page.getByRole('button', { name: '我的课程' }).click();
  const initialRows = await page.locator('.profile-course-row:not(.profile-course-row--head)').count();
  expect(initialRows).toBeGreaterThan(0);

  await page.locator('.profile-course-row:not(.profile-course-row--head)').first().getByRole('button', { name: '移除' }).click();
  await page.reload();
  await page.getByRole('button', { name: '我的课程' }).click();
  await expect(page.locator('.profile-course-row:not(.profile-course-row--head)')).toHaveCount(initialRows - 1);

  await page.locator('.demo-user-chip').click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '重置当前演示账号' }).click();
  await page.getByRole('button', { name: '我的课程' }).click();
  await expect(page.locator('.profile-course-row:not(.profile-course-row--head)')).toHaveCount(initialRows);
  expect(apiWrites).toEqual([]);
});

test('demo administrator approval publishes to the student account', async ({ page }) => {
  const apiWrites = [];
  page.on('request', (request) => {
    if (/\/api\//.test(request.url()) && !['GET', 'HEAD'].includes(request.method())) apiWrites.push(request.url());
  });
  await page.goto('/');
  await selectDemoIdentity(page, 'admin');
  await page.getByRole('button', { name: '管理后台' }).click();
  await expect(page.locator('.admin-page')).toBeVisible();
  await page.getByRole('button', { name: /投稿审核/ }).click();

  const submission = page.locator('.admin-content-table__row').filter({ hasText: '微生物学名词辨析表' });
  await expect(submission).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await submission.getByRole('button', { name: '通过', exact: true }).click();
  await expect(page.locator('.admin-notice').filter({ hasText: '投稿已通过并发布' })).toBeVisible();

  await selectDemoIdentity(page, 'cc98');
  await page.getByRole('button', { name: '个人主页' }).click();
  await page.getByRole('button', { name: '我的帖子' }).click();
  await expect(page.getByRole('link', { name: '微生物学名词辨析表' })).toBeVisible();
  expect(apiWrites).toEqual([]);
});
