import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getDemoPageFromHash,
  getDemoPageHref,
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
