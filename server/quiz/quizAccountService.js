import { getMistakes, getProgress } from './quizSessionService.js';

const validVocabularyStatuses = new Set(['new', 'learning', 'mastered']);

function collectionFor(store, collectionSlug) {
  return store.findCollectionBySlug(String(collectionSlug ?? '').trim());
}

function cleanVocabulary(input = {}) {
  const recordKey = String(input.recordKey ?? input.id ?? '').trim().slice(0, 300);
  const term = String(input.term ?? '').trim().slice(0, 120);
  if (!recordKey || !term) return null;
  return {
    recordKey,
    term,
    normalizedTerm: String(input.normalizedTerm ?? term).trim().toLowerCase().slice(0, 120),
    status: validVocabularyStatuses.has(input.status) ? input.status : 'new',
    context: input.context && typeof input.context === 'object' ? input.context : {},
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

export function claimPracticeSession(store, { userId, sessionId }) {
  if (!userId) return { ok: false, status: 401, message: '请先登录账号。' };
  const session = store.findSessionById(sessionId);
  if (!session) return { ok: false, status: 404, message: '练习记录不存在。' };
  if (session.userId === userId) return { ok: true, session };
  if (session.userId !== 0 || !store.claimAnonymousSession(sessionId, userId)) {
    return { ok: false, status: 409, message: '该练习记录不能认领。' };
  }
  return { ok: true, session: store.findSessionById(sessionId) };
}

export function upsertVocabularyRecord(store, input) {
  if (!input.userId) return { ok: false, status: 401, message: '请先登录账号。' };
  const collection = collectionFor(store, input.collectionSlug);
  if (!collection) return { ok: false, status: 404, message: '题库不存在。' };
  const value = cleanVocabulary(input);
  if (!value) return { ok: false, status: 400, message: '生词记录无效。' };
  return {
    ok: true,
    status: 200,
    record: store.upsertVocabulary({ ...value, userId: input.userId, collectionId: collection.id }),
  };
}

export function removeVocabularyRecord(store, input) {
  const collection = collectionFor(store, input.collectionSlug);
  if (!input.userId) return { ok: false, status: 401, message: '请先登录账号。' };
  if (!collection) return { ok: false, status: 404, message: '题库不存在。' };
  store.removeVocabulary(input.userId, collection.id, String(input.recordKey ?? '').trim());
  return { ok: true, status: 200 };
}

export function getQuizAccountState(store, { userId, collectionSlug }) {
  const collection = collectionFor(store, collectionSlug);
  if (!collection || !userId) return { progress: null, mistakes: [], vocabulary: [] };
  return {
    progress: getProgress(store, { userId, collectionSlug }),
    mistakes: getMistakes(store, { userId, collectionSlug }),
    vocabulary: store.listVocabulary(userId, collection.id),
  };
}

export function mergeQuizAccountState(store, {
  userId, collectionSlug, mistakes = [], vocabulary = [],
}) {
  if (!userId) return { ok: false, status: 401, message: '请先登录账号。' };
  const collection = collectionFor(store, collectionSlug);
  if (!collection) return { ok: false, status: 404, message: '题库不存在。' };
  for (const mistake of mistakes.slice(0, 1000)) {
    const question = store.getQuestionForEvaluationBySourceId(collection.id, String(mistake.sourceQuestionId ?? ''));
    if (!question) continue;
    store.mergeMistake({
      userId,
      collectionId: collection.id,
      questionId: question.id,
      answer: mistake.lastAnswer ?? mistake.answer ?? {},
      correctDisplay: mistake.correctDisplay ?? '',
      wrongCount: mistake.wrongCount ?? mistake.addedCount ?? 1,
      lastAnsweredAt: mistake.lastAnsweredAt ?? mistake.lastAddedAt,
    });
  }
  for (const item of vocabulary.slice(0, 2000)) {
    const value = cleanVocabulary(item);
    if (value) store.upsertVocabulary({ ...value, userId, collectionId: collection.id });
  }
  return { ok: true, status: 200, state: getQuizAccountState(store, { userId, collectionSlug }) };
}
