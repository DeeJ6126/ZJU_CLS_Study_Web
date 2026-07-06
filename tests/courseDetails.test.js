import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { getCourseDetail } from '../src/data/courses/courseDetails.js';
import { getCourseByCode, parseCourseCsv } from '../src/data/courses/resourceCatalog.js';

const csv = readFileSync('public/resource/summary/introduction.csv', 'utf8');
const courses = parseCourseCsv(csv);
const sourceCourse = getCourseByCode(courses, 'BIO2110F');

test('BIO2110F detail model exposes restored microbiology resource entries', () => {
  const course = getCourseDetail(sourceCourse);

  assert.equal(course.name, '微生物学（甲）');
  assert.equal(course.code, 'BIO2110F');
  assert.match(course.overview, /微生物学课程是国家理科基地生物学专业的主干课程/);
  assert.equal(course.content.overviewUrl, '/resource/courses/basic/BIO2110F_microbiology-a/overview/index.md');
  assert.equal(course.experiences.length, 3);
  assert.equal(course.materials.length, 3);
  assert.equal(course.papers.length, 1);
  assert.equal(course.experiences[0].url, '/resource/courses/basic/BIO2110F_microbiology-a/experiences/1.md');
  assert.equal(course.materials[0].href, '#resources/#BIO2110F/#materials/#1');
  assert.equal(course.papers[0].url, '/resource/courses/basic/BIO2110F_microbiology-a/papers/1.md');
});

test('every parsed course can create a clickable detail model by course code', () => {
  const genetics = getCourseByCode(courses, 'BIO0600G');
  const course = getCourseDetail(genetics);

  assert.equal(course.code, 'BIO0600G');
  assert.equal(course.name, '基因的突变和进化（A）');
  assert.deepEqual(course.experiences, []);
  assert.deepEqual(course.materials, []);
  assert.deepEqual(course.papers, []);
});
