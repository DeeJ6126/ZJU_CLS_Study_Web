# Complete Demo Accounts Design

## Goal

Turn the existing front-end-only identity switcher into a complete local demo environment. A visitor should be able to select any non-guest demo identity and try the account-facing product without being blocked merely because the identity is a demo.

Demo actions must never mutate the real backend session or production data.

## Scope

The four non-guest demo identities receive separate, realistic datasets:

- profile and avatar
- private course list
- favorites
- published and archived posts
- submissions in representative review states
- authored comments
- notifications
- quiz data continues to use the existing browser-local behavior

The administrator demo identity can review demo submissions. Approval and rejection update the affected student's demo data and create a notification. This shared review workflow remains entirely local to the browser.

The demo environment also supports avatar upload, XLSX timetable preview/import, profile edits, CC98 binding display changes, post revision, post archive, submission editing, withdrawal and deletion, favorite removal, comment editing/deletion, notification read state, and resetting the active demo identity.

Real registration, SMTP verification, CC98 verification, password recovery, server uploads, and production authorization are outside the demo implementation. Those security-sensitive flows continue to require the backend.

## Architecture

Add a focused service under `src/services/` that owns demo account behavior. Components remain presentational and continue to receive data and emit events.

The service provides:

- versioned seed data
- per-identity reads and writes
- shared demo submission review state
- localStorage persistence and schema reset
- immutable public-profile projections
- validation and result objects matching the existing API-client conventions
- browser-side avatar and XLSX processing helpers

`App.vue` remains the orchestration point for this phase. At each existing account operation it selects either the demo service or the existing API client based on the active identity. This keeps the real-account path unchanged and avoids putting demo decisions inside display components.

Demo public profile routes use the existing `#profile/<publicId>` contract. Known demo public IDs resolve locally; unknown and real public IDs continue through `profileApiClient`.

## Data Model

The localStorage document has a schema version and normalized account map:

```txt
{
  version,
  accounts: {
    "demo-cc98": { profile, courses, favoriteIds, posts, submissions, comments, notifications },
    "demo-email": { ... },
    "demo-dual": { ... },
    "demo-admin": { ... }
  },
  moderation: { submissions }
}
```

Seeds use real course codes and existing content routes. Each identity has a distinct academic persona and data mix so identity isolation is visible when switching accounts. Public projections expose only nickname, avatar, public ID, and published posts.

Seed changes use a schema-version migration policy. An incompatible version resets demo state only; it never clears unrelated localStorage keys.

## Interaction Rules

- Selecting a demo identity immediately changes the visible account and loads its local datasets.
- The personal-page button navigates to the selected demo identity rather than the real session.
- Demo operations return normal success or validation feedback and persist across reloads.
- Destructive actions use the existing UI action path and affect only the active identity's local records.
- Admin review can approve or reject demo submissions from any demo student.
- Approval publishes or revises the target content and notifies the submitter.
- Rejection preserves the submission with a review note and notifies the submitter.
- Reset restores only the currently selected demo identity and repairs shared moderation references for that identity.
- Every demo-management surface displays a concise notice that data is local and cannot affect the server.

## Files And Uploads

Avatar input accepts JPEG, PNG, or WebP within the existing size limit. The browser reads it as a Data URL for local preview and persistence. This is a demo approximation; real metadata stripping and WebP normalization remain backend-only.

XLSX import uses the installed `read-excel-file` browser entry. It scans for the same required timetable headers, merges repeated course meetings, retains unmatched courses, presents a preview, and writes only after confirmation. The original workbook is never persisted.

## Error Handling

The demo service uses the existing `{ ok, message, ...data }` result style. It handles unavailable or quota-limited localStorage by keeping an in-memory state for the current session and showing a non-blocking persistence warning. Invalid images, workbooks, edits, and impossible state transitions return user-facing validation messages without falling through to the backend.

## Testing

Add focused tests for:

- deterministic seed creation and distinct identities
- persistence, schema reset, and active-account reset
- public/private profile projections
- course, favorite, post, submission, comment, and notification mutations
- cross-identity administrator approval and rejection
- prevention of demo requests reaching real API clients through App wiring checks
- avatar validation and timetable parsing
- profile and account switcher demo controls

Run `npm.cmd test`, `npm.cmd run build`, and `npm.cmd run check` after implementation.

## Documentation

Update the closest service/component READMEs and `PROJECT_STATUS.md` after verification. Clarify that demo identities are complete browser-local sandboxes rather than display-only role previews.
