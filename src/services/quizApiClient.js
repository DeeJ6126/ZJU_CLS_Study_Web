// Quiz API client. The session-based, vocabulary, mistake and progress
// endpoints all use the same {ok, status, ...data} envelope as the other
// clients. Anonymous mode (no session cookie) is toggled by App.vue before
// any quiz fetch happens.

import { createRequestClient } from './apiClient.js';

let anonymousMode = false;

export function setQuizAnonymousMode(enabled) {
  anonymousMode = Boolean(enabled);
}

function currentCredentials() {
  return anonymousMode ? 'omit' : 'include';
}

function buildQuizClient() {
  return createRequestClient({
    name: 'quiz',
    credentials: currentCredentials(),
  });
}

function makeRequest() {
  const { request } = buildQuizClient();
  return async (path, options) => {
    // Rebuild per call so the credentials flag stays in sync with the
    // module-level anonymousMode toggle. Cheap because the factory is
    // pure; avoids the cost of re-creating the client everywhere.
    const fresh = buildQuizClient().request;
    return fresh(path, options);
  };
}

const request = makeRequest();

export function fetchQuizCollections(courseCode) {
  const query = courseCode ? `?courseCode=${encodeURIComponent(courseCode)}` : '';
  return request(`/api/quiz/collections${query}`);
}

export function fetchQuizCategories(collectionSlug) {
  return request(`/api/quiz/collections/${encodeURIComponent(collectionSlug)}/categories`);
}

export function fetchQuizReviewTerms(collectionSlug, categorySourceIds = []) {
  const query = categorySourceIds
    .map((sourceId) => `categorySourceIds=${encodeURIComponent(sourceId)}`)
    .join('&');
  return request(`/api/quiz/collections/${encodeURIComponent(collectionSlug)}/review-terms${query ? `?${query}` : ''}`);
}

export function fetchQuizImageGallery(collectionSlug) {
  return request(`/api/quiz/collections/${encodeURIComponent(collectionSlug)}/image-gallery`);
}

export function fetchQuizPastExams(collectionSlug) {
  return request(`/api/quiz/collections/${encodeURIComponent(collectionSlug)}/past-exams`);
}

export function fetchQuizPastExamQuestions(collectionSlug, examId) {
  return request(`/api/quiz/collections/${encodeURIComponent(collectionSlug)}/past-exams/${encodeURIComponent(examId)}/questions`);
}

export function fetchQuizPastExamFeedback(collectionSlug, examId, { questionNumber, selectedKey }) {
  return request(`/api/quiz/collections/${encodeURIComponent(collectionSlug)}/past-exams/${encodeURIComponent(examId)}/answers`, {
    method: 'POST',
    body: { questionNumber, selectedKey },
  });
}

export function createQuizSession({ collectionSlug, categorySourceIds = [], sourceQuestionIds = [], mode, limit = 0 }) {
  return request('/api/quiz/sessions', {
    method: 'POST',
    body: { collectionSlug, categorySourceIds, sourceQuestionIds, mode, limit },
  });
}

export function fetchQuizSession(sessionId) {
  return request(`/api/quiz/sessions/${encodeURIComponent(sessionId)}`);
}

export function navigateQuizSession(sessionId, { direction, currentIndex } = {}) {
  return request(`/api/quiz/sessions/${encodeURIComponent(sessionId)}/navigation`, {
    method: 'POST',
    body: { direction, currentIndex },
  });
}

export function submitQuizAnswer(sessionId, { sourceQuestionId, answer }) {
  return request(`/api/quiz/sessions/${encodeURIComponent(sessionId)}/answers`, {
    method: 'POST',
    body: { sourceQuestionId, answer },
  });
}

export function revealQuizAnswer(sessionId, { sourceQuestionId }) {
  return request(`/api/quiz/sessions/${encodeURIComponent(sessionId)}/reveals`, {
    method: 'POST',
    body: { sourceQuestionId },
  });
}

export function selfJudgeQuizAnswer(sessionId, { sourceQuestionId, isCorrect }) {
  return request(`/api/quiz/sessions/${encodeURIComponent(sessionId)}/self-judgements`, {
    method: 'POST',
    body: { sourceQuestionId, isCorrect },
  });
}

export function addQuizMistake({ collectionSlug, sourceQuestionId, answer }) {
  return request('/api/quiz/mistakes', {
    method: 'POST',
    body: { collectionSlug, sourceQuestionId, answer },
  });
}

export function removeQuizMistake(collectionSlug, sourceQuestionId) {
  return request(`/api/quiz/mistakes/${encodeURIComponent(sourceQuestionId)}?collectionSlug=${encodeURIComponent(collectionSlug)}`, {
    method: 'DELETE',
  });
}

export function resetQuizRecords(collectionSlug, scope) {
  return request('/api/quiz/progress/reset', {
    method: 'POST', body: { collectionSlug, scope },
  });
}

export function claimQuizSession(sessionId) {
  return request(`/api/quiz/sessions/${encodeURIComponent(sessionId)}/claim`, {
    method: 'POST', body: {},
  });
}

export function fetchQuizAccountState(collectionSlug) {
  return request(`/api/quiz/account-state?collectionSlug=${encodeURIComponent(collectionSlug)}`);
}

export function mergeQuizAccountState(input) {
  return request('/api/quiz/account-state/merge', {
    method: 'POST', body: input,
  });
}

export function upsertQuizVocabulary(collectionSlug, record) {
  return request(`/api/quiz/vocabulary/${encodeURIComponent(collectionSlug)}/${encodeURIComponent(record.recordKey ?? record.id)}`, {
    method: 'PUT', body: record,
  });
}

export function removeQuizVocabulary(collectionSlug, recordKey) {
  return request(`/api/quiz/vocabulary/${encodeURIComponent(collectionSlug)}/${encodeURIComponent(recordKey)}`, {
    method: 'DELETE',
  });
}
