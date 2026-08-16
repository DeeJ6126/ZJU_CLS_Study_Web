import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createQuizStore } from '../server/quiz/quizStore.js';
import { importConfiguredQuizCollections } from '../server/quiz/quizImportService.js';
import {
  claimPracticeSession,
  getQuizAccountState,
  mergeQuizAccountState,
  removeVocabularyRecord,
  upsertVocabularyRecord,
} from '../server/quiz/quizAccountService.js';
import { createPracticeSession, submitSessionAnswer } from '../server/quiz/quizSessionService.js';
import { getPracticeSession } from '../server/quiz/quizSessionService.js';

function setup() {
  const store = createQuizStore({ filename: ':memory:' });
  store.initialize();
  importConfiguredQuizCollections(store);
  return store;
}

test('an authenticated user can claim the current anonymous session', () => {
  const store = setup();
  const session = createPracticeSession(store, {
    userId: null, collectionSlug: 'microbiology-final-review', categorySourceIds: ['1'], limit: 1,
  });
  submitSessionAnswer(store, {
    userId: null, sessionId: session.id, sourceQuestionId: session.currentQuestion.sourceQuestionId,
    answer: { selectedKey: 'A' },
  });

  const claimed = claimPracticeSession(store, { userId: 42, sessionId: session.id });
  assert.equal(claimed.ok, true);
  assert.equal(store.findSessionById(session.id).userId, 42);
  assert.equal(store.getProgressSummary(42, store.findCollectionBySlug('microbiology-final-review').id).answered, 1);
  assert.equal(claimPracticeSession(store, { userId: 43, sessionId: session.id }).status, 409);
});

test('an authenticated user can reopen their unfinished session but not another account session', () => {
  const store = setup();
  const session = createPracticeSession(store, {
    userId: 42, collectionSlug: 'microbiology-final-review', categorySourceIds: ['1'], limit: 1,
  });
  assert.equal(getPracticeSession(store, { userId: 42, sessionId: session.id }).id, session.id);
  assert.equal(getPracticeSession(store, { userId: 43, sessionId: session.id }).status, 404);
});

test('quiz account sync merges mistakes by max count and vocabulary by newest update', () => {
  const store = setup();
  const first = mergeQuizAccountState(store, {
    userId: 42,
    collectionSlug: 'microbiology-final-review',
    mistakes: [{
      sourceQuestionId: 'chapter-01-q-001', wrongCount: 5,
      lastAnswer: { selectedKey: 'A' }, correctDisplay: 'C', lastAnsweredAt: '2026-01-01T00:00:00.000Z',
    }],
    vocabulary: [{
      recordKey: 'virus|practice|chapter-01-q-001', term: 'Virus', status: 'learning',
      context: { questionId: 'chapter-01-q-001' }, updatedAt: '2026-01-01T00:00:00.000Z',
    }],
  });
  assert.equal(first.ok, true);
  mergeQuizAccountState(store, {
    userId: 42,
    collectionSlug: 'microbiology-final-review',
    mistakes: [{
      sourceQuestionId: 'chapter-01-q-001', wrongCount: 2,
      lastAnswer: { selectedKey: 'B' }, correctDisplay: 'C', lastAnsweredAt: '2025-01-01T00:00:00.000Z',
    }],
    vocabulary: [{
      recordKey: 'virus|practice|chapter-01-q-001', term: 'Virus', status: 'mastered',
      context: {}, updatedAt: '2025-01-01T00:00:00.000Z',
    }],
  });
  const state = getQuizAccountState(store, { userId: 42, collectionSlug: 'microbiology-final-review' });
  assert.equal(state.mistakes[0].wrongCount, 5);
  assert.equal(state.vocabulary[0].status, 'learning');
});

test('vocabulary records support cross-device update and removal', () => {
  const store = setup();
  const input = {
    userId: 42, collectionSlug: 'molecular-biology-review', recordKey: 'dna', term: 'DNA',
    status: 'new', context: { sourceType: 'question' },
  };
  assert.equal(upsertVocabularyRecord(store, input).record.status, 'new');
  assert.equal(upsertVocabularyRecord(store, { ...input, status: 'mastered' }).record.status, 'mastered');
  assert.equal(removeVocabularyRecord(store, {
    userId: 42, collectionSlug: 'molecular-biology-review', recordKey: 'dna',
  }).ok, true);
  assert.equal(getQuizAccountState(store, {
    userId: 42, collectionSlug: 'molecular-biology-review',
  }).vocabulary.length, 0);
});

test('quiz imports preserve durable account progress across server restarts', () => {
  const directory = mkdtempSync(join(tmpdir(), 'quiz-account-restart-'));
  const filename = join(directory, 'quiz.sqlite');
  try {
    const first = createQuizStore({ filename });
    first.initialize();
    importConfiguredQuizCollections(first);
    const session = createPracticeSession(first, {
      userId: 42, collectionSlug: 'microbiology-final-review', categorySourceIds: ['1'], limit: 1,
    });
    submitSessionAnswer(first, {
      userId: 42, sessionId: session.id, sourceQuestionId: session.currentQuestion.sourceQuestionId,
      answer: { selectedKey: 'A' },
    });
    upsertVocabularyRecord(first, {
      userId: 42, collectionSlug: 'microbiology-final-review', recordKey: 'restart',
      term: 'restart', status: 'learning', context: {},
    });
    const questionId = first.getSafeQuestionBySourceId(
      first.findCollectionBySlug('microbiology-final-review').id,
      'chapter-01-q-001',
    ).id;
    first.close();

    const reopened = createQuizStore({ filename });
    reopened.initialize();
    importConfiguredQuizCollections(reopened);
    assert.equal(reopened.getSafeQuestionBySourceId(
      reopened.findCollectionBySlug('microbiology-final-review').id,
      'chapter-01-q-001',
    ).id, questionId);
    const state = getQuizAccountState(reopened, { userId: 42, collectionSlug: 'microbiology-final-review' });
    assert.equal(state.progress.answered, 1);
    assert.equal(state.mistakes.length, 1);
    assert.equal(state.vocabulary.length, 1);
    reopened.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
