# Deterministic Evaluators

Deterministic checks are the first project-check gate. They should be fast, local, and explain failures in a way that an agent can act on.

Current checks:

- architecture boundaries
- route contracts
- content location
- theme coverage

Run all deterministic checks with:

```bash
npm.cmd run check
```
