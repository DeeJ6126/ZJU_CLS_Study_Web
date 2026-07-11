import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const quizCollectionConfigs = [
  {
    courseCode: 'BIO2110F',
    slug: 'microbiology-final-review',
    title: '微生物学章节选择题',
    description: '从旧微生物学刷题项目迁移的章节四选一题库。',
    sourceFile: 'BIO2110F/microbiology-final-review/source/question-bank.json',
    adapter: 'microbiology',
  },
  {
    courseCode: 'BIO2019F',
    slug: 'botany-slice',
    title: '植物学切片识别',
    description: '从旧植物学刷题项目迁移的切片揭晓题库；不包含科属代表植物表格题。',
    sourceFile: 'BIO2019F/botany-slice/source/question-bank.json',
    adapter: 'botany-slice',
  },
  {
    courseCode: 'BIO2023M',
    slug: 'molecular-biology-review',
    title: '分子生物学综合题库',
    description: '从旧分子生物学刷题项目迁移的名词互译、判断、选择、简答和论述题库。',
    sourceFile: 'BIO2023M/molecular-biology-review/source/question-bank.json',
    adapter: 'molecular-biology',
  },
];

const questionTypeMap = {
  translation: 'translation',
  'true-false': 'true_false',
  'multiple-choice': 'multiple_choice',
  'short-answer': 'short_answer',
  essay: 'essay',
};

const microbiologyScopedChapterIds = new Set([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 19, 20,
]);

function readJsonFile(filename) {
  return JSON.parse(readFileSync(filename, 'utf8').replace(/^\uFEFF/, ''));
}

function hashFile(filename) {
  return createHash('sha256').update(readFileSync(filename)).digest('hex');
}

function countBy(items, getKey) {
  const counts = new Map();
  for (const item of items) {
    const key = getKey(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function remapAssetPath(path, fromPrefix, toPrefix) {
  return String(path ?? '').replace(new RegExp(`^${fromPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?`), `${toPrefix}/`);
}

function adaptMicrobiology(config, bank) {
  const scopedQuestions = bank.questions.filter((question) => microbiologyScopedChapterIds.has(Number(question.chapterId)));
  const scopedChapters = bank.chapters.filter((chapter) => microbiologyScopedChapterIds.has(Number(chapter.id)));
  const questionCounts = countBy(scopedQuestions, (question) => String(question.chapterId));
  const categories = scopedChapters.map((chapter, index) => ({
    sourceId: String(chapter.id),
    title: chapter.title,
    parentTitle: '章节练习',
    type: 'chapter',
    sortOrder: index + 1,
    questionCount: questionCounts.get(String(chapter.id)) ?? 0,
  }));

  const questions = scopedQuestions.map((question, index) => ({
    categorySourceId: String(question.chapterId),
    sourceQuestionId: question.id,
    type: 'single_choice',
    prompt: question.prompt,
    body: {
      number: question.number,
      chapterId: question.chapterId,
      chapterTitle: question.chapterTitle,
      options: question.options,
      hasFigure: Boolean(question.hasFigure),
      sourcePage: question.sourcePage ?? null,
      pdfPath: remapAssetPath(question.sourcePdf, 'pdfs', 'assets/pdfs'),
    },
    answer: {
      answerKey: question.answerKey,
    },
    explanation: question.aiExplanation ?? null,
    source: {
      sourceProject: 'E:/Microbiology/ZJU_Microbiology_tests',
      sourceQuestionId: question.id,
      sourcePdf: question.sourcePdf,
      sourcePage: question.sourcePage ?? null,
      generatedAt: bank.generatedAt,
    },
    sortOrder: index + 1,
  }));

  return {
    collection: {
      courseCode: config.courseCode,
      slug: config.slug,
      title: config.title,
      description: config.description,
      sourceVersion: bank.generatedAt,
      isEnabled: true,
    },
    categories,
    questions,
  };
}

function adaptBotanySlice(config, bank) {
  const questionCounts = countBy(bank.questions, (question) => question.categoryId);
  const categories = bank.categories.map((category, index) => ({
    sourceId: category.id,
    title: category.title,
    parentTitle: '切片分类',
    type: 'image-category',
    sortOrder: index + 1,
    questionCount: questionCounts.get(category.id) ?? 0,
  }));

  const questions = bank.questions.map((question, index) => ({
    categorySourceId: question.categoryId,
    sourceQuestionId: question.id,
    type: 'image_reveal',
    prompt: '请识别这张植物切片。',
    body: {
      imagePath: remapAssetPath(question.imagePath, 'data', 'assets/images'),
      categoryId: question.categoryId,
      plantType: question.plantType,
      magnification: question.magnification,
      sourceName: question.sourceName,
    },
    answer: {
      answer: question.answer,
      plantType: question.plantType,
      magnification: question.magnification,
      sourceName: question.sourceName,
    },
    explanation: null,
    source: {
      sourceProject: 'E:/Botany',
      sourceQuestionId: question.id,
      originalImagePath: question.imagePath,
      generatedAt: bank.generatedAt,
    },
    sortOrder: index + 1,
  }));

  return {
    collection: {
      courseCode: config.courseCode,
      slug: config.slug,
      title: config.title,
      description: config.description,
      sourceVersion: bank.generatedAt,
      isEnabled: true,
    },
    categories,
    questions,
  };
}

function adaptMolecularBiology(config, bank) {
  const questionCounts = countBy(bank.questions, (question) => question.categoryId);
  const categories = bank.categories.map((category, index) => ({
    sourceId: category.id,
    title: category.title,
    parentTitle: category.parentTitle ?? '',
    type: questionTypeMap[category.type] ?? category.type,
    sortOrder: index + 1,
    questionCount: questionCounts.get(category.id) ?? 0,
  }));

  const questions = bank.questions.map((question, index) => ({
    categorySourceId: question.categoryId,
    sourceQuestionId: question.id,
    type: questionTypeMap[question.type] ?? question.type,
    prompt: question.prompt,
    body: buildMolecularBody(question),
    answer: buildMolecularAnswer(question),
    explanation: buildMolecularExplanation(question),
    source: {
      sourceProject: 'E:/MolecularBiology/ZJU_Molecularbiology_Tests',
      sourceQuestionId: question.id,
      examSources: question.examSources ?? [],
      generatedAt: bank.generatedAt,
    },
    sortOrder: index + 1,
  }));

  return {
    collection: {
      courseCode: config.courseCode,
      slug: config.slug,
      title: config.title,
      description: config.description,
      sourceVersion: bank.generatedAt,
      isEnabled: true,
    },
    categories,
    questions,
  };
}

function buildMolecularBody(question) {
  const shared = {
    number: question.number,
    categoryId: question.categoryId,
    categoryTitle: question.categoryTitle,
    parentTitle: question.parentTitle ?? '',
    promptCn: question.promptCn ?? null,
    examSources: question.examSources ?? [],
  };

  if (question.type === 'translation') {
    return {
      ...shared,
      direction: question.direction,
      chineseMeaning: question.chineseMeaning ?? null,
    };
  }

  if (question.type === 'true-false') {
    return shared;
  }

  if (question.type === 'multiple-choice') {
    return {
      ...shared,
      options: question.options ?? [],
      distractorsGenerated: Boolean(question.distractorsGenerated),
    };
  }

  if (question.type === 'short-answer' || question.type === 'essay') {
    return shared;
  }

  return shared;
}

function buildMolecularAnswer(question) {
  if (question.type === 'translation') {
    return {
      answerTerm: question.answerTerm,
      answerFullTerm: question.answerFullTerm ?? null,
      acceptableAnswers: question.acceptableAnswers ?? [],
      chineseMeaning: question.chineseMeaning ?? null,
    };
  }

  if (question.type === 'true-false') {
    return {
      answerIsTrue: Boolean(question.answerIsTrue),
    };
  }

  if (question.type === 'multiple-choice') {
    return {
      answerKey: question.answerKey,
      answerText: question.answerText ?? null,
    };
  }

  if (question.type === 'short-answer' || question.type === 'essay') {
    return {
      referenceAnswer: remapMolecularAnswerAssets(question.referenceAnswer ?? ''),
    };
  }

  return {};
}

function buildMolecularExplanation(question) {
  if (question.aiExplanation) {
    return question.aiExplanation;
  }

  if (question.explanation || question.explanationCn) {
    return {
      explanation: question.explanation ?? '',
      explanationCn: question.explanationCn ?? null,
    };
  }

  return null;
}

function remapMolecularAnswerAssets(markdown) {
  return markdown.replace(/(["(])images\//g, '$1assets/images/');
}

function adaptCollection(config, bank) {
  if (config.adapter === 'microbiology') {
    return adaptMicrobiology(config, bank);
  }

  if (config.adapter === 'botany-slice') {
    return adaptBotanySlice(config, bank);
  }

  if (config.adapter === 'molecular-biology') {
    return adaptMolecularBiology(config, bank);
  }

  throw new Error(`Unknown quiz adapter: ${config.adapter}`);
}

export function importConfiguredQuizCollections(
  store,
  { contentRoot = resolve('public/resource/quiz'), configs = quizCollectionConfigs } = {},
) {
  const collections = [];
  let totalCategories = 0;
  let totalQuestions = 0;

  for (const config of configs) {
    const sourcePath = resolve(contentRoot, config.sourceFile);
    const bank = readJsonFile(sourcePath);
    const adapted = adaptCollection(config, bank);
    const sourceHash = hashFile(sourcePath);

    const collection = store.replaceCollection(
      adapted.collection,
      adapted.categories,
      adapted.questions,
      {
        collectionSlug: config.slug,
        sourcePath,
        sourceHash,
        status: 'success',
        importedCounts: {
          categories: adapted.categories.length,
          questions: adapted.questions.length,
        },
      },
    );

    collections.push(collection);
    totalCategories += adapted.categories.length;
    totalQuestions += adapted.questions.length;
  }

  return {
    collections,
    totals: {
      categories: totalCategories,
      questions: totalQuestions,
    },
  };
}
