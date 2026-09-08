# server

Lightweight Node backend for the current application.

## Current Responsibilities

- Numeric-student-ID `@zju.edu.cn` registration, with legacy CC98 endpoints retained but hidden from the frontend.
- Email/password login, one-time email binding, email-code password recovery, and CC98 rebinding.
- Password hashing.
- Cookie session login/logout.
- SQLite storage in `server/data/auth.sqlite`.
- Quiz collection import, grading, and practice APIs.
- Student practice without login; student-ID-verified account sync for saved progress and mistakes.
- Administrator-only course-content maintenance.
- Published course-content API and controlled PDF delivery.
- Student submission intake and administrator moderation.
- Published activity catalog plus administrator activity drafting, homepage recommendation, ordering, publishing, and archiving.
- Student-ID-verified post likes and administrator operation logs.
- Public profiles, nickname search, avatar uploads, and owner post management.
- Private course lists with XLSX timetable preview/import.
- Account favorites, identified comments/replies, and in-site notifications.
- Cross-device quiz progress, mistakes, vocabulary, and anonymous-session claiming.
- Cross-source search over courses, published content, activities, and approved student homepages.
- Student-homepage directory storage, authenticated applications, and administrator moderation APIs.

## Entry Point

```bash
npm.cmd run server
```

The server listens on `127.0.0.1:5175` by default.

## ZJU email setup

Email verification only sends mail through SMTP; POP3 and IMAP are not used. For
the ZJU mailbox service, create a client-specific password and provide it only to
the process environment:

```powershell
$env:SMTP_HOST="smtp.zju.edu.cn"
$env:SMTP_PORT="994"
$env:SMTP_SECURE="true"
$env:SMTP_USER="your-address@zju.edu.cn"
$env:SMTP_PASSWORD="your-16-character-client-password"
$env:SMTP_FROM_NAME="生科智学"
npm.cmd run server
```

Do not place the real mailbox password or client-specific password in `.env.example`,
Git, screenshots, logs, or frontend code. A personal ZJU mailbox is suitable for
the current small-volume phase, but delivery limits and sender reputation remain
external dependencies. If SMTP is not configured, public browsing and password
login remain available while code sending returns `503`.

Transient SMTP delivery failures are retried once. Logs record only the purpose
and attempt number, never the recipient, verification code, or SMTP credential.

The client sends only a numeric student ID. The server constructs the exact
`${studentId}@zju.edu.cn` address, so aliases and subdomains cannot be registered.
Codes expire after 10 minutes, allow five attempts, and are limited
per address, source IP, and service-wide. The database stores only salted code
hashes and hashed request IPs.

## Administrator setup

Set the numeric student-ID allowlist before starting the server:

```powershell
$env:ADMIN_STUDENT_IDS="3220100000,3230100000"
npm.cmd run server
```

An allowlisted student ID receives the `admin` role only after the corresponding
`@zju.edu.cn` mailbox passes the normal registration-code check. Administrator
passwords must be at least 10 characters. Existing allowlisted email accounts are
promoted on server startup. The management page is available at `#admin` and is
intentionally absent from student navigation. `ADMIN_CC98_NAMES` and
`ADMIN_INVITE_TOKEN` remain available only for legacy backend provisioning.

Optional persistent-path settings:

```powershell
$env:AUTH_DB_FILE="server/data/auth.sqlite"
$env:QUIZ_DB_FILE="server/data/auth.sqlite"
$env:CONTENT_DB_FILE="server/data/content.sqlite"
$env:CONTENT_UPLOAD_DIR="server/data/content-uploads"
$env:PROFILE_AVATAR_DIR="server/data/profile-avatars"
$env:STUDENT_HOMEPAGE_DB_FILE="server/data/student-homepages.sqlite"
```

Existing Markdown under `public/resource/courses/` is imported idempotently when
the server starts. The original files remain a read-only frontend fallback.

Approved submissions are converted into published `content_items` records. Likes,
favorites, comments, submissions, profile changes, account synchronization, and
student-homepage applications require a verified student ID (or administrator).
Administrator content and moderation mutations are recorded in the operation log.

Activity records use a separate `activity_items` table in the content database.
`public/content/activities/catalog.json` is imported idempotently on startup;
later administrator edits are not overwritten by normal startup seeding.

## Verification Codes

Seed data comes from:

```txt
src/data/config/cc98VerificationCodes.js
```

The server seeds SQLite on startup. Existing code rows are not overwritten by normal seed insertion.

CC98 and email identities share one user account. Existing CC98 users must log in
before binding an email; the service never auto-merges separately registered
accounts. Student passwords require at least 8 characters, while allowlisted
administrator accounts require at least 10. Sessions expire after seven days.

Each account receives a random immutable public profile ID. Email registrants choose
a case-insensitively unique 2–20 character nickname. After CC98 binding, the nickname
is locked to the verified CC98 name. Binding or rebinding CC98 requires the current
password and an unused CC98 code; other sessions are revoked while the current
session remains active.

Avatars accept JPEG, PNG, or WebP up to 2 MB. The backend decodes and re-encodes every
upload as a metadata-free 512×512 WebP under `PROFILE_AVATAR_DIR`. Public profiles
expose only the avatar, nickname, and published posts. Authors can archive their own
published posts immediately; edits create a moderation submission and leave the
current published version visible until approval.

## Account data and timetable imports

Student-ID-verified account endpoints manage private courses, favorites,
notifications, and quiz synchronization. Timetable upload accepts only XLSX files up to 5 MB and
uses `read-excel-file`; the original workbook is never stored. Preview scans the
first 30 rows of every worksheet for the six required headers, merges repeated
course codes, retains unmatched courses, and writes only after confirmation.

Comments are stored in `content.sqlite`, require a verified account, allow one reply
level, and use soft deletion. Notifications are stored in `auth.sqlite` for moderation
decisions, comments on owned content, and replies, but not for likes or favorites.

## Search and student homepages

`GET /api/search` searches the course catalog, published course content, published
activities, and approved student-homepage entries. The backend student-homepage
domain uses its own SQLite file and provides public listing, authenticated
application, and administrator CRUD/moderation endpoints. These endpoints are
tested, but the Vue application does not yet expose a student-homepage directory
or its administrator workflow.

## Deployment Note

The expected server project path is now:

```txt
/var/www/html/zjubio/
```

The server-specific Apache and Supervisor templates, environment-file launcher,
and verified operation order are documented in `deploy/README.md`.

The frontend should be built with `npm run build`, and Apache should serve `dist/` while proxying API requests to the Node backend.

Netlify can serve the static frontend, but it cannot provide durable writes for
this SQLite and filesystem-backed administration phase.

## Checks

```bash
npm.cmd test
npm.cmd run build
```

