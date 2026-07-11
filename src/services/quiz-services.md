# Quiz Services

This file is the quick map for quiz-related frontend services in `src/services/`.

## Shared Services

- `quizApiClient.js`: browser API client for quiz backend routes. Quiz API paths use absolute `/api/...` paths.
- `quizInteractionService.js`: pending answer state, keyboard behavior, submit payloads, and next-question targets.
- `quizRangeService.js`: converts backend categories into selectable practice ranges and stable question tiles.
- `quizAnswerViewService.js`: option state classes, answer markdown source selection, translation focus, and vocabulary feedback.
- `markdownAnswerService.js`: parses markdown-like answer text into safe structured blocks for Vue rendering.

## Course-Specific Local Services

- `molecularQuizService.js`: language mode, pronunciation text, vocabulary, local mistakes, and result summaries.
- `botanyQuizService.js`: slice category selection, local mistakes, gallery grouping, and result summaries.
- `microbiologyQuizService.js`: chapter selection, vocabulary, local mistakes, and result summaries.

These services are local UI/state helpers. They do not replace backend grading or answer-protection rules.

## Data Flow

1. Components ask `quizApiClient.js` for collections, categories, sessions, submissions, reveals, or review data.
2. Backend returns safe question views without answers until submit/reveal/self-judge.
3. Components keep current pending input in `quizInteractionService.js` shape.
4. Course local services update localStorage-backed mistakes, vocabulary, and result helpers.
5. Shared views render options and markdown consistently.

## Rules For Future AI

- Put reusable rules here before adding logic to components.
- Keep permission decisions in `authService.js`.
- Keep durable answer protection on the server; frontend hiding is not a security boundary.
- Do not reintroduce random shuffle or hard limits unless explicitly requested and tested.
- Preserve stable backend `questionIndex.localNumber` for sidebars.

## Tests

Relevant tests include:

- `tests/quizInteraction.test.js`
- `tests/quizRange.test.js`
- `tests/quizAnswerViewService.test.js`
- `tests/molecularQuizService.test.js`
- `tests/botanyQuizService.test.js`
- `tests/microbiologyQuizService.test.js`

