import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { getCourseDetail } from '../src/data/courseDetails.js';
import { getCourseByCode, parseCourseCsv } from '../src/data/resourceCatalog.js';
import { buildCourseOverviewFields } from '../src/services/courseOverviewService.js';

const csv = readFileSync('public/resource/summary/introduction.csv', 'utf8');
const courses = parseCourseCsv(csv);
const sourceCourse = getCourseByCode(courses, 'BIO2110F');

test('course overview fields are generated from the shared CSV model by course code', () => {
  const fields = buildCourseOverviewFields(sourceCourse);
  const labels = fields.map((field) => field.label);

  assert.ok(labels.includes('课程代码'));
  assert.ok(labels.includes('课程名称'));
  assert.ok(labels.includes('课程简介'));
  assert.ok(labels.includes('是否允许补考'));
  assert.ok(labels.includes('是否竺可桢学院课程'));
  assert.equal(fields.find((field) => field.label === '课程代码').value, 'BIO2110F');
  assert.match(fields.find((field) => field.label === '课程简介').value, /微生物学课程是国家理科基地生物学专业的主干课程/);
});

test('course overview excludes backend-only fields and removed hand-written sections', () => {
  const fields = buildCourseOverviewFields(sourceCourse);
  const labels = fields.map((field) => field.label);

  assert.equal(labels.includes('开课部门'), false);
  assert.equal(labels.includes('是否体育分项'), false);
  assert.equal(labels.includes('对应课程代码'), false);
  assert.equal(labels.includes('学习路径'), false);
  assert.equal(labels.includes('重点范围'), false);
});

test('course detail model exposes overview fields instead of per-course overview layouts', () => {
  const course = getCourseDetail(sourceCourse);

  assert.ok(Array.isArray(course.overviewFields));
  assert.equal(course.overviewFields.some((field) => field.label === '课程简介'), true);
  assert.equal(course.overviewFields.some((field) => field.label === '开课部门'), false);
  assert.equal('learningPath' in course, false);
  assert.equal('focusRange' in course, false);
});
