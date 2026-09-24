import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8');

function functionBody(name, nextName) {
  const start = app.indexOf(`function ${name}(`);
  const end = app.indexOf(`function ${nextName}(`, start + 1);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return app.slice(start, end);
}

test('microbiology starts each course entry with no chapter preselected', () => {
  const selectCourse = functionBody('selectCourse', 'resumeSyncedPractice');
  const loadCategories = functionBody('loadCategories', 'isRangeSelected');

  assert.match(selectCourse, /selectedCategorySourceIds\.value = \[\]/);
  assert.doesNotMatch(loadCategories, /readMicrobiologySelection/);
});

test('botany and microbiology start practice with scoped selected categories', () => {
  const botany = functionBody('beginBotanyPractice', 'beginMicrobiologyPractice');
  const microbiology = functionBody('beginMicrobiologyPractice', 'beginMistakePractice');

  assert.match(botany, /writeBotanySelection\(\s*quizScope\.value,\s*normalizeBotanyCategorySelection/);
  assert.match(microbiology, /writeMicrobiologySelection\(\s*quizScope\.value,\s*normalizeMicrobiologyCategorySelection/);
  assert.match(botany, /selectedCategorySourceIds\.value\.length/);
  assert.match(microbiology, /selectedCategorySourceIds\.value\.length/);
});
