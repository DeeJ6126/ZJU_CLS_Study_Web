import test from 'node:test';
import assert from 'node:assert/strict';

import { renderCommentBody } from '../src/utils/commentUbb.js';

test('renderCommentBody passes plain text through ubbToHtml as a single paragraph', () => {
  const result = renderCommentBody('你好，世界');
  assert.equal(result, '<p>你好，世界</p>');
});

test('renderCommentBody renders basic inline UBB tags (b/i/u/s)', () => {
  const result = renderCommentBody('[b]粗[/b] [i]斜[/i] [u]下[/u] [s]删[/s]');
  assert.equal(result, '<p><strong>粗</strong> <em>斜</em> <u>下</u> <s>删</s></p>');
});

test('renderCommentBody renders [code] tag and escapes inner content', () => {
  const result = renderCommentBody('[code]<script>x</script> & "y"[/code]');
  assert.equal(result.includes('<pre class="ubb-code">'), true);
  assert.equal(result.includes('&lt;script&gt;'), true);
  assert.equal(result.includes('&amp;'), true);
  assert.equal(result.includes('&quot;'), true);
  assert.equal(result.includes('<script>'), false);
});

test('renderCommentBody renders paired [url=href]text[/url] safely', () => {
  const result = renderCommentBody('[url=https://example.com]链接[/url]');
  assert.equal(
    result,
    '<p><a class="ubb-link" href="https://example.com" target="_blank" rel="noopener noreferrer">链接</a></p>',
  );
});

test('renderCommentBody strips javascript: URLs and keeps the visible text', () => {
  const result = renderCommentBody('[url=javascript:alert(1)]点我[/url]');
  assert.equal(result.includes('<a'), false);
  assert.equal(result.includes('javascript:'), false);
  assert.equal(result.includes('点我'), true);
});

test('renderCommentBody escapes raw HTML so v-html cannot inject tags', () => {
  const result = renderCommentBody('<script>alert(1)</script>');
  assert.equal(result, '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
  assert.equal(result.includes('<script>'), false);
});

test('renderCommentBody handles null/undefined and empty string safely', () => {
  assert.equal(renderCommentBody(null), '');
  assert.equal(renderCommentBody(undefined), '');
  assert.equal(renderCommentBody(''), '');
  // Whitespace-only content collapses to no paragraph because the parser
  // trims and drops empty paragraphs; this matches ubbToHtml behavior.
  assert.equal(renderCommentBody('   '), '');
});

test('renderCommentBody leaves unknown UBB tags visible as plain text', () => {
  const result = renderCommentBody('[bilibili]BV1xx[/bilibili]');
  assert.equal(result.includes('[bilibili]'), true);
  assert.equal(result.includes('<bilibili>'), false);
});

test('renderCommentBody splits paragraphs on blank lines', () => {
  const result = renderCommentBody('第一段\n\n第二段');
  assert.equal(result, '<p>第一段</p><p>第二段</p>');
});
