# tests

Node.js built-in tests for data contracts, services, UI structure, auth, and project check scripts.

## Test Style

- Use `node:test` and `node:assert/strict`.
- Prefer testing real project functions.
- Add focused tests when changing services, route contracts, auth behavior, or course-resource indexes.

## Useful Commands

```bash
npm.cmd test
npm.cmd run check:architecture
npm.cmd run check:routes
npm.cmd run check:content
npm.cmd run check:themes
```

## Common Coverage Areas

- Course catalog and route contracts.
- Markdown content parsing.
- Auth state and permission rules.
- CC98 registration/login backend flow.
- Account/profile/content/activity HTTP flows and SQLite stores.
- Cross-source search and student-homepage storage/application workflows.
- Quiz imports, grading, answer safety, sessions, and account synchronization.
- UI structure expectations that should not regress.

For the quiz-specific test map, read `quiz-tests.md`.

