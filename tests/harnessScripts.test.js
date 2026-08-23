import test from 'node:test';
import assert from 'node:assert/strict';

import { checkArchitecture } from '../project-checks/scripts/check-architecture.mjs';
import { checkContentLocation } from '../project-checks/scripts/check-content-location.mjs';
import { checkRoutes } from '../project-checks/scripts/check-routes.mjs';
import { checkThemes } from '../project-checks/scripts/check-themes.mjs';
import { buildReport } from '../project-checks/scripts/collect-report.mjs';

const rootDir = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

test('project route check validates course-code resource routes', async () => {
  const result = await checkRoutes({ rootDir });

  assert.equal(result.ok, true);
  assert.ok(result.checked.courseCount > 0);
  assert.ok(result.checked.sampleRoute.startsWith('#resources/#'));
});

test('project content-location check keeps long user content out of components', async () => {
  const result = await checkContentLocation({ rootDir });

  assert.equal(result.ok, true);
  assert.ok(result.checked.files > 0);
});

test('project theme check requires every configured theme to have CSS tokens', async () => {
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

test('project architecture check enforces service and public-path boundaries', async () => {
  const result = await checkArchitecture({ rootDir });

  assert.equal(result.ok, true);
  assert.ok(result.checked.rules >= 3);
});

test('project report builder records status, commands, and next steps', () => {
  const report = buildReport({
    rootDir,
    startedAt: '2026-05-20T12:00:00.000Z',
    endedAt: '2026-05-20T12:01:00.000Z',
    gitCommit: 'abc123',
    results: [
      {
        name: 'routes',
        ok: true,
        command: 'npm.cmd run check:routes',
        failures: [],
        checked: { courseCount: 1 },
        suggestions: [],
      },
    ],
  });

  assert.equal(report.ok, true);
  assert.equal(report.gitCommit, 'abc123');
  assert.equal(report.results[0].command, 'npm.cmd run check:routes');
  assert.equal(report.nextSteps[0], 'Project checks passed. Continue with implementation or CI handoff.');
});

