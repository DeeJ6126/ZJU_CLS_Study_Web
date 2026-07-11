# Quiz Tests

This file maps the quiz test suite for future AI work.

## Frontend Structure And Services

- `demoShell.test.js`: checks high-level quiz page structure, shared shell/layout usage, option styling, and markdown rendering entry points.
- `quizCourseConfig.test.js`: checks course navigation and capability config.
- `quizApiClient.test.js`: checks frontend quiz API paths.
- `quizInteraction.test.js`: checks keyboard behavior, pending answers, submit actions, and next-question handling.
- `quizRange.test.js`: checks course range cards and stable question tile numbering.
- `quizAnswerViewService.test.js`: checks option states, markdown answer source selection, translation focus, and vocabulary feedback.
- `markdownAnswer.test.js`: checks safe markdown-like answer parsing.

## Course Local Services

- `molecularQuizService.test.js`: molecular language display, pronunciation, vocabulary, local mistakes, and result summaries.
- `botanyQuizService.test.js`: botany category selection, mistakes, gallery grouping, and result summaries.
- `microbiologyQuizService.test.js`: microbiology selection, mistakes, vocabulary, and result summaries.

## Backend Quiz Tests

- `quizImport.test.js`: importer coverage for the three migrated collections.
- `quizGrading.test.js`: grading, reveal, and self-judgement rules.
- `quizSession.test.js`: session order, answer locking, safe payloads, review terms, mistake drills, and reset.
- `microbiologyPastExam.test.js`: past-exam summary/question/feedback answer-protection rules.

## Recommended Commands

For quiz-only work:

```bash
npm.cmd test -- tests/quizCourseConfig.test.js tests/quizInteraction.test.js tests/quizRange.test.js tests/quizSession.test.js
```

For release confidence:

```bash
npm.cmd test
npm.cmd run build
npm.cmd run check
```

