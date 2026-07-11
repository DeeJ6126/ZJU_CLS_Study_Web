import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMicrobiologyResultSummary,
  clearMicrobiologyMistakes,
  createMicrobiologyVocabularyRecord,
  normalizeMicrobiologyCategorySelection,
  normalizeMicrobiologyVocabularyRecords,
  removeMicrobiologyMistake,
  selectedMicrobiologyQuestionCount,
  tokenizeMicrobiologyVocabularyText,
  upsertMicrobiologyMistake,
} from '../src/services/microbiologyQuizService.js';

const categories = [
  { sourceId: '1', title: '绪论', questionCount: 54 },
  { sourceId: '2', title: '微生物形态', questionCount: 56 },
  { sourceId: '99', title: '非期末范围', questionCount: 12 },
];

test('microbiology selection helpers dedupe, filter invalid chapters, and count questions', () => {
  const selected = normalizeMicrobiologyCategorySelection(['2', 'bad', '1', '2'], categories);

  assert.deepEqual(selected, ['2', '1']);
  assert.equal(selectedMicrobiologyQuestionCount(selected, categories), 110);
});

test('microbiology mistake helpers upsert repeat counts, remove, and clear records', () => {
  const question = {
    sourceQuestionId: 'chapter-01-q-001',
    prompt: 'A single-choice question',
    body: {
      chapterId: 1,
      chapterTitle: '绪论',
      number: 1,
    },
  };

  const first = upsertMicrobiologyMistake([], {
    question,
    answer: { selectedKey: 'A' },
    correctDisplay: 'C',
  });
  assert.equal(first.length, 1);
  assert.equal(first[0].wrongCount, 1);
  assert.equal(first[0].categorySourceId, '1');
  assert.equal(first[0].correctDisplay, 'C');

  const second = upsertMicrobiologyMistake(first, {
    question,
    answer: { selectedKey: 'UNKNOWN' },
    correctDisplay: 'C',
  });
  assert.equal(second.length, 1);
  assert.equal(second[0].wrongCount, 2);
  assert.deepEqual(second[0].lastAnswer, { selectedKey: 'UNKNOWN' });

  assert.equal(removeMicrobiologyMistake(second, 'chapter-01-q-001').length, 0);
  assert.deepEqual(clearMicrobiologyMistakes(), []);
});

test('microbiology vocabulary helpers tokenize, dedupe, and keep source context', () => {
  assert.deepEqual(tokenizeMicrobiologyVocabularyText('DNA polymerase + E. coli'), [
    'DNA',
    'polymerase',
    'coli',
  ]);

  const first = createMicrobiologyVocabularyRecord('DNA', {
    contextText: 'DNA polymerase appears here',
    sourceType: 'practice',
    questionId: 'chapter-01-q-001',
    questionNumber: 1,
    chapterId: 1,
    chapterTitle: '绪论',
  });
  const duplicate = createMicrobiologyVocabularyRecord('dna', {
    contextText: 'DNA polymerase appears here',
    sourceType: 'practice',
    questionId: 'chapter-01-q-001',
    questionNumber: 1,
    chapterId: 1,
    chapterTitle: '绪论',
  });
  const records = normalizeMicrobiologyVocabularyRecords([first, duplicate]);

  assert.equal(records.length, 1);
  assert.equal(records[0].term, 'DNA');
  assert.equal(records[0].sourceType, 'practice');
  assert.equal(records[0].status, 'new');
});

test('microbiology result summary counts answered, unknown, and correct answers', () => {
  const summary = buildMicrobiologyResultSummary({
    questionOrder: ['chapter-01-q-001', 'chapter-01-q-002', 'chapter-02-q-001'],
    answerStatusBySourceQuestionId: {
      'chapter-01-q-001': { answer: { selectedKey: 'C' }, isCorrect: true },
      'chapter-01-q-002': { answer: { selectedKey: 'UNKNOWN' }, isCorrect: false },
    },
    mistakeRecords: [{ sourceQuestionId: 'chapter-01-q-002' }],
    selectedCategorySourceIds: ['1', '2'],
  });

  assert.equal(summary.total, 3);
  assert.equal(summary.answered, 2);
  assert.equal(summary.correct, 1);
  assert.equal(summary.incorrect, 1);
  assert.equal(summary.unknown, 1);
  assert.equal(summary.unanswered, 1);
  assert.equal(summary.mistakes, 1);
});
