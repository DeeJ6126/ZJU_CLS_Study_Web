import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAllCourseSections,
  buildProgramCategorySections,
  buildProgramSemesterSections,
  filterCoursesByProgram,
} from '../src/services/overviewCatalogService.js';
import { curriculumPrograms } from '../src/data/courses/programCatalog.js';

const courses = [
  { code: 'BIO2110F', name: '微生物学（甲）', category: '专业基础课程' },
  { code: 'BIO2028M', name: '生态学基础及实验', category: '专业课' },
  { code: 'BIO4087M', name: '毕业论文（设计）', category: '专业课' },
  { code: 'BIO0600G', name: '基因的突变和进化（A）', category: '通识' },
  { code: 'BIO9999M', name: '方案外课程', category: '专业课' },
];

test('all-course overview keeps the three requested top-level course categories', () => {
  const sections = buildAllCourseSections(courses);

  assert.deepEqual(sections.map((section) => section.title), ['专业基础课程', '专业课', '通识课']);
  assert.ok(sections[1].groups.some((group) => group.title === '专业必修课程'));
  assert.ok(sections[1].groups.some((group) => group.title === '毕业论文（设计）'));
  assert.ok(sections[1].groups.some((group) => group.title === '其他专业课程'));
});

test('section course counts do not double-count courses shared by professional modules', () => {
  const moduleCourses = [
    { code: 'BIO3066M', name: '遗传学进阶', category: '专业课' },
    { code: 'BIO3097M', name: '生物信息学', category: '专业课' },
  ];

  const [professionalSection] = buildAllCourseSections(moduleCourses);

  assert.equal(professionalSection.courseCount, 2);
});

test('program filter only keeps courses declared by the selected curriculum', () => {
  const selected = filterCoursesByProgram(courses, curriculumPrograms['2024']);

  assert.deepEqual(selected.map((course) => course.code), ['BIO2110F', 'BIO2028M', 'BIO4087M']);
});

test('program courses can still be grouped by course category', () => {
  const sections = buildProgramCategorySections(courses, curriculumPrograms['2024']);

  assert.deepEqual(sections.map((section) => section.title), ['专业基础课程', '专业课']);
  assert.ok(sections.every((section) => section.courseCount > 0));
});

test('program semester view shows only periods that contain courses', () => {
  const sections = buildProgramSemesterSections(courses, curriculumPrograms['2024']);

  assert.deepEqual(sections.map((section) => section.id), [
    '2-autumn-winter',
    '2-spring-summer',
    '4-spring-summer',
  ]);
  assert.deepEqual(
    sections.flatMap((section) => section.courses.map((course) => [course.code, section.id])),
    [
      ['BIO2028M', '2-autumn-winter'],
      ['BIO2110F', '2-spring-summer'],
      ['BIO4087M', '4-spring-summer'],
    ],
  );
});

test('2024 curriculum exposes the dedicated short-term sections like 2025', () => {
  const program2024 = curriculumPrograms['2024'];
  const program2025 = curriculumPrograms['2025'];
  const courses2024 = new Set(Object.keys(program2024.semesterByCourse));

  const shortCoursesIn2025 = Object.entries(program2025.semesterByCourse)
    .filter(([, semester]) => semester.endsWith('-short'));

  for (const [course, semester] of shortCoursesIn2025) {
    assert.ok(
      courses2024.has(course),
      `2024 should include shared short-term course ${course}`,
    );
    assert.equal(
      program2024.semesterByCourse[course],
      semester,
      `2024 should place ${course} in ${semester} to match 2025`,
    );
  }

  const sections = buildProgramSemesterSections(
    [...courses2024].map((code) => ({ code })),
    program2024,
  );
  const shortSectionIds = sections
    .filter((section) => section.id.endsWith('-short'))
    .map((section) => section.id)
    .sort();

  assert.deepEqual(shortSectionIds, ['2-short', '3-short']);
});

test('program semester view attaches a course detail href to every course', () => {
  const sections = buildProgramSemesterSections(courses, curriculumPrograms['2024']);

  const flatCourses = sections.flatMap((section) => section.courses);
  assert.ok(flatCourses.length > 0);
  for (const course of flatCourses) {
    assert.ok(course.href, `course ${course.code} should expose a detail href`);
    assert.match(course.href, /#resources\/#BIO\d{4}[FM]$/);
  }
});
