# Harness

This directory contains the executable harness for `life-science-study-platform`.

The human-readable rules live in `docs/harness/`. This directory turns those rules into agent roles, machine-readable policies, deterministic checks, browser smoke tests, artifacts, and reports.

## Commands

```bash
npm.cmd run harness
npm.cmd run harness:architecture
npm.cmd run harness:routes
npm.cmd run harness:content
npm.cmd run harness:themes
npm.cmd run harness:browser
```

On macOS/Linux, use `npm run ...`.

## Layers

- `agents/`: role protocols for multi-agent work.
- `policies/`: machine-readable rules.
- `datasets/`: test cases and expected identities.
- `scripts/`: deterministic checks and report generation.
- `evaluators/`: browser, visual, and LLM evaluation harnesses.
- `reports/`: generated harness reports.
- `artifacts/`: screenshots, videos, and traces.

## Report Output

`npm run harness` writes JSON and Markdown reports under `harness/reports/`. Generated reports are ignored by git; `.gitkeep` preserves the directory.
