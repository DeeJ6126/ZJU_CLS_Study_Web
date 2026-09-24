import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('molecular practice and review show their active keyboard shortcuts', async () => {
  const app = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8');
  const practice = app.slice(app.indexOf("molecularPage === 'practice'"), app.indexOf("molecularPage === 'mistakes'"));
  const review = app.slice(app.indexOf("molecularPage === 'review'"), app.indexOf("molecularPage === 'vocabulary'"));

  assert.match(practice, /退出练习<\/button>[\s\S]*?practice-shortcuts/);
  for (const key of ['A–D', 'T/F', 'Enter', '←/→', '空格', 'Tab']) {
    assert.ok(practice.includes(key), `missing practice shortcut: ${key}`);
  }
  for (const key of ['Enter', '空格', '←/→']) {
    assert.ok(review.includes(key), `missing review shortcut: ${key}`);
  }
});
