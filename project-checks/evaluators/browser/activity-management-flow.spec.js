import { expect, test } from '@playwright/test';

async function selectDemoIdentity(page, identityId) {
  await page.locator('.demo-user-chip').click();
  await page.locator('.account-switcher select').selectOption(identityId);
}

test('activity page opens a source-backed story with its original image', async ({ page }) => {
  await page.goto('/#activities/lab-open-day');
  await expect(page.getByRole('heading', { name: '实验室开放日', exact: true })).toBeVisible();
  await expect(page.locator('.activity-feature').getByText('走进科研一线', { exact: false })).toBeVisible();
  const image = page.getByRole('img', { name: '2025年生命科学学院实验室开放日师生合影' });
  await expect(image).toBeVisible();
  expect(await image.evaluate((element) => element.naturalWidth)).toBeGreaterThan(0);
});

test('demo administrator controls homepage recent activities without API writes', async ({ page }) => {
  const apiWrites = [];
  page.on('request', (request) => {
    if (/\/api\//.test(request.url()) && !['GET', 'HEAD'].includes(request.method())) apiWrites.push(request.url());
  });

  await page.goto('/');
  await selectDemoIdentity(page, 'admin');
  await page.getByRole('button', { name: '管理后台' }).click();
  await page.getByRole('button', { name: '活动管理' }).click();

  const row = page.locator('.admin-content-table__row').filter({ hasText: '实验室开放日' });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: '编辑' }).click();
  await page.getByLabel('推荐到首页“近期活动”').uncheck();
  await page.getByRole('button', { name: '保存修改' }).click();
  await expect(page.getByText('活动修改已保存。')).toBeVisible();

  await page.locator('.demo-topnav').getByRole('link', { name: '首页' }).click();
  await expect(page.locator('.home-activity-grid')).not.toContainText('实验室开放日');

  await page.locator('.demo-user-chip').click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '重置当前演示账号' }).click();
  await page.locator('.demo-topnav').getByRole('link', { name: '活动' }).click();
  await page.locator('.demo-topnav').getByRole('link', { name: '首页' }).click();
  await expect(page.locator('.home-activity-grid')).toContainText('实验室开放日');
  expect(apiWrites).toEqual([]);
});
