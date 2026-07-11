import test from 'node:test';
import assert from 'node:assert/strict';

import { getQuizCourseConfig, quizCourseConfigs } from '../src/data/quizCourseConfigs.js';

test('quiz course configs declare navigation and capabilities for the migrated courses', () => {
  assert.deepEqual(Object.keys(quizCourseConfigs).sort(), ['BIO2019F', 'BIO2023M', 'BIO2110F']);

  assert.deepEqual(
    getQuizCourseConfig('BIO2023M').navigationItems.map((item) => item.label),
    ['首页', '题型选择', '练习', '错题本', '复习', '生词本', '结果'],
  );
  assert.deepEqual(
    getQuizCourseConfig('BIO2019F').navigationItems.map((item) => item.label),
    ['首页', '分类', '练习', '图库', '错题本', '结果'],
  );
  assert.deepEqual(
    getQuizCourseConfig('BIO2110F').navigationItems.map((item) => item.label),
    ['首页', '章节', '真题', '练习', '错题本', '生词本', '结果'],
  );

  assert.equal(getQuizCourseConfig('BIO2023M').supportsReview, true);
  assert.equal(getQuizCourseConfig('BIO2019F').supportsGallery, true);
  assert.equal(getQuizCourseConfig('BIO2110F').supportsPastExams, true);
});
