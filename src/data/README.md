# src/data

Structured data and data models used by the Vue app.

## Main Areas

- `config/`: navigation, themes, test users, mock messages, and temporary CC98 verification-code config.
- `courses/`: course catalog parsing, course routes, and resource metadata indexes.
- `legacy/`: old or transitional data kept for migration context.
- `quizCourseConfigs.js`: quiz course navigation and capability configuration. See `quiz-config.md`.

## Course Content Rule

Do not put learning-note bodies, review-material bodies, or exam-paper text here. This folder may point to content files, but the content itself belongs under:

```txt
public/resource/courses/
```

Example: `BIO2110F` resource entries are indexed in `src/data/courses/courseDetails.js`, while the markdown/PDF files live in `public/resource/courses/basic/BIO2110F_microbiology-a/`.

## Routing Rule

Course routes use course codes:

```txt
#resources/#BIO2110F
#resources/#BIO2110F/#materials/#1
```

Do not route by Chinese or English course names.

## Checks

```bash
npm.cmd run check:routes
npm.cmd run check:content
npm.cmd test
```

