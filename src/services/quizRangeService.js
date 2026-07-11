const molecularTitleByType = {
  translation: '中英互译',
  true_false: '判断题',
  multiple_choice: '选择题',
  short_answer: '简答题',
  essay: '论述题',
};

function baseOption(category, overrides = {}) {
  return {
    id: String(category.sourceId),
    title: category.title,
    subtitle: category.parentTitle || '',
    sourceIds: [category.sourceId],
    questionCount: category.questionCount,
    countLabel: `${category.questionCount} 题`,
    detailTitles: [category.title],
    ...overrides,
  };
}

function buildMicrobiologyOptions(categories) {
  return categories.map((category) => baseOption(category, {
    title: `Chapter ${category.sourceId}`,
    subtitle: category.title,
  }));
}

function buildBotanyOptions(categories) {
  return categories.map((category) => baseOption(category, {
    title: category.title || category.sourceId,
    subtitle: '切片识别',
    countLabel: `${category.questionCount} 张`,
  }));
}

function molecularRangeTitle(category) {
  if (category.parentTitle === '中英名词互译' || category.type === 'translation') {
    return '中英互译';
  }
  return molecularTitleByType[category.type] || category.parentTitle || category.title;
}

function buildMolecularOptions(categories) {
  const groups = new Map();

  for (const category of categories) {
    const title = molecularRangeTitle(category);
    const existing = groups.get(title);
    if (existing) {
      existing.sourceIds.push(category.sourceId);
      existing.questionCount += category.questionCount;
      existing.countLabel = `${existing.questionCount} 题`;
      existing.detailTitles.push(category.title);
      existing.subtitle = `${existing.detailTitles.length} 个小类`;
      continue;
    }

    groups.set(title, {
      id: title,
      title,
      subtitle: category.title,
      sourceIds: [category.sourceId],
      questionCount: category.questionCount,
      countLabel: `${category.questionCount} 题`,
      detailTitles: [category.title],
    });
  }

  return [...groups.values()];
}

export function buildQuizRangeOptions(courseCode, categories) {
  if (courseCode === 'BIO2110F') {
    return buildMicrobiologyOptions(categories);
  }

  if (courseCode === 'BIO2019F') {
    return buildBotanyOptions(categories);
  }

  return buildMolecularOptions(categories);
}

export function buildPracticeQuestionTiles({ questionOrder = [], questionIndex = [], sourceIds = [] } = {}) {
  const allowedSourceIds = new Set(sourceIds);
  const indexBySourceId = new Map(questionIndex.map((item) => [item.sourceQuestionId, item]));
  let localNumber = 0;

  return questionOrder
    .map((sourceQuestionId, index) => ({
      sourceQuestionId,
      index,
      categorySourceId: indexBySourceId.get(sourceQuestionId)?.categorySourceId ?? '',
    }))
    .filter((item) => allowedSourceIds.has(item.categorySourceId))
    .map((item) => ({
      ...item,
      localNumber: ++localNumber,
    }));
}
