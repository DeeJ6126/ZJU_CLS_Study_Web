# PROJECT_STATUS.md

This file is the short-term recovery point for future AI sessions. Keep it current, factual, and brief.

## Current State

- The project is a Vue 3 + Vite + plain CSS learning-resource platform for ZJU life-science students.
- The app currently has a lightweight demo shell with top-level pages including `首页`, `概览`, `刷题`, and `关于`.
- The quiz feature is now mostly complete for the current phase:
  - `BIO2023M` molecular biology review
  - `BIO2019F` botany slice identification
  - `BIO2110F` microbiology final review
- Quiz practice now uses a shared course shell, shared practice layout, shared question views, backend grading, answer locking, and safe answer-return rules.
- Quiz handoff docs are in place under `src/components/quiz/`, `src/services/`, `src/data/`, `public/resource/quiz/`, `server/quiz/`, and `tests/`.
- Project management docs have been renamed to `docs/project-guides/`, and the preferred check commands are now `npm.cmd run check*`.

## Recently Completed

- Migrated quiz data and assets from the standalone molecular biology, botany, and microbiology quiz projects.
- Built backend quiz import, SQLite storage, sessions, grading, reveal, self-judgement, progress, mistakes, reset, molecular review terms, and microbiology past-exam APIs.
- Migrated the three quiz experiences into the main site without iframe usage.
- Unified the core quiz practice skeleton across the three courses.
- Added quiz-specific handoff documentation and test maps.
- Replaced visible project-management wording with neutral project-guide and project-check wording while preserving the underlying checks.
- Added BOM-tolerant parsing for project JSON checks and Markdown frontmatter.

## Known Good Verification

Last known passing commands:

```bash
npm.cmd test
npm.cmd run check
```

`npm.cmd run check` includes the broad project checks and produced a passing report on 2026-07-11.

## Deferred Or Not Yet Production-Ready

- Real production authentication and authorization hardening.
- Server-side persistence/sync for quiz local mistake books and vocabulary books.
- More course quiz migrations beyond the three current quiz courses.
- Final deployment hardening under `/var/www/html/zjubio/`.
- The next product direction is expected to involve `首页` and `概览`, but the exact scope should come from the user in the next task.

## Recovery Order For Future AI

1. Read `AGENTS.md`.
2. Read this file.
3. Read `docs/project-guides/index.md`.
4. Read `docs/project-guides/decisions.md`.
5. Read the closest README in the directory being edited.
6. For quiz work, read the Quiz Handoff Docs listed in `AGENTS.md`.

## Update Rule

Update this file when a task changes project status, leaves a known limitation, completes a major phase, or changes the recommended next recovery step.
