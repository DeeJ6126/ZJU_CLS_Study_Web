import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { filterSiteCourses, parseCourseCsv } from '../src/data/courses/resourceCatalog.js';

import {
  countPendingSubmissionsByCourse,
  filterAdminCourses,
} from '../src/services/adminCourseService.js';

const courses = [
  { code: 'BIO2110F', name: '微生物学（甲）' },
  { code: 'BIO2019F', name: '植物学' },
  { code: 'MATH2432F', name: '概率论与数理统计' },
  { code: 'CAB2001F', name: '生物统计学与试验设计（甲）' },
];

test('site course choices keep BIO courses and the one CAB exception only', () => {
  assert.deepEqual(filterSiteCourses(courses).map((course) => course.code), [
    'BIO2110F', 'BIO2019F', 'CAB2001F',
  ]);
});

test('actual admin catalog contains only BIO courses plus CAB2001F', () => {
  const catalog = parseCourseCsv(readFileSync('public/resource/summary/introduction.csv', 'utf8'));
  const choices = filterSiteCourses(catalog);
  assert.ok(choices.length > 0);
  assert.ok(choices.some((course) => course.code === 'CAB2001F'));
  assert.ok(choices.every((course) => course.code.startsWith('BIO') || course.code === 'CAB2001F'));
  assert.equal(choices.some((course) => course.code === 'MATH2432F'), false);
});

test('admin course search matches course codes, Chinese names, and multiple tokens', () => {
  assert.deepEqual(filterAdminCourses(courses, 'bio2110').map((course) => course.code), ['BIO2110F']);
  assert.deepEqual(filterAdminCourses(courses, '植物').map((course) => course.code), ['BIO2019F']);
  assert.deepEqual(filterAdminCourses(courses, 'math 统计').map((course) => course.code), ['MATH2432F']);
  assert.equal(filterAdminCourses(courses, '不存在').length, 0);
});

test('pending submission counts are grouped by course and exclude reviewed submissions', () => {
  assert.deepEqual(countPendingSubmissionsByCourse([
    { courseCode: 'BIO2110F', status: 'pending' },
    { courseCode: 'BIO2110F', status: 'pending' },
    { courseCode: 'BIO2019F', status: 'approved' },
    { courseCode: 'BIO2019F', status: 'pending' },
  ]), { BIO2110F: 2, BIO2019F: 1 });
});
