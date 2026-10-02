import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';

const pages = ['activities', 'about', 'admin', 'profile', 'auth', 'notices', 'consultation', 'settings'];
const styles = new Map(pages.map((name) => [name, postcss.parse(
  readFileSync(new URL(`../src/styles/${name}.css`, import.meta.url), 'utf8'),
)]));

function declarations(page, selector) {
  const values = new Map();
  styles.get(page).walkRules((rule) => {
    if (rule.selectors.includes(selector)) {
      rule.walkDecls((declaration) => values.set(declaration.prop, declaration.value));
    }
  });
  return values;
}

test('secondary pages inherit the shared light and dark palette without literal color overrides', () => {
  for (const [name, css] of styles) {
    css.walkDecls((declaration) => {
      assert.doesNotMatch(declaration.value, /#[0-9a-f]{3,8}\b/i, `${name}: ${declaration.toString()}`);
    });
    css.walkRules((rule) => {
      assert.doesNotMatch(rule.selector, /data-theme/, `${name} must inherit shared theme tokens`);
    });
  }
});

test('auth backdrop centers a bounded, scrollable dialog independently of viewport', () => {
  const backdrop = declarations('auth', '.auth-dialog-backdrop');
  assert.equal(backdrop.get('position'), 'fixed');
  assert.equal(backdrop.get('inset'), '0');
  assert.equal(backdrop.get('align-items'), 'center');
  assert.equal(backdrop.get('justify-content'), 'center');
  const dialog = declarations('auth', '.auth-dialog');
  assert.equal(dialog.get('overflow-y'), 'auto');
  assert.match(dialog.get('max-height'), /100vh/);
  assert.equal(dialog.has('bottom'), false);
  assert.equal(dialog.has('right'), false);
});

test('activity details retain readable typography and uncropped source imagery', () => {
  assert.equal(declarations('activities', '.activity-detail-page__hero img').get('object-fit'), 'contain');
  assert.equal(declarations('activities', '.activity-detail-page__head h1').get('font-size'), '30px');
  assert.equal(declarations('activities', '.activity-detail-page__articles li a').get('display'), 'grid');
});

test('admin publication and rejection states remain semantic across themes', () => {
  assert.equal(declarations('admin', '.admin-status[data-status="published"]').get('color'), 'var(--color-positive)');
  assert.equal(declarations('admin', '.admin-status[data-status="rejected"]').get('color'), 'var(--color-negative)');
  assert.equal(declarations('admin', '.admin-status[data-status="pending"]').get('color'), 'var(--color-warning)');
});
