# Course content backend

This directory owns the first-phase course-content administration backend.

## Responsibilities

- Private plain-text feedback, including guest submissions, rate/duplicate limits and administrator-only unread/read state. Feedback stays out of published course content and search.

- SQLite records for learning experiences, review materials, and past papers.
- Administrator JSON batch preview/import and filtered export of published experiences/materials. Batches are limited to 200 items and 8 MiB; creation plus audit entries is transactional, request IDs are administrator-scoped, and imports always create unowned drafts. See `docs/content-batch-json.md`.
- Idempotent import from `public/resource/courses/`.
- Draft, published, and archived status transitions.
- Optional `sourcePublishedDate` stores the original post date separately from site creation/audit timestamps. Administrator edits and batch JSON support `YYYY-MM-DD`; readers fall back to the Shanghai site creation date when unknown.
- Optional `subtitle` (up to 200 characters) preserves the original post title. `supplementBody` (up to 100000 characters) stores comment supplements separately from `body`, sharing its `bodyFormat`. Administrator content APIs and public reads expose both fields; omitted update fields retain their stored values. Existing databases migrate to empty defaults. The batch JSON schema is unchanged.
- PDF validation and storage outside the frontend build.
- `GET /api/content/courses/:courseCode/papers/download` streams published built-in PDFs as one ZIP, using the list's exact `year` and `teacher` filters. It includes validated stored/static files, never fetches external URLs, and limits each archive to 200 PDFs/100 MiB and two simultaneous streams. No temporary archive or database writes occur.
- The same controlled PDF endpoint previews files inline by default and downloads them as attachments with `download=1`; draft/archived access remains administrator-only. Legacy combined-microbiology reads support canonical redirection without mixing theory/lab lists.
- Public read models that omit internal storage metadata.
- Pending student submissions and administrator review decisions.
- Anonymous like state and administrator operation logs.
- Audit entries retain actor IDs and nickname snapshots. The administrator API resolves older empty/unbound names through auth identities and supports a separate nickname filter before row limits, including historical records for renamed administrators.
- A separate activity table used by the public activity page and homepage featured feed.

## Activity management

Activities are intentionally separate from course content because they do not
have a course-code identity. Public endpoints expose only published records.
Administrators can edit factual copy, image metadata, category, homepage
recommendation, and display order before publishing or archiving a record.

## Moderation flow

Authenticated users submit JSON to `api/submissions` and may attach a validated
PDF through the raw upload endpoint. Administrators can edit pending submissions,
then approve and immediately publish them or reject them with an optional note.
Only pending submissions can be changed or reviewed.

Course identity remains the course code. The public Vue routes are still built by
`src/data/courses/resourcePaths.js`.

## Persistent data

Defaults:

```txt
server/data/content.sqlite
server/data/content-uploads/
```

Production deployments should set `CONTENT_DB_FILE` and `CONTENT_UPLOAD_DIR` to
persistent, backed-up locations writable by the Node process.

## Checks

```bash
npm.cmd test
npm.cmd run build
```
