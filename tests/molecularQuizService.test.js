import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildQuizResultSummary,
  createVocabularyRecord,
  cycleVocabularyStatus,
  removeMolecularMistake,
  clearMolecularMistakes,
  getMolecularDisplayText,
  getMolecularOptionText,
  getMolecularSpeakText,
  normalizeVocabularyRecords,
  upsertMolecularMistake,
  tokenizeVocabularyText,
} from '../src/services/molecularQuizService.js';

test('molecular display helpers prefer selected language and fall back safely', () => {
  const question = {
    prompt: 'DNA replication',
    body: {
      promptCn: 'DNA复制',
      options: [
        { key: 'A', text: 'Polymerase', textCn: '聚合酶' },
        { key: 'B', text: 'Ligase' },
      ],
    },
    explanation: {
      explanation: 'English explanation',
      explanationCn: '中文解析',
    },
  };

  assert.equal(getMolecularDisplayText(question, 'zh', 'prompt'), 'DNA复制');
  assert.equal(getMolecularDisplayText(question, 'en', 'prompt'), 'DNA replication');
  assert.equal(getMolecularDisplayText(question, 'zh', 'explanation'), '中文解析');
  assert.equal(getMolecularOptionText(question.body.options[0], 'zh'), '聚合酶');
  assert.equal(getMolecularOptionText(question.body.options[1], 'zh'), 'Ligase');
});

test('molecular pronunciation matches the old project acronym and full-term rules', () => {
  assert.equal(
    getMolecularSpeakText({ answerTerm: 'deoxyribonucleic acid', answerFullTerm: 'DNA' }),
    'DNA',
  );
  assert.equal(
    getMolecularSpeakText({ answerTerm: 'polymerase chain reaction', answerFullTerm: 'PCR' }),
    'polymerase chain reaction',
  );
  assert.equal(getMolecularSpeakText({ answerTerm: 'ribosome' }), 'ribosome');
});

test('vocabulary helpers tokenize, dedupe, cycle status, and sanitize imports', () => {
  assert.deepEqual(tokenizeVocabularyText('DNA-binding protein and ATPase'), [
    'DNA-binding',
    'protein',
    'and',
    'ATPase',
  ]);

  const first = createVocabularyRecord('Protein', { questionId: 'q1', contextText: 'Protein binds DNA.' });
  const duplicate = createVocabularyRecord('protein', { questionId: 'q2' });
  const normalized = normalizeVocabularyRecords([first, duplicate, { term: '', status: 'bad' }]);

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].normalizedTerm, 'protein');
  assert.equal(cycleVocabularyStatus('new'), 'learning');
  assert.equal(cycleVocabularyStatus('learning'), 'mastered');
  assert.equal(cycleVocabularyStatus('mastered'), 'new');
});

test('result summary counts auto-graded and self-judged molecular answers by type', () => {
  const summary = buildQuizResultSummary({
    questionIndex: [
      { sourceQuestionId: 't1', categorySourceId: 'translation-1' },
      { sourceQuestionId: 'tf1', categorySourceId: 'true-false-1' },
      { sourceQuestionId: 's1', categorySourceId: 'short-answer' },
      { sourceQuestionId: 's2', categorySourceId: 'short-answer' },
    ],
    categories: [
      { sourceId: 'translation-1', parentTitle: '中英互译', title: '基础', type: 'translation' },
      { sourceId: 'true-false-1', parentTitle: '判断题', title: '判断题', type: 'true_false' },
      { sourceId: 'short-answer', parentTitle: '简答题', title: '简答题', type: 'short_answer' },
    ],
    answerStatusBySourceQuestionId: {
      t1: { isCorrect: true, gradingMode: 'auto' },
      tf1: { isCorrect: false, gradingMode: 'auto' },
      s1: { isCorrect: true, gradingMode: 'self_judge' },
    },
  });

  assert.equal(summary.total, 4);
  assert.equal(summary.answered, 3);
  assert.equal(summary.correct, 2);
  assert.equal(summary.unanswered, 1);
  assert.equal(summary.selfJudgedCorrect, 1);
  assert.equal(summary.byType['中英互译'].correct, 1);
  assert.equal(summary.byType['简答题'].unanswered, 1);
});

test('molecular mistake helpers upsert, count repeats, remove, and clear records', () => {
  const question = {
    sourceQuestionId: 'translation-1-q-001',
    type: 'translation',
    prompt: '真核生物',
    body: {
      categoryId: 'translation-1',
      categoryTitle: '基础分子生物学概念',
    },
  };

  const first = upsertMolecularMistake([], {
    question,
    answer: { text: 'wrong' },
    correctDisplay: 'Eukaryote',
  });
  assert.equal(first.length, 1);
  assert.equal(first[0].wrongCount, 1);
  assert.equal(first[0].sourceQuestionId, 'translation-1-q-001');
  assert.equal(first[0].correctDisplay, 'Eukaryote');

  const second = upsertMolecularMistake(first, {
    question,
    answer: { text: 'wrong again' },
    correctDisplay: 'Eukaryote',
  });
  assert.equal(second.length, 1);
  assert.equal(second[0].wrongCount, 2);
  assert.deepEqual(second[0].lastAnswer, { text: 'wrong again' });

  assert.equal(removeMolecularMistake(second, 'translation-1-q-001').length, 0);
  assert.deepEqual(clearMolecularMistakes(second), []);
});
