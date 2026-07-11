import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildNextQuestionTarget,
  createQuizInteractionState,
  handleQuizKey,
  selectPendingAnswer,
} from '../src/services/quizInteractionService.js';

test('choice option click selects a pending answer without submitting', () => {
  const state = createQuizInteractionState({ questionType: 'single_choice' });
  const next = selectPendingAnswer(state, 'B');

  assert.equal(next.pendingAnswer.selectedKey, 'B');
  assert.equal(next.hasStartedAnswer, true);
  assert.equal(next.result, null);
});

test('choice keyboard selects pending answer, enter submits, and space advances after judgement', () => {
  let state = createQuizInteractionState({ questionType: 'multiple_choice' });

  let event = handleQuizKey(state, { key: 'c' });
  assert.equal(event.action, 'select');
  state = event.state;
  assert.equal(state.pendingAnswer.selectedKey, 'C');

  event = handleQuizKey(state, { key: 'Enter' });
  assert.equal(event.action, 'submit');
  assert.deepEqual(event.answer, { selectedKey: 'C' });

  state = {
    ...state,
    result: { isCorrect: true },
  };
  event = handleQuizKey(state, { key: ' ' });
  assert.equal(event.action, 'next');
});

test('true false keyboard uses T and F as pending answers before enter submits', () => {
  let state = createQuizInteractionState({ questionType: 'true_false' });

  let event = handleQuizKey(state, { key: 't' });
  assert.equal(event.action, 'select');
  state = event.state;
  assert.deepEqual(state.pendingAnswer, { value: true });

  event = handleQuizKey(state, { key: 'Enter' });
  assert.equal(event.action, 'submit');
  assert.deepEqual(event.answer, { value: true });

  state = handleQuizKey(state, { key: 'f' }).state;
  assert.deepEqual(state.pendingAnswer, { value: false });
});

test('translation enter submits text and space advances only after result exists', () => {
  let state = createQuizInteractionState({
    questionType: 'translation',
    textAnswer: 'Eukaryote',
  });

  let event = handleQuizKey(state, { key: 'Enter' });
  assert.equal(event.action, 'submit');
  assert.deepEqual(event.answer, { text: 'Eukaryote' });

  event = handleQuizKey(state, { key: ' ' });
  assert.equal(event.action, 'none');

  state = {
    ...state,
    result: { isCorrect: true },
  };
  event = handleQuizKey(state, { key: ' ' });
  assert.equal(event.action, 'next');
});

test('translation tab requests pronunciation without submitting', () => {
  const state = createQuizInteractionState({
    questionType: 'translation',
    textAnswer: 'DNA',
  });

  const event = handleQuizKey(state, { key: 'Tab' });
  assert.equal(event.action, 'speak');
  assert.equal(event.state, state);
});

test('left and right navigate only before answer input starts', () => {
  let state = createQuizInteractionState({ questionType: 'single_choice' });
  assert.equal(handleQuizKey(state, { key: 'ArrowRight' }).action, 'next');
  assert.equal(handleQuizKey(state, { key: 'ArrowLeft' }).action, 'previous');

  state = selectPendingAnswer(state, 'A');
  assert.equal(handleQuizKey(state, { key: 'ArrowRight' }).action, 'none');

  const textState = createQuizInteractionState({
    questionType: 'translation',
    textAnswer: 'abc',
  });
  assert.equal(handleQuizKey(textState, { key: 'ArrowLeft' }).action, 'none');
});

test('next after grading uses the server nextIndex instead of incrementing twice', () => {
  assert.equal(buildNextQuestionTarget({ currentIndex: 0 }, null), 'next');
  assert.equal(buildNextQuestionTarget({ currentIndex: 0 }, { nextIndex: 1 }), 1);
});
