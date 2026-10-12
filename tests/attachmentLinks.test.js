import test from 'node:test';
import assert from 'node:assert/strict';
import { attachmentLink, renderAttachmentLink, renderLegacyResourceLink } from '../src/utils/attachmentLinks.js';
import { renderCourseMarkdown } from '../src/utils/renderCourseMarkdown.js';
import { ubbToHtml } from '../src/utils/ubbParser.js';

const base = 'https://file.cc98.org/v4-upload/d/2025/0922/';

test('attachments identify PDFs from pathname, preserve queries and download other file types', () => {
  const pdf = attachmentLink(`${base}report.PDF?key=a&download=1#page=2`);
  assert.equal(pdf.isPdf, true);
  assert.equal(pdf.label, '点击查看PDF');
  assert.match(renderAttachmentLink(pdf.url), /target="_blank" rel="noopener noreferrer"/);
  assert.doesNotMatch(renderAttachmentLink(pdf.url), / download=/);
  const md = renderAttachmentLink(`${base}fnelypkx.md?a=1&b=2`);
  assert.match(md, /download="fnelypkx.md"/);
  assert.match(md, /a=1&amp;b=2/);
  assert.match(md, /点击下载文件/);
  assert.equal(attachmentLink('https://www.cc98.org/topic/123'), null);
});

test('explicit attachments support opaque URLs and reject unsafe targets', () => {
  assert.match(renderAttachmentLink('https://example.org/download?id=1', { force: true }), /点击下载文件/);
  for (const url of ['javascript:alert(1)', 'data:text/html,x', '//evil.test/a.pdf', 'file:///a.pdf', 'https://user:password@example.org/a.pdf', 'https://example.org/a.pdf\n', 'https://example.org/a\\b.pdf']) {
    const value = url.endsWith('\n') ? url + 'injected' : url;
    assert.equal(renderAttachmentLink(value, { force: true }), '', value);
  }
  const html = renderAttachmentLink('https://example.org/%22onmouseover%3D%22evil.md');
  assert.doesNotMatch(html, /title=""onmouseover/);
  assert.match(html, /download="_onmouseover=_evil.md"/);
});

test('CC98 upload tags render multiple safe files while preserving report text', () => {
  const html = ubbToHtml(`生态学笔记[upload]${base}fmejnx4u.pdf[/upload]\nMarkdown源码[UPLOAD]${base}fnelypkx.md[/UPLOAD]\n[upload]javascript:alert(1)[/upload]`);
  assert.match(html, /生态学笔记/);
  assert.match(html, /Markdown源码/);
  assert.equal((html.match(/class="course-action-link content-file-link"/g) ?? []).length, 2);
  assert.match(html, /点击查看PDF/);
  assert.match(html, /点击下载文件/);
  assert.doesNotMatch(html, /href="javascript:/);
});

test('Markdown file links keep labels, normal topic links and images stay normal', () => {
  const html = renderCourseMarkdown(`[生态学笔记](${base}fnelypkx.md)\n\n[PDF版](${base}fmejnx4u.pdf)\n\n[帖子](https://www.cc98.org/topic/123)\n\n![图片](${base}image.png)\n\n[附件](https://example.org/download "attachment")`);
  assert.match(html, /content-file-caption">生态学笔记/);
  assert.equal((html.match(/content-file-link/g) ?? []).length, 3);
  assert.match(html, />帖子<\/a>/);
  assert.match(html, /<img /);
  assert.doesNotMatch(html, /download="fmejnx4u.pdf"/);
});

test('attachment syntax stays literal inside code examples', () => {
  for (const html of [ubbToHtml(`[code][upload]${base}fnelypkx.md[/upload]\n[b]示例[/b][/code]`), renderCourseMarkdown(`\`\`\`\n[附件](${base}fnelypkx.md)\n\`\`\``)]) {
    assert.doesNotMatch(html, /<a /);
    assert.match(html, /<pre/);
  }
});

test('legacy external resources remain available without changing stored content', () => {
  assert.match(renderLegacyResourceLink(`${base}fmejnx4u.pdf`), /点击查看PDF/);
  assert.match(renderLegacyResourceLink('https://example.org/quiz'), /打开资料链接/);
  assert.equal(renderLegacyResourceLink('javascript:alert(1)'), '');
});
