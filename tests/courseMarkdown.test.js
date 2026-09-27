import test from 'node:test';
import assert from 'node:assert/strict';

import { renderCourseMarkdown } from '../src/utils/renderCourseMarkdown.js';

test('course Markdown renders inline emphasis and common blocks', () => {
  const html = renderCourseMarkdown('**加粗** *斜体*\n\n- 第一项\n- 第二项');
  assert.match(html, /<strong>加粗<\/strong>/);
  assert.match(html, /<em>斜体<\/em>/);
  assert.match(html, /<ul>[\s\S]*<li>第一项<\/li>[\s\S]*<li>第二项<\/li>/);
});

test('course Markdown escapes raw HTML and rejects unsafe links and images', () => {
  const html = renderCourseMarkdown('<script>alert(1)</script>\n\n[bad](javascript:alert(1)) ![bad](data:image/svg+xml;base64,PHN2Zz4=)');
  assert.doesNotMatch(html, /<script>|href="javascript:|src="data:/);
  assert.match(html, /&lt;script&gt;/);
});

test('course Markdown keeps safe CC98 links and image URLs', () => {
  const html = renderCourseMarkdown('[帖子](https://www.cc98.org/topic/123) ![图](https://www.cc98.org/image.png)');
  assert.match(html, /href="https:\/\/www\.cc98\.org\/topic\/123"/);
  assert.match(html, /src="https:\/\/www\.cc98\.org\/image\.png"/);
});

test('course Markdown supports the editor tools without requiring images', () => {
  const html = renderCourseMarkdown('## 标题\n\n**加粗** *斜体* ~~删除~~ [链接](https://www.cc98.org/topic/1)\n\n> 引用\n\n```js\nconst n = 1;\n```\n\n- 第一项');
  for (const tag of ['<h2>', '<strong>', '<em>', '<del>', '<a ', '<blockquote>', '<pre>', '<ul>']) {
    assert.ok(html.includes(tag), `missing ${tag}`);
  }
  assert.doesNotMatch(html, /<img/);
});
