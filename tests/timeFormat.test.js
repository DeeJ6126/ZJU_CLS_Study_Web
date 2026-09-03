import test from 'node:test';
import assert from 'node:assert/strict';

import { formatRelativeTime, isoDateTime } from '../src/utils/timeFormat.js';

const NOW = Date.parse('2026-09-03T12:00:00Z');

test('formatRelativeTime returns "刚刚" for very recent timestamps', () => {
  assert.equal(formatRelativeTime('2026-09-03T11:59:30Z', NOW), '刚刚');
});

test('formatRelativeTime returns minutes for < 1 hour', () => {
  assert.equal(formatRelativeTime('2026-09-03T11:55:00Z', NOW), '5 分钟前');
  assert.equal(formatRelativeTime('2026-09-03T11:01:00Z', NOW), '59 分钟前');
});

test('formatRelativeTime returns hours for < 1 day', () => {
  assert.equal(formatRelativeTime('2026-09-03T09:00:00Z', NOW), '3 小时前');
});

test('formatRelativeTime returns days for < 1 week', () => {
  assert.equal(formatRelativeTime('2026-09-01T12:00:00Z', NOW), '2 天前');
});

test('formatRelativeTime returns ISO date for >= 1 week', () => {
  assert.equal(formatRelativeTime('2026-08-01T12:00:00Z', NOW), '2026-08-01');
});

test('formatRelativeTime returns "刚刚" for future timestamps', () => {
  assert.equal(formatRelativeTime('2026-09-03T13:00:00Z', NOW), '刚刚');
});

test('formatRelativeTime returns empty string for invalid input', () => {
  assert.equal(formatRelativeTime('', NOW), '');
  assert.equal(formatRelativeTime(null, NOW), '');
  assert.equal(formatRelativeTime('not a date', NOW), '');
});

test('isoDateTime returns ISO string for valid date', () => {
  assert.equal(isoDateTime('2026-09-03T11:00:00Z'), '2026-09-03T11:00:00.000Z');
});

test('isoDateTime returns empty string for invalid input', () => {
  assert.equal(isoDateTime(''), '');
  assert.equal(isoDateTime(null), '');
  assert.equal(isoDateTime('garbage'), '');
});
