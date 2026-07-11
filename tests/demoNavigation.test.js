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
