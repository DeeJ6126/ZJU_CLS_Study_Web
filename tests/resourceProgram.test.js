import test from 'node:test';
import assert from 'node:assert/strict';

import { programOptions } from '../src/data/courses/resourceCatalog.js';

test('program selector exposes 2024, 2025, and 2026 all enabled', () => {
  assert.deepEqual(
    programOptions.map((option) => option.year),
    ['2024', '2025', '2026'],
  );
  assert.deepEqual(
    programOptions.filter((option) => option.available).map((option) => option.year),
    ['2024', '2025', '2026'],
  );
});
