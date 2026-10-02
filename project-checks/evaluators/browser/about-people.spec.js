import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 1000 } });

test('about contact and ordered GitHub contributors remain readable in both themes', async ({ page }) => {
  const errors = [], writes = [], githubApiRequests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => { if (new URL(request.url()).hostname === 'api.github.com') githubApiRequests.push(request.url()); });
  await page.route('**/api/**', async (route) => {
    if (route.request().method() !== 'GET') writes.push(route.request().url());
    const path = new URL(route.request().url()).pathname;
    let payload = { items: [], activities: [], homepages: [] };
    if (path.endsWith('/auth/me')) payload = { user: { id: 'guest', role: 'guest', nickname: '游客', verifications: { email: false } } };
    if (path.endsWith('/consultation/status')) payload = { open: false, isMentor: false };
    await route.fulfill({ json: payload });
  });
  for (const mode of ['light', 'dark']) {
    await page.goto('/#about?section=about-us');
    await expect(page.locator('.about-contact')).toBeVisible();
    if ((await page.locator('html').getAttribute('data-theme') === 'dark') !== (mode === 'dark')) await page.locator('.theme-switch').click();
    const contact = page.locator('.about-contact');
    await expect(contact.locator('strong')).toHaveText('主要负责人');
    await expect(contact.getByRole('link')).toHaveText('3240105782@zju.edu.cn');
    await expect(contact.getByRole('link')).toHaveAttribute('href', 'mailto:3240105782@zju.edu.cn');
    await expect.poll(() => contact.locator('img').evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
    const positions = await contact.evaluate((element) => { const image = element.querySelector('img').getBoundingClientRect(), name = element.querySelector('strong').getBoundingClientRect(), email = element.querySelector('a').getBoundingClientRect(); return { width: image.width, height: image.height, left: image.right < name.left, top: name.bottom <= email.top }; });
    expect(positions).toEqual({ width: 64, height: 64, left: true, top: true });
    await page.screenshot({ path: `project-checks/artifacts/about-contact-${mode}.png`, fullPage: true });
    await page.locator('.about-nav').getByRole('link', { name: /贡献者/ }).click();
    await expect(page.locator('.about-contributor strong')).toHaveText(['DeeJ6126', 'somnis7', 'serashikan']);
    const counts = await page.locator('.about-contributor').evaluateAll((links) => links.map((link) => Number(link.dataset.contributions)));
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    for (const item of await page.locator('.about-contributor').all()) {
      await expect(item).toHaveAttribute('rel', 'noopener noreferrer');
      await expect.poll(() => item.locator('img').evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
    }
    expect((await page.locator('.about-page__body').textContent()).replace(/\s+/g, ' ').trim()).toBe('贡献者 DeeJ6126 somnis7 serashikan');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `project-checks/artifacts/about-contributors-${mode}.png`, fullPage: true });
  }
  await page.goto('/#about?section=thanks');
  await expect(page.locator('.about-contributor')).toHaveCount(3);
  await expect(page).toHaveURL(/section=contributors$/);
  expect(errors).toEqual([]);
  expect(writes).toEqual([]);
  expect(githubApiRequests).toEqual([]);
});
