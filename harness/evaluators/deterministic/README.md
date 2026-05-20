# Deterministic Evaluators

Deterministic checks are the first harness gate. They should be fast, local, and explain failures in a way that an agent can act on.

Current checks:

- `harness/scripts/check-architecture.mjs`
- `harness/scripts/check-routes.mjs`
- `harness/scripts/check-content-location.mjs`
- `harness/scripts/check-themes.mjs`

Run all deterministic checks with:

```bash
npm.cmd run harness
```
