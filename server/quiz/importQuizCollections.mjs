import { createQuizStore } from './quizStore.js';
import { importConfiguredQuizCollections } from './quizImportService.js';

const store = createQuizStore({
  filename: process.env.QUIZ_DB_FILE || 'server/data/auth.sqlite',
});

store.initialize();
const result = importConfiguredQuizCollections(store);

console.log(JSON.stringify({
  importedCollections: result.collections.map((collection) => collection.slug),
  totals: result.totals,
}, null, 2));
