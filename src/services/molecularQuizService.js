const molecularLanguageKey = 'molecular-biology-language';
const vocabularyKey = 'molecular-biology-vocabulary';
const mistakesKey = 'molecular-biology-mistakes';
const validStatuses = new Set(['new', 'learning', 'mastered']);
const pronounceableAcronyms = new Set(['DNA', 'RNA']);

function normalizeLanguage(language) {
  return language === 'en' ? 'en' : 'zh';
}

function nonEmpty(value) {
  return String(value ?? '').trim();
}

function normalizedTerm(term) {
  return nonEmpty(term).toLowerCase();
}

export function readMolecularLanguage(storage = globalThis.localStorage) {
  try {
    return normalizeLanguage(storage?.getItem(molecularLanguageKey));
  } catch {
    return 'zh';
  }
}

export function writeMolecularLanguage(language, storage = globalThis.localStorage) {
  const normalized = normalizeLanguage(language);
  try {
    storage?.setItem(molecularLanguageKey, normalized);
  } catch {
    // localStorage can be unavailable in tests or privacy modes.
  }
  return normalized;
}

export function getMolecularDisplayText(question, language, field = 'prompt') {
  const normalized = normalizeLanguage(language);

  if (field === 'explanation') {
    if (typeof question?.explanation === 'string') {
      return question.explanation;
    }
    const english = question?.explanation?.explanation;
    const chinese = question?.explanation?.explanationCn;
    return normalized === 'en' ? nonEmpty(english) || nonEmpty(chinese) : nonEmpty(chinese) || nonEmpty(english);
  }

  const english = question?.prompt;
  const chinese = question?.body?.promptCn;
  return normalized === 'en' ? nonEmpty(english) || nonEmpty(chinese) : nonEmpty(chinese) || nonEmpty(english);
}

export function getMolecularOptionText(option, language) {
  const normalized = normalizeLanguage(language);
  return normalized === 'en'
    ? nonEmpty(option?.text) || nonEmpty(option?.textCn)
    : nonEmpty(option?.textCn) || nonEmpty(option?.text);
}

export function getMolecularCorrectDisplay(status, language) {
  if (!status) {
    return '';
  }

  if (typeof status.correctDisplay !== 'string') {
    return status.correctDisplay ?? '';
  }

  if (language === 'en') {
    return status.correctDisplay;
  }

  return status.correctDisplay;
}

export function getMolecularSpeakText(termOrQuestion = {}) {
  const answerFullTerm = nonEmpty(termOrQuestion.answerFullTerm);
  const answerTerm = nonEmpty(termOrQuestion.answerTerm);
  const prompt = nonEmpty(termOrQuestion.prompt);

  if (answerFullTerm && pronounceableAcronyms.has(answerFullTerm.toUpperCase())) {
    return answerFullTerm;
  }

  return answerTerm || answerFullTerm || prompt;
}

export function speakMolecularText(text, speech = globalThis.speechSynthesis) {
  const spokenText = nonEmpty(text);
  if (!spokenText || !speech || typeof SpeechSynthesisUtterance === 'undefined') {
    return false;
  }

  speech.cancel();
  const utterance = new SpeechSynthesisUtterance(spokenText);
  utterance.lang = 'en-US';
  utterance.rate = 0.85;
  speech.speak(utterance);
  return true;
}

export function tokenizeVocabularyText(text) {
  return Array.from(String(text ?? '').matchAll(/[A-Za-z0-9][A-Za-z0-9+/]*(?:[-'][A-Za-z0-9+/]+)*/g))
    .map((match) => match[0]);
}

export function createVocabularyRecord(term, context = {}) {
  const cleanTerm = nonEmpty(term);
  const now = new Date().toISOString();
  return {
    id: `${normalizedTerm(cleanTerm)}:${context.questionId ?? ''}`,
    term: cleanTerm,
    normalizedTerm: normalizedTerm(cleanTerm),
    contextText: context.contextText ?? '',
    sourceType: context.sourceType ?? 'question',
    questionId: context.questionId ?? '',
    questionNumber: context.questionNumber ?? null,
    chapterTitle: context.chapterTitle ?? '',
    status: validStatuses.has(context.status) ? context.status : 'new',
    createdAt: context.createdAt ?? now,
    updatedAt: context.updatedAt ?? now,
  };
}

export function normalizeVocabularyRecords(records = []) {
  const byTerm = new Map();
  for (const record of records) {
    const term = nonEmpty(record?.term);
    const key = normalizedTerm(record?.normalizedTerm ?? term);
    if (!term || !key || byTerm.has(key)) {
      continue;
    }

    byTerm.set(key, createVocabularyRecord(term, {
      ...record,
      status: validStatuses.has(record.status) ? record.status : 'new',
    }));
  }
  return Array.from(byTerm.values());
}

export function readVocabularyRecords(storage = globalThis.localStorage) {
  try {
    return normalizeVocabularyRecords(JSON.parse(storage?.getItem(vocabularyKey) ?? '[]'));
  } catch {
    return [];
  }
}

export function writeVocabularyRecords(records, storage = globalThis.localStorage) {
  const normalized = normalizeVocabularyRecords(records);
  try {
    storage?.setItem(vocabularyKey, JSON.stringify(normalized));
  } catch {
    // localStorage can be unavailable in tests or privacy modes.
  }
  return normalized;
}

export function cycleVocabularyStatus(status) {
  if (status === 'new') {
    return 'learning';
  }
  if (status === 'learning') {
    return 'mastered';
  }
  return 'new';
}

export function upsertMolecularMistake(records = [], { question, answer = {}, correctDisplay = '' } = {}) {
  if (!question?.sourceQuestionId) {
    return records;
  }

  const now = new Date().toISOString();
  const existing = records.find((record) => record.sourceQuestionId === question.sourceQuestionId);
  const nextRecord = {
    sourceQuestionId: question.sourceQuestionId,
    questionType: question.type,
    categorySourceId: question.body?.categoryId ?? '',
    categoryTitle: question.body?.categoryTitle ?? question.body?.parentTitle ?? '',
    prompt: question.prompt,
    lastAnswer: answer,
    correctDisplay,
    wrongCount: existing ? existing.wrongCount + 1 : 1,
    lastAnsweredAt: now,
  };

  return [
    nextRecord,
    ...records.filter((record) => record.sourceQuestionId !== question.sourceQuestionId),
  ];
}

export function removeMolecularMistake(records = [], sourceQuestionId) {
  return records.filter((record) => record.sourceQuestionId !== sourceQuestionId);
}

export function clearMolecularMistakes() {
  return [];
}

export function normalizeMolecularMistakes(records = []) {
  const byQuestion = new Map();
  for (const record of records) {
    const sourceQuestionId = nonEmpty(record?.sourceQuestionId);
    if (!sourceQuestionId || byQuestion.has(sourceQuestionId)) {
      continue;
    }

    byQuestion.set(sourceQuestionId, {
      sourceQuestionId,
      questionType: record.questionType ?? '',
      categorySourceId: record.categorySourceId ?? '',
      categoryTitle: record.categoryTitle ?? '',
      prompt: record.prompt ?? '',
      lastAnswer: record.lastAnswer ?? {},
      correctDisplay: record.correctDisplay ?? '',
      wrongCount: Math.max(Number(record.wrongCount ?? 1), 1),
      lastAnsweredAt: record.lastAnsweredAt ?? new Date().toISOString(),
    });
  }
  return Array.from(byQuestion.values()).sort((left, right) => right.lastAnsweredAt.localeCompare(left.lastAnsweredAt));
}

export function readMolecularMistakes(storage = globalThis.localStorage) {
  try {
    return normalizeMolecularMistakes(JSON.parse(storage?.getItem(mistakesKey) ?? '[]'));
  } catch {
    return [];
  }
}

export function writeMolecularMistakes(records, storage = globalThis.localStorage) {
  const normalized = normalizeMolecularMistakes(records);
  try {
    storage?.setItem(mistakesKey, JSON.stringify(normalized));
  } catch {
    // localStorage can be unavailable in tests or privacy modes.
  }
  return normalized;
}

export function buildQuizResultSummary({ questionIndex = [], categories = [], answerStatusBySourceQuestionId = {} } = {}) {
  const categoriesBySourceId = new Map(categories.map((category) => [category.sourceId, category]));
  const summary = {
    total: questionIndex.length,
    answered: 0,
    correct: 0,
    incorrect: 0,
    unanswered: 0,
    selfJudgedCorrect: 0,
    selfJudgedIncorrect: 0,
    byType: {},
  };

  for (const item of questionIndex) {
    const category = categoriesBySourceId.get(item.categorySourceId);
    const typeLabel = category?.parentTitle || category?.title || category?.type || '未分类';
    summary.byType[typeLabel] ??= {
      total: 0,
      answered: 0,
      correct: 0,
      incorrect: 0,
      unanswered: 0,
    };

    const bucket = summary.byType[typeLabel];
    const status = answerStatusBySourceQuestionId[item.sourceQuestionId];
    bucket.total += 1;

    if (!status || typeof status.isCorrect !== 'boolean') {
      summary.unanswered += 1;
      bucket.unanswered += 1;
      continue;
    }

    summary.answered += 1;
    bucket.answered += 1;
    if (status.isCorrect) {
      summary.correct += 1;
      bucket.correct += 1;
      if (status.gradingMode === 'self_judge') {
        summary.selfJudgedCorrect += 1;
      }
    } else {
      summary.incorrect += 1;
      bucket.incorrect += 1;
      if (status.gradingMode === 'self_judge') {
        summary.selfJudgedIncorrect += 1;
      }
    }
  }

  return summary;
}
