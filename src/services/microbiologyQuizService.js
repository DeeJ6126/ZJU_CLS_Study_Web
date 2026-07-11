const selectionKey = 'microbiology-selection';
const mistakesKey = 'microbiology-mistakes';
const vocabularyKey = 'microbiology-vocabulary';
const validStatuses = new Set(['new', 'learning', 'mastered']);
const vocabularyPattern = /[A-Za-z0-9][A-Za-z0-9+/]*(?:[-'][A-Za-z0-9+/]+)*/g;

function nonEmpty(value) {
  return String(value ?? '').trim();
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeTerm(term) {
  return nonEmpty(term).toLowerCase();
}

function normalizeContext(contextText) {
  return nonEmpty(contextText).toLowerCase().replace(/\s+/g, ' ').slice(0, 120);
}

function isVocabularyTerm(value) {
  return value.length > 1 && /[A-Za-z]/.test(value);
}

function vocabularyDedupeKey(record) {
  const sourceId = record.sourceType === 'past-exam'
    ? record.examId || 'past-exam'
    : record.questionId || 'practice';
  return [
    record.normalizedTerm,
    record.sourceType,
    sourceId,
    record.questionNumber ?? '',
    normalizeContext(record.contextText),
  ].join('|');
}

export function normalizeMicrobiologyCategorySelection(categorySourceIds = [], categories = []) {
  const allowed = new Set(categories.map((category) => category.sourceId));
  return Array.from(new Set(categorySourceIds.map(nonEmpty))).filter((sourceId) => allowed.has(sourceId));
}

export function selectedMicrobiologyQuestionCount(categorySourceIds = [], categories = []) {
  const selected = new Set(categorySourceIds.map(nonEmpty));
  return categories
    .filter((category) => selected.has(category.sourceId))
    .reduce((sum, category) => sum + Number(category.questionCount ?? 0), 0);
}

export function readMicrobiologySelection(storage = globalThis.localStorage) {
  try {
    return JSON.parse(storage?.getItem(selectionKey) ?? '[]').map(nonEmpty).filter(Boolean);
  } catch {
    return [];
  }
}

export function writeMicrobiologySelection(categorySourceIds = [], storage = globalThis.localStorage) {
  const normalized = Array.from(new Set(categorySourceIds.map(nonEmpty))).filter(Boolean);
  try {
    storage?.setItem(selectionKey, JSON.stringify(normalized));
  } catch {
    // localStorage can be unavailable in tests or privacy modes.
  }
  return normalized;
}

export function upsertMicrobiologyMistake(records = [], { question, answer = {}, correctDisplay = '' } = {}) {
  const sourceQuestionId = nonEmpty(question?.sourceQuestionId ?? question?.id);
  if (!sourceQuestionId) {
    return records;
  }

  const existing = records.find((record) => record.sourceQuestionId === sourceQuestionId);
  const nextRecord = {
    sourceQuestionId,
    categorySourceId: nonEmpty(question?.body?.chapterId ?? question?.categorySourceId),
    categoryTitle: nonEmpty(question?.body?.chapterTitle ?? question?.categoryTitle),
    prompt: nonEmpty(question?.prompt),
    questionNumber: Number(question?.body?.number ?? question?.questionNumber ?? 0),
    lastAnswer: answer,
    correctDisplay: nonEmpty(correctDisplay),
    wrongCount: existing ? existing.wrongCount + 1 : 1,
    lastAnsweredAt: nowIso(),
  };

  return [
    nextRecord,
    ...records.filter((record) => record.sourceQuestionId !== sourceQuestionId),
  ];
}

export function removeMicrobiologyMistake(records = [], sourceQuestionId) {
  return records.filter((record) => record.sourceQuestionId !== sourceQuestionId);
}

export function clearMicrobiologyMistakes() {
  return [];
}

export function normalizeMicrobiologyMistakes(records = []) {
  const byQuestion = new Map();
  for (const record of records) {
    const sourceQuestionId = nonEmpty(record?.sourceQuestionId);
    if (!sourceQuestionId || byQuestion.has(sourceQuestionId)) {
      continue;
    }

    byQuestion.set(sourceQuestionId, {
      sourceQuestionId,
      categorySourceId: nonEmpty(record.categorySourceId),
      categoryTitle: nonEmpty(record.categoryTitle),
      prompt: nonEmpty(record.prompt),
      questionNumber: Number(record.questionNumber ?? 0),
      lastAnswer: record.lastAnswer ?? {},
      correctDisplay: nonEmpty(record.correctDisplay),
      wrongCount: Math.max(Number(record.wrongCount ?? 1), 1),
      lastAnsweredAt: record.lastAnsweredAt ?? nowIso(),
    });
  }
  return Array.from(byQuestion.values()).sort((left, right) => right.lastAnsweredAt.localeCompare(left.lastAnsweredAt));
}

export function readMicrobiologyMistakes(storage = globalThis.localStorage) {
  try {
    return normalizeMicrobiologyMistakes(JSON.parse(storage?.getItem(mistakesKey) ?? '[]'));
  } catch {
    return [];
  }
}

export function writeMicrobiologyMistakes(records = [], storage = globalThis.localStorage) {
  const normalized = normalizeMicrobiologyMistakes(records);
  try {
    storage?.setItem(mistakesKey, JSON.stringify(normalized));
  } catch {
    // localStorage can be unavailable in tests or privacy modes.
  }
  return normalized;
}

export function tokenizeMicrobiologyVocabularyText(text) {
  return Array.from(String(text ?? '').matchAll(vocabularyPattern))
    .map((match) => match[0])
    .filter(isVocabularyTerm);
}

export function createMicrobiologyVocabularyRecord(term, context = {}) {
  const cleanTerm = nonEmpty(term);
  const now = nowIso();
  return {
    id: `${normalizeTerm(cleanTerm)}:${context.sourceType ?? 'practice'}:${context.questionId ?? context.examId ?? ''}:${context.questionNumber ?? ''}`,
    term: cleanTerm,
    normalizedTerm: normalizeTerm(cleanTerm),
    contextText: nonEmpty(context.contextText),
    sourceType: context.sourceType === 'past-exam' ? 'past-exam' : 'practice',
    questionId: nonEmpty(context.questionId),
    examId: nonEmpty(context.examId),
    questionNumber: Number(context.questionNumber ?? 0),
    chapterId: Number(context.chapterId ?? 0),
    chapterTitle: nonEmpty(context.chapterTitle),
    status: validStatuses.has(context.status) ? context.status : 'new',
    addedAt: context.addedAt ?? now,
    updatedAt: context.updatedAt ?? now,
  };
}

export function normalizeMicrobiologyVocabularyRecords(records = []) {
  const byKey = new Map();
  for (const record of records) {
    const term = nonEmpty(record?.term);
    const contextText = nonEmpty(record?.contextText);
    const questionNumber = Number(record?.questionNumber ?? 0);
    if (!term || !contextText || !Number.isFinite(questionNumber)) {
      continue;
    }

    const normalized = createMicrobiologyVocabularyRecord(term, {
      ...record,
      normalizedTerm: normalizeTerm(record.normalizedTerm ?? term),
      status: validStatuses.has(record.status) ? record.status : 'new',
    });
    const key = vocabularyDedupeKey(normalized);
    if (!byKey.has(key) || normalized.updatedAt.localeCompare(byKey.get(key).updatedAt) > 0) {
      byKey.set(key, normalized);
    }
  }
  return Array.from(byKey.values()).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function readMicrobiologyVocabularyRecords(storage = globalThis.localStorage) {
  try {
    return normalizeMicrobiologyVocabularyRecords(JSON.parse(storage?.getItem(vocabularyKey) ?? '[]'));
  } catch {
    return [];
  }
}

export function writeMicrobiologyVocabularyRecords(records = [], storage = globalThis.localStorage) {
  const normalized = normalizeMicrobiologyVocabularyRecords(records);
  try {
    storage?.setItem(vocabularyKey, JSON.stringify(normalized));
  } catch {
    // localStorage can be unavailable in tests or privacy modes.
  }
  return normalized;
}

export function cycleMicrobiologyVocabularyStatus(status) {
  if (status === 'new') {
    return 'learning';
  }
  if (status === 'learning') {
    return 'mastered';
  }
  return 'new';
}

export function buildMicrobiologyResultSummary({
  questionOrder = [],
  answerStatusBySourceQuestionId = {},
  mistakeRecords = [],
  selectedCategorySourceIds = [],
} = {}) {
  const summary = {
    total: questionOrder.length,
    answered: 0,
    correct: 0,
    incorrect: 0,
    unknown: 0,
    unanswered: 0,
    mistakes: mistakeRecords.length,
    selectedChapters: selectedCategorySourceIds.length,
  };

  for (const sourceQuestionId of questionOrder) {
    const status = answerStatusBySourceQuestionId[sourceQuestionId];
    if (!status || typeof status.isCorrect !== 'boolean') {
      summary.unanswered += 1;
      continue;
    }

    summary.answered += 1;
    if (status.answer?.selectedKey === 'UNKNOWN') {
      summary.unknown += 1;
    }
    if (status.isCorrect) {
      summary.correct += 1;
    } else {
      summary.incorrect += 1;
    }
  }

  summary.accuracy = summary.answered ? Math.round((summary.correct / summary.answered) * 100) : 0;
  return summary;
}
