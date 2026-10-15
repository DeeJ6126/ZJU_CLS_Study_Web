import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test.use({ channel: 'chromium' });

const pdf = readFileSync(new URL('../../../public/resource/courses/basic/BIO2110F_microbiology-a/papers/25-26-midterm-lv.pdf', import.meta.url));

const papers = [
  { id: 'paper-first', routeId: 'paper-first', courseCode: 'BIO2019F', type: 'paper', title: '2024–2025春夏 植物学及实验（甲）期末回忆卷', subtitle: '植物学期末回忆与课程复习记录', summary: '应隐藏的列表摘要', author: '原帖分享者', sourcePublishedDate: '2025-06-18', sourcePlatform: 'cc98', sourceUrl: 'https://www.cc98.org/topic/6217956', body: '## 考试心得\n\n**复习建议**：回归课件。\n\n[课前资料](https://file.cc98.org/course.pdf)', supplementBody: '### [原帖补充：分享者 · 4L](https://www.cc98.org/topic/6217956/1#4)\n\n**补充建议**：对照笔记。\n\n[配套资料](https://file.cc98.org/notes.pdf)\n\n<script>window.paperUnsafe=true</script>', bodyFormat: 'markdown', file: { url: '/zjubio/api/content/files/paper-first', fileName: '回忆卷.pdf' } },
  { id: 'paper-teacher', routeId: 'paper-teacher', courseCode: 'BIO2019F', type: 'paper', title: '植物学及实验（甲）期末回忆', subtitle: '我的植物学复习和考试记录', summary: '应隐藏的另一条摘要', author: '另一位分享者', teacher: '李攀/赵云鹏', sourcePublishedDate: '2021-01-22', owner: { publicId: 'paper-contributor', nickname: '投稿同学' }, sourcePlatform: 'cc98', sourceUrl: 'https://www.cc98.org/topic/5026202', body: '[b]复习经验[/b]\n保持平时学习。\n\n课前PDF[upload]https://file.cc98.org/course.pdf[/upload]', supplementBody: '[b]原帖补充[/b]\n[color=red]补充说明[/color]\n\n配套PDF[upload]https://file.cc98.org/notes.pdf[/upload]\n[url=javascript:alert(1)]不安全链接[/url]', bodyFormat: 'ubb', file: { url: '/zjubio/api/content/files/paper-teacher#page=2&view=FitV&toolbar=1', fileName: '回忆.pdf' } },
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
      if (path.startsWith('/api/content/files/')) return route.fulfill({ contentType: 'application/pdf', body: pdf });
      await route.fulfill({ json: result });
    });
    await page.goto('/#resources/#BIO2019F/#papers');
    if (await page.locator('html').getAttribute('data-theme') !== theme) await page.locator('.theme-switch').click();
    const rows = page.locator('.paper-row-card');
    await expect(rows).toHaveCount(2);
    await expect(rows.first().locator('.paper-row-card__title')).toHaveText(papers[0].title);
    await expect(rows.first().locator('.paper-row-card__subtitle')).toHaveText(papers[0].subtitle);
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
    await expect(page.locator('.pdf-viewer')).toHaveAttribute('data', `${papers[0].file.url}#view=FitH`);
    await expect(page.locator('#paper-title')).toHaveText(papers[0].title);
    await expect(page.locator('.paper-detail .article-detail-card__subtitle')).toHaveText(papers[0].subtitle);
    await expect(page.getByRole('link', { name: /返回历年试卷|^打开 PDF$|^下载 PDF$/ })).toHaveCount(0);
    await expect(page.locator('.comment-section')).toHaveCount(0);
    await expect(page.locator('.paper-actions')).toContainText('原帖分享者');
    await expect(page.locator('.paper-detail__context')).not.toContainText('老师');
    const bodies = page.locator('.paper-detail .article-body');
    await expect(bodies).toHaveCount(2);
    const body = bodies.first(), supplement = bodies.last();
    await expect(body.locator('h2')).toHaveText('考试心得');
    await expect(body.locator('strong')).toHaveText('复习建议');
    await expect(body.locator('.content-file-link')).toHaveAttribute('href', 'https://file.cc98.org/course.pdf');
    await expect(supplement.locator('h3 a')).toHaveAttribute('href', 'https://www.cc98.org/topic/6217956/1#4');
    await expect(supplement.locator('strong')).toHaveText('补充建议');
    await expect(supplement.locator('.content-file-link')).toHaveAttribute('href', 'https://file.cc98.org/notes.pdf');
    await expect(supplement.locator('script')).toHaveCount(0);
    expect(await page.evaluate(() => window.paperUnsafe)).toBeUndefined();
    const dimensions = await body.evaluate(el => {
      const parent = el.closest('.article-detail-card'), s = getComputedStyle(parent);
      const reader = parent.querySelector('.pdf-viewer').getBoundingClientRect(), supplement = parent.querySelectorAll('.article-body')[1].getBoundingClientRect();
      return { width: el.getBoundingClientRect().width, available: parent.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight), bottom: el.getBoundingClientRect().bottom,
        pdfTop: reader.top, pdfBottom: reader.bottom, pdfWidth: reader.width, pdfCenter: reader.x + reader.width / 2,
        bodyCenter: el.getBoundingClientRect().x + el.getBoundingClientRect().width / 2, supplementWidth: supplement.width, supplementTop: supplement.top };
    });
    expect(Math.abs(dimensions.width - dimensions.available)).toBeLessThan(2);
    expect(dimensions.bottom).toBeLessThanOrEqual(dimensions.pdfTop);
    expect(dimensions.supplementTop).toBeGreaterThanOrEqual(dimensions.pdfBottom);
    expect(Math.abs(dimensions.supplementWidth - dimensions.available)).toBeLessThan(2);
    expect(dimensions.pdfWidth).toBeLessThanOrEqual(820);
    expect(dimensions.pdfWidth).toBeGreaterThan(700);
    expect(Math.abs(dimensions.pdfCenter - dimensions.bodyCenter)).toBeLessThan(2);
    const source = page.locator('.paper-actions .article-cc98-badge');
    await expect(source).toHaveAttribute('href', papers[0].sourceUrl);
    await expect(source).toHaveAttribute('rel', 'noopener noreferrer');
    await expect.poll(() => source.locator('img').evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
    const style = await source.evaluate(el => { const s = getComputedStyle(el); return { background: s.backgroundColor, border: s.borderWidth, padding: s.padding }; });
    expect(style.background).toBe('rgba(0, 0, 0, 0)');
    expect(style.border).toBe('0px');
    expect(style.padding).toBe('0px');
    await expect(page.locator('.paper-actions .favorite-button')).toHaveCount(1);
    await page.screenshot({ path: `project-checks/artifacts/paper-detail-${theme}.png`, fullPage: true });
    await page.goto('/#resources/#BIO2019F/#papers/#paper-teacher');
    await expect(page.locator('.paper-detail__context')).toContainText('授课老师：李攀/赵云鹏');
    await expect(page.locator('.paper-actions .article-author-link')).toHaveText('投稿同学');
    await expect(page.locator('.pdf-viewer')).toHaveAttribute('data', '/zjubio/api/content/files/paper-teacher#page=2&view=FitH&toolbar=1');
    const ubbBodies = page.locator('.paper-detail .article-body--ubb');
    await expect(ubbBodies).toHaveCount(2);
    await expect(ubbBodies.first().locator('strong')).toHaveText('复习经验');
    await expect(ubbBodies.last().locator('strong')).toHaveText('原帖补充');
    await expect(ubbBodies.last().locator('[style*="color"]')).toContainText('补充说明');
    await expect(ubbBodies.last().locator('.content-file-link')).toHaveText('点击查看PDF');
    await expect(ubbBodies.last().locator('a[href^="javascript:"]')).toHaveCount(0);
    const ubbDimensions = await ubbBodies.evaluateAll(els => {
      const pdfBox = els[0].parentElement.querySelector('.pdf-viewer').getBoundingClientRect();
      return { mainBottom: els[0].getBoundingClientRect().bottom, pdfTop: pdfBox.top, pdfBottom: pdfBox.bottom, supplementTop: els[1].getBoundingClientRect().top,
        mainWidth: els[0].getBoundingClientRect().width, supplementWidth: els[1].getBoundingClientRect().width };
    });
    expect(ubbDimensions.mainBottom).toBeLessThanOrEqual(ubbDimensions.pdfTop);
    expect(ubbDimensions.supplementTop).toBeGreaterThanOrEqual(ubbDimensions.pdfBottom);
    expect(ubbDimensions.mainWidth).toEqual(ubbDimensions.supplementWidth);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}
