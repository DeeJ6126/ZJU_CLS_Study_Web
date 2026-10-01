# Public Notices

Administrator-maintained notices are separate from private account messages.

## Storage And Lifecycle

`contentStore` initializes `notice_items` and `notice_attachments` in the existing content database. New notices are drafts; publishing requires a summary and at least a body, source link or attachment. Archiving removes the public record and download access without deleting its data. No notice application, comment or submission APIs are exposed.

Files live in `CONTENT_UPLOAD_DIR/notice-attachments/`, which is already covered by the content backup. Only PDF, DOCX and XLSX are accepted, up to 25 MB each and 20 files per notice. Office validation uses the existing ZIP parser without extraction, checks package structure and bounds, and rejects macros, encryption, unsafe paths and embedded active content. Server-generated names prevent user filename traversal.

## APIs

- `GET /api/notices`: published list, `query`, `category`, `majorId`, `cohortYear`, `timing=active|expired`, `page`, `pageSize`.
- `GET /api/notices/:id`: published details.
- `GET /api/notices/:id/attachments/:attachmentId`: published download, or authenticated administrator access to a draft/archive attachment.
- `GET /api/admin/notices` and `GET /api/admin/notices/:id`: administrator records.
- `POST /api/admin/notices`, `PATCH /api/admin/notices/:id`: validated draft creation/editing.
- `POST /api/admin/notices/:id/publish|archive`: publication state changes.
- `POST /api/admin/notices/:id/attachments`: raw binary with `x-notice-upload: notice-attachment`, encoded `x-file-name` and matching MIME type.
- `DELETE /api/admin/notices/:id/attachments/:attachmentId`: attachment removal.

All administrator endpoints check the authenticated role; mutation requests also check same-origin indicators. Public JSON excludes internal actor IDs and storage filenames. Download responses use attachment disposition, no-store and nosniff. Category/target/date validation and pinned-before-pagination ordering are server-enforced.

## Verification

`tests/noticePlatform.test.js` covers storage, validation, HTTP, uploads and deterministic concurrency regressions. `tests/noticeServer.test.js` exercises real authenticated server sessions. Browser tests use isolated in-memory stores and temporary files, never production notices.
