# Account Profile System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add numeric student-email authentication, unique user profiles and avatars, secure CC98 rebinding, public profile pages, user search, and owner-managed post revisions.

**Architecture:** Extend `auth.sqlite` for profile identity and avatar metadata while retaining `content.sqlite` for posts and moderation. Join the two stores in the HTTP service by immutable internal user ID and expose only random public profile IDs. Keep Vue components presentational and route all rules through services.

**Tech Stack:** Vue 3, Vite, JavaScript ESM, Node HTTP, Node SQLite, Sharp, Node test runner, plain CSS.

---

### Task 1: Numeric Email And Profile Identity

**Files:**
- Modify: `tests/emailAuth.test.js`
- Modify: `tests/serverAuth.test.js`
- Modify: `server/authStore.js`
- Modify: `server/authService.js`
- Modify: `server/emailAuthService.js`

- [ ] Add failing tests proving the email local part is digits only, registration accepts `{ studentId, nickname, code, password }`, nicknames are case-insensitively unique, and legacy users receive stable random public IDs.
- [ ] Run `node --test tests/emailAuth.test.js tests/serverAuth.test.js` and confirm failures are caused by the missing profile fields and student-ID parser.
- [ ] Add `public_id`, `nickname_normalized`, avatar columns and unique indexes through idempotent migration. Add store lookups and profile update methods.
- [ ] Replace arbitrary email normalization with a student-ID parser that constructs `${studentId}@zju.edu.cn`; validate nicknames with `^[\p{L}\p{N}_-]{2,20}$` and reserved-name checks.
- [ ] Run the focused tests and confirm they pass.

### Task 2: CC98 Binding And Session Security

**Files:**
- Modify: `tests/emailAuth.test.js`
- Modify: `tests/serverHttp.test.js`
- Modify: `server/authStore.js`
- Modify: `server/authService.js`
- Modify: `server/server.js`

- [ ] Add failing tests for password-confirmed CC98 binding/rebinding, nickname locking, old identity release, collision rejection, and revocation of every session except the current one.
- [ ] Run the focused tests and verify the new cases fail.
- [ ] Add a transactional identity replacement method and a `deleteOtherSessions(userId, currentSessionId)` store method.
- [ ] Add `PUT /api/account/cc98`, requiring login, current password, and an unused verification code.
- [ ] Run the focused tests and confirm they pass.

### Task 3: Avatar Processing

**Files:**
- Create: `server/profile/avatarService.js`
- Create: `tests/profileAvatar.test.js`
- Modify: `server/server.js`
- Modify: `.env.example`
- Modify: `package.json`

- [ ] Add failing tests for JPEG/PNG/WebP acceptance, 2 MB rejection, invalid file headers, 512×512 WebP output, replacement cleanup, and safe response headers.
- [ ] Run `node --test tests/profileAvatar.test.js` and verify it fails before implementation.
- [ ] Install `sharp`, decode and re-encode uploads to metadata-free WebP, and store random filenames under `PROFILE_AVATAR_DIR`.
- [ ] Add authenticated `PUT/DELETE /api/account/profile/avatar` and public `GET /api/profile-avatars/:storedName`.
- [ ] Run the avatar tests and confirm they pass.

### Task 4: Public Profiles And Owner Post Management

**Files:**
- Modify: `server/content/contentStore.js`
- Modify: `server/content/contentHttpService.js`
- Create: `server/profile/profileService.js`
- Create: `tests/profilePlatform.test.js`
- Modify: `server/server.js`

- [ ] Add failing tests for public profile privacy, published-only post lists, owner post status lists, pending edits, rejected resubmission, published revisions, conflicts, archive actions, and audit logs.
- [ ] Run `node --test tests/profilePlatform.test.js` and verify the cases fail.
- [ ] Migrate content ownership and revision columns; retain owner IDs when submissions become published content.
- [ ] Add public profile/search handlers and authenticated profile/post-management handlers with ownership checks.
- [ ] Ensure approved revisions update the target item while rejected revisions leave the published item unchanged.
- [ ] Run profile, submission, content, and HTTP tests and confirm they pass.

### Task 5: Frontend Account And Profile Experience

**Files:**
- Modify: `src/components/account/AuthDialog.vue`
- Modify: `src/components/account/AccountPopover.vue`
- Create: `src/components/profile/ProfilePage.vue`
- Create: `src/services/profileApiClient.js`
- Modify: `src/services/authApiClient.js`
- Modify: `src/services/homeSearchService.js`
- Modify: `src/services/demoNavigationService.js`
- Modify: `src/App.vue`
- Modify: `src/styles/auth.css`
- Create: `src/styles/profile.css`
- Modify: `src/main.js`
- Create: `tests/profileUi.test.js`

- [ ] Add failing source-contract and service tests for the fixed email suffix, registration nickname, profile route, user search, avatar controls, public/private states, and author profile links.
- [ ] Run the focused UI tests and verify failures.
- [ ] Implement student-ID inputs with a fixed `@zju.edu.cn` suffix and add the registration nickname field.
- [ ] Add the profile API client and hash route, account-panel entry, public profile view, self-management sidebar, avatar upload, and post status views.
- [ ] Add user results to homepage search and link owned post authors to their public profile.
- [ ] Apply the current green academic visual language and responsive layout.
- [ ] Run focused UI tests and `npm.cmd run build`.

### Task 6: Migration, Documentation, And Verification

**Files:**
- Modify: `server/README.md`
- Modify: `src/services/README.md`
- Modify: `src/components/README.md`
- Modify: `src/styles/README.md`
- Modify: `docs/project-guides/security-and-auth.md`
- Modify: `docs/project-guides/data-contracts.md`
- Modify: `PROJECT_STATUS.md`

- [ ] Document numeric student-email rules, nickname rules, avatar persistence, public-profile privacy, CC98 rebinding, post revision behavior, and deployment variables.
- [ ] Run `npm.cmd test` and require zero failed tests.
- [ ] Run `npm.cmd run build` and require exit code 0.
- [ ] Run `npm.cmd run check` and require a passing project report.
- [ ] Verify desktop and 390px mobile profile/account layouts, image rendering, author links, search, and console errors in the browser.
