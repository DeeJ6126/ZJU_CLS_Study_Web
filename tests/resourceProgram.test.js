import test from 'node:test';
import assert from 'node:assert/strict';

import { programOptions } from '../src/data/courses/resourceCatalog.js';

test('program selector exposes 2023, 2024, and 2025 with only 2024 enabled', () => {
  assert.deepEqual(
    programOptions.map((option) => option.year),
    ['2023', '2024', '2025'],
  );
  assert.deepEqual(
    programOptions.filter((option) => option.available).map((option) => option.year),
    ['2024'],
  );
});
