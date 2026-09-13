import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  curriculumPrograms,
  findCurriculumProgram,
  flattenProgram,
  listAlternativeGroups,
  listProgramYears,
  majorOptions,
  semesterLabels,
  semesterOrder,
  walkSections,
} from '../src/data/courses/programCatalog.js';
import { parseCourseCsv } from '../src/data/courses/resourceCatalog.js';

const catalogCodes = new Set(
  parseCourseCsv(readFileSync('public/resource/summary/introduction.csv', 'utf8'))
    .map((course) => course.code),
);

function everyProgram() {
  return Object.values(curriculumPrograms).flatMap((byYear) => Object.values(byYear));
}

function everyCourse(program) {
  const out = [];
  walkSections(program.sections, (section) => out.push(...(section.courses ?? [])));
  return out;
}

test('major options cover the five published majors and flag the unpublished ones', () => {
  assert.deepEqual(
    majorOptions.map((option) => option.label),
    ['生物科学', '生物科学（求是科学班）', '生物科学（强基计划）', '生态学', '生态学（强基计划）'],
  );
  // 生态学两个专业尚未收录培养方案，必须保持不可选，否则下拉框会选出空目录。
  for (const option of majorOptions) {
    assert.equal(
      option.available,
      listProgramYears(option.id).length > 0,
      `${option.label} 的 available 应与是否收录培养方案一致`,
    );
  }
});

test('every program course code exists in the course catalog csv', () => {
  // 这是最容易出的错：overviewCatalogService 会把 CSV 里没有的课程静默过滤掉，
  // 页面上只是少了一门课，不会报错。
  for (const program of everyProgram()) {
    for (const course of everyCourse(program)) {
      assert.ok(
        catalogCodes.has(course.code),
        `${program.id} 引用了 introduction.csv 中不存在的课程 ${course.code}`,
      );
    }
  }
});

test('every program semester is a known semester id', () => {
  const known = new Set(semesterOrder);
  for (const program of everyProgram()) {
    for (const { code, semester } of everyCourse(program)) {
      assert.ok(known.has(semester), `${program.id} 的 ${code} 学期 ${semester} 不在 semesterOrder 中`);
      assert.ok(semesterLabels[semester], `${semester} 缺少中文标签`);
    }
  }
});

test('each program keeps its own section wording instead of a shared shape', () => {
  // 三个专业的写法差异必须原样保留，不能被归一成同一套分组。
  const qiushi = findCurriculumProgram('biology-qiushi', '2024').sections.map((s) => s.tag);
  const qiangji = findCurriculumProgram('biology-qiangji', '2024').sections.map((s) => s.tag);
  const biology = findCurriculumProgram('biology', '2026').sections.map((s) => s.tag);

  assert.deepEqual(qiushi, ['2.专业基础课程', '3.专业课程', '4.个性修读课程']);
  // 强基没有「专业基础课程」一节，个性修读编号是 3 不是 4。
  assert.deepEqual(qiangji, ['2.专业课程', '3.个性修读课程']);
  // 2026 版改用中文数字编号。
  assert.deepEqual(biology, ['二、专业基础课程', '三、专业课程', '四、个性修读课程']);
});

test('qiushi has no direction split under 进阶模块 while biology does', () => {
  const qiushiAdvanced = [];
  walkSections(findCurriculumProgram('biology-qiushi', '2024').sections, (s) => {
    if (s.tag === '1)本专业进阶模块') qiushiAdvanced.push(s);
  });
  assert.equal(qiushiAdvanced.length, 1);
  assert.equal(qiushiAdvanced[0].children, undefined, '求是科学班的进阶模块不分方向');
  assert.ok(qiushiAdvanced[0].courses.length > 0);

  const biologyAdvanced = [];
  walkSections(findCurriculumProgram('biology', '2024').sections, (s) => {
    if (s.tag === '1)本专业进阶模块') biologyAdvanced.push(s);
  });
  assert.deepEqual(
    biologyAdvanced[0].children.map((c) => c.tag),
    ['A.生物科学方向', 'B.生物技术方向', 'C.生物信息学方向'],
  );
});

test('alternative modules are detected and flattening honours the choice', () => {
  const program = findCurriculumProgram('biology-qiangji', '2024');
  const groups = listAlternativeGroups(program);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].tag, '(1)专业必修课程');
  assert.deepEqual(groups[0].options.map((o) => o.tag), ['1)生物科学模块', '2)神经生物学模块']);

  const bio = flattenProgram(program);
  const neuro = flattenProgram(program, ['2)神经生物学模块']);

  assert.ok(bio.courseCodes.includes('BIO3038MZ'));
  assert.ok(!bio.courseCodes.includes('MED2307M'));
  assert.ok(neuro.courseCodes.includes('MED2307M'));
  assert.ok(!neuro.courseCodes.includes('BIO3038MZ'));

  // 同一门课在两个模块的建议学期不同，取选中分支的值。
  assert.equal(bio.semesterByCourse.BIO2029M, '3-autumn-winter');
  assert.equal(neuro.semesterByCourse.BIO2029M, '2-spring-summer');
});

test('programs without alternatives flatten to every course in the tree', () => {
  const program = findCurriculumProgram('biology-qiushi', '2025');
  assert.deepEqual(listAlternativeGroups(program), []);
  const flat = flattenProgram(program);
  assert.ok(flat.courseCodes.includes('BIO2033MZ'));
  assert.equal(flat.semesterByCourse.BIO4087M, '4-spring-summer');
});

test('every major now has all three cohorts, and unknown ids resolve to nothing', () => {
  for (const option of majorOptions) {
    assert.deepEqual(listProgramYears(option.id), ['2024', '2025', '2026'], option.label);
  }
  assert.equal(findCurriculumProgram('no-such-major', '2024'), null);
  assert.deepEqual(listProgramYears('no-such-major'), []);
  assert.deepEqual(flattenProgram(null).courseCodes, []);
});

test('ecology plans keep their own wording, distinct from biology', () => {
  // 生态学没有「专业选修课程」，实践教学环节也不细分方向。
  const ecology = findCurriculumProgram('ecology', '2024');
  const tags = [];
  walkSections(ecology.sections, (s) => tags.push(s.tag));
  assert.ok(tags.includes('(1)专业必修课程'));
  assert.ok(!tags.includes('(2)专业选修课程'));
  assert.ok(!tags.some((t) => /方向$/.test(t) && /^\d\)/.test(t)));

  // 生态学强基的专业必修不分模块，这点与生物科学强基相反。
  assert.deepEqual(listAlternativeGroups(findCurriculumProgram('ecology-qiangji', '2024')), []);
  assert.equal(listAlternativeGroups(findCurriculumProgram('biology-qiangji', '2024')).length, 1);
});
