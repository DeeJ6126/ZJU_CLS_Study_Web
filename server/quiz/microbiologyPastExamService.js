import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const defaultPastExamPath = resolve(
  'public/resource/quiz/BIO2110F/microbiology-final-review/source/past-exams.json',
);
const allowedKeys = new Set(['A', 'B', 'C', 'D', 'UNKNOWN']);

let cachedBank = null;
let cachedPath = '';

function readPastExamBank(filename = defaultPastExamPath) {
  if (cachedBank && cachedPath === filename) {
    return cachedBank;
  }
  cachedPath = filename;
  cachedBank = JSON.parse(readFileSync(filename, 'utf8').replace(/^\uFEFF/, ''));
  return cachedBank;
}

function safeOption(option) {
  return {
    key: option.key,
    text: option.text,
  };
}

function safeQuestion(question) {
  return {
    number: question.number,
    prompt: question.prompt,
    options: (question.options ?? []).map(safeOption),
    match: question.match
      ? {
        type: question.match.type ?? '',
        sourceQuestionId: question.match.sourceQuestionId ?? '',
        sourceChapterId: question.match.sourceChapterId ?? null,
      }
      : null,
  };
}

function findExam(examId, filename) {
  return readPastExamBank(filename).exams.find((exam) => exam.id === examId) ?? null;
}

export function listMicrobiologyPastExamSummaries({ filename = defaultPastExamPath } = {}) {
  return readPastExamBank(filename).exams.map((exam) => {
    const answeredCount = exam.questions.filter((question) => question.answerKey).length;
    const explanationCount = exam.questions.filter((question) => question.aiExplanation).length;
    return {
      examId: exam.id,
      title: exam.title,
      sourcePdf: exam.sourcePdf,
      questionCount: exam.summary?.totalQuestions ?? exam.questions.length,
      answeredCount,
      explanationCount,
      exactMatches: exam.summary?.exactMatches ?? 0,
      highMatches: exam.summary?.highMatches ?? 0,
      reviewMatches: exam.summary?.reviewMatches ?? 0,
    };
  });
}

export function getMicrobiologyPastExamQuestions(examId, { filename = defaultPastExamPath } = {}) {
  const exam = findExam(examId, filename);
  if (!exam) {
    return [];
  }

  return exam.questions.map(safeQuestion);
}

export function getMicrobiologyPastExamFeedback(examId, { questionNumber, selectedKey }, { filename = defaultPastExamPath } = {}) {
  const exam = findExam(examId, filename);
  if (!exam) {
    return { ok: false, status: 404, message: '真题不存在。' };
  }

  const question = exam.questions.find((item) => Number(item.number) === Number(questionNumber));
  if (!question) {
    return { ok: false, status: 404, message: '真题题目不存在。' };
  }

  const normalizedKey = String(selectedKey ?? '').trim().toUpperCase();
  if (!allowedKeys.has(normalizedKey)) {
    return { ok: false, status: 400, message: '请选择 A-D，或选择不知道。' };
  }

  const correctKey = question.answerKey ?? null;
  return {
    ok: true,
    examId,
    questionNumber: question.number,
    selectedKey: normalizedKey,
    correctKey,
    isCorrect: Boolean(correctKey && normalizedKey === correctKey),
    explanation: question.aiExplanation ?? null,
    match: question.match ?? null,
  };
}
