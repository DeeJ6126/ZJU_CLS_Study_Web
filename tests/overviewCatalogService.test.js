import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAllCourseSections,
  buildProgramOutline,
  buildProgramSemesterSections,
  filterCoursesByProgram,
} from '../src/services/overviewCatalogService.js';
import { findCurriculumProgram, flattenProgram } from '../src/data/courses/programCatalog.js';
import { parseCourseCsv } from '../src/data/courses/resourceCatalog.js';
import { readFileSync } from 'node:fs';

// 大纲视图会隐藏「整棵子树都没有课程」的小节，所以这条用例必须喂真实课程
// 目录；上面那份 5 门课的精简 fixture 会让大部分小节被判为空而消失。
const catalogCourses = parseCourseCsv(readFileSync('public/resource/summary/introduction.csv', 'utf8'));

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
  const selected = filterCoursesByProgram(courses, findCurriculumProgram('biology', '2024'));

  assert.deepEqual(selected.map((course) => course.code), ['BIO2110F', 'BIO2028M', 'BIO4087M']);
});

test('program outline follows the plan wording instead of csv categories', () => {
  const rows = buildProgramOutline(catalogCourses, findCurriculumProgram('biology', '2024'));

  assert.deepEqual(
    rows.filter((row) => row.depth === 0).map((row) => row.tag),
    ['2.专业基础课程', '3.专业课程', '4.个性修读课程'],
  );
  const practice = rows.find((row) => row.tag === '(2)实践教学环节');
  assert.equal(practice.depth, 1);
  // 生物科学的实践教学环节按三个方向细分，这是本专业独有的写法。
  assert.deepEqual(
    rows.filter((row) => row.depth === 2 && /^\d\)/.test(row.tag)).map((row) => row.tag),
    ['1)生物科学方向', '2)生物技术方向', '3)生物信息学方向'],
  );
  // 个性修读的进阶模块另有 A/B/C 三个方向，与实践环节的方向是两套。
  assert.deepEqual(
    rows.filter((row) => row.depth === 2 && /^[A-Z]\..*方向$/.test(row.tag)).map((row) => row.tag),
    ['A.生物科学方向', 'B.生物技术方向', 'C.生物信息学方向'],
  );
});

test('outline drops prose-only sections but keeps ones that do list courses', () => {
  // 「跨专业学习模块」「学生自主修读模块」在多数方案里只有文字要求、不列课程。
  const biology = buildProgramOutline(catalogCourses, findCurriculumProgram('biology', '2024'))
    .map((row) => row.tag);
  assert.ok(!biology.includes('2)跨专业学习模块'));
  assert.ok(!biology.includes('3)学生自主修读模块'));
  assert.ok(!biology.includes('A.跨专业课程至少1门'));

  // 但 2026 级生态学的「学生自主修读模块」确实列了课程，必须保留——所以判断
  // 依据是子树里有没有课程，而不是小节名字。
  const ecology = buildProgramOutline(catalogCourses, findCurriculumProgram('ecology', '2026'));
  const selfDirected = ecology.find((row) => row.tag === '3)学生自主修读模块');
  assert.ok(selfDirected, '2026 级生态学的学生自主修读模块有课程，不应被过滤');
  assert.ok(selfDirected.courses.length > 0);
});

test('program semester view shows only periods that contain courses', () => {
  const sections = buildProgramSemesterSections(courses, findCurriculumProgram('biology', '2024'));

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

test('2024 and 2025 biology plans agree on the short-term practice courses', () => {
  const short = (year) => Object.entries(
    flattenProgram(findCurriculumProgram('biology', year)).semesterByCourse,
  ).filter(([, semester]) => semester.endsWith('-short')).sort();

  assert.deepEqual(short('2024'), short('2025'));
  assert.ok(short('2024').length > 0);
});

test('program semester view attaches a course detail href to every course', () => {
  const sections = buildProgramSemesterSections(courses, findCurriculumProgram('biology', '2024'));

  const flatCourses = sections.flatMap((section) => section.courses);
  assert.ok(flatCourses.length > 0);
  for (const course of flatCourses) {
    assert.ok(course.href, `course ${course.code} should expose a detail href`);
    assert.match(course.href, /#resources\/#BIO\d{4}[FM]$/);
  }
});
