import { expect, test } from '@playwright/test';

test('resources course detail and contribution modal flow works', async ({ page }) => {
  await page.goto('/');
  await page.locator('a[href="#resources"]').first().click();

  await expect(page.locator('.resource-page')).toBeVisible();
  await page.locator('a[href^="#resources/#"]').first().click();

  await expect(page.locator('.course-detail')).toBeVisible();
  await expect(page.locator('.course-detail__hero')).toBeVisible();

  await page.locator('a[href*="/#experiences"]').first().click();
  await expect(page.locator('.course-subpage')).toBeVisible();

  await page.locator('button.contribution-trigger').click();
  await expect(page.locator('.contribution-modal')).toBeVisible();
  await expect(page.locator('input[type="text"]').first()).toBeVisible();
  await expect(page.locator('input[type="url"]').first()).toBeVisible();
  await expect(page.locator('textarea')).toBeVisible();
  await expect(page.locator('input[type="file"]')).toBeVisible();
});

test('all configured themes can be selected from settings', async ({ page }) => {
  await page.goto('/');
  await page.locator('button.settings-entry').click();

  const themeOptions = page.locator('.theme-option');
  await expect(themeOptions).toHaveCount(5);

  for (let index = 0; index < 5; index += 1) {
    await themeOptions.nth(index).click();
    await expect(themeOptions.nth(index)).toHaveClass(/is-selected/);
  }
});
