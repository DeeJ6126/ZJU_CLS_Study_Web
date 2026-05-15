import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const netlifyConfig = readFileSync(new URL('../netlify.toml', import.meta.url), 'utf8');

test('Netlify config builds the Vite app and publishes dist output', () => {
  assert.match(netlifyConfig, /\[build\]/);
  assert.match(netlifyConfig, /command\s*=\s*"npm run build"/);
  assert.match(netlifyConfig, /publish\s*=\s*"dist"/);
});

test('Netlify config pins a Node version compatible with Vite 7', () => {
  assert.match(netlifyConfig, /\[build\.environment\]/);
  assert.match(netlifyConfig, /NODE_VERSION\s*=\s*"22"/);
});

test('Netlify config rewrites SPA routes to index.html', () => {
  assert.match(netlifyConfig, /\[\[redirects\]\]/);
  assert.match(netlifyConfig, /from\s*=\s*"\/\*"/);
  assert.match(netlifyConfig, /to\s*=\s*"\/index.html"/);
  assert.match(netlifyConfig, /status\s*=\s*200/);
});
