# PROJECT_STATUS.md

This file is the short-term recovery point for future AI sessions. Keep it current, factual, and brief.

## Current State

- The project is a Vue 3 + Vite + plain CSS learning-resource platform for ZJU life-science students.
- The app currently has top-level pages for `首页`, `概览`, `刷题`, `活动`, `通知`, `咨询`, `关于`, and `更多`, plus hash-routed course/notice details, activity details, public/owner profiles, private account messages, and a hidden administrator workspace.
- The homepage now centers search across `课程 / 资料 / 题库 / 活动 / 用户`; the `资料` mode queries published backend posts with course, type, teacher, and year filters plus pagination, while the other modes retain their focused indexes.
- The overview page now lists all catalog courses under `专业基础课程 / 专业课 / 通识课`, supports deeper professional-course groups, and can filter the normalized 2024, 2025, and 2026 curricula by category or twelve semester periods (each year's autumn-winter, spring-summer, and short term).
- The quiz feature is now mostly complete for the current phase:
  - `BIO2023M` molecular biology review
  - `BIO2019F` botany slice identification
  - `BIO2110F` microbiology final review
- Quiz practice now uses a shared course shell, shared practice layout, shared question views, backend grading, answer locking, and safe answer-return rules.
- Quiz handoff docs are in place under `src/components/quiz/`, `src/services/`, `src/data/`, `public/resource/quiz/`, `server/quiz/`, and `tests/`.
- The Node backend now spans authentication, account data, profiles, content and moderation, activities, cross-source search, student-homepage directory APIs, and quizzes. Student homepages are displayed and submitted in More, with management and moderation nested under the administrator More workspace.
- The public account model now has exactly three product roles: guest, student-ID-verified student, and administrator. CC98 endpoints remain backend-only for compatibility and no longer independently grant persistent-write permissions.
- The consultation room now supports administrator-scheduled hours, a verified assigned mentor, isolated guest or account conversations, mentor inboxes, and polling-based message alerts.
- Project management docs have been renamed to `docs/project-guides/`, and the preferred check commands are now `npm.cmd run check*`.

## Recently Completed

- Overview outline navigation now follows the rendered curriculum hierarchy, including professional requirements, modules and directions with indented labels. Repeated A/B required/elective course leaf labels remain in the main content but not the sidebar. Directory anchors stay aligned with module choices, available-course filtering and the semester view.
- Fixed notification read actions to send the required JSON envelope, with real client/server regression coverage. Owner profiles display one nickname and a read-only student-ID-derived cohort; the footer opens nickname editing only on demand. Avatar upload is a hover/focus overlay on the image, not a separate button. Verified-account cohort edits are rejected by both profile APIs, while guest-local setup remains editable. About is the last navigation entry. Registered palette color tokens interpolate once for 650ms, preserving the original toggle animation and respecting reduced-motion preferences.
- Removed the clickable account popover. The header name opens login or the own personal page; a Lucide bell with an unread dot opens private messages and refreshes counts periodically. Logout lives at the bottom of the owner profile, while only owner administrators see a management shortcut. AuthDialog retains direct registration and recovery links.
- Added private plain-text feedback under About Us, including guest submission, server validation/rate limits, administrator-only paginated reading and per-page unread receipts. Feedback shares the existing content database and backup coverage. Administrator sidebar dots now cover all course submission types, More homepage applications, and unread feedback, with periodic badge refresh. About Site precedes About Us; contributor avatars are distinct locally bundled GitHub snapshots.
- About Us now exposes the requested responsible-person avatar and mailto contact. The former acknowledgements section is Contributors, showing GitHub avatars/logins ordered by the official contributor API's commit totals. The 2026-10-02 snapshot provenance is retained in the HTML comment/data attributes; old `section=thanks` links remain compatible.
- Added More after About in the top navigation. It restores the student-homepage directory, external links and name/avatar/link submissions through the existing API; guests use the shared login entry. The administrator More workspace contains homepage CRUD and application review. No other supplementary categories or new data stores are introduced.
- Removed the academic-voyage activity program. Homepage recent activities now require an explicit administrator recommendation; new/seeded records default off, offline fallbacks never recommend records, and the release clears previous recommendations once without deleting posts. The activity editor supports enabling/disabling homepage display. Homepage search now aligns with the full My Courses content width.
- Merged the `activity` and `about` branches and applied the approved Minimal professional presentation to all public, account, administrator, quiz and course-content pages. The site now shares neutral surfaces, teal accents, 4px controls, locally bundled Outfit/Space Grotesk fonts and light/dark tokens. The animated ThemeSwitch remains unchanged. Homepage search, My Courses, last practice and activity links remain functional; Markdown/UBB readers share typography while preserving author formatting. Browser acceptance also caught and fixed missing activity-search and activity-detail imports.
- Homepage and personal workspace now share one editable My Courses list. First setup seeds current-term professional/foundation curriculum sections; optional electives remain searchable in the full course picker. Guests persist locally and verified accounts persist in auth SQLite with an initialization marker so removing all courses never silently reseeds them. Existing imported lists are preserved; explicit preset reset requires confirmation. Course favorites remain separate.
- Added administrator-maintained public notices with category/major/cohort/deadline filters, pagination, pinned ordering, safe Markdown details, source links and PDF/DOCX/XLSX attachments. Drafts and archived content remain private; no application, comment or submission workflow is exposed. Notice data and files reuse existing production backup coverage.
- Added freely editable teacher-name suggestions to resource search, course submissions, and administrator content forms. Suggestions use the course teacher catalog, narrow by course and name prefix, and highlight the prefix without requiring a listed teacher for submission.
- Added a course-overview teacher list from a pinned Chalaoshi data snapshot, covering 120 of 131 site courses. Microbiology theory and lab share the original combined-course list; unmatched courses remain explicitly empty.
- Added optional major/cohort setup for guests, browser-local course/content favorites, current-semester suggestions below homepage search, and resumption of the last quiz session. Verified accounts synchronize study preferences and read their latest practice from the backend. Course-resource lists and articles now show applicable teacher/year metadata.
- Replaced the homepage's three hardcoded resource-search suggestions with paginated published-content search and canonical post links. Resource search relates historical `BIO2009F` microbiology posts to the split `BIO2110F` / `BIO2113F` courses without moving their original records.
- Added a dedicated consultation SQLite store, scheduled open/close controls in the administrator workspace, a responsive visitor/mentor chat page, server-issued guest cookies, access checks, rate limits, and backup coverage.

- Migrated quiz data and assets from the standalone molecular biology, botany, and microbiology quiz projects.
- Built backend quiz import, SQLite storage, sessions, grading, reveal, self-judgement, progress, mistakes, reset, molecular review terms, and microbiology past-exam APIs.
- Migrated the three quiz experiences into the main site without iframe usage.
- Unified the core quiz practice skeleton across the three courses.
- Added quiz-specific handoff documentation and test maps.
- Replaced the sparse homepage placeholder with a responsive search-and-activity homepage backed by the shared course catalog and focused homepage data.
- Replaced visible project-management wording with neutral project-guide and project-check wording while preserving the underlying checks.
- Added BOM-tolerant parsing for project JSON checks and Markdown frontmatter.
- Added the first course-overview catalog and 2024 curriculum-program view while preserving course-code resource routes and existing detail pages.
- Added the first administrator platform at `#admin` for course experiences, review materials, and past papers.
- Added server-side administrator roles, content SQLite storage, idempotent Markdown import, publication states, and validated PDF uploads.
- Course detail pages now prefer published backend content and fall back to the existing Markdown only when the backend is unavailable.
- The administrator platform now includes submission moderation, searchable operation logs, and denser course/status/content filters.
- Student-ID-verified students can submit course content for review; approved submissions publish immediately through the shared content store.
- Published posts support optional CC98 source links, click-to-reveal GPA, and student-ID-authenticated likes.
- The visible account system accepts only numeric student IDs for `@zju.edu.cn` registration/login and supports unique nicknames, random public profile IDs, avatar uploads, password recovery, masked email display, expiring sessions, and server-side verification-code limits. Legacy CC98 registration/login/binding remains server-side only.
- Public personal pages expose only nickname, avatar, and published posts. Signed-in users can manage profile details, review their submission states, archive published posts, and submit revisions without removing the live version before approval.
- Course-content cards and article author names link to owned public profiles; static imported content remains unowned and compatible.
- ZJU email delivery uses backend-only SMTP environment variables; real mailbox credentials are intentionally absent from the repository.
- Signed-in accounts now synchronize quiz progress, mistakes, vocabulary, content favorites, private course lists, comments, and notifications through the Node backend.
- Personal pages now include course-list XLSX import, favorites, owned posts/submissions, and authored-comment management; the sample timetable is verified as 15 unique courses with 3 duplicate groups merged and 6 catalog matches retained alongside 9 unmatched courses.
- Published experiences, materials, and papers now share identified one-level comments, owner edit/delete actions, author profile links, and comment/reply notifications.
- The hidden `#notifications` route provides recent messages and read state; submission decisions, new content comments, and replies create notifications without email delivery.
- Added 2025 and 2026 BIO course programs (parsed from the program PDFs via MinerU), extended the semester vocabulary to twelve periods with per-year short terms, and enabled both in the overview selector.
- Renamed the project check system folder to `project-checks/` and purged the former folder name from folder names, file names, and file contents.
- Reduced the demo identity switcher to the three product roles: guest, student-ID-verified student, and administrator.
- The student and administrator demos remain isolated browser-local sandboxes with realistic profiles, courses, favorites, posts, submissions, comments, notifications, avatar uploads, XLSX timetable import, reset controls, and administrator review. Demo writes never reach the backend.
- Replaced the activity placeholder with a source-backed activity directory using six academic-department programs and original images from the supplied recruitment article. Homepage recent activities now read the same published, administrator-ordered records, while popular resources remain unchanged.
- Added a dedicated activity content table and administrator workspace for drafting, editing, categorizing, homepage recommendation, ordering, publishing, and archiving. The demo administrator exercises the same workflow entirely in browser-local state.
- Hardened login with an in-memory brute-force guard (per-account lock and per-ip throttle), Secure session cookies behind HTTPS, forwarded-ip trust for rate limits, and an internal `/api/health` liveness endpoint exposed publicly as `/zjubio/api/health`.
- Added student-ID administrator provisioning through `ADMIN_STUDENT_IDS`, centralized server enforcement for persistent writes, and deployment templates for the observed Apache/Supervisor container layout.
- Added a public deployment checklist at `docs/deployment-checklist.md` covering code hardening, server setup, security, data, launch verification, and weekly ops.
- Fixed the GitHub Actions workflow to run `npm run check` (the old script name did not exist) and applied `npm audit` fixes (zero vulnerabilities).
- Required `npm.cmd run check:architecture` / `run check:routes` / `run check:content` / `run check:themes` as the local architecture and content-location gates.
- Added a backend cross-source search endpoint for courses, published content, activities, and approved student homepages, plus a frontend search client. The current homepage still uses its focused local search index (and profile lookup for users); the former global `SearchBar` is no longer mounted.
- Added backend storage, public/application APIs, administrator moderation, and search indexing for the student-homepage directory. Frontend directory and moderation surfaces remain to be implemented.
- Consolidated the frontend API clients around `src/services/apiClient.js` and completed the 2026-09-05 critical/high-priority security, state-isolation, navigation, modal, and interaction fixes recorded in `docs/audits/2026-09-05-new-round-audit.md`.
- Deployed the application with the isolated Node.js 22 runtime, Supervisor-managed backend, container Apache API proxy, bounded Node logs, zero-vulnerability production dependency lock, verified ZJU SMTP delivery, and a validated SQLite/upload snapshot under `/data/zjubio/backups/`.

## Known Good Verification

Current known verification:

The More/student-homepage release passed all 506 Node tests, 36 production-preview browser tests, the build and project checks. The new flows cover guest login entry, safe external links, avatar processing, failed-submission retention, administrator creation, approval and rejection.

The follow-up activity/homepage update passed 503 Node tests, all 34 production-preview browser cases, the build and project checks. Administrator recommendation/withdrawal and the initially empty homepage feed are covered with isolated fixtures.

The 2026-10-02 full-site theme work passed all 502 Node tests, the production build, project checks and all 34 browser tests against the production preview locally. Its 18 new desktop light/dark cases cover homepage/overview, Markdown/UBB articles and contribution forms, administrator review/directories, all three quiz experiences, activity/about, profile/auth, notices and consultation. Existing course/personalization/teacher/notice regressions and production no-demo checks also passed. Browser fixtures use intercepted APIs or isolated in-memory SQLite/temp files; no synthetic content is seeded online.

```bash
npm.cmd test
npm.cmd run build
npm.cmd run check
npm.cmd run check:browser
```

On 2026-09-15, the production-readiness work passed all 380 tests,
`npm.cmd run build`, and `npm.cmd run check` locally. The deployed server passed
the same application suite before the backup scheduler was added; the final
scheduler tests and full suite were then rerun before deployment.

The dependency audit last reported zero vulnerabilities after `npm audit fix`.

The browser check also passed six Chromium flows, including persistent demo
account course changes/reset, administrator approval publishing into the
student demo profile, source-backed activity rendering, and demo activity
homepage recommendation management.

## Deferred Or Not Yet Production-Ready

- Public browser and API traffic share the `/zjubio/` namespace. Apache maps public `/zjubio/api/...` requests to the Node service's internal `/api/...` routes, so this project does not claim the shared host's root `/api/`. Run the external launch gate and create the first administrator account with student ID `3240105782` after deploying this mapping.
- More course quiz migrations beyond the three current quiz courses.
- Content version history and multi-level administrator permissions.
- A deliberate product decision on whether the unmounted cross-source `SearchBar` should return or the endpoint should remain infrastructure-only; the homepage currently keeps its focused search experience.
- The 2023 curriculum is omitted because it used legacy numeric course codes with no BIO-encoded courses.

## Recovery Order For Future AI

1. Read `AGENTS.md`.
2. Read this file.
3. Read `docs/project-guides/index.md`.
4. Read `docs/project-guides/decisions.md`.
5. Read the closest README in the directory being edited.
6. For quiz work, read the Quiz Handoff Docs listed in `AGENTS.md`.

## Update Rule

Update this file when a task changes project status, leaves a known limitation, completes a major phase, or changes the recommended next recovery step.
