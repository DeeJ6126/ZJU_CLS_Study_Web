import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ALLOWED_GRADES,
  gradeFromStudentId,
  isAllowedGrade,
} from '../server/studentGrade.js';

test('gradeFromStudentId maps the three documented prefixes to their year', () => {
  assert.equal(gradeFromStudentId('3240123'), 2024);
  assert.equal(gradeFromStudentId('3250999'), 2025);
  assert.equal(gradeFromStudentId('3260001'), 2026);
});

test('gradeFromStudentId accepts longer student ids and trims whitespace', () => {
  assert.equal(gradeFromStudentId('  3240123456  '), 2024);
});

test('gradeFromStudentId returns null for non-matching or malformed ids', () => {
  assert.equal(gradeFromStudentId('3230001'), null);
  assert.equal(gradeFromStudentId('3270001'), null);
  assert.equal(gradeFromStudentId('324'), null);
  assert.equal(gradeFromStudentId(''), null);
  assert.equal(gradeFromStudentId(null), null);
  assert.equal(gradeFromStudentId(1234567), null);
});

test('isAllowedGrade only accepts the documented years', () => {
  for (const grade of ALLOWED_GRADES) {
    assert.equal(isAllowedGrade(grade), true);
  }
  assert.equal(isAllowedGrade(2023), false);
  assert.equal(isAllowedGrade(2027), false);
  assert.equal(isAllowedGrade('2024'), false);
  assert.equal(isAllowedGrade(null), false);
});
