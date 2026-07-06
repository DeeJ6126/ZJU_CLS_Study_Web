# tests

Node.js built-in tests for data contracts, services, UI structure, auth, and harness scripts.

## Test Style

- Use `node:test` and `node:assert/strict`.
- Prefer testing real project functions.
- Add focused tests when changing services, route contracts, auth behavior, or course-resource indexes.

## Useful Commands

```bash
npm.cmd test
npm.cmd run harness:architecture
npm.cmd run harness:routes
npm.cmd run harness:content
npm.cmd run harness:themes
```

## Common Coverage Areas

- Course catalog and route contracts.
- Markdown content parsing.
- Auth state and permission rules.
- CC98 registration/login backend flow.
- UI structure expectations that should not regress.
