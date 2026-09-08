# Project Decisions

This file records stable project decisions so future AI sessions do not need to rediscover them from chat history.

## How To Use This File

- Read this after `PROJECT_STATUS.md` when starting substantial work.
- Add a short entry when a decision changes architecture, data placement, routing, authentication boundaries, project checks, or long-term workflow.
- Keep entries concise. This is a decision log, not a progress journal.

## Decisions

### 1. `AGENTS.md` stays short and acts as an entry map

`AGENTS.md` should point to the right documents instead of becoming a full project manual. Detailed rules belong in `docs/project-guides/` or the closest directory README.

Impact: future AI should add new handoff details to focused docs, not overload `AGENTS.md`.

### 2. `PROJECT_STATUS.md` is the current recovery point

The project needs a lightweight current-state document so future AI can recover without relying on chat history.

Impact: update `PROJECT_STATUS.md` after major phases, important verification runs, or meaningful deferred work.

### 3. Project rules live in `docs/project-guides/`

The visible documentation layer uses neutral "project guides" and "project checks" wording. The management core remains: readable rules, machine-checkable constraints, and verification commands.

Impact: user-facing docs should refer to `docs/project-guides/` and `npm.cmd run check*`.

### 4. Use course codes as stable identity

Course routes, lookup keys, quiz configuration, favorites, and resource references use course codes such as `BIO2110F`, not Chinese or English course names.

Impact: new course work must preserve course-code routing and lookup.

### 5. Long course content stays out of Vue components

Learning notes, review material, exam-paper text, and question-bank bodies belong under `public/` or backend data sources, not in Vue components.

Impact: components render data; they do not store large course bodies.

### 6. Permissions stay behind `authService.js`

Frontend components must not duplicate submit/comment/favorite/auth permission logic. Current frontend checks are not a real security boundary.

Impact: auth UI may display state, but permission rules stay centralized.

### 7. Keep the frontend stack simple

The current frontend remains Vue 3 + Vite + JavaScript ESM + plain CSS. Do not add a router, state manager, or UI framework without a deliberate plan.

Impact: hash routing and local services remain acceptable until a planned migration is approved.

### 8. Quiz data is backend-first and answer-safe

Quiz source files live under `public/resource/quiz/`, are imported by `server/quiz/`, and normal practice question payloads must not expose answers before submit, reveal, or self-judgement.

Impact: do not fetch or embed question-bank answers directly in frontend components.

### 9. Quiz practice uses one shared skeleton

Molecular biology, botany, and microbiology quiz practice pages share:

- `QuizCourseShell.vue`
- `QuizPracticeLayout.vue`
- shared question views for choice, true/false, text answer, image reveal, and Markdown result rendering

Impact: new quiz courses should configure differences, not fork another complete practice skeleton.

### 10. Legacy quiz projects are migrated into the main site, not iframed

The standalone quiz projects are reference implementations and data sources. The user experience should be rebuilt inside the main site with consistent styling.

Impact: future legacy migrations should preserve useful behavior while using current site components and services.

### 11. Quiz supports guest-local state and signed-in account sync

Guests can practice without login and keep scoped localStorage records. Signed-in
accounts persist progress, mistakes, and vocabulary through the backend; the
first successful account merge clears the corresponding local browser records.
Demo identities remain isolated browser-local sandboxes and never acquire a real
backend session.

Impact: do not block guest practice on login, do not mix local records between
account scopes, and keep durable signed-in synchronization behind the quiz API.

### 12. Stable order is preferred for quiz sessions

The current quiz experience prioritizes complete, stable question sets and continuous local numbering over random order.

Impact: do not reintroduce hidden limits or random shuffling unless explicitly requested and tested.

### 13. Markdown answers must render safely

Quiz short-answer, essay, explanation, and reference-answer content should render through structured Markdown parsing, not `v-html`.

Impact: answer display changes should preserve `MarkdownResultView.vue` or equivalent safe rendering.

### 14. Preferred verification commands use `check`

Use:

```bash
npm.cmd test
npm.cmd run build
npm.cmd run check
```

For targeted checks, use `check:routes`, `check:content`, `check:themes`, `check:architecture`, or `check:browser`.

Impact: new docs should not introduce old command names.

### 15. Deployment target is `/var/www/html/zjubio/`

The expected server deployment path is `/var/www/html/zjubio/`.

Impact: older `/app/zjubio` references should be treated as historical unless the user says otherwise.

### 16. The check system folder is `project-checks/`

The project check system folder is now `project-checks/` (renamed from the
former folder name). The former folder name must not appear in folder names,
file names, or file contents anywhere in the repository.

Impact: reference the scripts as `project-checks/scripts/*`; the workflow
runner is `run-checks.mjs` and the config is `checks.config.json`. Do not
reintroduce the former folder name in new paths or docs.

### 17. Curriculum programs include short terms and 2025/2026

`programCatalog.js` models each curriculum with a `semesterByCourse` map over
twelve periods (each year's autumn-winter, spring-summer, and short term).
2024, 2025, and 2026 are enabled; 2023 is omitted because it used legacy
numeric course codes without BIO-encoded courses.

Impact: new curriculum work must fill `semesterByCourse` per year and keep the
`*-short` periods; courses identify by BIO code only.

### 18. Activities use a dedicated content domain

Activity records do not use course codes and therefore stay outside
`content_items`. The `activity_items` table owns publication state, homepage
recommendation, category, display order, and image metadata. The activity page
and homepage recent feed must read the same published records.

Impact: do not hardcode homepage activities or model them as course resources.
The static catalog is only the source-backed initial seed and offline fallback;
administrator edits are durable backend data.

### 19. Public identity has three product roles

The product exposes only guest, student-ID-verified student, and administrator.
Guests keep all read-only discovery and anonymous practice flows. Any action that
creates a public or account-persistent trace requires numeric student-ID email
verification; administrators add server-enforced management privileges. Legacy
CC98 endpoints remain backend-only and do not independently grant write rights.

Impact: new write endpoints must call the shared server authorization helper,
frontend permission copy must refer to student-ID verification, and new
administrators are provisioned through `ADMIN_STUDENT_IDS` plus mailbox proof.
