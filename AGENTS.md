# AGENTS.md

This is the AI entry map for `E:\Study_Web`. Keep this file short. Use it to choose the next document, not to learn the whole project.

## Project

- Name: `life-science-study-platform`
- Product: 生科智学 / 生命科学学子学习平台
- Goal: a learning-resource platform for ZJU life-science students
- Current direction: harden the current full application and deploy it under `/var/www/html/zjubio/`

## Stack

- Vue 3 + Vite
- JavaScript ESM
- Plain CSS, no UI framework
- Node.js built-in tests: `node --test`
- Lightweight Node backend in `server/` for auth, account data, profiles, content, activities, search, student homepages, and quizzes

## Read Next

Always read:

1. `docs/project-guides/index.md`
2. `PROJECT_STATUS.md`
3. `docs/project-guides/decisions.md`
4. The README in the directory you are about to edit
5. The matching project guide:
   - Architecture: `docs/project-guides/architecture.md`, `docs/project-guides/project-map.md`
   - Auth/security: `docs/project-guides/security-and-auth.md`
   - Course data/routes/content: `docs/project-guides/data-contracts.md`
   - UI/theme/copy: `docs/project-guides/ui-rules.md`, `docs/design-system.md`
   - Failures/debugging: `docs/project-guides/failure-modes.md`
   - Project checks: `docs/project-guides/checks-usage-guide.md`

## Directory Map

- `src/`: Vue application code. See `src/README.md`.
- `src/data/`: structured config, course catalog, route metadata. See `src/data/README.md`.
- `src/services/`: shared business logic and API clients. See `src/services/README.md`.
- `src/components/`: Vue display components. Prefer props/events over business decisions.
- `src/components/quiz/`: shared quiz UI skeleton and question views. See `src/components/quiz/README.md`.
- `src/styles/`: global CSS files and theme tokens.
- `public/`: static user-facing content. See `public/resource/README.md` for course resources and `public/resource/quiz/README.md` for quiz banks.
- `server/`: current lightweight auth backend. See `server/README.md`.
- `server/quiz/`: quiz import, grading, sessions, and safe answer APIs. See `server/quiz/README.md`.
- `tests/`: Node test suite. See `tests/README.md`.
- `docs/project-guides/`: project rules and human/AI operating docs.
- `PROJECT_STATUS.md`: current project state, recent verification, and recovery order.

## Quiz Handoff Docs

When touching the quiz feature, read these first:

1. `src/components/quiz/README.md`
2. `src/services/quiz-services.md`
3. `src/data/quiz-config.md`
4. `public/resource/quiz/README.md`
5. `server/quiz/README.md`
6. `tests/quiz-tests.md`

## Hard Rules

- Do not put course text, learning notes, review material, or exam-paper text inside Vue components.
- Do not route courses by Chinese or English course names. Use course codes, e.g. `#resources/#BIO2110F`.
- Do not duplicate submit/comment/favorite/auth permission logic in components. Use `src/services/authService.js`.
- Do not treat frontend permission checks as a real security boundary.
- Do not edit `dist/` or `node_modules/` by hand.
- Do not add UI frameworks, router libraries, or state managers without a deliberate plan.

## Common Commands

On Windows, prefer `npm.cmd`:

```bash
npm.cmd test
npm.cmd run build
npm.cmd run check
npm.cmd run check:routes
npm.cmd run check:content
npm.cmd run check:themes
npm.cmd run check:architecture
```

Browser smoke test:

```bash
npm.cmd run check:browser
```

## Deployment Note

The current server path is expected to be:

```txt
/var/www/html/zjubio/
```

Older `/app/zjubio` notes may refer to temporary deployment work. Prefer the current server path unless the user says otherwise.

