import { randomBytes } from 'node:crypto';

import { gradeAnswer, revealAnswer, selfJudgeAnswer } from './quizGradingService.js';

function createSessionId() {
  return `quiz_${randomBytes(16).toString('hex')}`;
}

function requireCollection(store, collectionSlug) {
  const collection = store.findCollectionBySlug(collectionSlug);
  if (!collection) {
    return { error: { ok: false, status: 404, message: '题库不存在。' } };
  }
  return { collection };
}

function requireSession(store, { sessionId, userId }) {
  const session = store.findSessionById(sessionId);
  const isStudentSession = session?.userId === 0;
  if (!session || (!isStudentSession && session.userId !== userId)) {
    return { error: { ok: false, status: 404, message: '练习记录不存在。' } };
  }
  return { session };
}

function currentQuestionForSession(store, session) {
  const sourceQuestionId = session.questionOrder[session.currentIndex] ?? '';
  if (!sourceQuestionId) {
    return null;
  }
  return store.getSafeQuestionBySourceId(session.collectionId, sourceQuestionId);
}

function buildStoredAnswerStatus(store, collection, storedAnswer) {
  const question = store.getQuestionForEvaluationBySourceId(collection.id, storedAnswer.sourceQuestionId);
  if (!question) {
    return null;
  }

  const result = storedAnswer.gradingMode === 'self_judge'
    ? selfJudgeAnswer(store, {
      collectionSlug: collection.slug,
      sourceQuestionId: storedAnswer.sourceQuestionId,
      isCorrect: storedAnswer.answer?.selfJudgedCorrect,
    })
    : gradeAnswer(store, {
      collectionSlug: collection.slug,
      sourceQuestionId: storedAnswer.sourceQuestionId,
      answer: storedAnswer.answer,
    });

  return {
    sourceQuestionId: storedAnswer.sourceQuestionId,
    answer: storedAnswer.answer,
    isCorrect: result.isCorrect,
    gradingMode: storedAnswer.gradingMode,
    correctDisplay: result.correctDisplay,
    explanation: result.explanation,
    answeredAt: storedAnswer.answeredAt,
  };
}

function buildRevealStatus(store, collection, storedReveal) {
  const result = revealAnswer(store, {
    collectionSlug: collection.slug,
    sourceQuestionId: storedReveal.sourceQuestionId,
  });
  if (!result.ok) {
    return null;
  }

  return {
    sourceQuestionId: storedReveal.sourceQuestionId,
    revealed: true,
    gradingMode: result.gradingMode,
    correctDisplay: result.correctDisplay,
    revealedAnswer: result.answer,
    explanation: result.explanation,
    revealedAt: storedReveal.revealedAt,
  };
}

function buildAnswerStatusBySourceQuestionId(store, collection, session) {
  const statusBySourceQuestionId = {};

  for (const reveal of store.listSessionReveals(session.id)) {
    const status = buildRevealStatus(store, collection, reveal);
    if (status) {
      statusBySourceQuestionId[status.sourceQuestionId] = status;
    }
  }

  for (const answer of store.listSessionAnswers(session.id)) {
    const status = buildStoredAnswerStatus(store, collection, answer);
    if (status) {
      statusBySourceQuestionId[status.sourceQuestionId] = status;
    }
  }

  return statusBySourceQuestionId;
}

function buildQuestionIndex(store, session) {
  const refs = store.listQuestionRefsBySourceIds(session.collectionId, session.questionOrder);
  const localNumbers = new Map();

  for (const ref of refs) {
    const nextNumber = (localNumbers.get(ref.categorySourceId) ?? 0) + 1;
    localNumbers.set(ref.categorySourceId, nextNumber);
    ref.localNumber = nextNumber;
  }

  const refsBySourceId = new Map(refs.map((ref) => [ref.sourceQuestionId, ref]));

  return session.questionOrder.map((sourceQuestionId, index) => {
    const ref = refsBySourceId.get(sourceQuestionId);
    return {
      sourceQuestionId,
      index,
      categorySourceId: ref?.categorySourceId ?? '',
      localNumber: ref?.localNumber ?? index + 1,
    };
  });
}

function toSessionPayload(store, collection, session) {
  return {
    id: session.id,
    collectionSlug: collection.slug,
    mode: session.mode,
    selectedCategorySourceIds: session.selectedCategorySourceIds,
    questionOrder: session.questionOrder,
    questionIndex: buildQuestionIndex(store, session),
    currentIndex: session.currentIndex,
    currentQuestion: currentQuestionForSession(store, session),
    answerStatusBySourceQuestionId: buildAnswerStatusBySourceQuestionId(store, collection, session),
    startedAt: session.startedAt,
  };
}

function nextIndexAfterAnswer(session, sourceQuestionId) {
  const answeredIndex = session.questionOrder.indexOf(sourceQuestionId);
  if (answeredIndex < 0) {
    return session.currentIndex;
  }
  return Math.min(answeredIndex + 1, Math.max(session.questionOrder.length - 1, 0));
}

export function createPracticeSession(
  store,
  {
    userId,
    collectionSlug,
    mode = 'categories',
    categorySourceIds = [],
    sourceQuestionIds = [],
    limit = 0,
  },
) {
  const resolved = requireCollection(store, collectionSlug);
  if (resolved.error) {
    return resolved.error;
  }

  const { collection } = resolved;
  const exactSourceIds = Array.isArray(sourceQuestionIds)
    ? sourceQuestionIds
      .map((sourceId) => String(sourceId ?? '').trim())
      .filter(Boolean)
    : [];
  const questionSourceIds = exactSourceIds.length
    ? exactSourceIds.filter((sourceId) => store.getSafeQuestionBySourceId(collection.id, sourceId))
    : store.listQuestionSourceIds(collection.id, {
      categorySourceIds,
      limit,
    });
  const questionOrder = questionSourceIds;
  if (!questionOrder.length) {
    return { ok: false, status: 400, message: '没有可练习的题目。' };
  }

  const session = store.createSession({
    id: createSessionId(),
    userId: userId ?? 0,
    collectionId: collection.id,
    mode,
    selectedCategorySourceIds: categorySourceIds,
    questionOrder,
    currentIndex: 0,
    startedAt: new Date().toISOString(),
  });

  return toSessionPayload(store, collection, session);
}

export function getPracticeSession(store, { userId, sessionId }) {
  const sessionResult = requireSession(store, { sessionId, userId });
  if (sessionResult.error) {
    return sessionResult.error;
  }

  const { session } = sessionResult;
  const collection = store.listCollections().find((item) => item.id === session.collectionId);
  return toSessionPayload(store, collection, session);
}

export function navigatePracticeSession(store, { userId, sessionId, direction, currentIndex }) {
  const sessionResult = requireSession(store, { sessionId, userId });
  if (sessionResult.error) {
    return sessionResult.error;
  }

  const { session } = sessionResult;
  const collection = store.listCollections().find((item) => item.id === session.collectionId);
  const maxIndex = Math.max(session.questionOrder.length - 1, 0);
  let nextIndex = Number.isInteger(currentIndex) ? currentIndex : session.currentIndex;

  if (direction === 'next') {
    nextIndex = session.currentIndex + 1;
  } else if (direction === 'previous') {
    nextIndex = session.currentIndex - 1;
  }

  const updated = store.updateSessionIndex(sessionId, Math.min(Math.max(nextIndex, 0), maxIndex));
  return toSessionPayload(store, collection, updated);
}

export function submitSessionAnswer(store, { userId, sessionId, sourceQuestionId, answer }) {
  const sessionResult = requireSession(store, { sessionId, userId });
  if (sessionResult.error) {
    return sessionResult.error;
  }

  const { session } = sessionResult;
  const collection = store.listCollections().find((item) => item.id === session.collectionId);
  const question = store.getQuestionForEvaluationBySourceId(collection.id, sourceQuestionId);
  if (!question) {
    return { ok: false, status: 404, message: '题目不存在。' };
  }

  const existingAnswer = store.findSessionAnswer(sessionId, question.id);
  if (existingAnswer) {
    const existingStatus = buildStoredAnswerStatus(store, collection, existingAnswer);
    return {
      ok: true,
      alreadyAnswered: true,
      gradingMode: existingStatus.gradingMode,
      isCorrect: existingStatus.isCorrect,
      correctDisplay: existingStatus.correctDisplay,
      explanation: existingStatus.explanation,
      answer: existingStatus.answer,
      nextIndex: nextIndexAfterAnswer(session, sourceQuestionId),
    };
  }

  const result = gradeAnswer(store, {
    collectionSlug: collection.slug,
    sourceQuestionId,
    answer,
  });
  if (!result.ok) {
    return result;
  }

  store.recordAnswer({
    sessionId,
    userId: session.userId,
    collectionId: collection.id,
    questionId: question.id,
    answer,
    isCorrect: result.isCorrect,
    gradingMode: result.gradingMode,
  });

  if (userId) {
    if (result.isCorrect === false) {
      store.upsertMistake({
        userId,
        collectionId: collection.id,
        questionId: question.id,
        answer,
        correctDisplay: result.correctDisplay,
      });
    }
  }

  const nextIndex = nextIndexAfterAnswer(session, sourceQuestionId);
  return {
    ...result,
    answer,
    nextIndex,
  };
}

export function revealSessionAnswer(store, { userId, sessionId, sourceQuestionId }) {
  const sessionResult = requireSession(store, { sessionId, userId });
  if (sessionResult.error) {
    return sessionResult.error;
  }

  const { session } = sessionResult;
  const collection = store.listCollections().find((item) => item.id === session.collectionId);
  const result = revealAnswer(store, {
    collectionSlug: collection.slug,
    sourceQuestionId,
  });
  if (!result.ok) {
    return result;
  }

  const question = store.getQuestionForEvaluationBySourceId(collection.id, sourceQuestionId);
  if (!question) {
    return { ok: false, status: 404, message: '题目不存在。' };
  }

  store.recordReveal({
    sessionId,
    userId: session.userId,
    collectionId: collection.id,
    questionId: question.id,
  });

  return result;
}

export function selfJudgeSessionAnswer(store, { userId, sessionId, sourceQuestionId, isCorrect }) {
  const sessionResult = requireSession(store, { sessionId, userId });
  if (sessionResult.error) {
    return sessionResult.error;
  }

  const { session } = sessionResult;
  const collection = store.listCollections().find((item) => item.id === session.collectionId);
  const question = store.getQuestionForEvaluationBySourceId(collection.id, sourceQuestionId);
  if (!question) {
    return { ok: false, status: 404, message: '题目不存在。' };
  }

  const existingAnswer = store.findSessionAnswer(sessionId, question.id);
  if (existingAnswer) {
    const existingStatus = buildStoredAnswerStatus(store, collection, existingAnswer);
    return {
      ok: true,
      alreadyAnswered: true,
      gradingMode: existingStatus.gradingMode,
      isCorrect: existingStatus.isCorrect,
      correctDisplay: existingStatus.correctDisplay,
      explanation: existingStatus.explanation,
      answer: existingStatus.answer,
      nextIndex: nextIndexAfterAnswer(session, sourceQuestionId),
    };
  }

  const result = selfJudgeAnswer(store, {
    collectionSlug: collection.slug,
    sourceQuestionId,
    isCorrect,
  });
  if (!result.ok) {
    return result;
  }

  const answer = { selfJudgedCorrect: Boolean(isCorrect) };
  store.recordAnswer({
    sessionId,
    userId: session.userId,
    collectionId: collection.id,
    questionId: question.id,
    answer,
    isCorrect: result.isCorrect,
    gradingMode: result.gradingMode,
  });

  if (userId) {
    if (result.isCorrect === false) {
      store.upsertMistake({
        userId,
        collectionId: collection.id,
        questionId: question.id,
        answer,
        correctDisplay: result.correctDisplay,
      });
    }
  }

  const nextIndex = nextIndexAfterAnswer(session, sourceQuestionId);
  return {
    ...result,
    answer,
    nextIndex,
  };
}

export function getTranslationReviewTerms(store, { collectionSlug, categorySourceIds = [] }) {
  const resolved = requireCollection(store, collectionSlug);
  if (resolved.error) {
    return resolved.error;
  }

  const { collection } = resolved;
  const sourceIds = store.listQuestionSourceIds(collection.id, { categorySourceIds });
  const terms = sourceIds
    .map((sourceQuestionId) => store.getQuestionForEvaluationBySourceId(collection.id, sourceQuestionId))
    .filter((question) => question?.type === 'translation')
    .map((question) => ({
      type: 'translation',
      sourceQuestionId: question.sourceQuestionId,
      categorySourceId: question.body.categoryId ?? '',
      categoryTitle: question.body.categoryTitle ?? '',
      prompt: question.prompt,
      promptCn: question.body.promptCn ?? question.prompt,
      direction: question.body.direction ?? '',
      chineseMeaning: question.answer.chineseMeaning ?? question.body.chineseMeaning ?? null,
      answerTerm: question.answer.answerTerm ?? '',
      answerFullTerm: question.answer.answerFullTerm ?? null,
      acceptableAnswers: question.answer.acceptableAnswers ?? [],
      examSources: question.source.examSources ?? question.body.examSources ?? [],
    }));

  return { ok: true, terms };
}

export function getImageRevealGallery(store, { collectionSlug }) {
  const resolved = requireCollection(store, collectionSlug);
  if (resolved.error) {
    return resolved.error;
  }

  const { collection } = resolved;
  const sourceIds = store.listQuestionSourceIds(collection.id);
  const items = sourceIds
    .map((sourceQuestionId) => store.getQuestionForEvaluationBySourceId(collection.id, sourceQuestionId))
    .filter((question) => question?.type === 'image_reveal')
    .map((question) => ({
      sourceQuestionId: question.sourceQuestionId,
      type: question.type,
      categorySourceId: question.body.categoryId,
      imagePath: question.body.imagePath,
      answer: question.answer.answer,
      plantType: question.answer.plantType,
      magnification: question.answer.magnification,
      sourceName: question.answer.sourceName,
    }));

  return { ok: true, items };
}

export function addManualMistake(store, { userId, collectionSlug, sourceQuestionId, answer = {} }) {
  const resolved = requireCollection(store, collectionSlug);
  if (resolved.error) {
    return resolved.error;
  }

  const { collection } = resolved;
  const revealed = revealAnswer(store, { collectionSlug, sourceQuestionId });
  if (!revealed.ok) {
    return revealed;
  }

  const question = store.getQuestionForEvaluationBySourceId(collection.id, sourceQuestionId);
  return store.upsertMistake({
    userId,
    collectionId: collection.id,
    questionId: question.id,
    answer,
    correctDisplay: revealed.correctDisplay,
  });
}

export function getProgress(store, { userId, collectionSlug }) {
  const resolved = requireCollection(store, collectionSlug);
  if (resolved.error) {
    return {
      answered: 0,
      correct: 0,
      incorrect: 0,
      activeSessionId: '',
    };
  }
  return store.getProgressSummary(userId, resolved.collection.id);
}

export function getMistakes(store, { userId, collectionSlug }) {
  const resolved = requireCollection(store, collectionSlug);
  if (resolved.error) {
    return [];
  }

  return store.listMistakes(userId, resolved.collection.id).map((mistake) => ({
    ...mistake,
    question: store.getSafeQuestionBySourceId(resolved.collection.id, mistake.sourceQuestionId),
  }));
}

export function removeMistake(store, { userId, collectionSlug, sourceQuestionId }) {
  const resolved = requireCollection(store, collectionSlug);
  if (resolved.error) {
    return resolved.error;
  }

  store.deleteMistakeBySourceQuestionId({
    userId,
    collectionId: resolved.collection.id,
    sourceQuestionId,
  });
  return { ok: true };
}

export function resetPracticeRecords(store, { userId, collectionSlug, scope = 'all' }) {
  const resolved = requireCollection(store, collectionSlug);
  if (resolved.error) {
    return resolved.error;
  }

  store.resetUserCollectionRecords({
    userId,
    collectionId: resolved.collection.id,
    scope,
  });
  return { ok: true };
}
