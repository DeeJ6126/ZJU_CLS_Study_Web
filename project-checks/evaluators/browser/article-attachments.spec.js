import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 1000 } });
const base = 'https://file.cc98.org/v4-upload/d/2025/0922/';
const pdf = `${base}fmejnx4u.pdf`, md = `${base}fnelypkx.md`;
const posts = [
  { id: 'ubb-files', routeId: 'ubb-files', courseCode: 'BIO2110F', type: 'material', title: '附件资料', author: '整理者', sourcePublishedDate: '2024-11-06', bodyFormat: 'ubb', body: `报告[upload]${pdf}[/upload]\nMarkdown源码[upload]${md}[/upload]\n\n[url=https://www.cc98.org/topic/6028874/1#2][b]原帖补充：闽山苍翠 · 2L[/b][/url]\n\n[code][upload]${md}[/upload][/code]`, externalUrl: 'https://example.org/legacy.pdf' },
  { id: 'md-files', routeId: 'md-files', courseCode: 'BIO2110F', type: 'experience', title: '心得附件', author: '分享者', bodyFormat: 'markdown', body: `[生态学笔记](${md})\n\n[PDF版](${pdf})\n\n[原帖](https://www.cc98.org/topic/123)\n\n[百度网盘](https://pan.baidu.com/s/abcd?pwd=1234)\n\n[浙大云盘](https://pan.zju.edu.cn/share/abcd)\n\n\`[文件](${md})\`` },
];

async function fixture(page, role = 'student') {
  const errors = [], writes = [], externalRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname.replace(/^\/zjubio/, '');
    if (request.method() !== 'GET') writes.push(path);
    let result = { items: [], activities: [], courses: [], initialized: true, submissions: [], favorites: [], homepages: [], applications: [], notifications: [], unreadCount: 0 };
    if (path === '/api/auth/me') result = { user: { id: 11, publicId: 'attachment-tester', role, nickname: '测试用户', verifications: { email: true } } };
    if (path === '/api/consultation/status') result = { open: false, isMentor: false };
    if (path.startsWith('/api/content/courses/')) result = { items: posts };
    await route.fulfill({ json: result });
  });
  await page.context().route('https://file.cc98.org/**', async route => {
    externalRequests.push(route.request().url());
    await route.fulfill(route.request().url().endsWith('.md')
      ? { contentType: 'application/octet-stream', body: '# Fixture notes' }
      : { contentType: 'text/html', body: '<title>PDF address fixture</title>PDF destination' });
  });
  return { errors, writes, externalRequests };
}

for (const theme of ['light', 'dark']) {
  test(`article attachments render and navigate directly in ${theme}`, async ({ page }) => {
    const state = await fixture(page);
    await page.goto('/#resources/#BIO2110F/#materials/#ubb-files');
    if ((await page.locator('html').getAttribute('data-theme')) !== theme) await page.locator('.theme-switch').click();
    const body = page.locator('.article-body');
    await expect(body.getByRole('link', { name: '点击查看PDF', exact: true })).toHaveCount(2);
    await expect(body.getByRole('link', { name: '点击下载文件', exact: true })).toHaveCount(1);
    await expect(body.locator('pre')).toContainText('[upload]');
    expect(state.externalRequests).toEqual([]);
    const pdfLink = body.getByRole('link', { name: '点击查看PDF', exact: true }).first();
    await expect(page.locator('.article-detail-card__context')).toContainText('发布日期：2024-11-06');
    expect(await pdfLink.evaluate(element => getComputedStyle(element).display)).toBe('flex');
    const boxes = await body.locator('.content-file-link').evaluateAll(elements => elements.map(element => ({ top: element.getBoundingClientRect().top, bottom: element.getBoundingClientRect().bottom })));
    for (let index = 1; index < boxes.length; index++) expect(boxes[index].top).toBeGreaterThanOrEqual(boxes[index - 1].bottom);
    const supplement = body.getByRole('link', { name: '原帖补充：闽山苍翠 · 2L', exact: true });
    await expect(supplement).toHaveAttribute('href', 'https://www.cc98.org/topic/6028874/1#2');
    await expect(supplement.locator('img.content-cc98-icon')).toHaveCount(1);
    await expect.poll(() => supplement.locator('img').evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
    await expect(pdfLink).toHaveAttribute('href', pdf);
    await expect(pdfLink).toHaveAttribute('target', '_blank');
    await expect(pdfLink).toHaveAttribute('rel', 'noopener noreferrer');
    const popupEvent = page.waitForEvent('popup');
    await pdfLink.click();
    const popup = await popupEvent;
    await expect(popup).toHaveURL(pdf);
    await popup.close();
    const downloadEvent = page.waitForEvent('download');
    await body.getByRole('link', { name: '点击下载文件', exact: true }).click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toBe('fnelypkx.md');
    expect(await download.failure()).toBeNull();
    await page.goto('/#resources/#BIO2110F/#experiences/#md-files');
    await expect(body.getByRole('link', { name: '点击查看PDF', exact: true })).toHaveCount(1);
    await expect(body.getByRole('link', { name: '点击下载文件', exact: true })).toHaveCount(1);
    await expect(body.getByRole('link', { name: '原帖', exact: true })).toHaveAttribute('href', 'https://www.cc98.org/topic/123');
    await expect(page.getByText('暂无成绩', { exact: true })).toHaveCount(0);
    for (const name of ['百度网盘', '浙大云盘']) {
      const link = body.getByRole('link', { name, exact: true });
      await expect(link.locator('img.content-cloud-icon')).toHaveCount(1);
      await expect.poll(() => link.locator('img').evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
    }
    await expect(body.locator('code')).toContainText('[文件]');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await body.locator('.content-file-link').first().evaluate(el => getComputedStyle(el).borderRadius)).toBe('4px');
    await page.screenshot({ path: `project-checks/artifacts/article-attachments-${theme}.png` });
    expect(state.errors).toEqual([]);
    expect(state.writes).toEqual([]);
  });
}

test('both editor formats insert attachments and admin hides legacy external URL fields', async ({ page }) => {
  const state = await fixture(page, 'admin');
  await page.goto('/#resources/#BIO2110F/#materials');
  await page.getByRole('button', { name: '投稿', exact: true }).click();
  const panel = page.locator('.contribution-modal__panel');
  await panel.getByRole('button', { name: '插入文件', exact: true }).click();
  await panel.getByRole('textbox', { name: '插入文件', exact: true }).fill(md);
  await panel.getByRole('button', { name: '确定', exact: true }).click();
  await expect(panel.locator('textarea')).toHaveValue(`[附件](${md} "attachment")`);
  await panel.getByRole('tab', { name: 'UBB（论坛格式）', exact: true }).click();
  await panel.locator('textarea').fill('报告');
  await panel.getByRole('button', { name: '插入文件', exact: true }).click();
  await panel.getByRole('textbox', { name: '插入文件', exact: true }).fill(pdf);
  await panel.getByRole('button', { name: '确定', exact: true }).click();
  await expect(panel.locator('textarea')).toHaveValue(`报告[upload]${pdf}[/upload]`);
  await expect(panel.getByRole('textbox', { name: /外部链接|资料链接/ })).toHaveCount(0);
  await panel.getByRole('button', { name: '取消', exact: true }).click();
  await page.goto('/#admin');
  await page.getByRole('button', { name: '新增内容', exact: true }).click();
  const editor = page.getByRole('region', { name: '内容编辑器', exact: true });
  await editor.getByRole('combobox', { name: '内容类型', exact: true }).selectOption('material');
  await expect(editor.getByRole('textbox', { name: '外部链接', exact: true })).toHaveCount(0);
  expect(state.errors).toEqual([]);
  expect(state.writes).toEqual([]);
});
