import test from 'node:test';
import assert from 'node:assert/strict';

import { ubbToHtml, isUbbFormat } from '../src/utils/ubbParser.js';

test('escapes raw HTML so it cannot inject tags', () => {
  const result = ubbToHtml('<script>alert(1)</script>');
  assert.equal(result, '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
});

test('preserves ampersand and quote characters in plain text', () => {
  const result = ubbToHtml('A & B "c" \'d\'');
  assert.equal(result.includes('&amp;'), true);
  assert.equal(result.includes('&quot;'), true);
  assert.equal(result.includes('&#39;'), true);
  assert.equal(result.includes('<script>'), false);
});

test('renders basic inline tags b/i/u/s', () => {
  const result = ubbToHtml('[b]粗[/b] [i]斜[/i] [u]下[/u] [s]删[/s]');
  assert.equal(result, '<p><strong>粗</strong> <em>斜</em> <u>下</u> <s>删</s></p>');
});

test('paired [url=href]text[/url] becomes anchor with safe href', () => {
  const result = ubbToHtml('[url=https://example.com]链接[/url]');
  assert.equal(result, '<p><a class="ubb-link" href="https://example.com" target="_blank" rel="noopener noreferrer">链接</a></p>');
});

test('javascript: URL is rejected and inner text remains', () => {
  const result = ubbToHtml('[url=javascript:alert(1)]点我[/url]');
  assert.equal(result.includes('<a'), false);
  assert.equal(result.includes('javascript:'), false);
  assert.equal(result.includes('点我'), true);
});

test('data: and unknown scheme URLs are stripped', () => {
  const result = ubbToHtml('[url=data:text/html,<h1>x</h1>]x[/url]');
  assert.equal(result.includes('<a'), false);
  assert.equal(result.includes('data:'), false);
});

test('[img] tag with safe URL becomes img', () => {
  const result = ubbToHtml('[img]https://example.com/x.png[/img]');
  assert.equal(result, '<p><img class="ubb-image" src="https://example.com/x.png" alt="" loading="lazy" /></p>');
});

test('[img]javascript: URL is dropped, leaves no broken markup', () => {
  const result = ubbToHtml('[img]javascript:alert(1)[/img]');
  // The image slot is replaced with empty string, so the resulting paragraphs
  // (after split/filter) collapse to no content.
  assert.equal(result, '');
  assert.equal(result.includes('<img'), false);
  assert.equal(result.includes('javascript:'), false);
});

test('mailto: and tel: links are preserved', () => {
  const mailto = ubbToHtml('[url=mailto:foo@bar.com]邮箱[/url]');
  assert.equal(mailto, '<p><a class="ubb-link" href="mailto:foo@bar.com" target="_blank" rel="noopener noreferrer">邮箱</a></p>');

  const tel = ubbToHtml('[url=tel:13800138000]电话[/url]');
  assert.equal(tel, '<p><a class="ubb-link" href="tel:13800138000" target="_blank" rel="noopener noreferrer">电话</a></p>');
});

test('[code] tag escapes inner content verbatim', () => {
  const result = ubbToHtml('[code]<script>x</script> & "y"[/code]');
  assert.equal(result.includes('&lt;script&gt;'), true);
  assert.equal(result.includes('&amp;'), true);
  assert.equal(result.includes('&quot;'), true);
  assert.equal(result.includes('<pre class="ubb-code">'), true);
});

test('[quote] tag wraps inner content in blockquote', () => {
  const result = ubbToHtml('[quote]你好世界[/quote]');
  assert.equal(result, '<p><blockquote class="ubb-quote">你好世界</blockquote></p>');
});

test('[size] tag clamps to range 1-7', () => {
  const small = ubbToHtml('[size=0]x[/size]');
  assert.equal(small.includes('ubb-size-1'), true);
  const big = ubbToHtml('[size=99]x[/size]');
  assert.equal(big.includes('ubb-size-7'), true);
});

test('[color] tag accepts hex and named colors', () => {
  const hex = ubbToHtml('[color=#ff0000]红[/color]');
  assert.equal(hex.includes('color:#ff0000'), true);
  const name = ubbToHtml('[color=red]红[/color]');
  assert.equal(name.includes('color:red'), true);
});

test('[align] tag outputs text-align style', () => {
  const result = ubbToHtml('[align=center]中[/align]');
  assert.equal(result.includes('text-align:center'), true);
  const invalid = ubbToHtml('[align=banana]x[/align]');
  assert.equal(invalid.includes('text-align'), false);
});

test('[smiley] tag wraps in span', () => {
  const result = ubbToHtml('[smiley]smile[/smiley]');
  assert.equal(result, '<p><span class="ubb-smiley">smile</span></p>');
});

test('unknown tags remain as plain text and are not consumed', () => {
  const result = ubbToHtml('[bilibili]BV1xx[/bilibili]');
  assert.equal(result.includes('[bilibili]'), true);
  assert.equal(result.includes('<bilibili>'), false);
});

test('unpaired [b] tag does not consume later text', () => {
  // Without a matching [/b], the lazy match leaves the [b] tag visible as
  // text rather than producing stray markup. The fully-paired [i] still
  // renders normally.
  const result = ubbToHtml('[b]粗体未关闭 [i]斜体[/i]');
  assert.equal(result.includes('<strong>'), false);
  assert.equal(result.includes('[b]'), true);
  assert.equal(result.includes('粗体未关闭'), true);
  assert.equal(result.includes('<em>'), true);
  assert.equal(result.includes('斜体'), true);
});

test('mismatched closing tags are not consumed', () => {
  const result = ubbToHtml('[b]a[/i]');
  assert.equal(result.includes('[/i]'), true);
});

test('paragraph splitting: blank line splits paragraphs', () => {
  const result = ubbToHtml('第一段\n\n第二段');
  assert.equal(result, '<p>第一段</p><p>第二段</p>');
});

test('single newline becomes <br> within paragraph', () => {
  const result = ubbToHtml('a\nb');
  assert.equal(result, '<p>a<br>b</p>');
});

test('isUbbFormat only matches "ubb" (case-insensitive)', () => {
  assert.equal(isUbbFormat('ubb'), true);
  assert.equal(isUbbFormat('UBB'), true);
  assert.equal(isUbbFormat('markdown'), false);
  assert.equal(isUbbFormat(''), false);
  assert.equal(isUbbFormat(null), false);
});

test('empty input returns empty string', () => {
  assert.equal(ubbToHtml(''), '');
  assert.equal(ubbToHtml(null), '');
  assert.equal(ubbToHtml(undefined), '');
});
