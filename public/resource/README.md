# public/resource

Static course and resource content served to users.

## Main Areas

- `summary/`: course catalog CSV and generated summary references.
- `educational_program/`: curriculum/program static files.
- `courses/`: per-course user-facing resources.

## Content Rule

Learning notes, review materials, and exam-paper metadata/text belong here, not in Vue components.

Course resource files should be referenced from `src/data/courses/`, usually through course code indexes.

## Deployment Note

Files in `public/` are copied into `dist/` by Vite. After changing these files, rebuild before deployment:

```bash
npm.cmd run build
```

## Checks

```bash
npm.cmd run check:content
npm.cmd run check:routes
```

