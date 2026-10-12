# src/utils

Small shared helpers with no Vue component dependency.

## Current Responsibilities

- Markdown parsing and frontmatter helpers.
- `attachmentLinks.js`: safe HTTP(S) attachment URLs and shared PDF/download links for Markdown, UBB and legacy resource fields. Files are accessed directly on their external host; no server proxy is introduced.
- Public asset path helpers for different deployment bases.

## Rules

- Keep helpers deterministic and easy to test.
- Do not put business permissions here.
- Do not put course catalog ownership here; use `src/data/courses/`.

## Checks

```bash
npm.cmd test
npm.cmd run build
```

