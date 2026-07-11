import test from 'node:test';
import assert from 'node:assert/strict';

import { createAuthStore } from '../server/authStore.js';
import { createAuthServer, isDirectRun } from '../server/server.js';
import { createQuizStore } from '../server/quiz/quizStore.js';

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve(server.address().port);
    });
  });
}

test('auth http server registers, logs in, returns current user, and logs out', async () => {
  const store = createAuthStore({ filename: ':memory:' });
  const quizStore = createQuizStore({ filename: ':memory:' });
  const { server } = createAuthServer({ store, quizStore });
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const registration = await fetch(`${baseUrl}/api/auth/register/cc98`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code: 'bio-cc98',
        password: 'test',
      }),
    });
    assert.equal(registration.status, 201);

    const login = await fetch(`${baseUrl}/api/auth/login/cc98`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        cc98Name: 'cc98_bio_visitor',
        password: 'test',
      }),
    });
    const cookie = login.headers.get('set-cookie');
    assert.equal(login.status, 200);
    assert.match(cookie, /study_session=/);

    const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie } });
    const meBody = await me.json();
    assert.equal(meBody.user.cc98Nickname, 'cc98_bio_visitor');
    assert.equal(meBody.user.verifications.cc98, true);

    const loggedOut = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { cookie },
    });
    const loggedOutBody = await loggedOut.json();
    assert.equal(loggedOutBody.user.role, 'guest');
  } finally {
    server.close();
  }
});

test('quiz http API lets students practice while users store session progress and mistakes', async () => {
  const store = createAuthStore({ filename: ':memory:' });
  const quizStore = createQuizStore({ filename: ':memory:' });
  const { server } = createAuthServer({ store, quizStore });
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const studentSessionResponse = await fetch(`${baseUrl}/api/quiz/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        collectionSlug: 'microbiology-final-review',
        categorySourceIds: ['1'],

        limit: 1,
      }),
    });
    const studentSessionBody = await studentSessionResponse.json();
    assert.equal(studentSessionResponse.status, 201);
    assert.equal(studentSessionBody.session.currentQuestion.sourceQuestionId, 'chapter-01-q-001');
    assert.equal(studentSessionBody.session.currentQuestion.answer, undefined);

    const studentAnswer = await fetch(`${baseUrl}/api/quiz/sessions/${studentSessionBody.session.id}/answers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sourceQuestionId: 'chapter-01-q-001',
        answer: { selectedKey: 'A' },
      }),
    });
    const studentAnswerBody = await studentAnswer.json();
    assert.equal(studentAnswer.status, 200);
    assert.equal(studentAnswerBody.result.isCorrect, false);
    assert.equal(studentAnswerBody.result.correctDisplay, 'C');

    const studentSessionLookup = await fetch(`${baseUrl}/api/quiz/sessions/${studentSessionBody.session.id}`);
    const studentSessionLookupBody = await studentSessionLookup.json();
    assert.equal(studentSessionLookup.status, 200);
    assert.equal(studentSessionLookupBody.session.currentIndex, 0);
    assert.deepEqual(
      studentSessionLookupBody.session.answerStatusBySourceQuestionId['chapter-01-q-001'].answer,
      { selectedKey: 'A' },
    );

    const studentMistake = await fetch(`${baseUrl}/api/quiz/mistakes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        collectionSlug: 'microbiology-final-review',
        sourceQuestionId: 'chapter-01-q-001',
        answer: { action: 'manual-add' },
      }),
    });
    assert.equal(studentMistake.status, 401);

    await fetch(`${baseUrl}/api/auth/register/cc98`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code: 'bio-cc98',
        password: 'test',
      }),
    });
    const login = await fetch(`${baseUrl}/api/auth/login/cc98`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        cc98Name: 'cc98_bio_visitor',
        password: 'test',
      }),
    });
    const cookie = login.headers.get('set-cookie');

    const sessionResponse = await fetch(`${baseUrl}/api/quiz/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        collectionSlug: 'microbiology-final-review',
        categorySourceIds: ['1'],

        limit: 2,
      }),
    });
    const sessionBody = await sessionResponse.json();
    assert.equal(sessionResponse.status, 201);
    assert.equal(sessionBody.session.currentQuestion.sourceQuestionId, 'chapter-01-q-001');
    assert.equal(sessionBody.session.currentQuestion.answer, undefined);

    const sessionLookup = await fetch(`${baseUrl}/api/quiz/sessions/${sessionBody.session.id}`, {
      headers: { cookie },
    });
    const sessionLookupBody = await sessionLookup.json();
    assert.equal(sessionLookup.status, 200);
    assert.equal(sessionLookupBody.session.id, sessionBody.session.id);

    const navigateNext = await fetch(`${baseUrl}/api/quiz/sessions/${sessionBody.session.id}/navigation`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ direction: 'next' }),
    });
    const navigateNextBody = await navigateNext.json();
    assert.equal(navigateNext.status, 200);
    assert.equal(navigateNextBody.session.currentIndex, 1);
    assert.equal(navigateNextBody.session.currentQuestion.sourceQuestionId, 'chapter-01-q-002');

    const navigatePrevious = await fetch(`${baseUrl}/api/quiz/sessions/${sessionBody.session.id}/navigation`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ direction: 'previous' }),
    });
    const navigatePreviousBody = await navigatePrevious.json();
    assert.equal(navigatePrevious.status, 200);
    assert.equal(navigatePreviousBody.session.currentIndex, 0);
    assert.equal(navigatePreviousBody.session.currentQuestion.sourceQuestionId, 'chapter-01-q-001');

    const answerResponse = await fetch(`${baseUrl}/api/quiz/sessions/${sessionBody.session.id}/answers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        sourceQuestionId: 'chapter-01-q-001',
        answer: { selectedKey: 'A' },
      }),
    });
    const answerBody = await answerResponse.json();
    assert.equal(answerResponse.status, 200);
    assert.equal(answerBody.result.isCorrect, false);
    assert.equal(answerBody.result.correctDisplay, 'C');

    const duplicateAnswer = await fetch(`${baseUrl}/api/quiz/sessions/${sessionBody.session.id}/answers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        sourceQuestionId: 'chapter-01-q-001',
        answer: { selectedKey: 'C' },
      }),
    });
    const duplicateAnswerBody = await duplicateAnswer.json();
    assert.equal(duplicateAnswerBody.result.alreadyAnswered, true);
    assert.equal(duplicateAnswerBody.result.isCorrect, false);

    const reviewTerms = await fetch(
      `${baseUrl}/api/quiz/collections/molecular-biology-review/review-terms?categorySourceIds=translation-1&categorySourceIds=short-answer`,
    );
    const reviewTermsBody = await reviewTerms.json();
    assert.equal(reviewTerms.status, 200);
    assert.ok(reviewTermsBody.terms.length > 0);
    assert.ok(reviewTermsBody.terms.every((term) => term.type === 'translation'));
    assert.equal(reviewTermsBody.terms.some((term) => Object.hasOwn(term, 'answer')), false);

    const pastExams = await fetch(`${baseUrl}/api/quiz/collections/microbiology-final-review/past-exams`);
    const pastExamsBody = await pastExams.json();
    assert.equal(pastExams.status, 200);
    assert.equal(pastExamsBody.exams[0].examId, 'midterm-24');
    assert.equal(Object.hasOwn(pastExamsBody.exams[0], 'questions'), false);

    const pastExamQuestions = await fetch(`${baseUrl}/api/quiz/collections/microbiology-final-review/past-exams/midterm-24/questions`);
    const pastExamQuestionsBody = await pastExamQuestions.json();
    assert.equal(pastExamQuestions.status, 200);
    assert.equal(pastExamQuestionsBody.questions[0].number, 1);
    assert.equal(Object.hasOwn(pastExamQuestionsBody.questions[0], 'answerKey'), false);

    const pastExamAnswer = await fetch(`${baseUrl}/api/quiz/collections/microbiology-final-review/past-exams/midterm-24/answers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        questionNumber: 1,
        selectedKey: 'A',
      }),
    });
    const pastExamAnswerBody = await pastExamAnswer.json();
    assert.equal(pastExamAnswer.status, 200);
    assert.equal(pastExamAnswerBody.result.questionNumber, 1);
    assert.equal(pastExamAnswerBody.result.correctKey, 'C');

    const progress = await fetch(`${baseUrl}/api/quiz/progress?collectionSlug=microbiology-final-review`, {
      headers: { cookie },
    });
    const progressBody = await progress.json();
    assert.equal(progressBody.progress.answered, 1);
    assert.equal(progressBody.progress.incorrect, 1);

    const mistakes = await fetch(`${baseUrl}/api/quiz/mistakes?collectionSlug=microbiology-final-review`, {
      headers: { cookie },
    });
    const mistakesBody = await mistakes.json();
    assert.equal(mistakesBody.mistakes.length, 1);
    assert.equal(mistakesBody.mistakes[0].question.answer, undefined);

    const deleteMistake = await fetch(`${baseUrl}/api/quiz/mistakes/chapter-01-q-001?collectionSlug=microbiology-final-review`, {
      method: 'DELETE',
      headers: { cookie },
    });
    assert.equal(deleteMistake.status, 200);
    const emptyMistakes = await fetch(`${baseUrl}/api/quiz/mistakes?collectionSlug=microbiology-final-review`, {
      headers: { cookie },
    });
    assert.equal((await emptyMistakes.json()).mistakes.length, 0);

    const reset = await fetch(`${baseUrl}/api/quiz/progress/reset`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        collectionSlug: 'microbiology-final-review',
        scope: 'all',
      }),
    });
    assert.equal(reset.status, 200);
  } finally {
    server.close();
  }
});

test('quiz http API exposes collection and category metadata without answers', async () => {
  const store = createAuthStore({ filename: ':memory:' });
  const quizStore = createQuizStore({ filename: ':memory:' });
  const { server } = createAuthServer({ store, quizStore });
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const collections = await fetch(`${baseUrl}/api/quiz/collections?courseCode=BIO2110F`);
    const collectionsBody = await collections.json();
    assert.equal(collections.status, 200);
    assert.deepEqual(
      collectionsBody.collections.map((collection) => collection.slug),
      ['microbiology-final-review'],
    );
    assert.equal(collectionsBody.collections[0].questionCount, 667);

    const categories = await fetch(`${baseUrl}/api/quiz/collections/microbiology-final-review/categories`);
    const categoriesBody = await categories.json();
    assert.equal(categories.status, 200);
    assert.equal(categoriesBody.categories.length, 14);
    assert.equal(categoriesBody.categories[0].sourceId, '1');
  } finally {
    server.close();
  }
});

test('auth server direct-run detection handles windows script paths', () => {
  assert.equal(
    isDirectRun('file:///E:/Study_Web/server/server.js', 'E:\\Study_Web\\server\\server.js'),
    true,
  );
});
