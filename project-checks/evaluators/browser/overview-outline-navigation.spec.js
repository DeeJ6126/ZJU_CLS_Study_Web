import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 1000 } });

async function fixture(page) {
  const errors = [], writes = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/**', async (route) => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (request.method() !== 'GET') writes.push(path);
    let payload = { items: [], activities: [], open: false };
    if (path.endsWith('/auth/me')) payload = { user: { id: 'guest', role: 'guest', nickname: '游客', verifications: {} } };
    await route.fulfill({ json: payload });
  });
  return { errors, writes };
}

for (const mode of ['light', 'dark']) test(`overview nested curriculum navigation remains readable and locates headings in ${mode}`, async ({ page }) => {
  const state = await fixture(page);
  await page.addInitScript((theme) => localStorage.setItem('study-platform-theme', theme), mode);
  await page.goto('/#overview?major=biology&program=2024');
  const navigation = page.getByRole('navigation', { name: '培养方案目录', exact: true });
  const required = navigation.getByRole('button', { name: '(1)专业必修课程', exact: true });
  const direction = navigation.getByRole('button', { name: '1)生物科学方向', exact: true });
  await expect(required).toBeVisible();
  await expect(direction).toBeVisible();
  await expect(navigation.getByRole('button', { name: 'A.生物科学方向', exact: true })).toBeVisible();
  await expect(navigation.getByRole('button', { name: 'A.必修课程', exact: true })).toHaveCount(0);
  await expect(navigation.getByRole('button', { name: 'B.选修课程', exact: true })).toHaveCount(0);
  const rootIndent = await navigation.getByRole('button', { name: '3.专业课程', exact: true }).evaluate((element) => parseFloat(getComputedStyle(element).paddingLeft));
  const requiredIndent = await required.evaluate((element) => parseFloat(getComputedStyle(element).paddingLeft));
  const directionIndent = await direction.evaluate((element) => parseFloat(getComputedStyle(element).paddingLeft));
  expect(rootIndent).toBeLessThan(requiredIndent);
  expect(requiredIndent).toBeLessThan(directionIndent);
  await required.click();
  const requiredHeading = page.getByRole('heading', { name: '(1)专业必修课程', exact: false });
  await expect(requiredHeading).toBeInViewport();
  await direction.click();
  const directionHeading = page.locator('.overview-outline__head').filter({ hasText: '1)生物科学方向' });
  await expect.poll(async () => (await directionHeading.boundingBox()).y).toBeLessThan(260);
  await expect.poll(async () => (await directionHeading.boundingBox()).y).toBeGreaterThanOrEqual(188);
  await expect(directionHeading).toBeInViewport();
  await expect(page.locator('.overview-outline__head').filter({ hasText: 'A.必修课程' })).toHaveCount(1);
  await page.screenshot({ path: `project-checks/artifacts/overview-nested-navigation-${mode}.png`, fullPage: false });
  for (const year of ['2025', '2026']) {
    await page.locator('.overview-controls').getByRole('combobox', { name: '培养方案', exact: true }).selectOption(year);
    await expect(direction).toBeVisible();
    await direction.click();
    await expect(directionHeading).toBeInViewport();
  }
  expect(state.errors).toEqual([]);
  expect(state.writes).toEqual([]);
});

test('overview navigation follows module switches, current major directions, resource filters and semester grouping', async ({ page }) => {
  const state = await fixture(page);
  await page.goto('/#overview?major=biology-qiangji&program=2025');
  const navigation = page.getByRole('navigation', { name: '培养方案目录', exact: true });
  await expect(navigation.getByRole('button', { name: '1)生物科学模块', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '2)神经生物学模块', exact: true }).click();
  await expect(navigation.getByRole('button', { name: '2)神经生物学模块', exact: true })).toBeVisible();
  await expect(navigation.getByRole('button', { name: '1)生物科学模块', exact: true })).toHaveCount(0);
  await page.locator('.overview-controls').getByRole('combobox', { name: '专业', exact: true }).selectOption('ecology-qiangji');
  const ecology = navigation.getByRole('button', { name: '1)生态学', exact: true });
  await expect(ecology).toBeVisible();
  await ecology.click();
  await expect(page.locator('.overview-outline__head').filter({ hasText: '1)生态学' })).toBeInViewport();
  await page.getByRole('checkbox', { name: '仅展示有资料的课程', exact: true }).check();
  await expect(navigation.getByRole('button', { name: '1)生态学', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '按学期', exact: true }).click();
  await expect(page.getByRole('navigation', { name: '课程分组目录', exact: true })).toBeVisible();
  await expect(page.locator('.overview-contents button')).not.toHaveCount(0);
  await expect(page.locator('.overview-contents')).not.toContainText('方向');
  expect(state.errors).toEqual([]);
  expect(state.writes).toEqual([]);
});
