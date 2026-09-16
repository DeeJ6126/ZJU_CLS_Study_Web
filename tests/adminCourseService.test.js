import test from 'node:test';
import assert from 'node:assert/strict';

import {
  countPendingSubmissionsByCourse,
  filterAdminCourses,
} from '../src/services/adminCourseService.js';

const courses = [
  { code: 'BIO2110F', name: '微生物学（甲）' },
  { code: 'BIO2019F', name: '植物学' },
  { code: 'MATH2432F', name: '概率论与数理统计' },
];

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
