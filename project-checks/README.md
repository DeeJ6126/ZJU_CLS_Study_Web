# Project Checks

This directory contains the executable project checks for `life-science-study-platform`.

The human-readable rules live in `docs/project-guides/`. This directory turns those rules into agent roles, machine-readable policies, deterministic checks, browser smoke tests, artifacts, and reports.

## Commands

```bash
npm.cmd run check
npm.cmd run check:architecture
npm.cmd run check:routes
npm.cmd run check:content
npm.cmd run check:themes
npm.cmd run check:browser
```

On macOS/Linux, use `npm run ...`.

## Layers

- `agents/`: role protocols for multi-agent work.
- `policies/`: machine-readable rules.
- `datasets/`: test cases and expected identities.
- `scripts/`: deterministic checks and report generation.
- `evaluators/`: browser, visual, and LLM evaluation checks.
- `reports/`: generated project check reports.
- `artifacts/`: screenshots, videos, and traces.

## Report Output

`npm run check` writes JSON and Markdown reports. Generated reports are ignored by git; `.gitkeep` preserves the output directory.
