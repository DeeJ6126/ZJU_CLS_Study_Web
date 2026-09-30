import test from 'node:test';
import assert from 'node:assert/strict';

import { currentSchoolSemester, currentSemesterCourses } from '../src/services/currentSemesterService.js';

test('school semester follows the Shanghai academic calendar', () => {
  assert.deepEqual(currentSchoolSemester('2026-09-30T00:00:00+08:00'), { academicYear: 2026, term: 'autumn-winter' });
  assert.deepEqual(currentSchoolSemester('2027-01-15T00:00:00+08:00'), { academicYear: 2026, term: 'autumn-winter' });
  assert.deepEqual(currentSchoolSemester('2027-04-15T00:00:00+08:00'), { academicYear: 2026, term: 'spring-summer' });
  assert.deepEqual(currentSchoolSemester('2027-07-15T00:00:00+08:00'), { academicYear: 2026, term: 'short' });
});

test('current courses use the selected major and cohort without inventing unavailable programs', () => {
  const catalog = [
    { code: 'BIO2011F', name: '生物化学（甲）' },
    { code: 'BIO2012F', name: '生物化学实验（甲）' },
    { code: 'BIO2005F', name: '动物学及实验（甲）' },
  ];
  const result = currentSemesterCourses({
    majorId: 'biology', cohortYear: 2024, courses: catalog,
    now: '2025-10-01T00:00:00+08:00',
  });
  assert.equal(result.status, 'ready');
  assert.equal(result.semesterId, '2-autumn-winter');
  assert.deepEqual(result.courses.map((course) => course.code), ['BIO2011F', 'BIO2012F']);
  assert.equal(result.courses[0].href, '#resources/#BIO2011F');
  assert.equal(currentSemesterCourses({ majorId: 'biology', cohortYear: 2023, courses: catalog }).status, 'no-program');
  assert.equal(currentSemesterCourses({ majorId: '', cohortYear: null, courses: catalog }).status, 'missing-profile');
});

test('current microbiology recommendations use the split theory and laboratory courses', () => {
  const result = currentSemesterCourses({
    majorId: 'biology-qiangji', cohortYear: 2025, now: '2027-04-01T00:00:00+08:00',
    courses: [
      { code: 'BIO2009F', name: '微生物学及实验（甲）' },
      { code: 'BIO2110F', name: '微生物学（甲）' },
      { code: 'BIO2113F', name: '微生物学实验' },
    ],
  });
  assert.deepEqual(result.courses.map((course) => course.code), ['BIO2110F', 'BIO2113F']);
});
