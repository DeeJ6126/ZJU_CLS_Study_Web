import { expect, test } from '@playwright/test';

test('course teacher names are visible and shared by the split microbiology courses', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/zjubio/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const payload = path.endsWith('/auth/me')
      ? { user: { id: 'guest', role: 'guest', nickname: '游客', verifications: {} } }
      : path.endsWith('/consultation/status') ? { open: false, isMentor: false }
        : { items: [], activities: [], homepages: [], count: 0 };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
  });
  await page.goto('/#resources/#BIO2110F');
  await expect(page.getByRole('heading', { name: '老师名单', exact: true })).toBeVisible();
  await expect(page.locator('.course-teachers li')).toHaveCount(8);
  await expect(page.locator('.course-teachers')).toContainText('高海春');
  const theoryNames = await page.locator('.course-teachers li').allTextContents();
  await page.screenshot({ path: 'project-checks/artifacts/course-teachers-desktop.png', fullPage: true });
  await page.goto('/#resources/#BIO2113F');
  await expect(page.locator('.course-teachers li')).toHaveCount(8);
  expect(await page.locator('.course-teachers li').allTextContents()).toEqual(theoryNames);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
  await page.screenshot({ path: 'project-checks/artifacts/course-teachers-mobile.png', fullPage: true });
  await page.goto('/#resources/#BIO2114M');
  await expect(page.locator('.course-teachers')).toContainText('老师名单暂未收录');
  expect(errors).toEqual([]);
});
