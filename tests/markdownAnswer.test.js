import test from 'node:test';
import assert from 'node:assert/strict';

import { parseMarkdownAnswer } from '../src/services/markdownAnswerService.js';

test('markdown answer parser keeps headings, lists, code blocks, and paragraphs structured', () => {
  const blocks = parseMarkdownAnswer(`# 参考答案

- 第一条
- 第二条

\`\`\`
DNA -> RNA
\`\`\`

普通段落`);

  assert.deepEqual(blocks, [
    { type: 'heading', level: 1, text: '参考答案' },
    { type: 'list', ordered: false, items: ['第一条', '第二条'] },
    { type: 'code', text: 'DNA -> RNA' },
    { type: 'paragraph', text: '普通段落' },
  ]);
});

test('markdown answer parser treats html as text instead of executable markup', () => {
  assert.deepEqual(parseMarkdownAnswer('<img src=x onerror=alert(1)>'), [
    { type: 'paragraph', text: '<img src=x onerror=alert(1)>' },
  ]);
});
