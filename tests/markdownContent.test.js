import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  bodyToParagraphs,
  parseMarkdownDocument,
  splitPipeList,
  splitTimeline,
} from '../src/utils/markdownContent.js';

test('markdown content parser reads frontmatter and body paragraphs', () => {
  const markdown = readFileSync('public/resource/courses/basic/BIO2110F_microbiology-a/materials/1.md', 'utf8');
  const document = parseMarkdownDocument(markdown);

  assert.equal(document.frontmatter.id, '1');
  assert.equal(document.frontmatter.author, 'DeeJ');
  assert.equal(document.frontmatter.externalUrl, 'https://deej6126.github.io/ZJU_Microbiology_tests/');
  assert.ok(bodyToParagraphs(document.body).length >= 2);
});

test('overview helpers parse pipe-delimited lists and timeline entries', () => {
  assert.deepEqual(splitPipeList('A|B|C'), ['A', 'B', 'C']);
  assert.deepEqual(splitTimeline('预习：先看名词|复习：再做题'), [
    { title: '预习', text: '先看名词' },
    { title: '复习', text: '再做题' },
  ]);
});
