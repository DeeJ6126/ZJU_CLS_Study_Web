import { expect, test } from '@playwright/test';

test('overview course detail and guest contribution boundary work', async ({ page }) => {
  await page.goto('/');
  await page.locator('a[href="#overview"]').first().click();

  await expect(page.locator('.overview-page')).toBeVisible();
  await page.locator('a[href^="#resources/#"]').first().click();

  await expect(page.locator('.course-detail')).toBeVisible();
  await expect(page.locator('.course-detail__hero')).toBeVisible();

  await page.locator('a[href*="/#experiences"]').first().click();
  await expect(page.locator('.course-subpage')).toBeVisible();
  await page.locator('button.contribution-trigger').click();
  await expect(page.locator('.contribution-modal')).toBeVisible();
  await expect(page.locator('.contribution-box__notice')).toContainText('需要登录');
});

test('course content and comments remain readable at a 375px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 760 });
  await page.goto('/');
  await page.locator('a[href="#overview"]').first().click();
  await page.locator('a[href="#resources/#BIO2110F"]').click();
  await page.locator('a[href*="/#experiences"]').first().click();
  const firstItem = page.locator('.learning-card__main-link').first();
  await expect(firstItem).toBeVisible();
  await firstItem.click();
  await expect(page.locator('.comment-section')).toBeVisible();
  await expect(page.locator('.permission-note')).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(hasHorizontalOverflow).toBe(false);
});
