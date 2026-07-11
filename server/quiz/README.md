# server/quiz

Backend-first quiz importer and storage boundary.

## Read With

- `public/resource/quiz/README.md`: static source data and assets.
- `src/services/quiz-services.md`: frontend API client and local quiz services.
- `tests/quiz-tests.md`: test map.

## Responsibilities

- Initialize quiz SQLite tables.
- Import legacy quiz JSON from `public/resource/quiz/`.
- Normalize legacy course-specific formats into collections, categories, and questions.
- Keep answer data in `answer_json` and expose safe question views without answers.
- Grade submitted answers and reveal answers through explicit backend service calls.

## Current Phase Boundaries

The current backend layer imports quiz data, implements answer handling, and exposes a minimal HTTP API for practice sessions, progress, mistakes, and reset flows.

Keyboard shortcuts and rich practice UI behavior are intentionally outside this backend phase.

## Main Files

- `quizStore.js`: SQLite schema and persistence helpers.
- `quizImportService.js`: imports `public/resource/quiz/` source files into the normalized database shape.
- `quizSessionService.js`: session creation, safe payloads, navigation, answer locking, reveal, self-judgement, progress, mistakes, and reset.
- `quizGradingService.js`: automatic grading and reveal/self-judge result shaping.
- `microbiologyPastExamService.js`: microbiology past-exam summaries, safe question reads, and per-question feedback.
- `importQuizCollections.mjs`: manual import entry point.

## Answer Strategy

- `gradeAnswer()` handles automatic grading for choice, true/false, and translation questions.
- `revealAnswer()` returns answers for reveal-only questions such as Botany slice identification, and references for short-answer or essay questions.
- `selfJudgeAnswer()` records explicit user judgement for short-answer and essay questions.
- Safe question reads still omit `answer_json`; answer data is returned only by submit, reveal, or self-judge flows.

## HTTP API

- `GET /api/quiz/collections?courseCode=BIO2110F`
- `GET /api/quiz/collections/:slug/categories`
- `POST /api/quiz/sessions`
- `GET /api/quiz/sessions/:sessionId`
- `POST /api/quiz/sessions/:sessionId/answers`
- `POST /api/quiz/sessions/:sessionId/reveals`
- `POST /api/quiz/sessions/:sessionId/self-judgements`
- `POST /api/quiz/mistakes`
- `DELETE /api/quiz/mistakes/:sourceQuestionId?collectionSlug=...`
- `GET /api/quiz/progress?collectionSlug=...`
- `GET /api/quiz/mistakes?collectionSlug=...`
- `POST /api/quiz/progress/reset`

Collection and category metadata are public. Session, answer, reveal, mistake, progress, and reset routes require the existing auth cookie.

## Invariants

- Safe question payloads do not include `answer_json`.
- The first submitted answer for a session/question is locked and cannot be overwritten.
- Session navigation does not grade or reveal answers.
- Practice sessions default to stable source order unless a caller explicitly requests otherwise.
- `sourceQuestionId` is the durable question identity across frontend local mistakes and backend sessions.

## Excluded Legacy Data

The old Botany `family-questions.json` table exercise is intentionally not imported. The active Botany collection is only the slice-identification bank.

## Checks

```bash
npm.cmd test -- tests/quizImport.test.js tests/quizGrading.test.js tests/quizSession.test.js tests/microbiologyPastExam.test.js
npm.cmd run build
```

