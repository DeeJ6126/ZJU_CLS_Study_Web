import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildQuizRangeOptions,
  buildPracticeQuestionTiles,
} from '../src/services/quizRangeService.js';

test('microbiology range options keep original final-review chapter cards', () => {
  const options = buildQuizRangeOptions('BIO2110F', [
    {
      sourceId: '1',
      title: 'The Microbial World',
      parentTitle: '章节练习',
      type: 'chapter',
      questionCount: 17,
    },
    {
      sourceId: '20',
      title: 'Microbial Ecology',
      parentTitle: '章节练习',
      type: 'chapter',
      questionCount: 21,
    },
  ]);

  assert.deepEqual(options.map((option) => option.id), ['1', '20']);
  assert.equal(options[0].title, 'Chapter 1');
  assert.equal(options[0].subtitle, 'The Microbial World');
  assert.equal(options[0].countLabel, '17 题');
  assert.deepEqual(options[0].sourceIds, ['1']);
});

test('botany range options keep original slice category folders', () => {
  const options = buildQuizRangeOptions('BIO2019F', [
    { sourceId: '叶', title: '叶', parentTitle: '切片分类', type: 'image-category', questionCount: 49 },
    { sourceId: '根', title: '根', parentTitle: '切片分类', type: 'image-category', questionCount: 36 },
    { sourceId: '植物组织', title: '植物组织', parentTitle: '切片分类', type: 'image-category', questionCount: 25 },
  ]);

  assert.deepEqual(options.map((option) => option.title), ['叶', '根', '植物组织']);
  assert.equal(options[0].subtitle, '切片识别');
  assert.equal(options[0].countLabel, '49 张');
  assert.deepEqual(options[2].sourceIds, ['植物组织']);
});

test('molecular biology range options still group detailed categories by question type', () => {
  const options = buildQuizRangeOptions('BIO2023M', [
    { sourceId: 'translation-1', title: '名词 1', parentTitle: '中英名词互译', type: 'translation', questionCount: 5 },
    { sourceId: 'translation-2', title: '名词 2', parentTitle: '中英名词互译', type: 'translation', questionCount: 7 },
    { sourceId: 'true-false-1', title: '判断 1', parentTitle: '判断题', type: 'true_false', questionCount: 3 },
  ]);

  assert.equal(options.length, 2);
  assert.equal(options[0].title, '中英互译');
  assert.deepEqual(options[0].sourceIds, ['translation-1', 'translation-2']);
  assert.equal(options[0].questionCount, 12);
  assert.deepEqual(options[0].detailTitles, ['名词 1', '名词 2']);
});

test('practice question tiles renumber within the displayed range group', () => {
  const tiles = buildPracticeQuestionTiles({
    questionOrder: ['t1-a', 't1-b', 't2-a', 't2-b', 't2-c', 'choice-a'],
    questionIndex: [
      { sourceQuestionId: 't1-a', categorySourceId: 'translation-1', localNumber: 1 },
      { sourceQuestionId: 't1-b', categorySourceId: 'translation-1', localNumber: 2 },
      { sourceQuestionId: 't2-a', categorySourceId: 'translation-2', localNumber: 1 },
      { sourceQuestionId: 't2-b', categorySourceId: 'translation-2', localNumber: 2 },
      { sourceQuestionId: 't2-c', categorySourceId: 'translation-2', localNumber: 3 },
      { sourceQuestionId: 'choice-a', categorySourceId: 'multiple-choice-1', localNumber: 1 },
    ],
    sourceIds: ['translation-1', 'translation-2'],
  });

  assert.deepEqual(tiles.map((tile) => tile.sourceQuestionId), ['t1-a', 't1-b', 't2-a', 't2-b', 't2-c']);
  assert.deepEqual(tiles.map((tile) => tile.localNumber), [1, 2, 3, 4, 5]);
});
