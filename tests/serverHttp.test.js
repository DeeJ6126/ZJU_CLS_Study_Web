import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createAuthStore } from '../server/authStore.js';
import { createAuthServer, isDirectRun } from '../server/server.js';
import { createQuizStore } from '../server/quiz/quizStore.js';
import { createContentStore } from '../server/content/contentStore.js';

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
        password: 'test-pass',
      }),
    });
    assert.equal(registration.status, 201);

    const login = await fetch(`${baseUrl}/api/auth/login/cc98`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        cc98Name: 'cc98_bio_visitor',
        password: 'test-pass',
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
        password: 'test-pass',
      }),
    });
    const login = await fetch(`${baseUrl}/api/auth/login/cc98`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        cc98Name: 'cc98_bio_visitor',
        password: 'test-pass',
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

test('email auth HTTP API sends codes, registers, logs in, binds, and resets passwords', async () => {
  const store = createAuthStore({ filename: ':memory:' });
  const quizStore = createQuizStore({ filename: ':memory:' });
  const sent = [];
  let nextCode = '123456';
  let now = new Date('2026-07-30T12:00:00.000Z');
  const { server } = createAuthServer({
    store,
    quizStore,
    emailSender: async (message) => sent.push(message),
    emailCodeGenerator: () => nextCode,
    emailNow: () => now,
  });
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const invalid = await fetch(`${baseUrl}/api/auth/email/code`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ studentId: 'student', purpose: 'register' }),
    });
    assert.equal(invalid.status, 400);

    const codeResponse = await fetch(`${baseUrl}/api/auth/email/code`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ studentId: '3220100000', purpose: 'register' }),
    });
    assert.equal(codeResponse.status, 202);
    assert.equal(sent[0].to, '3220100000@zju.edu.cn');

    const registration = await fetch(`${baseUrl}/api/auth/register/email`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        studentId: '3220100000', nickname: '生科同学', code: '123456', password: '12345678',
      }),
    });
    const registrationBody = await registration.json();
    assert.equal(registration.status, 201);
    assert.equal(registrationBody.user.verifications.email, true);

    const login = await fetch(`${baseUrl}/api/auth/login/email`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ studentId: '3220100000', password: '12345678' }),
    });
    assert.equal(login.status, 200);
    assert.match(login.headers.get('set-cookie'), /study_session=/);

    now = new Date('2026-07-30T13:00:00.000Z');
    nextCode = '654321';
    await fetch(`${baseUrl}/api/auth/email/code`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ studentId: '3220100000', purpose: 'password-reset' }),
    });
    const reset = await fetch(`${baseUrl}/api/auth/password/reset/email`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ studentId: '3220100000', code: '654321', password: 'new-pass' }),
    });
    assert.equal(reset.status, 200);

    const oldLogin = await fetch(`${baseUrl}/api/auth/login/email`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ studentId: '3220100000', password: '12345678' }),
    });
    assert.equal(oldLogin.status, 401);
  } finally {
    server.close();
  }
});

test('submission moderation, audit logs, and anonymous likes work through HTTP', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'study-submissions-'));
  const store = createAuthStore({ filename: ':memory:' });
  const quizStore = createQuizStore({ filename: ':memory:' });
  const contentStore = createContentStore({ filename: ':memory:' });
  const { server } = createAuthServer({
    store,
    quizStore,
    contentStore,
    uploadDirectory: directory,
    adminCc98Names: new Set(['cc98_bio_visitor']),
  });
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;

  async function registerAndLogin(code, cc98Name, password) {
    await fetch(`${baseUrl}/api/auth/register/cc98`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, password }),
    });
    const response = await fetch(`${baseUrl}/api/auth/login/cc98`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cc98Name, password }),
    });
    return response.headers.get('set-cookie');
  }

  try {
    const guestSubmission = await fetch(`${baseUrl}/api/submissions`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    });
    assert.equal(guestSubmission.status, 401);

    const studentCookie = await registerAndLogin('zjubio-test-001', 'zjubio_test_001', 'test-pass');
    const submitted = await fetch(`${baseUrl}/api/submissions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: studentCookie },
      body: JSON.stringify({
        courseCode: 'BIO2110F', type: 'experience', title: '学生心得', summary: '简短摘要',
        author: '投稿同学', body: '投稿正文', cc98Url: 'https://www.cc98.org/topic/1', gpa: '4.20',
      }),
    });
    const submittedBody = await submitted.json();
    assert.equal(submitted.status, 201);
    assert.equal(submittedBody.submission.status, 'pending');

    const adminCookie = await registerAndLogin('bio-cc98', 'cc98_bio_visitor', 'administrator');
    const pending = await fetch(`${baseUrl}/api/admin/submissions?status=pending`, { headers: { cookie: adminCookie } });
    const pendingBody = await pending.json();
    assert.equal(pending.status, 200);
    assert.equal(pendingBody.submissions.length, 1);

    const approved = await fetch(`${baseUrl}/api/admin/submissions/${submittedBody.submission.id}/approve`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie: adminCookie }, body: '{}',
    });
    assert.equal(approved.status, 200);

    const studentNotifications = await fetch(`${baseUrl}/api/account/notifications`, {
      headers: { cookie: studentCookie },
    });
    const studentNotificationBody = await studentNotifications.json();
    assert.equal(studentNotificationBody.notifications[0].type, 'submission.approved');
    assert.equal(studentNotificationBody.notifications[0].submissionId, submittedBody.submission.id);

    const publicContent = await fetch(`${baseUrl}/api/content/courses/BIO2110F`);
    const publicBody = await publicContent.json();
    const item = publicBody.items.find((entry) => entry.title === '学生心得');
    assert.equal(item.gpa, '4.20');
    assert.equal(item.likeCount, 0);

    const liked = await fetch(`${baseUrl}/api/content/${item.id}/like`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    });
    const likedBody = await liked.json();
    assert.equal(likedBody.liked, true);
    assert.equal(likedBody.likeCount, 1);
    assert.match(liked.headers.get('set-cookie'), /study_visitor=/);

    const logs = await fetch(`${baseUrl}/api/admin/audit-logs?action=submission.approve`, {
      headers: { cookie: adminCookie },
    });
    const logsBody = await logs.json();
    assert.equal(logs.status, 200);
    assert.equal(logsBody.logs[0].targetTitle, '学生心得');
  } finally {
    server.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('content admin API protects writes and publishes content to the public course API', async () => {
  const store = createAuthStore({ filename: ':memory:' });
  const quizStore = createQuizStore({ filename: ':memory:' });
  const contentStore = createContentStore({ filename: ':memory:' });
  const uploadDirectory = mkdtempSync(join(tmpdir(), 'zjubio-http-content-'));
  const { server } = createAuthServer({
    store, quizStore, contentStore, uploadDirectory,
    adminCc98Names: new Set(['cc98_bio_visitor']),
  });
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;

  async function registerAndLogin(code, cc98Name, password) {
    await fetch(`${baseUrl}/api/auth/register/cc98`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, password }),
    });
    const login = await fetch(`${baseUrl}/api/auth/login/cc98`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cc98Name, password }),
    });
    return login.headers.get('set-cookie');
  }

  try {
    assert.equal((await fetch(`${baseUrl}/api/admin/content`)).status, 401);
    const studentCookie = await registerAndLogin('cls-open-day', 'cc98_open_day', 'student-pass');
    assert.equal((await fetch(`${baseUrl}/api/admin/content`, { headers: { cookie: studentCookie } })).status, 403);

    const adminCookie = await registerAndLogin('bio-cc98', 'cc98_bio_visitor', 'admin-pass-123');
    const create = await fetch(`${baseUrl}/api/admin/content`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({
        courseCode: 'BIO2110F', type: 'experience', title: '管理员新增心得',
        summary: '测试发布闭环。', author: '学术部', body: '这是一条由管理平台维护的内容。',
      }),
    });
    const createdBody = await create.json();
    assert.equal(create.status, 201);

    const beforeItems = (await (await fetch(`${baseUrl}/api/content/courses/BIO2110F`)).json()).items;
    assert.equal(beforeItems.some((item) => item.id === createdBody.item.id), false);

    const publish = await fetch(`${baseUrl}/api/admin/content/${createdBody.item.id}/publish`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie: adminCookie }, body: '{}',
    });
    assert.equal(publish.status, 200);
    const afterItems = (await (await fetch(`${baseUrl}/api/content/courses/BIO2110F`)).json()).items;
    assert.equal(afterItems.some((item) => item.id === createdBody.item.id), true);

    const archive = await fetch(`${baseUrl}/api/admin/content/${createdBody.item.id}/archive`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie: adminCookie }, body: '{}',
    });
    assert.equal(archive.status, 200);
  } finally {
    server.close();
    rmSync(uploadDirectory, { recursive: true, force: true });
  }
});

test('content admin API validates and serves uploaded PDF files', async () => {
  const store = createAuthStore({ filename: ':memory:' });
  const quizStore = createQuizStore({ filename: ':memory:' });
  const contentStore = createContentStore({ filename: ':memory:' });
  const uploadDirectory = mkdtempSync(join(tmpdir(), 'zjubio-http-files-'));
  const { server } = createAuthServer({
    store, quizStore, contentStore, uploadDirectory,
    adminCc98Names: new Set(['cc98_bio_visitor']),
  });
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await fetch(`${baseUrl}/api/auth/register/cc98`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'bio-cc98', password: 'admin-pass-123' }),
    });
    const login = await fetch(`${baseUrl}/api/auth/login/cc98`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cc98Name: 'cc98_bio_visitor', password: 'admin-pass-123' }),
    });
    const cookie = login.headers.get('set-cookie');
    const created = await fetch(`${baseUrl}/api/admin/content`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        courseCode: 'BIO2110F', type: 'paper', title: '测试试卷', summary: 'API 测试',
        year: '2025-2026', teacher: '测试教师',
      }),
    });
    const item = (await created.json()).item;

    const fakePdf = await fetch(`${baseUrl}/api/admin/content/${item.id}/file`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/pdf', 'x-file-name': 'fake.pdf',
        'x-admin-upload': 'course-content', cookie,
      },
      body: 'not pdf',
    });
    assert.equal(fakePdf.status, 400);

    const upload = await fetch(`${baseUrl}/api/admin/content/${item.id}/file`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/pdf', 'x-file-name': '../midterm.pdf',
        'x-admin-upload': 'course-content', cookie,
      },
      body: '%PDF-1.7\ntest',
    });
    const uploadedItem = (await upload.json()).item;
    assert.equal(upload.status, 201);
    assert.equal(uploadedItem.file.fileName, 'midterm.pdf');

    assert.equal((await fetch(`${baseUrl}${uploadedItem.file.url}`)).status, 404);
    const publish = await fetch(`${baseUrl}/api/admin/content/${item.id}/publish`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: '{}',
    });
    assert.equal(publish.status, 200);

    const publicItems = (await (await fetch(`${baseUrl}/api/content/courses/BIO2110F`)).json()).items;
    const publicPaper = publicItems.find((entry) => entry.id === item.id);
    assert.equal(Object.hasOwn(publicPaper, 'sourcePath'), false);
    assert.equal(Object.hasOwn(publicPaper.file, 'storedName'), false);

    const fileResponse = await fetch(`${baseUrl}${uploadedItem.file.url}`);
    assert.equal(fileResponse.status, 200);
    assert.equal(fileResponse.headers.get('content-type'), 'application/pdf');
    assert.equal(fileResponse.headers.get('x-content-type-options'), 'nosniff');
    assert.match(await fileResponse.text(), /^%PDF-/);

    const remove = await fetch(`${baseUrl}/api/admin/content/${item.id}/file`, {
      method: 'DELETE', headers: { 'content-type': 'application/json', cookie },
    });
    assert.equal(remove.status, 400);

    await fetch(`${baseUrl}/api/admin/content/${item.id}/archive`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: '{}',
    });
    const removeArchived = await fetch(`${baseUrl}/api/admin/content/${item.id}/file`, {
      method: 'DELETE', headers: { 'content-type': 'application/json', cookie },
    });
    assert.equal(removeArchived.status, 200);
  } finally {
    server.close();
    rmSync(uploadDirectory, { recursive: true, force: true });
  }
});

test('activity HTTP API exposes only administrator-managed push-article entries', async () => {
  const store = createAuthStore({ filename: ':memory:' });
  const quizStore = createQuizStore({ filename: ':memory:' });
  const contentStore = createContentStore({ filename: ':memory:' });
  const { server } = createAuthServer({
    store, quizStore, contentStore,
    adminCc98Names: new Set(['cc98_bio_visitor']),
  });
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const publicResponse = await fetch(`${baseUrl}/api/activities`);
    const publicBody = await publicResponse.json();
    assert.equal(publicResponse.status, 200);
    assert.equal(publicBody.activities.length, 0);
    assert.equal(publicBody.activities.every((item) => item.status === undefined), true);
    assert.equal((await fetch(`${baseUrl}/api/admin/activities`)).status, 401);

    await fetch(`${baseUrl}/api/auth/register/cc98`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'bio-cc98', password: 'admin-pass-123' }),
    });
    const login = await fetch(`${baseUrl}/api/auth/login/cc98`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cc98Name: 'cc98_bio_visitor', password: 'admin-pass-123' }),
    });
    const cookie = login.headers.get('set-cookie');

    const create = await fetch(`${baseUrl}/api/admin/activities`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        title: '实验室开放日回顾', programId: 'laboratory-open-day',
        imageUrl: '/assets/activities/laboratory-open-day.webp',
        externalUrl: 'https://mp.weixin.qq.com/s/http-test-lab',
      }),
    });
    const created = await create.json();
    assert.equal(create.status, 201);
    assert.equal(created.activity.status, 'published');
    const published = await (await fetch(`${baseUrl}/api/activities`)).json();
    assert.equal(published.activities[0].programId, 'laboratory-open-day');
    assert.equal(published.activities[0].externalUrl, 'https://mp.weixin.qq.com/s/http-test-lab');
    assert.equal(published.activities[0].status, undefined);

    const archive = await fetch(`${baseUrl}/api/admin/activities/${created.activity.id}/archive`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: '{}',
    });
    assert.equal(archive.status, 200);
    assert.equal((await fetch(`${baseUrl}/api/activities/${created.activity.slug}`)).status, 404);
  } finally {
    server.close();
  }
});
