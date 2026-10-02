import { expect, test } from '@playwright/test';

test('teacher suggestions scope to courses, highlight prefixes and allow custom submissions', async ({ page }) => {
  const errors = [];
  const submissions = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/zjubio/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let payload = { items: [], activities: [], homepages: [], count: 0, total: 0 };
    if (path.endsWith('/auth/me')) payload = { user: { id: 'test-student', publicId: 'test-student', role: 'student', nickname: '测试同学', verifications: { email: true } } };
    if (path.endsWith('/consultation/status')) payload = { open: false, isMentor: false };
    if (path.endsWith('/submissions') && request.method() === 'POST') {
      submissions.push(request.postDataJSON());
      payload = { submission: { id: 'test-submission', status: 'pending' } };
    }
    if (path.endsWith('/submissions/test-submission/file')) payload = { submission: { id: 'test-submission', status: 'pending' } };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '资料', exact: true }).click();
  const filters = page.locator('.home-resource-search__filters');
  const teacher = filters.getByRole('combobox', { name: '授课老师' });
  await teacher.fill('陈');
  const options = filters.locator('.teacher-name-input [role="option"]');
  await expect(options.first()).toBeVisible();
  const allNames = await options.allTextContents();
  expect(allNames.every((name) => name.startsWith('陈'))).toBe(true);
  await expect(options.first().locator('strong')).toHaveText('陈');
  expect(await options.first().locator('strong').evaluate((el) => getComputedStyle(el).color)).toBe('rgb(40, 107, 74)');
  await filters.getByRole('searchbox', { name: '课程', exact: true }).fill('BIO2110F');
  await teacher.focus();
  await expect(options).toHaveCount(2);
  await expect(options).toHaveText(['陈璨', '陈景华']);
  await teacher.press('ArrowDown');
  await teacher.press('Enter');
  await expect(teacher).toHaveValue('陈璨');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await teacher.fill('陈景');
  await teacher.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await teacher.focus();
  await teacher.fill('陈景');
  await expect(options).toHaveText(['陈景华']);
  await page.screenshot({ path: 'project-checks/artifacts/teacher-suggestions-search.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
  await page.screenshot({ path: 'project-checks/artifacts/teacher-suggestions-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 720 });

  for (const tab of ['experiences', 'materials', 'papers']) {
    await page.goto(`/#resources/#BIO2110F/#${tab}`);
    await page.getByRole('button', { name: '投稿', exact: true }).click();
    const modal = page.locator('.contribution-modal');
    const input = modal.getByRole('combobox', { name: '老师姓名（选填）' });
    await input.fill('陈');
    await expect(modal.getByRole('option')).toHaveText(['陈璨', '陈景华']);
    await modal.getByRole('option', { name: '陈景华', exact: true }).click();
    await expect(input).toHaveValue('陈景华');
    await input.fill('名单外老师');
    await expect(modal.getByRole('listbox')).toHaveCount(0);
    if (tab === 'papers') {
      await modal.getByRole('textbox', { name: '年份', exact: true }).fill('2026');
      await modal.getByLabel('选择 PDF 文件').setInputFiles({ name: 'test.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF') });
    } else {
      await modal.getByRole('textbox', { name: '标题', exact: true }).fill('测试投稿');
      await modal.locator('textarea').fill('测试正文');
    }
    await modal.getByRole('button', { name: '发送审核', exact: true }).click();
    await expect.poll(() => submissions.length).toBe(['experiences', 'materials', 'papers'].indexOf(tab) + 1);
    expect(submissions.at(-1).teacher).toBe('名单外老师');
    await expect(modal).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});
