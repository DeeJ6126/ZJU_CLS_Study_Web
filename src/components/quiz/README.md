# src/components/quiz

Shared Vue components for the quiz course subapps.

## Read This First

The quiz UI is intentionally split into a shared skeleton plus small question-type views. Molecular biology, botany, and microbiology should look and behave consistently in practice mode. Course-specific pages may differ, but the core practice surface should reuse this folder.

## Main Components

- `QuizCourseShell.vue`: course subapp frame. It owns the left course navigation and the full-width content area.
- `QuizPracticeLayout.vue`: shared practice layout with question overview, range rows, question tiles, and right-side question content.
- `ChoiceQuestionView.vue`: shared choice option rendering and color states.
- `TrueFalseQuestionView.vue`: shared true/false controls.
- `TextAnswerQuestionView.vue`: shared translation/text-answer input with exposed `focus()`.
- `ImageRevealQuestionView.vue`: shared image reveal view for botany slice questions.
- `MarkdownResultView.vue`: safe structured rendering for answers and explanations.

## Boundaries

- Do not put question-bank text or long answer content in these components.
- Do not call backend APIs directly from question-type components.
- Do not reimplement option correctness styling per course. Use `ChoiceQuestionView.vue` and `quizAnswerViewService.js`.
- Do not use `v-html`; answer markdown goes through `MarkdownResultView.vue`.

## How To Add A Course

1. Add course configuration in `src/data/quizCourseConfigs.js`.
2. Add or import course-specific page sections in `src/App.vue` or a future course page component.
3. Use `QuizCourseShell.vue` for the course frame.
4. Use `QuizPracticeLayout.vue` for the practice page.
5. Use the shared question-type views for the right-side question body.

## Checks

```bash
npm.cmd test
npm.cmd run build
npm.cmd run check
```

