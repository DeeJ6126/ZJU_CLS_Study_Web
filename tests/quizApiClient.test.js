import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createQuizSession,
  fetchQuizCategories,
  fetchQuizCollections,
  fetchQuizImageGallery,
  fetchQuizPastExamFeedback,
  fetchQuizPastExamQuestions,
  fetchQuizPastExams,
  fetchQuizReviewTerms,
  navigateQuizSession,
  revealQuizAnswer,
  selfJudgeQuizAnswer,
  submitQuizAnswer,
  claimQuizSession,
  fetchQuizAccountState,
  fetchQuizSession,
  mergeQuizAccountState,
  removeQuizVocabulary,
  upsertQuizVocabulary,
  setQuizAnonymousMode,
} from '../src/services/quizApiClient.js';

async function captureRequest(call) {
  const previousFetch = globalThis.fetch;
  let captured = null;
  globalThis.fetch = async (path, options = {}) => {
    captured = { path, options };
    return {
      ok: true,
      status: 200,
      async json() {
        return {};
      },
    };
  };

  try {
    await call();
    return captured;
  } finally {
    globalThis.fetch = previousFetch;
  }
}

test('quiz api client always uses absolute api paths', async () => {
  const requests = await Promise.all([
    captureRequest(() => fetchQuizCollections('BIO2023M')),
    captureRequest(() => fetchQuizCategories('molecular-biology-review')),
    captureRequest(() => fetchQuizImageGallery('botany-slice')),
    captureRequest(() => fetchQuizPastExams('microbiology-final-review')),
    captureRequest(() => fetchQuizPastExamQuestions('microbiology-final-review', 'midterm-24')),
    captureRequest(() => fetchQuizPastExamFeedback('microbiology-final-review', 'midterm-24', {
      questionNumber: 1,
      selectedKey: 'A',
    })),
    captureRequest(() => fetchQuizReviewTerms('molecular-biology-review', ['translation-1'])),
    captureRequest(() => createQuizSession({ collectionSlug: 'molecular-biology-review' })),
    captureRequest(() => navigateQuizSession('quiz_1', { direction: 'next' })),
    captureRequest(() => submitQuizAnswer('quiz_1', { sourceQuestionId: 'q1', answer: { selectedKey: 'A' } })),
    captureRequest(() => revealQuizAnswer('quiz_1', { sourceQuestionId: 'q1' })),
    captureRequest(() => selfJudgeQuizAnswer('quiz_1', { sourceQuestionId: 'q1', isCorrect: true })),
    captureRequest(() => claimQuizSession('quiz_1')),
    captureRequest(() => fetchQuizAccountState('molecular-biology-review')),
    captureRequest(() => fetchQuizSession('quiz_1')),
    captureRequest(() => mergeQuizAccountState({ collectionSlug: 'molecular-biology-review' })),
    captureRequest(() => upsertQuizVocabulary('molecular-biology-review', { recordKey: 'dna', term: 'DNA' })),
    captureRequest(() => removeQuizVocabulary('molecular-biology-review', 'dna')),
  ]);

  assert.ok(requests.every((request) => request.path.startsWith('/api/quiz/')));
});

test('quiz api client omits real session cookies while demo mode is active', async () => {
  setQuizAnonymousMode(true);
  const anonymous = await captureRequest(() => createQuizSession({ collectionSlug: 'molecular-biology-review' }));
  setQuizAnonymousMode(false);
  const authenticated = await captureRequest(() => fetchQuizAccountState('molecular-biology-review'));
  assert.equal(anonymous.options.credentials, 'omit');
  assert.equal(authenticated.options.credentials, 'include');
});
