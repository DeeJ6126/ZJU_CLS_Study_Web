const autoGradedTypes = new Set(['single_choice', 'multiple_choice', 'true_false', 'translation']);
const revealOnlyTypes = new Set(['image_reveal']);
const selfJudgeTypes = new Set(['short_answer', 'essay']);

function resolveQuestion(store, { collectionSlug, sourceQuestionId }) {
  const collection = store.findCollectionBySlug(collectionSlug);
  if (!collection) {
    return { error: { status: 404, message: '题库不存在。' } };
  }

  const question = store.getQuestionForEvaluationBySourceId(collection.id, sourceQuestionId);
  if (!question) {
    return { error: { status: 404, message: '题目不存在。' } };
  }

  return { collection, question };
}

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[，,。\.！!？?；;：:、\s()（）\[\]【】]+$/, '')
    .replace(/^[，,。\.！!？?；;：:、\s()（）\[\]【】]+/, '');
}

function getPossibleStems(word) {
  const stems = new Set([word]);

  if (word.length <= 2) {
    return Array.from(stems);
  }

  if (word.endsWith('ies') && word.length > 4) {
    stems.add(`${word.slice(0, -3)}y`);
  }

  if (word.endsWith('ves') && word.length > 4) {
    stems.add(`${word.slice(0, -3)}f`);
  }

  if (word.endsWith('es') && word.length > 4) {
    stems.add(word.slice(0, -2));
  }

  if (word.endsWith('s') && word.length > 3) {
    stems.add(word.slice(0, -1));
  }

  return Array.from(stems);
}

function isTranslationCorrect(userInput, answer) {
  const normalized = normalizeText(userInput);
  if (!normalized) {
    return false;
  }

  const acceptableAnswers = [
    ...(answer.acceptableAnswers ?? []),
    answer.answerTerm,
    answer.answerFullTerm,
  ].filter(Boolean);

  if (acceptableAnswers.some((item) => normalizeText(item) === normalized)) {
    return true;
  }

  const inputStems = getPossibleStems(normalized);
  return acceptableAnswers.some((item) => {
    const answerStems = getPossibleStems(normalizeText(item));
    return inputStems.some((stem) => answerStems.includes(stem));
  });
}

function buildCorrectDisplay(question) {
  const { answer } = question;

  if (question.type === 'single_choice' || question.type === 'multiple_choice') {
    return answer.answerKey ?? answer.answerText ?? '';
  }

  if (question.type === 'true_false') {
    return answer.answerIsTrue ? '正确' : '错误';
  }

  if (question.type === 'translation') {
    return answer.answerTerm ?? answer.chineseMeaning ?? '';
  }

  if (question.type === 'image_reveal') {
    return answer.answer ?? '';
  }

  if (question.type === 'short_answer' || question.type === 'essay') {
    return answer.referenceAnswer ?? '';
  }

  return '';
}

function gradeAutoQuestion(question, submittedAnswer) {
  if (question.type === 'single_choice' || question.type === 'multiple_choice') {
    return String(submittedAnswer?.selectedKey ?? '') === String(question.answer.answerKey ?? '');
  }

  if (question.type === 'true_false') {
    return Boolean(submittedAnswer?.value) === Boolean(question.answer.answerIsTrue);
  }

  if (question.type === 'translation') {
    return isTranslationCorrect(submittedAnswer?.text, question.answer);
  }

  return false;
}

function publicAnswerForReveal(question) {
  if (question.type === 'image_reveal') {
    return {
      answer: question.answer.answer,
      plantType: question.answer.plantType,
      magnification: question.answer.magnification,
      sourceName: question.answer.sourceName,
    };
  }

  if (question.type === 'short_answer' || question.type === 'essay') {
    return {
      referenceAnswer: question.answer.referenceAnswer,
    };
  }

  return {
    correctDisplay: buildCorrectDisplay(question),
  };
}

export function gradeAnswer(store, { collectionSlug, sourceQuestionId, answer }) {
  const resolved = resolveQuestion(store, { collectionSlug, sourceQuestionId });
  if (resolved.error) {
    return { ok: false, ...resolved.error };
  }

  const { question } = resolved;
  if (revealOnlyTypes.has(question.type)) {
    return {
      ok: true,
      gradingMode: 'manual_mistake',
      isCorrect: null,
      feedback: '这类题目需要先揭晓答案，再由用户决定是否加入错题。',
    };
  }

  if (selfJudgeTypes.has(question.type)) {
    return {
      ok: true,
      gradingMode: 'self_judge',
      isCorrect: null,
      feedback: '这类题目需要揭晓参考答案后由用户自评。',
    };
  }

  if (!autoGradedTypes.has(question.type)) {
    return {
      ok: false,
      status: 400,
      message: '暂不支持该题型判分。',
    };
  }

  const isCorrect = gradeAutoQuestion(question, answer);
  return {
    ok: true,
    gradingMode: 'auto',
    isCorrect,
    correctDisplay: buildCorrectDisplay(question),
    explanation: question.explanation,
  };
}

export function revealAnswer(store, { collectionSlug, sourceQuestionId }) {
  const resolved = resolveQuestion(store, { collectionSlug, sourceQuestionId });
  if (resolved.error) {
    return { ok: false, ...resolved.error };
  }

  const { question } = resolved;
  if (autoGradedTypes.has(question.type)) {
    return {
      ok: false,
      status: 400,
      message: '自动判分题应通过提交答案获取反馈。',
    };
  }

  const gradingMode = selfJudgeTypes.has(question.type) ? 'self_judge' : 'reveal_only';
  return {
    ok: true,
    gradingMode,
    correctDisplay: buildCorrectDisplay(question),
    answer: publicAnswerForReveal(question),
    explanation: question.explanation,
  };
}

export function selfJudgeAnswer(store, { collectionSlug, sourceQuestionId, isCorrect }) {
  const resolved = resolveQuestion(store, { collectionSlug, sourceQuestionId });
  if (resolved.error) {
    return { ok: false, ...resolved.error };
  }

  const { question } = resolved;
  if (!selfJudgeTypes.has(question.type)) {
    return {
      ok: false,
      status: 400,
      message: '只有简答和论述题支持自评。',
    };
  }

  return {
    ok: true,
    gradingMode: 'self_judge',
    isCorrect: Boolean(isCorrect),
    correctDisplay: buildCorrectDisplay(question),
    explanation: question.explanation,
  };
}
