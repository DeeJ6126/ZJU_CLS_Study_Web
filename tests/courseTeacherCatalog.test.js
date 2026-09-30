import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCourseTeacherCatalog } from '../scripts/import-course-teachers.mjs';
import teacherCatalog from '../src/data/courses/courseTeachers.json' with { type: 'json' };
import { getCourseDetail } from '../src/data/courses/courseDetails.js';

test('course teachers match punctuation variants, deduplicate names, and keep A/B separate', () => {
  const catalog = buildCourseTeacherCatalog([
    { courseName: '生物化学(甲)', teacherName: '陈老师', gpa: 5 },
    { courseName: '生物化学（甲）', teacherName: '陈老师' },
    { courseName: '生物化学（乙）', teacherName: '乙班老师' },
  ], [
    { code: 'BIO2011F', name: '生物化学（甲）' },
    { code: 'BIO2013F', name: '生物化学（乙）' },
    { code: 'BIO9999F', name: '未收录课程' },
  ], { revision: 'test' });
  assert.deepEqual(catalog.teachersByCourse.BIO2011F, ['陈老师']);
  assert.deepEqual(catalog.teachersByCourse.BIO2013F, ['乙班老师']);
  assert.equal(catalog.teachersByCourse.BIO9999F, undefined);
  assert.deepEqual(catalog.unmatchedCourses, [{ code: 'BIO9999F', name: '未收录课程' }]);
  assert.equal(JSON.stringify(catalog).includes('gpa'), false);
});

test('split microbiology theory and experiment share the original A-course teachers', () => {
  const catalog = buildCourseTeacherCatalog([
    { courseName: '微生物学及实验（甲）', teacherName: '吕镇梅' },
    { courseName: '微生物学及实验（甲）', teacherName: '高海春' },
    { courseName: '微生物学及实验（乙）', teacherName: '乙班老师' },
  ], [
    { code: 'BIO2009F', name: '微生物学及实验（甲）' },
    { code: 'BIO2110F', name: '微生物学（甲）' },
    { code: 'BIO2113F', name: '微生物学实验' },
  ], {});
  assert.deepEqual(catalog.teachersByCourse.BIO2110F, catalog.teachersByCourse.BIO2009F);
  assert.deepEqual(catalog.teachersByCourse.BIO2113F, catalog.teachersByCourse.BIO2009F);
  assert.equal(catalog.teachersByCourse.BIO2113F.includes('乙班老师'), false);
});


test('the extracted catalog supplies real course details without review or GPA fields', () => {
  assert.equal(teacherCatalog.totalCourses, 131);
  assert.equal(teacherCatalog.matchedCourses, 120);
  const theory = getCourseDetail({ code: 'BIO2110F', name: '微生物学（甲）' });
  const laboratory = getCourseDetail({ code: 'BIO2113F', name: '微生物学实验' });
  assert.equal(theory.teachers.length, 8);
  assert.deepEqual(laboratory.teachers, theory.teachers);
  assert.equal(theory.teachers.includes('高海春'), true);
  assert.equal(getCourseDetail({ code: 'BIO2011F' }).teachers.length, 10);
  assert.deepEqual(getCourseDetail({ code: 'BIO2114M' }).teachers, []);
  for (const teachers of Object.values(teacherCatalog.teachersByCourse)) {
    assert.equal(new Set(teachers).size, teachers.length);
    assert.equal(teachers.every((teacher) => typeof teacher === 'string' && teacher.trim()), true);
  }
  assert.equal(JSON.stringify(teacherCatalog).includes('gpa'), false);
});
