import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 1000 } });

const paperId = '11111111-1111-4111-8111-111111111111';
const labId = '22222222-2222-4222-8222-222222222222';
const paper = {
  id: paperId, routeId: paperId, courseCode: 'BIO2110F', type: 'paper',
  title: 'Synthetic theory paper', body: 'Theory paper notes.', status: 'published', author: 'Fixture author',
};
const lab = {
  id: labId, routeId: labId, courseCode: 'BIO2113F', type: 'experience',
  title: 'Synthetic laboratory experience', body: 'Laboratory-only notes.', status: 'published', author: 'Fixture author',
};

test('legacy microbiology links resolve to their migrated courses and stale requests cannot override navigation', async ({ page }) => {
  const errors = [];
  const writes = [];
  page.on('pageerror', error => errors.push(error.message));
  let delayLegacy = false;
  let releaseLegacy, legacyArrived;
  const legacyGate = new Promise(resolve => { releaseLegacy = resolve; });
  const legacyRequest = new Promise(resolve => { legacyArrived = resolve; });
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/zjubio/, '');
    if (!['GET', 'HEAD'].includes(request.method())) {
      writes.push(path);
      await route.fulfill({ status: 403, json: { message: 'Read-only fixture' } });
      return;
    }
    let payload = { items: [], activities: [], notifications: [], unreadCount: 0 };
    if (path === '/api/auth/me') payload = { user: { id: 'guest', role: 'guest', nickname: 'Guest', verifications: {} } };
    if (path === '/api/consultation/status') payload = { open: false, isMentor: false };
    if (path === '/api/content/courses/BIO2009F') {
      if (delayLegacy) { legacyArrived(); await legacyGate; }
      payload = { items: [paper, lab] };
    }
    if (path === '/api/content/courses/BIO2110F') payload = { items: [paper] };
    if (path === '/api/content/courses/BIO2113F') payload = { items: [lab] };
    await route.fulfill({ json: payload });
  });

  await page.goto(`/#resources/#BIO2009F/#papers/#${paperId}`);
  await expect(page).toHaveURL(new RegExp(`#resources/#BIO2110F/#papers/#${paperId}$`));
  await expect(page.locator('#paper-title')).toHaveText(paper.title);

  await page.goto(`/#resources/#BIO2009F/#experiences/#${labId}`);
  await expect(page).toHaveURL(new RegExp(`#resources/#BIO2113F/#experiences/#${labId}$`));
  await expect(page.locator('#experience-title')).toHaveText(lab.title);
  await expect(page.locator('.article-body')).toContainText(lab.body);

  await page.goto('/#resources/#BIO2009F/#papers');
  await expect(page).toHaveURL(/#resources\/#BIO2110F\/#papers$/);
  await expect(page.locator('.paper-row-card')).toHaveCount(1);
  await expect(page.locator('.paper-row-card__title')).toHaveText(paper.title);

  await page.goto('/#resources/#BIO2113F/#experiences');
  await expect(page.locator('.learning-card')).toHaveCount(1);
  await expect(page.locator('.learning-card__title')).toHaveText(lab.title);
  await expect(page.getByText(paper.title, { exact: true })).toHaveCount(0);

  delayLegacy = true;
  await page.evaluate(id => { location.hash = `#resources/#BIO2009F/#papers/#${id}`; }, paperId);
  await legacyRequest;
  await page.evaluate(() => { location.hash = '#resources/#BIO2113F/#experiences'; });
  await expect(page.locator('.learning-card__title')).toHaveText(lab.title);
  const legacyResponse = page.waitForResponse(response => response.url().endsWith('/api/content/courses/BIO2009F'));
  releaseLegacy();
  await legacyResponse;
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveURL(/#resources\/#BIO2113F\/#experiences$/);
  await expect(page.locator('.learning-card__title')).toHaveText(lab.title);
  expect(errors).toEqual([]);
  expect(writes).toEqual([]);
});
