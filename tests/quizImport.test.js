import test from 'node:test';
import assert from 'node:assert/strict';

import { createQuizStore } from '../server/quiz/quizStore.js';
import { importConfiguredQuizCollections } from '../server/quiz/quizImportService.js';

test('phase one quiz import loads the three course collections without botany family questions', () => {
  const store = createQuizStore({ filename: ':memory:' });
  store.initialize();

  const result = importConfiguredQuizCollections(store);
  const collections = store.listCollections();

  assert.deepEqual(
    collections.map((collection) => collection.slug),
    [
      'microbiology-final-review',
      'botany-slice',
      'molecular-biology-review',
    ],
  );
  assert.equal(result.collections.length, 3);
  assert.equal(result.totals.questions, 1049);
  assert.equal(
    collections.some((collection) => collection.slug === 'botany-family'),
    false,
  );

  const microbiology = store.findCollectionBySlug('microbiology-final-review');
  const botany = store.findCollectionBySlug('botany-slice');
  const molecular = store.findCollectionBySlug('molecular-biology-review');

  assert.equal(microbiology.courseCode, 'BIO2110F');
  assert.equal(microbiology.questionCount, 667);
  assert.equal(botany.courseCode, 'BIO2019F');
  assert.equal(botany.questionCount, 192);
  assert.equal(molecular.courseCode, 'BIO2023M');
  assert.equal(molecular.questionCount, 190);

  assert.deepEqual(
    store.listCategories(microbiology.id).map((category) => category.sourceId),
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '11', '12', '13', '19', '20'],
  );
  assert.equal(store.listCategories(botany.id).length, 5);
  assert.equal(store.listCategories(molecular.id).length, 20);
});

test('quiz import is idempotent and records import runs', () => {
  const store = createQuizStore({ filename: ':memory:' });
  store.initialize();

  importConfiguredQuizCollections(store);
  importConfiguredQuizCollections(store);

  assert.equal(store.listCollections().length, 3);
  assert.equal(store.countQuestions(), 1049);
  assert.equal(store.listImportRuns().length, 6);
});

test('safe question views omit answers while preserving display data and source metadata', () => {
  const store = createQuizStore({ filename: ':memory:' });
  store.initialize();
  importConfiguredQuizCollections(store);

  const microbiology = store.findCollectionBySlug('microbiology-final-review');
  const microQuestion = store.getSafeQuestionBySourceId(
    microbiology.id,
    'chapter-01-q-001',
  );
  assert.equal(microQuestion.type, 'single_choice');
  assert.equal(microQuestion.prompt, 'Which of the following statements is FALSE?');
  assert.equal(microQuestion.body.options.length, 4);
  assert.equal(microQuestion.body.answerKey, undefined);
  assert.equal(microQuestion.answer, undefined);
  assert.equal(microQuestion.source.sourcePdf, 'pdfs/chapter-01.pdf');

  const molecular = store.findCollectionBySlug('molecular-biology-review');
  const translationQuestion = store.getSafeQuestionBySourceId(
    molecular.id,
    'translation-1-q-001',
  );
  assert.equal(translationQuestion.type, 'translation');
  assert.equal(translationQuestion.body.acceptableAnswers, undefined);
  assert.equal(translationQuestion.body.answerTerm, undefined);
  assert.equal(translationQuestion.body.direction, 'zh-to-en');

  const botany = store.findCollectionBySlug('botany-slice');
  const imageQuestion = store.getSafeQuestions(botany.id, { limit: 1 })[0];
  assert.equal(imageQuestion.type, 'image_reveal');
  assert.match(imageQuestion.body.imagePath, /^assets\/images\//);
  assert.equal(imageQuestion.answer, undefined);
});
