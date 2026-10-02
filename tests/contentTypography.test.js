import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import postcss from 'postcss';

const stylesheet = await readFile(new URL('../src/styles/content-typography.css', import.meta.url), 'utf8');
const css = postcss.parse(stylesheet);
const wrappers = ['article-body', 'comment-body', 'notice-body', 'notice-admin__markdown', 'about-page__body', 'markdown-answer'];

test('all actual rich-text readers share body, heading, table and code defaults', () => {
  const rules = [];
  css.walkRules((rule) => rules.push(rule));
  for (const wrapper of wrappers) {
    const matching = rules.filter((rule) => rule.selector.includes(`.${wrapper}`));
    const hasDeclaration = (property, value) => matching.some((rule) => rule.nodes.some((node) => node.prop === property && node.value === value));
    assert.ok(hasDeclaration('font-family', 'var(--font-body)'), wrapper);
    assert.ok(hasDeclaration('font-size', '16px'), wrapper);
    assert.ok(hasDeclaration('line-height', '1.8'), wrapper);
    assert.ok(hasDeclaration('font-family', 'var(--font-heading)'), wrapper);
    assert.ok(hasDeclaration('font-family', 'var(--font-mono)'), wrapper);
    assert.ok(hasDeclaration('border-collapse', 'collapse'), wrapper);
    assert.ok(hasDeclaration('overflow-x', 'auto'), wrapper);
    assert.ok(hasDeclaration('max-width', '100%'), wrapper);
  }
});

test('rich-text defaults preserve author formatting and use theme tokens', () => {
  css.walkDecls((declaration) => {
    assert.equal(declaration.important, undefined, declaration.toString());
    if (['color', 'background', 'border', 'border-left', 'border-top', 'outline'].includes(declaration.prop)) {
      assert.doesNotMatch(declaration.value, /#[\da-f]{3,8}\b|rgba?\(/i);
    }
    assert.notEqual(declaration.prop, 'text-align');
  });
  for (const size of [1, 2, 3, 4, 5, 6, 7]) assert.match(stylesheet, new RegExp(`\\.ubb-size-${size}\\b`));
  assert.match(stylesheet, /text-align:center/);
  assert.match(stylesheet, /text-align:right/);
  assert.doesNotMatch(stylesheet, /filter:\s*invert|mix-blend-mode/);
});

test('comment rich text is placed in div wrappers rather than nested paragraphs', async () => {
  const component = await readFile(new URL('../src/components/CommentSection.vue', import.meta.url), 'utf8');
  assert.equal((component.match(/<div class="comment-body" v-html=/g) ?? []).length, 2);
  assert.doesNotMatch(component, /<p class="comment-body"/);
});
