import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHashWithQuery,
  getDemoPageFromHash,
  getDemoPageHref,
  getHashQuery,
} from '../src/services/demoNavigationService.js';
import { demoTopPages } from '../src/data/quizDemo.js';

test('demo navigation maps every top page to a direct hash route', () => {
  for (const page of demoTopPages) {
    assert.equal(getDemoPageHref(page.id), `#${page.id}`);
    assert.equal(getDemoPageFromHash(`#${page.id}`, demoTopPages), page.id);
  }
});

test('demo navigation falls back to home for empty or unknown hashes', () => {
  assert.equal(getDemoPageFromHash('', demoTopPages), 'home');
  assert.equal(getDemoPageFromHash('#unknown', demoTopPages), 'home');
});

test('course resource routes stay inside the overview top-level page', () => {
  assert.equal(getDemoPageFromHash('#resources/#BIO2110F', demoTopPages), 'overview');
  assert.equal(getDemoPageFromHash('#resources/#BIO2110F/#materials/#1', demoTopPages), 'overview');
});

test('admin route is reachable without appearing in the student top navigation', () => {
  assert.equal(getDemoPageFromHash('#admin', demoTopPages), 'admin');
  assert.equal(demoTopPages.some((page) => page.id === 'admin'), false);
});

test('notifications route is account-only and not part of the top navigation', () => {
  assert.equal(getDemoPageFromHash('#notifications', demoTopPages), 'notifications');
  assert.equal(demoTopPages.some((page) => page.id === 'notifications'), false);
});

test('overview hash with filter query still resolves to the overview page', () => {
  assert.equal(
    getDemoPageFromHash('#overview?program=2025&group=semester', demoTopPages),
    'overview',
  );
  assert.equal(
    getDemoPageFromHash('#resources?program=2025&group=semester', demoTopPages),
    'overview',
  );
});

test('in-page section anchors stay on their parent page instead of falling back to home', () => {
  assert.equal(
    getDemoPageFromHash('#activity-program-academic-voyage', demoTopPages),
    'activities',
  );
  assert.equal(
    getDemoPageFromHash('#resource-bio2110f-materials', demoTopPages),
    'overview',
  );
});

test('getHashQuery returns parsed params from a hash with a query suffix', () => {
  const params = getHashQuery('#overview?program=2025&group=semester');
  assert.equal(params.get('program'), '2025');
  assert.equal(params.get('group'), 'semester');
});

test('getHashQuery returns empty params when the hash has no query suffix', () => {
  const params = getHashQuery('#overview');
  assert.equal(params.toString(), '');
});

test('buildHashWithQuery omits empty params and keeps a clean base hash', () => {
  assert.equal(buildHashWithQuery('overview', {}), '#overview');
  assert.equal(
    buildHashWithQuery('overview', { program: '2025', group: '' }),
    '#overview?program=2025',
  );
  assert.equal(
    buildHashWithQuery('overview', { program: '2025', group: 'semester' }),
    '#overview?program=2025&group=semester',
  );
});
