import { test, expect } from '@playwright/test';

const papers = [
  { id: 'paper-first', routeId: 'paper-first', courseCode: 'BIO2019F', type: 'paper', title: '2024–2025春夏 植物学及实验（甲）期末回忆卷', summary: '应隐藏的列表副标题', author: '原帖分享者', sourcePublishedDate: '2025-06-18', sourcePlatform: 'cc98', sourceUrl: 'https://www.cc98.org/topic/6217956', body: '## 考试心得\n\n**复习建议**：回归课件。\n\n### [原帖补充：分享者 · 4L](https://www.cc98.org/topic/6217956/1#4)\n\n[配套资料](https://file.cc98.org/notes.pdf)', bodyFormat: 'markdown', file: { url: '/zjubio/api/content/files/paper-first', fileName: '回忆卷.pdf' } },
  { id: 'paper-teacher', routeId: 'paper-teacher', courseCode: 'BIO2019F', type: 'paper', title: '植物学及实验（甲）期末回忆', summary: '应隐藏的另一条副标题', author: '另一位分享者', teacher: '李攀/赵云鹏', sourcePublishedDate: '2021-01-22', owner: { publicId: 'paper-contributor', nickname: '投稿同学' }, sourcePlatform: 'cc98', sourceUrl: 'https://www.cc98.org/topic/5026202', body: '[b]复习经验[/b]\n保持平时学习。\n\n配套PDF[upload]https://file.cc98.org/notes.pdf[/upload]', bodyFormat: 'ubb', file: { url: '/zjubio/api/content/files/paper-teacher', fileName: '回忆.pdf' } },
];

for (const theme of ['light', 'dark']) {
  test(`paper list and reader use compact metadata in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname.replace(/^\/zjubio/, '');
      let result = { items: [], courses: [], initialized: true, favorites: [], notifications: [], unreadCount: 0, homepages: [], activities: [] };
      if (path === '/api/auth/me') result = { user: { id: 11, publicId: 'paper-tester', role: 'student', nickname: '测试用户', verifications: { email: true } } };
      if (path.startsWith('/api/content/courses/')) result = { items: papers };
      if (path === '/api/consultation/status') result = { open: false, isMentor: false };
      if (path.startsWith('/api/content/files/')) return route.fulfill({ contentType: 'application/pdf', body: '%PDF-1.4\n%%EOF' });
      await route.fulfill({ json: result });
    });
    await page.goto('/#resources/#BIO2019F/#papers');
    if (await page.locator('html').getAttribute('data-theme') !== theme) await page.locator('.theme-switch').click();
    const rows = page.locator('.paper-row-card');
    await expect(rows).toHaveCount(2);
    await expect(rows.first().locator('.paper-row-card__author')).toHaveText('原帖分享者');
    await expect(rows.first().locator('time')).toHaveText('2025-06-18');
    await expect(rows.first().locator('.paper-row-card__teacher')).toHaveCount(0);
    await expect(rows.nth(1).locator('.paper-row-card__author')).toHaveText('投稿同学');
    await expect(rows.nth(1).locator('.paper-row-card__teacher')).toHaveText('授课老师：李攀/赵云鹏');
    await expect(page.getByText(/应隐藏|未注明|发布日期：/)).toHaveCount(0);
    const boxes = await rows.first().evaluate(row => {
      const box = selector => row.querySelector(selector).getBoundingClientRect().toJSON();
      return { title: box('strong'), author: box('.paper-row-card__author'), date: box('time') };
    });
    expect(boxes.author.y).toBeLessThan(boxes.date.y);
    expect(boxes.date.x).toBeGreaterThanOrEqual(boxes.title.right);
    await page.screenshot({ path: `project-checks/artifacts/paper-list-${theme}.png` });
    await rows.first().click();
    await expect(page.locator('.pdf-viewer')).toHaveAttribute('data', papers[0].file.url);
    await expect(page.getByRole('link', { name: /返回历年试卷|^打开 PDF$|^下载 PDF$/ })).toHaveCount(0);
    await expect(page.locator('.comment-section')).toHaveCount(0);
    await expect(page.locator('.paper-actions')).toContainText('原帖分享者');
    await expect(page.locator('.paper-detail__context')).not.toContainText('老师');
    const body = page.locator('.paper-detail .article-body');
    await expect(body.locator('h2')).toHaveText('考试心得');
    await expect(body.locator('strong')).toHaveText('复习建议');
    await expect(body.locator('h3 a')).toHaveAttribute('href', 'https://www.cc98.org/topic/6217956/1#4');
    const dimensions = await body.evaluate(el => {
      const parent = el.closest('.article-detail-card'), s = getComputedStyle(parent);
      return { width: el.getBoundingClientRect().width, available: parent.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight), top: el.getBoundingClientRect().top,
        pdfBottom: parent.querySelector('.pdf-viewer').getBoundingClientRect().bottom };
    });
    expect(Math.abs(dimensions.width - dimensions.available)).toBeLessThan(2);
    expect(dimensions.top).toBeGreaterThanOrEqual(dimensions.pdfBottom);
    const source = page.locator('.paper-actions .article-cc98-badge');
    await expect(source).toHaveAttribute('href', papers[0].sourceUrl);
    await expect(source).toHaveAttribute('rel', 'noopener noreferrer');
    await expect.poll(() => source.locator('img').evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
    const style = await source.evaluate(el => { const s = getComputedStyle(el); return { background: s.backgroundColor, border: s.borderWidth, padding: s.padding }; });
    expect(style.background).toBe('rgba(0, 0, 0, 0)');
    expect(style.border).toBe('0px');
    expect(style.padding).toBe('0px');
    await expect(page.locator('.paper-actions .favorite-button')).toHaveCount(1);
    await page.screenshot({ path: `project-checks/artifacts/paper-detail-${theme}.png` });
    await page.goto('/#resources/#BIO2019F/#papers/#paper-teacher');
    await expect(page.locator('.paper-detail__context')).toContainText('授课老师：李攀/赵云鹏');
    await expect(page.locator('.paper-actions .article-author-link')).toHaveText('投稿同学');
    await expect(page.locator('.article-body--ubb strong')).toHaveText('复习经验');
    await expect(page.locator('.article-body--ubb .content-file-link')).toHaveText('点击查看PDF');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}
