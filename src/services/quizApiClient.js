let anonymousMode = false;

export function setQuizAnonymousMode(enabled) {
  anonymousMode = Boolean(enabled);
}

async function requestJson(path, options = {}) {
  const response = await fetch(path, {
    credentials: anonymousMode ? 'omit' : 'include',
    headers: {
      'content-type': 'application/json',
      ...(options.headers ?? {}),
    },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) {
    return { ok: false, status: response.status, message: data.message ?? '请求失败。' };
  }
  return { ok: true, status: response.status, ...data };
}

export function fetchQuizCollections(courseCode) {
  const query = courseCode ? `?courseCode=${encodeURIComponent(courseCode)}` : '';
  return requestJson(`/api/quiz/collections${query}`);
}

export function fetchQuizCategories(collectionSlug) {
  return requestJson(`/api/quiz/collections/${encodeURIComponent(collectionSlug)}/categories`);
}

export function fetchQuizReviewTerms(collectionSlug, categorySourceIds = []) {
  const query = categorySourceIds
    .map((sourceId) => `categorySourceIds=${encodeURIComponent(sourceId)}`)
    .join('&');
  return requestJson(`/api/quiz/collections/${encodeURIComponent(collectionSlug)}/review-terms${query ? `?${query}` : ''}`);
}

export function fetchQuizImageGallery(collectionSlug) {
  return requestJson(`/api/quiz/collections/${encodeURIComponent(collectionSlug)}/image-gallery`);
}

export function fetchQuizPastExams(collectionSlug) {
  return requestJson(`/api/quiz/collections/${encodeURIComponent(collectionSlug)}/past-exams`);
}

export function fetchQuizPastExamQuestions(collectionSlug, examId) {
  return requestJson(`/api/quiz/collections/${encodeURIComponent(collectionSlug)}/past-exams/${encodeURIComponent(examId)}/questions`);
}

export function fetchQuizPastExamFeedback(collectionSlug, examId, { questionNumber, selectedKey }) {
  return requestJson(`/api/quiz/collections/${encodeURIComponent(collectionSlug)}/past-exams/${encodeURIComponent(examId)}/answers`, {
    method: 'POST',
    body: JSON.stringify({ questionNumber, selectedKey }),
  });
}

export function createQuizSession({ collectionSlug, categorySourceIds = [], sourceQuestionIds = [], mode, limit = 0 }) {
  return requestJson('/api/quiz/sessions', {
    method: 'POST',
    body: JSON.stringify({ collectionSlug, categorySourceIds, sourceQuestionIds, mode, limit }),
  });
}

export function fetchQuizSession(sessionId) {
  return requestJson(`/api/quiz/sessions/${encodeURIComponent(sessionId)}`);
}

export function navigateQuizSession(sessionId, { direction, currentIndex } = {}) {
  return requestJson(`/api/quiz/sessions/${encodeURIComponent(sessionId)}/navigation`, {
    method: 'POST',
    body: JSON.stringify({ direction, currentIndex }),
  });
}

export function submitQuizAnswer(sessionId, { sourceQuestionId, answer }) {
  return requestJson(`/api/quiz/sessions/${encodeURIComponent(sessionId)}/answers`, {
    method: 'POST',
    body: JSON.stringify({ sourceQuestionId, answer }),
  });
}

export function revealQuizAnswer(sessionId, { sourceQuestionId }) {
  return requestJson(`/api/quiz/sessions/${encodeURIComponent(sessionId)}/reveals`, {
    method: 'POST',
    body: JSON.stringify({ sourceQuestionId }),
  });
}

export function selfJudgeQuizAnswer(sessionId, { sourceQuestionId, isCorrect }) {
  return requestJson(`/api/quiz/sessions/${encodeURIComponent(sessionId)}/self-judgements`, {
    method: 'POST',
    body: JSON.stringify({ sourceQuestionId, isCorrect }),
  });
}

export function addQuizMistake({ collectionSlug, sourceQuestionId, answer }) {
  return requestJson('/api/quiz/mistakes', {
    method: 'POST',
    body: JSON.stringify({ collectionSlug, sourceQuestionId, answer }),
  });
}

export function removeQuizMistake(collectionSlug, sourceQuestionId) {
  return requestJson(`/api/quiz/mistakes/${encodeURIComponent(sourceQuestionId)}?collectionSlug=${encodeURIComponent(collectionSlug)}`, {
    method: 'DELETE',
  });
}

export function resetQuizRecords(collectionSlug, scope) {
  return requestJson('/api/quiz/progress/reset', {
    method: 'POST', body: JSON.stringify({ collectionSlug, scope }),
  });
}

export function claimQuizSession(sessionId) {
  return requestJson(`/api/quiz/sessions/${encodeURIComponent(sessionId)}/claim`, {
    method: 'POST', body: '{}',
  });
}

export function fetchQuizAccountState(collectionSlug) {
  return requestJson(`/api/quiz/account-state?collectionSlug=${encodeURIComponent(collectionSlug)}`);
}

export function mergeQuizAccountState(input) {
  return requestJson('/api/quiz/account-state/merge', {
    method: 'POST', body: JSON.stringify(input),
  });
}

export function upsertQuizVocabulary(collectionSlug, record) {
  return requestJson(`/api/quiz/vocabulary/${encodeURIComponent(collectionSlug)}/${encodeURIComponent(record.recordKey ?? record.id)}`, {
    method: 'PUT', body: JSON.stringify(record),
  });
}

export function removeQuizVocabulary(collectionSlug, recordKey) {
  return requestJson(`/api/quiz/vocabulary/${encodeURIComponent(collectionSlug)}/${encodeURIComponent(recordKey)}`, {
    method: 'DELETE',
  });
}
