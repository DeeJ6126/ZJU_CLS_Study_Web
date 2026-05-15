import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readStyle = (name) => readFileSync(new URL(`../src/styles/${name}.css`, import.meta.url), 'utf8');

const getBlock = (css, selector) => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `Missing ${selector} block`);
  return match[1];
};

test('primary content pages are not capped by page-level max width', () => {
  const resourceCss = readStyle('resource');
  const courseDetailCss = readStyle('course-detail');
  const settingsCss = readStyle('settings');

  assert.doesNotMatch(getBlock(resourceCss, '.resource-page'), /max-width:/);
  assert.doesNotMatch(getBlock(courseDetailCss, '.course-detail'), /max-width:/);
  assert.doesNotMatch(getBlock(settingsCss, '.settings-page'), /max-width:/);
});

test('card grids use auto fitting tracks instead of fixed column counts', () => {
  const resourceCss = readStyle('resource');
  const courseDetailCss = readStyle('course-detail');

  assert.match(resourceCss, /\.resource-grid\s*\{[\s\S]*?repeat\(auto-fit,/);
  assert.match(courseDetailCss, /\.three-column-cards\s*\{[\s\S]*?repeat\(auto-fit,/);
  assert.doesNotMatch(courseDetailCss, /\.three-column-cards\s*\{[\s\S]*?repeat\(3,/);
});
