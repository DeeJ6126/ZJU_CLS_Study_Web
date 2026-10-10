# src/components

Vue display components.

## Purpose

Components should render props, hold local UI state, and emit events upward. Keep business rules and durable data decisions outside this folder.

## Main Pages

- `HomePage.vue`: homepage search entry, API-backed featured activity feed, and compact static popular-resource list.
- `ActivityPage.vue`: published activity directory, category filters, source imagery, and stable activity-detail hashes.
- `AboutPage.vue`: renders a section sidebar beside the sanitized author-written fragments under `public/content/about/`. Sidebar entries come from `src/data/config/aboutSections.js`, and the active section is kept in the `#about?section=` hash.
- `MorePage.vue`: supplementary public directory at `#more`, initially containing student homepages and their authenticated submission form. Management and moderation remain in the administrator More workspace.
- `OverviewPage.vue`: course catalog, curriculum selector, category grouping, and semester grouping.
- `admin/AdminPage.vue`: hidden-route administrator login plus course-content, moderation, audit-log, and activity maintenance UI.
- `admin/AdminContentBatchPanel.vue`: administrator JSON preview/confirmation and course/type-filtered exports, sharing the main workspace theme and navigation guards.
- `ConsultationPage.vue`: visitor and mentor chat views for scheduled consultation sessions.
- `NoticePage.vue`: public notice search, filters and details; `admin/NoticeAdminPanel.vue` maintains drafts, published notices and downloadable attachments.
- `ContributionBox.vue`: authenticated course submission form that sends review-ready fields upward.
- `MyCourseGrid.vue` / `MyCourseEditor.vue`: shared homepage/personal course cards and full-catalog name/code search, with hover/focus removal and visible touch controls; persistence stays in App/services.
- `account/AuthDialog.vue`: numeric student-ID login, registration and recovery. The header goes directly to login/personal pages and exposes a Lucide notification bell; owner profile pages provide logout and administrator shortcuts. The old account popover is unmounted.
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
