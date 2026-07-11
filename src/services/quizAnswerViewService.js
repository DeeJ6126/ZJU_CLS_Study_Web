import { parseMarkdownAnswer } from './markdownAnswerService.js';

export function buildOptionStateClass({ optionKey, selectedKey = '', result = null }) {
  const normalizedOption = String(optionKey ?? '').toUpperCase();
  const normalizedSelected = String(selectedKey ?? '').toUpperCase();
  const normalizedCorrect = String(result?.correctDisplay ?? '').toUpperCase();

  return {
    'is-selected': normalizedSelected === normalizedOption,
    'is-correct': Boolean(result) && normalizedCorrect === normalizedOption,
    'is-incorrect': Boolean(result) && normalizedSelected === normalizedOption && normalizedCorrect !== normalizedOption,
  };
}

export function getAnswerMarkdownSource(result) {
  return result?.correctDisplay
    || result?.revealedAnswer?.referenceAnswer
    || result?.answer?.referenceAnswer
    || '';
}

export function buildAnswerMarkdownBlocks(result) {
  return parseMarkdownAnswer(getAnswerMarkdownSource(result));
}

export function shouldFocusTranslationInput(question, status) {
  return question?.type === 'translation' && !status;
}

export function buildVocabularyFeedback(term, records = []) {
  const cleanTerm = String(term ?? '').trim();
  const normalized = cleanTerm.toLowerCase();
  const exists = records.some((record) => record.normalizedTerm === normalized);
  return exists ? `已在生词本：${cleanTerm}` : `已加入：${cleanTerm}`;
}
