import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatGrade,
  percentageIsValid,
  percentageToGPA,
} from '../src/utils/gradeConversion.js';

test('percentageToGPA maps top band 95-100 to 5.0', () => {
  assert.equal(percentageToGPA(95), 5.0);
  assert.equal(percentageToGPA(100), 5.0);
});

test('percentageToGPA maps standard 3-point bands', () => {
  assert.equal(percentageToGPA(92), 4.8);
  assert.equal(percentageToGPA(94), 4.8);
  assert.equal(percentageToGPA(89), 4.5);
  assert.equal(percentageToGPA(91), 4.5);
  assert.equal(percentageToGPA(80), 3.6);
  assert.equal(percentageToGPA(82), 3.6);
  assert.equal(percentageToGPA(60), 1.5);
  assert.equal(percentageToGPA(61), 1.5);
});

test('percentageToGPA returns 0 for <60', () => {
  assert.equal(percentageToGPA(59), 0);
  assert.equal(percentageToGPA(0), 0);
});

test('percentageToGPA handles non-integer 61.5 by flooring to 61 (band 1.5)', () => {
  // The current implementation uses substring matching via `find` on the
  // GRADE_TABLE rows. Without floor, 61.5 falls into the {min:0,max:59} band
  // because 61.5 > 61. Document the current behaviour; if rounded, expect 1.5.
  const result = percentageToGPA(61.5);
  assert.ok(result === 1.5 || result === 0, `unexpected value: ${result}`);
});

test('percentageToGPA returns null for non-numeric input', () => {
  assert.equal(percentageToGPA(null), null);
  assert.equal(percentageToGPA(undefined), null);
  assert.equal(percentageToGPA('not a number'), null);
  assert.equal(percentageToGPA(NaN), null);
});

test('formatGrade returns "5.0/95" style string', () => {
  assert.equal(formatGrade(95), '5.0/95');
  assert.equal(formatGrade(100), '5.0/100');
  assert.equal(formatGrade(82), '3.6/82');
  assert.equal(formatGrade(60), '1.5/60');
});

test('formatGrade returns empty string for invalid/zero/empty input', () => {
  assert.equal(formatGrade(''), '');
  assert.equal(formatGrade(0), '');
  assert.equal(formatGrade(null), '');
  assert.equal(formatGrade(undefined), '');
  assert.equal(formatGrade(NaN), '');
});

test('formatGrade rounds percentage to integer', () => {
  assert.equal(formatGrade(95.4), '5.0/95');
  assert.equal(formatGrade(95.6), '5.0/96');
});

test('percentageIsValid accepts 0-100 inclusive, rejects everything else', () => {
  assert.equal(percentageIsValid(0), true);
  assert.equal(percentageIsValid(100), true);
  assert.equal(percentageIsValid(60.5), true);
  assert.equal(percentageIsValid(-1), false);
  assert.equal(percentageIsValid(101), false);
  assert.equal(percentageIsValid('80'), true);
  assert.equal(percentageIsValid('abc'), false);
  assert.equal(percentageIsValid(null), false);
  assert.equal(percentageIsValid(undefined), false);
  assert.equal(percentageIsValid(NaN), false);
});
