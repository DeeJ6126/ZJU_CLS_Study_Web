import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 1000 } });

async function openGuestPage(page) {
  await page.addInitScript(() => localStorage.setItem('study-platform-theme', 'light'));
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const payload = path.endsWith('/auth/me')
      ? { user: { id: 'guest', role: 'guest', nickname: '游客', verifications: {} } }
      : { open: false, items: [], activities: [], homepages: [] };
    await route.fulfill({ json: payload });
  });
  await page.goto('/');
  await expect(page.locator('.theme-switch')).toBeVisible();
}

test('theme colors interpolate in both directions without changing the toggle animation', async ({ page }) => {
  await openGuestPage(page);
  const colors = () => page.evaluate(() => [document.body, document.querySelector('.demo-head')].map((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, color: style.color };
  }));
  for (const mode of ['dark', 'light']) {
    const before = await colors();
    await page.locator('.theme-switch').click();
    await expect(page.locator('html')).toHaveClass(/theme-transitioning/);
    await page.waitForTimeout(180);
    const during = await colors();
    const animation = await page.locator('.theme-switch .ts-main-button').evaluate((element) => getComputedStyle(element).transitionProperty);
    expect(animation).not.toBe('background-color, color, border-color, box-shadow, fill, stroke');
    await expect(page.locator('html')).not.toHaveClass(/theme-transitioning/);
    await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
    const after = await colors();
    for (let i = 0; i < before.length; i++) {
      expect(during[i].background).not.toBe(before[i].background);
      expect(during[i].background).not.toBe(after[i].background);
      expect(during[i].color).not.toBe(before[i].color);
      expect(during[i].color).not.toBe(after[i].color);
    }
    await page.screenshot({ path: `project-checks/artifacts/theme-transition-${mode}.png` });
  }
});

test('reduced-motion users get the final palette without a color animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openGuestPage(page);
  await page.locator('.theme-switch').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).not.toHaveClass(/theme-transitioning/);
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(23, 28, 30)');
});
