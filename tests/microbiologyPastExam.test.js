import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getMicrobiologyPastExamFeedback,
  getMicrobiologyPastExamQuestions,
  listMicrobiologyPastExamSummaries,
} from '../server/quiz/microbiologyPastExamService.js';

test('microbiology past exam summaries expose metadata without answers', () => {
  const summaries = listMicrobiologyPastExamSummaries();

  assert.ok(summaries.length >= 2);
  assert.equal(summaries[0].examId, 'midterm-24');
  assert.equal(typeof summaries[0].questionCount, 'number');
  assert.equal(Object.hasOwn(summaries[0], 'answerKey'), false);
  assert.equal(Object.hasOwn(summaries[0], 'questions'), false);
});

test('microbiology past exam questions hide answer keys and explanations', () => {
  const questions = getMicrobiologyPastExamQuestions('midterm-24');

  assert.ok(questions.length > 0);
  assert.equal(questions[0].number, 1);
  assert.ok(Array.isArray(questions[0].options));
  assert.equal(Object.hasOwn(questions[0], 'answerKey'), false);
  assert.equal(Object.hasOwn(questions[0], 'aiExplanation'), false);
});

test('microbiology past exam feedback returns only the submitted question result', () => {
  const feedback = getMicrobiologyPastExamFeedback('midterm-24', {
    questionNumber: 1,
    selectedKey: 'A',
  });

  assert.equal(feedback.ok, true);
  assert.equal(feedback.questionNumber, 1);
  assert.equal(feedback.selectedKey, 'A');
  assert.equal(feedback.correctKey, 'C');
  assert.equal(feedback.isCorrect, false);
  assert.ok(feedback.explanation);

  const unknown = getMicrobiologyPastExamFeedback('midterm-24', {
    questionNumber: 1,
    selectedKey: 'UNKNOWN',
  });
  assert.equal(unknown.ok, true);
  assert.equal(unknown.isCorrect, false);
});
