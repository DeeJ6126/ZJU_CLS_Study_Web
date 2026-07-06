# public/resource/courses

Per-course static resource content.

## Structure

Use stable course-category and course-code folders, for example:

```txt
basic/BIO2110F_microbiology-a/
  overview/index.md
  experiences/1.md
  materials/1.md
  papers/1.md
  papers/example.pdf
```

## Indexing

Adding a markdown or PDF file here is not enough by itself. The Vue app needs an index entry under:

```txt
src/data/courses/courseDetails.js
```

That index maps course code and tab to markdown files.

## Rules

- Keep large/user-facing content in markdown or static files.
- Do not use Chinese or English names as route identity.
- Keep routes based on course code, e.g. `BIO2110F`.

## Checks

```bash
npm.cmd run harness:content
npm.cmd run harness:routes
npm.cmd test
```
