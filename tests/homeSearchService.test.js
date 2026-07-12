import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHomeSearchIndex, searchHomeIndex } from '../src/services/homeSearchService.js';

const courses = [
  { code: 'BIO2110F', name: '微生物学（甲）', englishName: 'Microbiology' },
  { code: 'BIO2023M', name: '分子生物学', englishName: 'Molecular Biology' },
];

const activities = [
  { id: 'lab-day', title: '实验室开放日', summary: '走进学院实验室', href: '#about' },
];

test('home search finds courses by code, Chinese name, and English name', () => {
  const index = buildHomeSearchIndex({ courses, activities });

  assert.deepEqual(searchHomeIndex(index, 'BIO2110F', 'course').map((item) => item.title), ['微生物学（甲）']);
  assert.deepEqual(searchHomeIndex(index, '分子', 'course').map((item) => item.code), ['BIO2023M']);
  assert.deepEqual(searchHomeIndex(index, 'microbiology', 'course').map((item) => item.code), ['BIO2110F']);
});

test('home search separates courses, resources, quizzes, and activities', () => {
  const index = buildHomeSearchIndex({
    courses,
    activities,
    resources: [{ id: 'micro-review', title: '微生物学期末复习资料', courseCode: 'BIO2110F', href: '#resources/#BIO2110F' }],
    quizzes: [{ id: 'micro-quiz', title: '微生物学期末刷题', courseCode: 'BIO2110F', href: '#quiz' }],
  });

  assert.equal(searchHomeIndex(index, '微生物', 'course').length, 1);
  assert.equal(searchHomeIndex(index, '微生物', 'resource').length, 1);
  assert.equal(searchHomeIndex(index, '微生物', 'quiz').length, 1);
  assert.equal(searchHomeIndex(index, '实验室', 'activity').length, 1);
});

test('home search returns no suggestions for a blank query and caps result count', () => {
  const index = buildHomeSearchIndex({ courses, activities });

  assert.deepEqual(searchHomeIndex(index, '   ', 'course'), []);
  assert.equal(searchHomeIndex(index, 'bio', 'course', 1).length, 1);
});
