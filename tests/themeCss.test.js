import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const baseCss = readFileSync(new URL('../src/styles/base.css', import.meta.url), 'utf8');

const getBlock = (selector) => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm');
  const match = baseCss.match(pattern);
  assert.ok(match, `Missing CSS block for ${selector}`);
  return match[1];
};

const getToken = (block, tokenName) => {
  const pattern = new RegExp(`${tokenName}:\\s*(#[0-9a-fA-F]{6})`);
  const match = block.match(pattern);
  assert.ok(match, `Missing ${tokenName}`);
  return match[1].toLowerCase();
};

test('default minimalist white uses Modern Minimalist colors instead of green accents', () => {
  const rootBlock = getBlock(':root');

  assert.equal(getToken(rootBlock, '--color-primary'), '#36454f');
  assert.equal(getToken(rootBlock, '--color-accent'), '#708090');
  assert.equal(getToken(rootBlock, '--resource-card-title'), '#36454f');
  assert.equal(getToken(rootBlock, '--detail-link'), '#36454f');
});

test('theme CSS exposes distinct theme-factory color identities for all alternate themes', () => {
  const plantBlock = getBlock('html[data-theme="plant-green"]');
  const blueBlock = getBlock('html[data-theme="life-blue"]');
  const blackBlock = getBlock('html[data-theme="silent-black"]');
  const techBlock = getBlock('html[data-theme="tech-innovation"]');

  assert.equal(getToken(plantBlock, '--color-primary'), '#2d4a2b');
  assert.equal(getToken(plantBlock, '--color-accent'), '#7d8471');
  assert.equal(getToken(blueBlock, '--color-primary'), '#4a6fa5');
  assert.equal(getToken(blueBlock, '--color-accent'), '#c0c0c0');
  assert.equal(getToken(blackBlock, '--color-primary'), '#a490c2');
  assert.equal(getToken(blackBlock, '--color-accent'), '#4a4e8f');
  assert.equal(getToken(techBlock, '--color-primary'), '#0066ff');
  assert.equal(getToken(techBlock, '--color-accent'), '#00ffff');
  assert.equal(getToken(techBlock, '--color-surface'), '#1e1e1e');
});
