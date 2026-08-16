# PROJECT_STATUS.md

This file is the short-term recovery point for future AI sessions. Keep it current, factual, and brief.

## Current State

- The project is a Vue 3 + Vite + plain CSS learning-resource platform for ZJU life-science students.
- The app currently has a lightweight demo shell with top-level pages including `首页`, `概览`, `刷题`, and `关于`.
- The homepage now centers course search, supports `课程 / 资料 / 题库 / 活动 / 用户` search modes, and gives student-union activities more space than the compact popular-resource list.
- The overview page now lists all catalog courses under `专业基础课程 / 专业课 / 通识课`, supports deeper professional-course groups, and can filter the normalized 2024 curriculum by category or eight semester periods.
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

## Known Good Verification

Last known passing commands:

```bash
npm.cmd test
npm.cmd run build
npm.cmd run check
```

On 2026-08-02, all 212 tests passed, the Vite production build passed, and
`npm.cmd run check` produced a passing project report. The production dependency
audit completed from the local advisory cache with zero reported vulnerabilities.

## Deferred Or Not Yet Production-Ready

- Production authentication hardening: HTTPS/proxy cookie policy, secret rotation, SMTP monitoring, backups, and stronger anti-abuse controls.
- More course quiz migrations beyond the three current quiz courses.
- Final deployment hardening under `/var/www/html/zjubio/`.
- Content version history, automated backups, and multi-level administrator permissions.
- The overview UI is intentionally an initial layout; 2023 and 2025 curriculum mappings remain disabled until their legacy/new course codes are normalized. Course detail layout is deferred for a later redesign.

## Recovery Order For Future AI

1. Read `AGENTS.md`.
2. Read this file.
3. Read `docs/project-guides/index.md`.
4. Read `docs/project-guides/decisions.md`.
5. Read the closest README in the directory being edited.
6. For quiz work, read the Quiz Handoff Docs listed in `AGENTS.md`.

## Update Rule

Update this file when a task changes project status, leaves a known limitation, completes a major phase, or changes the recommended next recovery step.
