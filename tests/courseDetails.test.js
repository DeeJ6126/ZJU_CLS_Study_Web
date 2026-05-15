import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { getCourseDetail, supportedCourseCodes } from '../src/data/courseDetails.js';
import { getCourseByCode, parseCourseCsv } from '../src/data/resourceCatalog.js';

const csv = readFileSync('public/resource/summary/introduction.csv', 'utf8');
const courses = parseCourseCsv(csv);
const sourceCourse = getCourseByCode(courses, 'BIO2110F');

test('BIO2110F detail model keeps text content outside frontend data files', () => {
  const course = getCourseDetail(sourceCourse);

  assert.ok(supportedCourseCodes.includes('BIO2110F'));
  assert.equal(course.name, '微生物学（甲）');
  assert.equal(course.code, 'BIO2110F');
  assert.match(course.overview, /微生物学课程是国家理科基地生物学专业的主干课程/);
  assert.equal(course.experiences[0].url, '/resource/courses/basic/BIO2110F_microbiology-a/experiences/1.md');
  assert.equal(course.materials[0].href, '#resources/#BIO2110F/#materials/#1');
  assert.equal(course.papers[0].url, '/resource/courses/basic/BIO2110F_microbiology-a/papers/1.md');
  assert.equal('summary' in course.experiences[0], false);
});
