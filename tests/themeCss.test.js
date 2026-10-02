import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';

const baseCss = readFileSync(new URL('../src/styles/base.css', import.meta.url), 'utf8');

const rules = postcss.parse(baseCss);
const tokensFor = (selector) => {
  let tokens;
  rules.walkRules((rule) => {
    if (rule.selector === selector) tokens = Object.fromEntries(rule.nodes.filter((node) => node.type === 'decl').map((node) => [node.prop, node.value]));
  });
  assert.ok(tokens, `Missing CSS block for ${selector}`);
  return tokens;
};

test('Minimal professional provides shared neutral surfaces and teal accents', () => {
  const tokens = tokensFor(':root');
  assert.equal(tokens['--color-primary'], '#14768a');
  assert.equal(tokens['--color-ink'], '#213139');
  assert.equal(tokens['--color-soft'], '#f5f8f9');
  assert.equal(tokens['--resource-card-title'], 'var(--color-ink)');
  assert.equal(tokens['--detail-link'], 'var(--color-primary-strong)');
  assert.equal(tokens['--radius-sm'], '4px');
  assert.match(tokens['--font-body'], /Outfit/);
  assert.match(tokens['--font-code'], /Space Grotesk/);
  assert.match(tokens['--font-mono'], /monospace/);
});

test('legacy theme IDs map to the same shared light and dark design language', () => {
  const light = tokensFor(':root');
  const dark = tokensFor('html[data-theme="dark"]');
  assert.equal(dark['--color-primary'], '#84cbda');
  assert.equal(dark['--color-surface'], '#22292c');
  assert.equal(dark['--color-ink'], '#f1f5f6');
  for (const [mode, aliases] of [[light, ['plant-green', 'life-blue']], [dark, ['silent-black', 'tech-innovation']]]) {
    for (const alias of aliases) {
      const tokens = tokensFor(`html[data-theme="${alias}"]`);
      for (const name of Object.keys(mode).filter((name) => name.startsWith('--color-') || name.startsWith('--detail-') || name.startsWith('--resource-'))) {
        assert.equal(tokens[name], mode[name], `${alias}: ${name}`);
      }
    }
  }
});

test('both palettes keep body, muted, primary and semantic text readable', () => {
  const luminance = (hex) => [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
    .reduce((total, value, index) => total + value * [.2126, .7152, .0722][index], 0);
  const contrast = (a, b) => { const values = [luminance(a), luminance(b)].sort((a, b) => b - a); return (values[0] + .05) / (values[1] + .05); };
  for (const selector of [':root', 'html[data-theme="dark"]']) {
    const tokens = tokensFor(selector);
    for (const text of ['--color-ink', '--color-muted', '--color-primary', '--color-positive', '--color-negative', '--color-warning']) {
      for (const surface of ['--color-soft', '--color-surface']) assert.ok(contrast(tokens[text], tokens[surface]) >= 4.5, `${selector} ${text} on ${surface}`);
    }
    assert.ok(contrast(tokens['--color-on-primary'], tokens['--color-primary']) >= 4.5);
  }
});
