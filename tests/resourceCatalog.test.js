import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildResourceSections, getCourseByCode, parseCourseCsv } from '../src/data/courses/resourceCatalog.js';

const csv = readFileSync('public/resource/summary/introduction.csv', 'utf8');
const courses = parseCourseCsv(csv);
const sections = buildResourceSections(courses);

test('resource catalog parses course code and course name from introduction csv', () => {
  assert.equal(courses[0].code, 'BIO0600G');
  assert.equal(courses[0].name, '基因的突变和进化（A）');
});

test('course cards link by course code without translated names', () => {
  const basic = sections.find((section) => section.id === 'basic');
  const microbiology = basic.groups[0].courses.find((course) => course.code === 'BIO2110F');

  assert.equal(microbiology.name, '微生物学（甲）');
  assert.equal(microbiology.href, '#resources/#BIO2110F');
  assert.equal(microbiology.href.includes('Microbiology'), false);
});

test('course detail summary is read from the CSV by unique course code', () => {
  const microbiology = getCourseByCode(courses, 'BIO2110F');

  assert.equal(microbiology.name, '微生物学（甲）');
  assert.match(microbiology.introduction, /微生物学课程是国家理科基地生物学专业的主干课程/);
});

test('resource sections follow educational program category order', () => {
  assert.deepEqual(
    sections.map((section) => section.title),
    ['专业基础课程', '专业课', '个性修读课程', '通识课'],
  );
});

test('major courses expose collapsible subgroup order from 2024 program', () => {
  const major = sections.find((section) => section.id === 'major');

  assert.deepEqual(
    major.groups.map((group) => group.title),
    ['专业必修课程', '实践教学环节', '毕业论文（设计）'],
  );
  assert.ok(major.groups[0].courses.some((course) => course.code === 'BIO2028M'));
  assert.ok(major.groups[2].courses.some((course) => course.code === 'BIO4087M'));
});

test('personal courses expose advanced module directions before open modules', () => {
  const personal = sections.find((section) => section.id === 'personal');

  assert.deepEqual(
    personal.groups.map((group) => group.title),
    ['本专业进阶模块：生物科学方向', '本专业进阶模块：生物技术方向', '本专业进阶模块：生物信息学方向', '学生自主修读模块'],
  );
  assert.ok(personal.groups[0].courses.some((course) => course.code === 'BIO3052M'));
  assert.ok(personal.groups[2].courses.some((course) => course.code === 'BIO3058M'));
});
