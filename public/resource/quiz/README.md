# public/resource/quiz

Migration source files and static assets for the backend quiz importer.

## Read With

- `server/quiz/README.md`: backend importer, grading, sessions, and API boundary.
- `src/data/quiz-config.md`: frontend course configuration.
- `src/components/quiz/README.md`: shared quiz UI skeleton.

## Layout

```txt
public/resource/quiz/
  BIO2110F/microbiology-final-review/
    source/question-bank.json
    source/past-exams.json
    assets/pdfs/
  BIO2019F/botany-slice/
    source/question-bank.json
    assets/images/
  BIO2023M/molecular-biology-review/
    source/question-bank.json
    assets/images/
```

Course codes are the stable identity. Collection slugs distinguish multiple future quiz banks for the same course.

## Rule

These files are migration sources for `server/quiz/`. Vue components should not import or embed question-bank bodies directly.

The Botany family table bank is intentionally excluded from this migration phase.

## Current Collections

- `BIO2023M/molecular-biology-review`: molecular biology question bank, including translation fields used by language mode and review flashcards.
- `BIO2019F/botany-slice`: botany slice image reveal bank. Images stay under `assets/images/`.
- `BIO2110F/microbiology-final-review`: microbiology final-review bank and past-exam source data.

## Adding Or Updating Data

1. Keep source data under `source/`; keep binary assets under `assets/`.
2. Preserve course code and collection slug paths.
3. Update importer logic in `server/quiz/quizImportService.js` only if the source shape changes.
4. Re-run quiz import/session tests before trusting the data.

```bash
npm.cmd test -- tests/quizImport.test.js tests/quizSession.test.js
```

