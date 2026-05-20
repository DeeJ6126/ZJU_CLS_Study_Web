import test from 'node:test';
import assert from 'node:assert/strict';

import { checkArchitecture } from '../harness/scripts/check-architecture.mjs';
import { checkContentLocation } from '../harness/scripts/check-content-location.mjs';
import { checkRoutes } from '../harness/scripts/check-routes.mjs';
import { checkThemes } from '../harness/scripts/check-themes.mjs';
import { buildReport } from '../harness/scripts/collect-report.mjs';

const rootDir = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

test('harness route check validates course-code resource routes', async () => {
  const result = await checkRoutes({ rootDir });

  assert.equal(result.ok, true);
  assert.ok(result.checked.courseCount > 0);
  assert.ok(result.checked.sampleRoute.startsWith('#resources/#'));
});

test('harness content-location check keeps long user content out of components', async () => {
  const result = await checkContentLocation({ rootDir });

  assert.equal(result.ok, true);
  assert.ok(result.checked.files > 0);
});

test('harness theme check requires every configured theme to have CSS tokens', async () => {
  const result = await checkThemes({ rootDir });

  assert.equal(result.ok, true);
  assert.deepEqual(result.checked.themeIds, [
    'minimal-white',
    'plant-green',
    'life-blue',
    'silent-black',
    'tech-innovation',
  ]);
});

test('harness architecture check enforces service and public-path boundaries', async () => {
  const result = await checkArchitecture({ rootDir });

  assert.equal(result.ok, true);
  assert.ok(result.checked.rules >= 3);
});

test('harness report builder records status, commands, and next steps', () => {
  const report = buildReport({
    rootDir,
    startedAt: '2026-05-20T12:00:00.000Z',
    endedAt: '2026-05-20T12:01:00.000Z',
    gitCommit: 'abc123',
    results: [
      {
        name: 'routes',
        ok: true,
        command: 'npm.cmd run harness:routes',
        failures: [],
        checked: { courseCount: 1 },
        suggestions: [],
      },
    ],
  });

  assert.equal(report.ok, true);
  assert.equal(report.gitCommit, 'abc123');
  assert.equal(report.results[0].command, 'npm.cmd run harness:routes');
  assert.equal(report.nextSteps[0], 'Harness checks passed. Continue with implementation or CI handoff.');
});
