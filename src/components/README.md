# src/components

Vue display components.

## Purpose

Components should render props, hold local UI state, and emit events upward. Keep business rules and durable data decisions outside this folder.

## Boundaries

- Auth and permission rules: `src/services/authService.js`.
- API calls: `src/services/*ApiClient.js`.
- Course route and resource metadata: `src/data/courses/`.
- Long content such as notes, materials, and exam text: `public/`.

## When Adding Components

- Prefer props and events over importing global state.
- Keep text readable and domain-specific.
- Do not duplicate submit/comment/favorite permission checks.
- Do not hardcode course resource bodies or CC98 verification codes.

## Checks

```bash
npm.cmd test
npm.cmd run build
npm.cmd run check:architecture
```

