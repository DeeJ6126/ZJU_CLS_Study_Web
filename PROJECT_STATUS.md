# PROJECT_STATUS.md

This file is the short-term recovery point for future AI sessions. Keep it current, factual, and brief.

## Current State

- The project is a Vue 3 + Vite + plain CSS learning-resource platform for ZJU life-science students.
- The app currently has a lightweight demo shell with top-level pages including `首页`, `概览`, `刷题`, and `关于`.
- The homepage now centers course search, supports `课程 / 资料 / 题库 / 活动 / 用户` search modes, and gives student-union activities more space than the compact popular-resource list.
- The overview page now lists all catalog courses under `专业基础课程 / 专业课 / 通识课`, supports deeper professional-course groups, and can filter the normalized 2024, 2025, and 2026 curricula by category or twelve semester periods (each year's autumn-winter, spring-summer, and short term).
- The quiz feature is now mostly complete for the current phase:
  - `BIO2023M` molecular biology review
  - `BIO2019F` botany slice identification
  - `BIO2110F` microbiology final review
- Quiz practice now uses a shared course shell, shared practice layout, shared question views, backend grading, answer locking, and safe answer-return rules.
- Quiz handoff docs are in place under `src/components/quiz/`, `src/services/`, `src/data/`, `public/resource/quiz/`, `server/quiz/`, and `tests/`.
- Project management docs have been renamed to `docs/project-guides/`, and the preferred check commands are now `npm.cmd run check*`.

## Recently Completed

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
- Authenticated students can submit course content for review; approved submissions publish immediately through the shared content store.
- Published posts support optional CC98 links, click-to-reveal GPA, and anonymous browser-scoped likes.
- The account system now accepts only numeric student IDs for `@zju.edu.cn` registration/login, supports unique nicknames, random public profile IDs, avatar uploads, CC98 binding/rebinding, password recovery, masked email display, expiring sessions, and server-side verification-code limits.
- Public personal pages expose only nickname, avatar, and published posts. Signed-in users can manage profile details, review their submission states, archive published posts, and submit revisions without removing the live version before approval.
- Course-content cards and article author names link to owned public profiles; static imported content remains unowned and compatible.
- ZJU email delivery uses backend-only SMTP environment variables; real mailbox credentials are intentionally absent from the repository.
- Signed-in accounts now synchronize quiz progress, mistakes, vocabulary, content favorites, private course lists, comments, and notifications through the Node backend.
- Personal pages now include course-list XLSX import, favorites, owned posts/submissions, and authored-comment management; the sample timetable is verified as 15 unique courses with 3 duplicate groups merged and 6 catalog matches retained alongside 9 unmatched courses.
- Published experiences, materials, and papers now share identified one-level comments, owner edit/delete actions, author profile links, and comment/reply notifications.
- The hidden `#notifications` route provides recent messages and read state; submission decisions, new content comments, and replies create notifications without email delivery.
- Added 2025 and 2026 BIO course programs (parsed from the program PDFs via MinerU), extended the semester vocabulary to twelve periods with per-year short terms, and enabled both in the overview selector.
- Renamed the project check system folder to `project-checks/` and purged the former folder name from folder names, file names, and file contents.
- Added a demo identity switcher in the account popover so developers can preview guest, cc98-only, email-only, dual-auth, and admin views without registering real accounts.
- Hardened login with an in-memory brute-force guard (per-account lock and per-ip throttle), Secure session cookies behind HTTPS, forwarded-ip trust for rate limits, and a `/api/health` liveness endpoint.
- Added a public deployment checklist at `docs/deployment-checklist.md` covering code hardening, server setup, security, data, launch verification, and weekly ops.
- Fixed the GitHub Actions workflow to run `npm run check` (the old script name did not exist) and applied `npm audit` fixes (zero vulnerabilities).
- Required `npm.cmd run check:architecture` / `run check:routes` / `run check:content` / `run check:themes` as the local architecture and content-location gates.

## Known Good Verification

Last known passing commands:

```bash
npm.cmd test
npm.cmd run build
npm.cmd run check
```

On 2026-08-23, all 231 tests passed and the project checks pipeline
(`npm.cmd run check`) produced a passing report. The dependency audit
reported zero vulnerabilities after `npm audit fix`.

## Deferred Or Not Yet Production-Ready

- Production authentication hardening: HTTPS/proxy cookie policy, secret rotation, SMTP monitoring, backups, and stronger anti-abuse controls.
- More course quiz migrations beyond the three current quiz courses.
- Final deployment hardening under `/var/www/html/zjubio/`.
- Content version history, automated backups, and multi-level administrator permissions.
- The overview UI is intentionally an initial layout; the 2023 curriculum is omitted because it used legacy numeric course codes with no BIO-encoded courses. Course detail layout is deferred for a later redesign.

## Recovery Order For Future AI

1. Read `AGENTS.md`.
2. Read this file.
3. Read `docs/project-guides/index.md`.
4. Read `docs/project-guides/decisions.md`.
5. Read the closest README in the directory being edited.
6. For quiz work, read the Quiz Handoff Docs listed in `AGENTS.md`.

## Update Rule

Update this file when a task changes project status, leaves a known limitation, completes a major phase, or changes the recommended next recovery step.
