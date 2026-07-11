import test from 'node:test';
import assert from 'node:assert/strict';

import { createQuizStore } from '../server/quiz/quizStore.js';
import { importConfiguredQuizCollections } from '../server/quiz/quizImportService.js';
import {
  addManualMistake,
  createPracticeSession,
  getMistakes,
  getProgress,
  getPracticeSession,
  getTranslationReviewTerms,
  resetPracticeRecords,
  revealSessionAnswer,
  selfJudgeSessionAnswer,
  submitSessionAnswer,
} from '../server/quiz/quizSessionService.js';

function createImportedStore() {
  const store = createQuizStore({ filename: ':memory:' });
  store.initialize();
  importConfiguredQuizCollections(store);
  return store;
}

test('practice sessions store question order and answer progress for a user', () => {
  const store = createImportedStore();
  const userId = 1;
  const session = createPracticeSession(store, {
    userId,
    collectionSlug: 'microbiology-final-review',
    mode: 'categories',
    categorySourceIds: ['1'],
    limit: 3,
  });

  assert.equal(session.collectionSlug, 'microbiology-final-review');
  assert.equal(session.currentIndex, 0);
  assert.equal(session.questionOrder.length, 3);
  assert.equal(session.currentQuestion.sourceQuestionId, 'chapter-01-q-001');
  assert.equal(session.currentQuestion.answer, undefined);

  const submitted = submitSessionAnswer(store, {
    userId,
    sessionId: session.id,
    sourceQuestionId: 'chapter-01-q-001',
    answer: { selectedKey: 'A' },
  });
  assert.equal(submitted.isCorrect, false);
  assert.equal(submitted.correctDisplay, 'C');
  assert.equal(submitted.nextIndex, 1);

  const progress = getProgress(store, {
    userId,
    collectionSlug: 'microbiology-final-review',
  });
  assert.equal(progress.answered, 1);
  assert.equal(progress.correct, 0);
  assert.equal(progress.incorrect, 1);
  assert.equal(progress.activeSessionId, session.id);

  const mistakes = getMistakes(store, {
    userId,
    collectionSlug: 'microbiology-final-review',
  });
  assert.equal(mistakes.length, 1);
  assert.equal(mistakes[0].sourceQuestionId, 'chapter-01-q-001');
  assert.equal(mistakes[0].wrongCount, 1);
  assert.equal(mistakes[0].question.answer, undefined);
});

test('practice sessions include every selected category when no limit is requested', () => {
  const store = createImportedStore();
  const session = createPracticeSession(store, {
    userId: null,
    collectionSlug: 'microbiology-final-review',
    mode: 'categories',
    categorySourceIds: ['1', '2'],
  });

  assert.equal(session.questionOrder.length, 110);
  assert.equal(session.questionOrder[0], 'chapter-01-q-001');
  assert.ok(session.questionOrder.includes('chapter-02-q-001'));
});

test('practice sessions default to the source order when shuffle is omitted', () => {
  const store = createImportedStore();
  const session = createPracticeSession(store, {
    userId: null,
    collectionSlug: 'microbiology-final-review',
    mode: 'categories',
    categorySourceIds: ['1'],
    limit: 3,
  });

  assert.deepEqual(session.questionOrder, [
    'chapter-01-q-001',
    'chapter-01-q-002',
    'chapter-01-q-003',
  ]);
});

test('practice sessions can be built from exact source question ids for local mistake drills', () => {
  const store = createImportedStore();
  const session = createPracticeSession(store, {
    userId: null,
    collectionSlug: 'microbiology-final-review',
    mode: 'mistakes',
    sourceQuestionIds: ['chapter-02-q-001', 'missing-question', 'chapter-01-q-001'],
  });

  assert.equal(session.mode, 'mistakes');
  assert.deepEqual(session.questionOrder, ['chapter-02-q-001', 'chapter-01-q-001']);
  assert.equal(session.currentQuestion.sourceQuestionId, 'chapter-02-q-001');
});

test('practice sessions reject exact source id drills when no ids exist in the collection', () => {
  const store = createImportedStore();
  const session = createPracticeSession(store, {
    userId: null,
    collectionSlug: 'microbiology-final-review',
    mode: 'mistakes',
    sourceQuestionIds: ['missing-question'],
  });

  assert.equal(session.ok, false);
  assert.equal(session.status, 400);
});

test('practice sessions expose category metadata and local numbering for ordered sidebars', () => {
  const store = createImportedStore();
  const session = createPracticeSession(store, {
    userId: null,
    collectionSlug: 'botany-slice',
    mode: 'categories',
    categorySourceIds: ['叶', '根'],
  });

  assert.equal(session.questionOrder.length, 89);
  assert.equal(session.questionIndex.length, 89);
  assert.equal(session.questionIndex.filter((item) => item.categorySourceId === '叶').length, 46);
  assert.equal(session.questionIndex.filter((item) => item.categorySourceId === '根').length, 43);

  const leafQuestions = session.questionIndex.filter((item) => item.categorySourceId === '叶');
  const rootQuestions = session.questionIndex.filter((item) => item.categorySourceId === '根');
  assert.deepEqual(leafQuestions.slice(0, 3).map((item) => item.localNumber), [1, 2, 3]);
  assert.deepEqual(rootQuestions.slice(0, 3).map((item) => item.localNumber), [1, 2, 3]);
});

test('student practice sessions can grade answers without storing user progress or mistakes', () => {
  const store = createImportedStore();
  const session = createPracticeSession(store, {
    userId: null,
    collectionSlug: 'microbiology-final-review',
    mode: 'categories',
    categorySourceIds: ['1'],

    limit: 1,
  });

  assert.equal(session.currentQuestion.sourceQuestionId, 'chapter-01-q-001');
  assert.equal(session.currentQuestion.answer, undefined);

  const submitted = submitSessionAnswer(store, {
    userId: null,
    sessionId: session.id,
    sourceQuestionId: 'chapter-01-q-001',
    answer: { selectedKey: 'A' },
  });
  assert.equal(submitted.isCorrect, false);
  assert.equal(submitted.correctDisplay, 'C');

  const progress = getProgress(store, {
    userId: 1,
    collectionSlug: 'microbiology-final-review',
  });
  assert.equal(progress.answered, 0);
  assert.equal(getMistakes(store, { userId: 1, collectionSlug: 'microbiology-final-review' }).length, 0);
});

test('session answers lock the first attempt without advancing the current question', () => {
  const store = createImportedStore();
  const session = createPracticeSession(store, {
    userId: null,
    collectionSlug: 'microbiology-final-review',
    mode: 'categories',
    categorySourceIds: ['1'],
    limit: 2,
  });

  const first = submitSessionAnswer(store, {
    userId: null,
    sessionId: session.id,
    sourceQuestionId: 'chapter-01-q-001',
    answer: { selectedKey: 'A' },
  });
  assert.equal(first.isCorrect, false);
  assert.equal(first.nextIndex, 1);

  const afterFirst = getPracticeSession(store, { userId: null, sessionId: session.id });
  assert.equal(afterFirst.currentIndex, 0);
  assert.equal(afterFirst.currentQuestion.sourceQuestionId, 'chapter-01-q-001');
  assert.deepEqual(afterFirst.answerStatusBySourceQuestionId['chapter-01-q-001'].answer, { selectedKey: 'A' });
  assert.equal(afterFirst.answerStatusBySourceQuestionId['chapter-01-q-001'].isCorrect, false);
  assert.equal(afterFirst.answerStatusBySourceQuestionId['chapter-01-q-002'], undefined);

  const second = submitSessionAnswer(store, {
    userId: null,
    sessionId: session.id,
    sourceQuestionId: 'chapter-01-q-001',
    answer: { selectedKey: 'C' },
  });
  assert.equal(second.alreadyAnswered, true);
  assert.equal(second.isCorrect, false);

  const afterSecond = getPracticeSession(store, { userId: null, sessionId: session.id });
  assert.deepEqual(afterSecond.answerStatusBySourceQuestionId['chapter-01-q-001'].answer, { selectedKey: 'A' });
});

test('revealed and self-judged answers are restored in the session payload', () => {
  const store = createImportedStore();
  const session = createPracticeSession(store, {
    userId: null,
    collectionSlug: 'molecular-biology-review',
    mode: 'categories',
    categorySourceIds: ['short-answer'],
    limit: 1,
  });

  const revealed = revealSessionAnswer(store, {
    userId: null,
    sessionId: session.id,
    sourceQuestionId: session.currentQuestion.sourceQuestionId,
  });
  assert.equal(revealed.gradingMode, 'self_judge');

  const afterReveal = getPracticeSession(store, { userId: null, sessionId: session.id });
  const revealedStatus = afterReveal.answerStatusBySourceQuestionId[session.currentQuestion.sourceQuestionId];
  assert.equal(revealedStatus.revealed, true);
  assert.equal(revealedStatus.answer, undefined);
  assert.ok(revealedStatus.correctDisplay.length > 0);

  const judged = selfJudgeSessionAnswer(store, {
    userId: null,
    sessionId: session.id,
    sourceQuestionId: session.currentQuestion.sourceQuestionId,
    isCorrect: true,
  });
  assert.equal(judged.isCorrect, true);

  const afterJudgement = getPracticeSession(store, { userId: null, sessionId: session.id });
  const judgedStatus = afterJudgement.answerStatusBySourceQuestionId[session.currentQuestion.sourceQuestionId];
  assert.deepEqual(judgedStatus.answer, { selfJudgedCorrect: true });
  assert.equal(judgedStatus.isCorrect, true);
});

test('translation review terms only expose flashcard fields for translation questions', () => {
  const store = createImportedStore();
  const result = getTranslationReviewTerms(store, {
    collectionSlug: 'molecular-biology-review',
    categorySourceIds: ['translation-1', 'short-answer'],
  });

  assert.equal(result.ok, true);
  assert.ok(result.terms.length > 0);
  assert.ok(result.terms.every((term) => term.type === 'translation'));
  assert.ok(result.terms.every((term) => typeof term.promptCn === 'string'));
  assert.ok(result.terms.every((term) => typeof term.answerTerm === 'string'));
  assert.equal(result.terms.some((term) => Object.hasOwn(term, 'answer')), false);
  assert.equal(result.terms.some((term) => term.sourceQuestionId.startsWith('short-answer')), false);
});

test('reveal-only questions can be manually added to mistakes after reveal', () => {
  const store = createImportedStore();
  const userId = 2;
  const session = createPracticeSession(store, {
    userId,
    collectionSlug: 'botany-slice',
    mode: 'categories',
    categorySourceIds: ['叶'],

    limit: 1,
  });

  const revealed = revealSessionAnswer(store, {
    userId,
    sessionId: session.id,
    sourceQuestionId: session.currentQuestion.sourceQuestionId,
  });
  assert.equal(revealed.gradingMode, 'reveal_only');
  assert.match(revealed.correctDisplay, /——/);

  const mistake = addManualMistake(store, {
    userId,
    collectionSlug: 'botany-slice',
    sourceQuestionId: session.currentQuestion.sourceQuestionId,
    answer: { action: 'manual-add' },
  });
  assert.equal(mistake.wrongCount, 1);

  const mistakes = getMistakes(store, {
    userId,
    collectionSlug: 'botany-slice',
  });
  assert.equal(mistakes.length, 1);
  assert.equal(mistakes[0].correctDisplay, revealed.correctDisplay);
});

test('reset removes a user collection sessions, answers, and mistakes without touching other users', () => {
  const store = createImportedStore();
  const firstUser = 1;
  const secondUser = 2;
  const firstSession = createPracticeSession(store, {
    userId: firstUser,
    collectionSlug: 'microbiology-final-review',
    categorySourceIds: ['1'],

    limit: 1,
  });
  const secondSession = createPracticeSession(store, {
    userId: secondUser,
    collectionSlug: 'microbiology-final-review',
    categorySourceIds: ['1'],

    limit: 1,
  });

  submitSessionAnswer(store, {
    userId: firstUser,
    sessionId: firstSession.id,
    sourceQuestionId: firstSession.currentQuestion.sourceQuestionId,
    answer: { selectedKey: 'A' },
  });
  submitSessionAnswer(store, {
    userId: secondUser,
    sessionId: secondSession.id,
    sourceQuestionId: secondSession.currentQuestion.sourceQuestionId,
    answer: { selectedKey: 'A' },
  });

  const reset = resetPracticeRecords(store, {
    userId: firstUser,
    collectionSlug: 'microbiology-final-review',
    scope: 'all',
  });
  assert.equal(reset.ok, true);
  assert.equal(getProgress(store, { userId: firstUser, collectionSlug: 'microbiology-final-review' }).answered, 0);
  assert.equal(getMistakes(store, { userId: firstUser, collectionSlug: 'microbiology-final-review' }).length, 0);
  assert.equal(getProgress(store, { userId: secondUser, collectionSlug: 'microbiology-final-review' }).answered, 1);
  assert.equal(getMistakes(store, { userId: secondUser, collectionSlug: 'microbiology-final-review' }).length, 1);
});
