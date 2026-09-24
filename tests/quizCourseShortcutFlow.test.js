import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createQuizInteractionState, handleQuizKey, withQuizResult } from '../src/services/quizInteractionService.js';

const app = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8');

test('botany image reveal has Enter to reveal and Space to advance after reveal', () => {
  const initial = createQuizInteractionState({ questionType: 'image_reveal' });
  assert.equal(handleQuizKey(initial, { key: 'Enter' }).action, 'reveal');
  assert.equal(handleQuizKey(initial, { key: ' ' }).action, 'none');
  const revealed = withQuizResult(initial, { revealedAnswer: { answer: '叶' } });
  assert.equal(handleQuizKey(revealed, { key: 'Enter' }).action, 'none');
  assert.equal(handleQuizKey(revealed, { key: ' ' }).action, 'next');
});

test('answered choice questions ignore new keyboard selections', () => {
  const initial = createQuizInteractionState({ questionType: 'single_choice' });
  const answered = withQuizResult(initial, { isCorrect: true });
  assert.equal(handleQuizKey(answered, { key: 'a' }).action, 'none');
});

test('botany and microbiology practice pages use the shared keyboard handler', () => {
  const handler = app.slice(app.indexOf('function handleGlobalKeydown('), app.indexOf('function activeOptionText('));
  assert.match(handler, /quizView\.value === 'botany' && botanyPage\.value === 'practice'/);
  assert.match(handler, /quizView\.value === 'microbiology' && microbiologyPage\.value === 'practice'/);
  assert.match(handler, /keyResult\.action === 'reveal'[\s\S]*?revealAnswer\(\)/);
  assert.match(handler, /submitUnknownAnswer\(\)/);
});

test('both practice headers explain their supported shortcuts', () => {
  const microbiology = app.slice(app.indexOf('v-else-if="microbiologyPage === \'practice\'"'), app.indexOf('microbiologyPage === \'mistakes\''));
  const botany = app.slice(app.indexOf('v-else-if="botanyPage === \'practice\'"'), app.indexOf('botanyPage === \'gallery\''));
  assert.match(microbiology, /退出练习<\/button>[\s\S]*?practice-shortcuts[\s\S]*?A–D[\s\S]*?Enter[\s\S]*?U 不知道/);
  assert.match(botany, /退出练习<\/button>[\s\S]*?practice-shortcuts[\s\S]*?Enter 揭晓[\s\S]*?空格/);
});
