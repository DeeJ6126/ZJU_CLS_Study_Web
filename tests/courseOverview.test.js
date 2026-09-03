import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { getCourseDetail } from '../src/data/courses/courseDetails.js';
import { getCourseByCode, parseCourseCsv } from '../src/data/courses/resourceCatalog.js';
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

test('course overview uses only the first-row summary surface', () => {
  const course = getCourseDetail(sourceCourse);

  assert.deepEqual(
    course.summaryFacts.map((field) => field.label),
    ['学分', '总学时', '课程类型', '建议修读年级'],
  );
});

test('course detail uses a left navigation and a dedicated quiz entry', () => {
  const component = readFileSync('src/components/CourseDetailPage.vue', 'utf8');
  const css = readFileSync('src/styles/course-detail.css', 'utf8');
  const app = readFileSync('src/App.vue', 'utf8');

  assert.match(component, /class="course-detail__nav"/);
  assert.match(component, /class="course-detail__content"/);
  assert.match(css, /\.course-detail\s*\{[\s\S]*?grid-template-columns:\s*188px\s+minmax\(0,\s*1fr\)/);
  assert.doesNotMatch(css, /\.course-tabs\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4/);
  assert.doesNotMatch(component, /QuizPracticePanel/);
  assert.match(component, /hasQuiz[\s\S]*?course-detail__quiz-link[\s\S]*?刷题网页/);
  assert.match(component, /emit\('open-quiz',\s*course\.code\)/);
  assert.match(app, /:has-quiz="[\s\S]*?@open-quiz="openCourseQuiz"/);
});

test('course detail content is loaded through the shared API client instead of inside the component', () => {
  const component = readFileSync('src/components/CourseDetailPage.vue', 'utf8');
  const app = readFileSync('src/App.vue', 'utf8');

  assert.match(app, /loadCourseContent/);
  assert.doesNotMatch(component, /fetchMarkdownDocument|publicAssetPath|loadCollection/);
  assert.match(component, /:class="\{ 'is-active': activeTab\.id === tab\.id \}"/);
});

test('learning cards keep compact metadata while article details expose CC98, persistent grade label, and anonymous likes', () => {
  const component = readFileSync('src/components/CourseDetailPage.vue', 'utf8');
  const css = readFileSync('src/styles/course-detail.css', 'utf8');

  assert.match(component, /learning-card__title/);
  assert.match(component, /learning-card__author/);
  assert.match(component, /cc98-icon/);
  assert.match(component, /查看成绩\s+\{\{\s*activeItemGradeLabel/);
  assert.match(component, /toggle-like/);
  assert.match(css, /\.article-detail-card__author/);
  assert.match(css, /\.article-action-button/);
  assert.doesNotMatch(css, /\.article-grade-badge/);
  assert.doesNotMatch(css, /\.article-detail-card__identity/);
});
