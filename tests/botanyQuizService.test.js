import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildBotanyGalleryGroups,
  buildBotanyResultSummary,
  clearBotanyMistakes,
  normalizeBotanyCategorySelection,
  removeBotanyMistake,
  selectedBotanyImageCount,
  upsertBotanyMistake,
} from '../src/services/botanyQuizService.js';

const categories = [
  { sourceId: '叶', title: '叶', questionCount: 46 },
  { sourceId: '根', title: '根', questionCount: 43 },
  { sourceId: '茎', title: '茎', questionCount: 38 },
  { sourceId: '花', title: '花', questionCount: 33 },
  { sourceId: '植物组织', title: '植物组织', questionCount: 32 },
];

test('botany selection helpers dedupe, filter invalid categories, and count images', () => {
  const selected = normalizeBotanyCategorySelection(['根', 'bad', '叶', '根'], categories);

  assert.deepEqual(selected, ['根', '叶']);
  assert.equal(selectedBotanyImageCount(selected, categories), 89);
});

test('botany mistake helpers upsert repeat counts, remove, and clear records', () => {
  const question = {
    sourceQuestionId: '叶-q-001',
    prompt: '识别切片',
    body: {
      categoryId: '叶',
      imagePath: 'assets/images/叶/丁香叶柄10X-1.jpg',
    },
  };

  const first = upsertBotanyMistake([], {
    question,
    revealedAnswer: {
      answer: '双子叶 —— 叶 —— 丁香叶柄 —— 10X',
      sourceName: '丁香叶柄10X-1.jpg',
    },
  });
  assert.equal(first.length, 1);
  assert.equal(first[0].addedCount, 1);
  assert.equal(first[0].categorySourceId, '叶');
  assert.equal(first[0].answer, '双子叶 —— 叶 —— 丁香叶柄 —— 10X');

  const second = upsertBotanyMistake(first, {
    question,
    revealedAnswer: {
      answer: '双子叶 —— 叶 —— 丁香叶柄 —— 10X',
      sourceName: '丁香叶柄10X-1.jpg',
    },
  });
  assert.equal(second.length, 1);
  assert.equal(second[0].addedCount, 2);

  assert.equal(removeBotanyMistake(second, '叶-q-001').length, 0);
  assert.deepEqual(clearBotanyMistakes(), []);
});

test('botany gallery groups keep organ order and total image counts', () => {
  const groups = buildBotanyGalleryGroups([
    { sourceQuestionId: 'root-1', categorySourceId: '根', answer: '根答案' },
    { sourceQuestionId: 'leaf-1', categorySourceId: '叶', answer: '叶答案' },
    { sourceQuestionId: 'flower-1', categorySourceId: '花', answer: '花答案' },
  ]);

  assert.deepEqual(groups.map((group) => group.id), ['叶', '根', '花']);
  assert.equal(groups[0].items.length, 1);
  assert.equal(groups.reduce((sum, group) => sum + group.items.length, 0), 3);
});

test('botany result summary counts revealed and remaining slice questions', () => {
  const summary = buildBotanyResultSummary({
    questionOrder: ['leaf-1', 'leaf-2', 'root-1'],
    answerStatusBySourceQuestionId: {
      'leaf-1': { revealed: true },
      'root-1': { revealedAnswer: { answer: '根答案' } },
    },
    mistakeRecords: [{ sourceQuestionId: 'root-1' }],
  });

  assert.equal(summary.total, 3);
  assert.equal(summary.revealed, 2);
  assert.equal(summary.remaining, 1);
  assert.equal(summary.mistakes, 1);
});
