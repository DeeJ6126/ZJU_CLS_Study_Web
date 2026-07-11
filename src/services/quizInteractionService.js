const choiceTypes = new Set(['single_choice', 'multiple_choice']);

function hasText(value) {
  return String(value ?? '').trim().length > 0;
}

function isJudged(state) {
  return Boolean(state.result);
}

function hasStartedAnswer(state) {
  return Boolean(state.pendingAnswer) || hasText(state.textAnswer);
}

export function createQuizInteractionState({
  questionType,
  pendingAnswer = null,
  textAnswer = '',
  result = null,
} = {}) {
  return {
    questionType,
    pendingAnswer,
    textAnswer,
    result,
    hasStartedAnswer: Boolean(pendingAnswer) || hasText(textAnswer),
  };
}

export function selectPendingAnswer(state, value) {
  let pendingAnswer = null;

  if (choiceTypes.has(state.questionType)) {
    pendingAnswer = { selectedKey: String(value).toUpperCase() };
  } else if (state.questionType === 'true_false') {
    pendingAnswer = { value: Boolean(value) };
  }

  return createQuizInteractionState({
    ...state,
    pendingAnswer,
    result: null,
  });
}

export function updateTextAnswer(state, textAnswer) {
  return createQuizInteractionState({
    ...state,
    textAnswer,
    result: null,
  });
}

export function withQuizResult(state, result) {
  return createQuizInteractionState({
    ...state,
    result,
  });
}

export function resetQuizInteraction(questionType) {
  return createQuizInteractionState({ questionType });
}

export function buildSubmitAnswer(state) {
  if (choiceTypes.has(state.questionType) || state.questionType === 'true_false') {
    return state.pendingAnswer;
  }

  if (state.questionType === 'translation') {
    return hasText(state.textAnswer) ? { text: state.textAnswer.trim() } : null;
  }

  return null;
}

export function buildNextQuestionTarget(session, result) {
  if (Number.isInteger(result?.nextIndex)) {
    return result.nextIndex;
  }

  return 'next';
}

export function handleQuizKey(state, event) {
  const key = event.key;

  if (key === ' ' && isJudged(state)) {
    return { action: 'next', state };
  }

  if ((key === 'ArrowLeft' || key === 'ArrowRight') && !hasStartedAnswer(state) && !isJudged(state)) {
    return { action: key === 'ArrowLeft' ? 'previous' : 'next', state };
  }

  if (key === 'Enter') {
    const answer = buildSubmitAnswer(state);
    return answer ? { action: 'submit', state, answer } : { action: 'none', state };
  }

  if (key === 'Tab' && state.questionType === 'translation') {
    return { action: 'speak', state };
  }

  if (choiceTypes.has(state.questionType) && /^[a-d]$/i.test(key)) {
    const nextState = selectPendingAnswer(state, key);
    return { action: 'select', state: nextState };
  }

  if (state.questionType === 'true_false' && /^[tf]$/i.test(key)) {
    const nextState = selectPendingAnswer(state, key.toLowerCase() === 't');
    return { action: 'select', state: nextState };
  }

  return { action: 'none', state };
}
