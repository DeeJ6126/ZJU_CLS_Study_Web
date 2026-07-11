import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAnswerMarkdownBlocks,
  buildOptionStateClass,
  buildVocabularyFeedback,
  shouldFocusTranslationInput,
} from '../src/services/quizAnswerViewService.js';

test('choice option view marks correct choice green and wrong selected choice red', () => {
  assert.deepEqual(
    buildOptionStateClass({
      optionKey: 'C',
      selectedKey: 'A',
      result: { correctDisplay: 'C' },
    }),
    {
      'is-selected': false,
      'is-correct': true,
      'is-incorrect': false,
    },
  );
  assert.deepEqual(
    buildOptionStateClass({
      optionKey: 'A',
      selectedKey: 'A',
      result: { correctDisplay: 'C' },
    }),
    {
      'is-selected': true,
      'is-correct': false,
      'is-incorrect': true,
    },
  );
});

test('markdown blocks can come from correct display or revealed reference answers', () => {
  const blocks = buildAnswerMarkdownBlocks({
    correctDisplay: '',
    revealedAnswer: {
      referenceAnswer: '### 要点\n- DNA\n- RNA',
    },
  });

  assert.equal(blocks[0].type, 'heading');
  assert.equal(blocks[1].type, 'list');
  assert.deepEqual(blocks[1].items, ['DNA', 'RNA']);
});

test('translation input should focus only for unlocked translation questions', () => {
  assert.equal(shouldFocusTranslationInput({ type: 'translation' }, null), true);
  assert.equal(shouldFocusTranslationInput({ type: 'translation' }, { answer: { text: 'DNA' } }), false);
  assert.equal(shouldFocusTranslationInput({ type: 'single_choice' }, null), false);
});

test('vocabulary feedback distinguishes new and duplicate terms', () => {
  assert.equal(buildVocabularyFeedback('DNA', []), '已加入：DNA');
  assert.equal(
    buildVocabularyFeedback('DNA', [{ normalizedTerm: 'dna' }]),
    '已在生词本：DNA',
  );
});
