# src/components

Vue display components.

## Purpose

Components should render props, hold local UI state, and emit events upward. Keep business rules and durable data decisions outside this folder.

## Main Pages

- `HomePage.vue`: homepage search entry, API-backed featured activity feed, and compact static popular-resource list.
- `ActivityPage.vue`: published activity directory, category filters, source imagery, and stable activity-detail hashes.
- `OverviewPage.vue`: course catalog, curriculum selector, category grouping, and semester grouping.
- `admin/AdminPage.vue`: hidden-route administrator login plus course-content, moderation, audit-log, and activity maintenance UI.
- `ContributionBox.vue`: authenticated course submission form that sends review-ready fields upward.
- `account/AccountPopover.vue` and `account/AuthDialog.vue`: account status and numeric student-ID email authentication forms; API work and permission decisions remain in the app/service layer.
- `account/AccountSwitcher.vue`: switches between the real session and isolated browser-local demo accounts, and can reset the active demo account.
- `account/NotificationsPage.vue`: account-only message list and read actions.
- `profile/ProfilePage.vue`: public post view and the owner's course, favorite, post, submission, comment, and avatar controls.
- `CommentSection.vue`: identified one-level discussion UI; durable operations are emitted to the service layer.

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

## Profile

`profile/ProfilePage.vue` renders both the public published-post view and the signed-in
owner workspace. Authentication and ownership decisions are passed in as props; API
calls remain in `App.vue` and shared services.

When `isDemo` is true, the profile page only adds a local-data notice. Demo
persistence and mutations remain outside the component.
