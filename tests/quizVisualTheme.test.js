import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import postcss from 'postcss';

test('quiz surfaces use shared theme tokens instead of light-only literal colors', async () => {
  const css = await readFile(new URL('../src/styles/demo.css', import.meta.url), 'utf8');
  const stylesheet = postcss.parse(css);
  stylesheet.walkDecls((declaration) => {
    assert.doesNotMatch(declaration.value, /#[0-9a-f]{3,8}\b|rgba?\(/i, declaration.toString());
  });
  for (const token of ['color-surface', 'color-ink', 'color-muted', 'color-line', 'color-primary', 'color-positive', 'color-negative']) {
    assert.ok(css.includes(`var(--${token})`), `Missing ${token}`);
  }
  assert.doesNotMatch(css, /!important|linear-gradient|radial-gradient/);
});

test('answered quiz options retain readable feedback and active tiles retain a separate marker', async () => {
  const css = await readFile(new URL('../src/styles/demo.css', import.meta.url), 'utf8');
  const rules = new Map();
  postcss.parse(css).walkRules((rule) => {
    if (rule.parent.type === 'root') rules.set(rule.selector, rule);
  });
  const feedback = rules.get('.quiz-demo .practice-options button:disabled');
  assert.equal(feedback.nodes.find((node) => node.prop === 'opacity')?.value, '1');
  assert.ok(rules.get('.question-grid-cell.is-active').nodes.some((node) => node.prop === 'outline'));
  assert.match(css, /\.question-grid-cell\.is-correct\s*\{[^}]*var\(--color-positive-soft\)/);
  assert.match(css, /\.question-grid-cell\.is-incorrect\s*\{[^}]*var\(--color-negative-soft\)/);
});

test('quiz presentation exposes selected states without changing answer event handling', async () => {
  const choice = await readFile(new URL('../src/components/quiz/ChoiceQuestionView.vue', import.meta.url), 'utf8');
  const shell = await readFile(new URL('../src/components/quiz/QuizCourseShell.vue', import.meta.url), 'utf8');
  const layout = await readFile(new URL('../src/components/quiz/QuizPracticeLayout.vue', import.meta.url), 'utf8');
  assert.match(choice, /:aria-pressed="selectedKey === option.key"/);
  assert.match(choice, /@click="emit\('select', option.key\)"/);
  assert.match(shell, /:aria-current="page === item.id \? 'page' : null"/);
  assert.match(layout, /:aria-current="tile.index === activeIndex \? 'step' : null"/);
});
