# src

Vue application source code.

## Before Editing

Read the closest child README first:

- `src/data/README.md` for structured data and course routing.
- `src/services/README.md` for auth, permissions, API clients, and shared rules.
- `src/components/README.md` for Vue component boundaries.
- `src/styles/README.md` for CSS and theme work.
- `src/utils/README.md` for small shared helpers.

Also read the matching `docs/harness/*.md` document listed in `AGENTS.md`.

## Rules

- Components display state and emit events.
- Shared decisions belong in `src/services/`.
- Structured data belongs in `src/data/`.
- Long user-facing content belongs in `public/`, not Vue files.

## Checks

```bash
npm.cmd test
npm.cmd run build
npm.cmd run harness:architecture
```
