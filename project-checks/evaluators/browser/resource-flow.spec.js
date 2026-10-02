import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 1000 } });

const post = {
  id: 'resource-reader-note', routeId: 'resource-reader-note', courseCode: 'BIO2011F',
  type: 'experience', title: '生化学习方法', summary: '课程阅读回归测试', author: '测试同学',
  teacher: '陈才勇', year: '2025-2026', bodyFormat: 'markdown',
  body: '## 学习记录\n\n完整的课程阅读内容。\n\n- 课前预习\n- 课后整理', status: 'published',
};

async function guestFixture(page) {
  const writes = [];
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/zjubio/, '');
    if (!['GET', 'HEAD'].includes(request.method())) {
      writes.push(path);
      await route.fulfill({ status: 403, json: { message: '需要学号认证' } });
      return;
    }
    let payload = { items: [], activities: [], notifications: [], unreadCount: 0 };
    if (path === '/api/auth/me') payload = { user: { id: 'guest', nickname: '游客', role: 'guest', verifications: { email: false } } };
    if (path === '/api/consultation/status') payload = { open: false, isMentor: false };
    if (path === '/api/content/courses/BIO2011F') payload = { items: [post] };
    await route.fulfill({ json: payload });
  });
  return writes;
}

test('overview course detail and all guest contribution boundaries work', async ({ page }) => {
  const writes = await guestFixture(page);
  await page.goto('/');
  await page.locator('a[href="#overview"]').first().click();
  await expect(page.locator('.overview-page')).toBeVisible();
  await page.locator('a[href="#resources/#BIO2011F"]').first().click();
  await expect(page.locator('.course-detail__hero')).toBeVisible();

  for (const tab of ['experiences', 'materials', 'papers']) {
    await page.locator(`.course-tabs a[href$="/#${tab}"]`).click();
    await expect(page.locator('.course-subpage')).toBeVisible();
    await page.getByRole('button', { name: '投稿', exact: true }).click();
    const panel = page.locator('.contribution-modal__panel');
    await expect(panel).toBeVisible();
    if (tab === 'papers') {
      await panel.getByRole('textbox', { name: '年份', exact: true }).fill('2026');
      await panel.getByLabel('选择 PDF 文件').setInputFiles({ name: 'guest.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF') });
    } else {
      await panel.getByRole('textbox', { name: '标题', exact: true }).fill('游客不能发布');
      await panel.locator('textarea').fill('完整内容也不能绕过学号认证。');
    }
    await panel.getByRole('button', { name: '发送审核', exact: true }).click();
    await expect(panel.locator('.contribution-box__notice')).toContainText('需要完成学号认证');
    await expect(panel).toBeVisible();
    await panel.getByRole('button', { name: '取消', exact: true }).click();
  }
  expect(writes).toEqual([]);
});

test('course article remains readable and locally favoritable without retired comments', async ({ page }) => {
  const writes = await guestFixture(page);
  await page.goto('/#resources/#BIO2011F/#experiences');
  await page.locator('.learning-card__main-link').click();
  await expect(page.locator('.article-body h2')).toHaveText('学习记录');
  await expect(page.locator('.article-body li')).toHaveCount(2);
  await expect(page.locator('.article-detail-card__context')).toContainText('陈才勇');
  await expect(page.locator('.comment-section')).toHaveCount(0);
  await expect(page.locator('.article-action-button')).toBeDisabled();
  await page.getByRole('button', { name: '收藏', exact: true }).click();
  await expect(page.getByRole('button', { name: '取消收藏', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByRole('button', { name: '取消收藏', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(writes).toEqual([]);
});
