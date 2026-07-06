# AGENTS.md

This is the AI entry map for `E:\Study_Web`. Keep this file short. Use it to choose the next document, not to learn the whole project.

## Project

- Name: `life-science-study-platform`
- Product: 生科智学 / 生命科学学子学习平台
- Goal: a learning-resource platform for ZJU life-science students
- Current direction: grow from a Vue prototype into a fuller application, then deploy under `/var/www/html/zjubio/`

## Stack

- Vue 3 + Vite
- JavaScript ESM
- Plain CSS, no UI framework
- Node.js built-in tests: `node --test`
- Lightweight Node backend in `server/` for current auth prototype

## Read Next

Always read:

1. `docs/harness/index.md`
2. The README in the directory you are about to edit
3. The matching harness doc:
   - Architecture: `docs/harness/architecture.md`, `docs/harness/project-map.md`
   - Auth/security: `docs/harness/security-and-auth.md`
   - Course data/routes/content: `docs/harness/data-contracts.md`
   - UI/theme/copy: `docs/harness/ui-rules.md`, `docs/design-system.md`
   - Failures/debugging: `docs/harness/failure-modes.md`
   - Harness usage: `docs/harness/harness-usage-guide.md`

## Directory Map

- `src/`: Vue application code. See `src/README.md`.
- `src/data/`: structured config, course catalog, route metadata. See `src/data/README.md`.
- `src/services/`: shared business logic and API clients. See `src/services/README.md`.
- `src/components/`: Vue display components. Prefer props/events over business decisions.
- `src/styles/`: global CSS files and theme tokens.
- `public/`: static user-facing content. See `public/resource/README.md` for course resources.
- `server/`: current lightweight auth backend. See `server/README.md`.
- `tests/`: Node test suite. See `tests/README.md`.
- `docs/harness/`: project rules and human/AI operating docs.
- `harness/`: executable checks and reports.

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
npm.cmd run harness
npm.cmd run harness:routes
npm.cmd run harness:content
npm.cmd run harness:themes
npm.cmd run harness:architecture
```

Browser smoke test:

```bash
npm.cmd run harness:browser
```

## Deployment Note

The current server path is expected to be:

```txt
/var/www/html/zjubio/
```

Older `/app/zjubio` notes may refer to temporary deployment work. Prefer the current server path unless the user says otherwise.
