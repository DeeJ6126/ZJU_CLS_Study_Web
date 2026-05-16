import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import { normalizePublicPath } from '../src/utils/publicPath.js';

test('GitHub Pages workflow builds Vite output and deploys dist', () => {
  const workflowPath = '.github/workflows/deploy-pages.yml';

  assert.equal(existsSync(workflowPath), true);

  const workflow = readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /actions\/upload-pages-artifact/);
  assert.match(workflow, /actions\/deploy-pages/);
  assert.match(workflow, /path:\s+dist/);
});

test('public path helper prefixes assets for project GitHub Pages without touching external URLs', () => {
  assert.equal(
    normalizePublicPath('/resource/summary/introduction.csv', '/ZJU_CLS_Study_Web/'),
    '/ZJU_CLS_Study_Web/resource/summary/introduction.csv',
  );
  assert.equal(
    normalizePublicPath('resource/courses/basic/file.md', './'),
    './resource/courses/basic/file.md',
  );
  assert.equal(
    normalizePublicPath('https://example.com/file.pdf', '/ZJU_CLS_Study_Web/'),
    'https://example.com/file.pdf',
  );
});
