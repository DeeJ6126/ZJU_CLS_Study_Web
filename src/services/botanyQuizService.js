const selectionKey = 'botany-slice-selection';
const mistakesKey = 'botany-slice-mistakes';
const organOrder = ['叶', '根', '茎', '花', '植物组织'];

function nonEmpty(value) {
  return String(value ?? '').trim();
}

function nowIso() {
  return new Date().toISOString();
}

export function normalizeBotanyCategorySelection(categorySourceIds = [], categories = []) {
  const allowed = new Set(categories.map((category) => category.sourceId));
  return Array.from(new Set(categorySourceIds.map(nonEmpty))).filter((sourceId) => allowed.has(sourceId));
}

export function selectedBotanyImageCount(categorySourceIds = [], categories = []) {
  const selected = new Set(categorySourceIds);
  return categories
    .filter((category) => selected.has(category.sourceId))
    .reduce((sum, category) => sum + Number(category.questionCount ?? 0), 0);
}

export function readBotanySelection(storage = globalThis.localStorage) {
  try {
    return JSON.parse(storage?.getItem(selectionKey) ?? '[]').map(nonEmpty).filter(Boolean);
  } catch {
    return [];
  }
}

export function writeBotanySelection(categorySourceIds = [], storage = globalThis.localStorage) {
  const normalized = Array.from(new Set(categorySourceIds.map(nonEmpty))).filter(Boolean);
  try {
    storage?.setItem(selectionKey, JSON.stringify(normalized));
  } catch {
    // localStorage can be unavailable in tests or privacy modes.
  }
  return normalized;
}

export function upsertBotanyMistake(records = [], { question, revealedAnswer = {} } = {}) {
  const sourceQuestionId = nonEmpty(question?.sourceQuestionId ?? question?.id);
  if (!sourceQuestionId) {
    return records;
  }

  const existing = records.find((record) => record.sourceQuestionId === sourceQuestionId);
  const nextRecord = {
    sourceQuestionId,
    categorySourceId: nonEmpty(question?.body?.categoryId ?? question?.categorySourceId),
    imagePath: nonEmpty(question?.body?.imagePath ?? question?.imagePath),
    answer: nonEmpty(revealedAnswer.answer ?? question?.answer),
    sourceName: nonEmpty(revealedAnswer.sourceName ?? question?.sourceName),
    plantType: nonEmpty(revealedAnswer.plantType ?? question?.plantType),
    magnification: nonEmpty(revealedAnswer.magnification ?? question?.magnification),
    addedCount: existing ? existing.addedCount + 1 : 1,
    lastAddedAt: nowIso(),
  };

  return [
    nextRecord,
    ...records.filter((record) => record.sourceQuestionId !== sourceQuestionId),
  ];
}

export function removeBotanyMistake(records = [], sourceQuestionId) {
  return records.filter((record) => record.sourceQuestionId !== sourceQuestionId);
}

export function clearBotanyMistakes() {
  return [];
}

export function normalizeBotanyMistakes(records = []) {
  const byQuestion = new Map();
  for (const record of records) {
    const sourceQuestionId = nonEmpty(record?.sourceQuestionId ?? record?.questionId);
    if (!sourceQuestionId || byQuestion.has(sourceQuestionId)) {
      continue;
    }

    byQuestion.set(sourceQuestionId, {
      sourceQuestionId,
      categorySourceId: nonEmpty(record.categorySourceId ?? record.categoryId),
      imagePath: nonEmpty(record.imagePath),
      answer: nonEmpty(record.answer),
      sourceName: nonEmpty(record.sourceName),
      plantType: nonEmpty(record.plantType),
      magnification: nonEmpty(record.magnification),
      addedCount: Math.max(Number(record.addedCount ?? 1), 1),
      lastAddedAt: record.lastAddedAt ?? nowIso(),
    });
  }
  return Array.from(byQuestion.values()).sort((left, right) => right.lastAddedAt.localeCompare(left.lastAddedAt));
}

export function readBotanyMistakes(storage = globalThis.localStorage) {
  try {
    return normalizeBotanyMistakes(JSON.parse(storage?.getItem(mistakesKey) ?? '[]'));
  } catch {
    return [];
  }
}

export function writeBotanyMistakes(records = [], storage = globalThis.localStorage) {
  const normalized = normalizeBotanyMistakes(records);
  try {
    storage?.setItem(mistakesKey, JSON.stringify(normalized));
  } catch {
    // localStorage can be unavailable in tests or privacy modes.
  }
  return normalized;
}

export function buildBotanyGalleryGroups(items = []) {
  const byCategory = new Map();
  for (const item of items) {
    const categorySourceId = nonEmpty(item.categorySourceId ?? item.categoryId);
    if (!categorySourceId) {
      continue;
    }
    if (!byCategory.has(categorySourceId)) {
      byCategory.set(categorySourceId, []);
    }
    byCategory.get(categorySourceId).push({ ...item, categorySourceId });
  }

  return organOrder
    .filter((categorySourceId) => byCategory.has(categorySourceId))
    .map((categorySourceId) => ({
      id: categorySourceId,
      title: categorySourceId,
      items: byCategory.get(categorySourceId),
    }));
}

export function buildBotanyResultSummary({
  questionOrder = [],
  answerStatusBySourceQuestionId = {},
  mistakeRecords = [],
} = {}) {
  const revealed = questionOrder.filter((sourceQuestionId) => {
    const status = answerStatusBySourceQuestionId[sourceQuestionId];
    return Boolean(status?.revealed || status?.revealedAnswer);
  }).length;

  return {
    total: questionOrder.length,
    revealed,
    remaining: Math.max(questionOrder.length - revealed, 0),
    mistakes: mistakeRecords.length,
  };
}
