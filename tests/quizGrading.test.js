import test from 'node:test';
import assert from 'node:assert/strict';

import { createQuizStore } from '../server/quiz/quizStore.js';
import { importConfiguredQuizCollections } from '../server/quiz/quizImportService.js';
import {
  gradeAnswer,
  revealAnswer,
  selfJudgeAnswer,
} from '../server/quiz/quizGradingService.js';

function createImportedStore() {
  const store = createQuizStore({ filename: ':memory:' });
  store.initialize();
  importConfiguredQuizCollections(store);
  return store;
}

test('single choice grading returns correctness and feedback only after submission', () => {
  const store = createImportedStore();

  const correct = gradeAnswer(store, {
    collectionSlug: 'microbiology-final-review',
    sourceQuestionId: 'chapter-01-q-001',
    answer: { selectedKey: 'C' },
  });
  assert.equal(correct.gradingMode, 'auto');
  assert.equal(correct.isCorrect, true);
  assert.equal(correct.correctDisplay, 'C');
  assert.match(correct.explanation.explanation, /病毒/);

  const wrong = gradeAnswer(store, {
    collectionSlug: 'microbiology-final-review',
    sourceQuestionId: 'chapter-01-q-001',
    answer: { selectedKey: 'A' },
  });
  assert.equal(wrong.isCorrect, false);
  assert.equal(wrong.correctDisplay, 'C');

  const unknown = gradeAnswer(store, {
    collectionSlug: 'microbiology-final-review',
    sourceQuestionId: 'chapter-01-q-001',
    answer: { selectedKey: 'UNKNOWN' },
  });
  assert.equal(unknown.isCorrect, false);
});

test('true false and translation grading follow legacy matching rules on the server', () => {
  const store = createImportedStore();

  const trueFalse = gradeAnswer(store, {
    collectionSlug: 'molecular-biology-review',
    sourceQuestionId: 'true-false-1-q-001',
    answer: { value: false },
  });
  assert.equal(trueFalse.isCorrect, true);
  assert.equal(trueFalse.correctDisplay, '错误');

  const translation = gradeAnswer(store, {
    collectionSlug: 'molecular-biology-review',
    sourceQuestionId: 'translation-1-q-001',
    answer: { text: 'Eukaryotes.' },
  });
  assert.equal(translation.isCorrect, true);
  assert.equal(translation.correctDisplay, 'Eukaryote');

  const wrongTranslation = gradeAnswer(store, {
    collectionSlug: 'molecular-biology-review',
    sourceQuestionId: 'translation-1-q-001',
    answer: { text: 'prokaryote' },
  });
  assert.equal(wrongTranslation.isCorrect, false);
  assert.equal(wrongTranslation.correctDisplay, 'Eukaryote');
});

test('image reveal questions do not grade directly and reveal answers only through reveal flow', () => {
  const store = createImportedStore();
  const botany = store.findCollectionBySlug('botany-slice');
  const imageQuestion = store.getSafeQuestions(botany.id, { limit: 1 })[0];

  const directGrade = gradeAnswer(store, {
    collectionSlug: 'botany-slice',
    sourceQuestionId: imageQuestion.sourceQuestionId,
    answer: { selectedKey: 'A' },
  });
  assert.equal(directGrade.gradingMode, 'manual_mistake');
  assert.equal(directGrade.isCorrect, null);
  assert.equal(directGrade.correctDisplay, undefined);

  const revealed = revealAnswer(store, {
    collectionSlug: 'botany-slice',
    sourceQuestionId: imageQuestion.sourceQuestionId,
  });
  assert.equal(revealed.gradingMode, 'reveal_only');
  assert.match(revealed.correctDisplay, /——/);
  assert.equal(revealed.answer.answer, revealed.correctDisplay);
});

test('short answer and essay questions reveal references and accept explicit self judgement', () => {
  const store = createImportedStore();

  const revealed = revealAnswer(store, {
    collectionSlug: 'molecular-biology-review',
    sourceQuestionId: 'short-answer-q-001',
  });
  assert.equal(revealed.gradingMode, 'self_judge');
  assert.match(revealed.answer.referenceAnswer, /DNA复制有三种方式/);
  assert.match(revealed.correctDisplay, /DNA复制有三种方式/);

  const judgedWrong = selfJudgeAnswer(store, {
    collectionSlug: 'molecular-biology-review',
    sourceQuestionId: 'short-answer-q-001',
    isCorrect: false,
  });
  assert.equal(judgedWrong.gradingMode, 'self_judge');
  assert.equal(judgedWrong.isCorrect, false);
  assert.match(judgedWrong.correctDisplay, /DNA复制有三种方式/);

  const judgedCorrect = selfJudgeAnswer(store, {
    collectionSlug: 'molecular-biology-review',
    sourceQuestionId: 'essay-q-024',
    isCorrect: true,
  });
  assert.equal(judgedCorrect.isCorrect, true);
  assert.match(judgedCorrect.correctDisplay, /Griffith/);
});
