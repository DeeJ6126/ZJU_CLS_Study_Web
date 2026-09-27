import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { filterSiteCourses, parseCourseCsv } from '../src/data/courses/resourceCatalog.js';

import {
  countPendingSubmissionsByCourse,
  filterAdminCourses,
  filterAdminCoursesToOverview,
  pendingCourseOrder,
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

test('admin choices contain only courses available across current overview programs', () => {
  const catalog = parseCourseCsv(readFileSync('public/resource/summary/introduction.csv', 'utf8'));
  const siteCourses = filterSiteCourses(catalog);
  const choices = filterAdminCoursesToOverview(siteCourses);
  assert.ok(choices.length > 0);
  assert.ok(choices.some((course) => course.code === 'CAB2001F'));
  assert.ok(choices.some((course) => course.code === 'BIO3115M'));
  assert.equal(choices.some((course) => course.code === 'BIO0600G'), false);
  assert.ok(choices.length < siteCourses.length);
  assert.ok(choices.every((course) => course.code.startsWith('BIO') || course.code === 'CAB2001F'));
  assert.equal(choices.some((course) => course.code === 'MATH2432F'), false);
});

test('major selection narrows admin courses without dropping shared or alternative courses', () => {
  const catalog = filterSiteCourses(parseCourseCsv(readFileSync('public/resource/summary/introduction.csv', 'utf8')));
  const all = filterAdminCoursesToOverview(catalog);
  const majorIds = ['biology', 'biology-qiushi', 'biology-qiangji', 'ecology', 'ecology-qiangji'];
  for (const majorId of majorIds) {
    const choices = filterAdminCoursesToOverview(catalog, majorId);
    assert.ok(choices.length > 0 && choices.length < all.length);
    assert.ok(choices.some((course) => course.code === 'BIO2110F'));
  }
  assert.ok(filterAdminCoursesToOverview(catalog, 'ecology').some((course) => course.code === 'BIO3101M'));
  assert.equal(filterAdminCoursesToOverview(catalog, 'biology').some((course) => course.code === 'BIO3101M'), false);
  assert.ok(filterAdminCoursesToOverview(catalog, 'biology-qiushi').some((course) => course.code === 'BIO3115M'));
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

test('pending courses are ordered by the earliest submission in the selected content type', () => {
  const submissions = [
    { courseCode: 'BIO2110F', type: 'experience', status: 'pending', createdAt: '2026-09-03T00:00:00Z' },
    { courseCode: 'BIO2019F', type: 'experience', status: 'pending', createdAt: '2026-09-02T00:00:00Z' },
    { courseCode: 'BIO2110F', type: 'experience', status: 'pending', createdAt: '2026-09-01T00:00:00Z' },
    { courseCode: 'CAB2001F', type: 'material', status: 'pending', createdAt: '2026-08-01T00:00:00Z' },
    { courseCode: 'BIO2019F', type: 'experience', status: 'rejected', createdAt: '2026-08-01T00:00:00Z' },
  ];
  assert.deepEqual(pendingCourseOrder(submissions, 'experience'), ['BIO2110F', 'BIO2019F']);
  assert.deepEqual(pendingCourseOrder(submissions, 'material'), ['CAB2001F']);
});
