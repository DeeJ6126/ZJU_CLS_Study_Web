# Complete Demo Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make every non-guest demo identity a persistent, isolated browser-local account that can exercise profile, course, favorite, post, submission, comment, notification, upload, and moderation workflows without contacting the real backend.

**Architecture:** Add one versioned demo-account repository with API-shaped methods and seeded personas. `App.vue` selects that repository whenever a demo identity is active, while real identities continue using the existing clients. `AdminPage.vue` receives injectable user and API dependencies so the demo administrator reviews local submissions without weakening backend authorization.

**Tech Stack:** Vue 3 Composition API, JavaScript ESM, localStorage, FileReader, `read-excel-file/browser`, Node `node:test`.

---

## File Structure

- Create `src/data/config/demoAccountSeeds.js`: realistic immutable seed records for four demo identities.
- Create `src/services/courseScheduleService.js`: browser-neutral timetable normalization shared by browser and server parsers.
- Create `src/services/demoAccountService.js`: versioned persistence, account/profile mutations, comments, notifications, files, and admin moderation.
- Modify `server/account/courseScheduleService.js`: import shared row normalization while retaining Node upload validation.
- Modify `src/App.vue`: route demo operations through the demo service and refresh local datasets after identity changes.
- Modify `src/components/account/AccountSwitcher.vue`: local-data notice and reset action.
- Modify `src/components/account/AccountPopover.vue`: forward reset action.
- Modify `src/components/profile/ProfilePage.vue`: visible demo-mode notice.
- Modify `src/components/admin/AdminPage.vue`: injectable current user and API client.
- Modify `src/styles/auth.css` and `src/styles/profile.css`: restrained demo notices and reset control.
- Create `tests/demoAccountService.test.js`: repository behavior, isolation, persistence, reset, and moderation.
- Modify `tests/demoIdentityService.test.js`, `tests/profileUi.test.js`, and `tests/adminPlatform.test.js`: UI and orchestration contracts.
- Modify `src/services/README.md`, `src/data/README.md`, `src/components/README.md`, and `PROJECT_STATUS.md`: handoff state.

### Task 1: Shared Timetable Normalization

- [x] **Step 1: Add a failing browser-neutral normalization test**

Add a test that imports `normalizeCourseScheduleRows` from `src/services/courseScheduleService.js` and verifies duplicate meeting merging and catalog matching.

```js
const result = normalizeCourseScheduleRows(rows, { catalogCodes: new Set(['BIO2110F']) });
assert.equal(result.ok, true);
assert.equal(result.courses[0].classTime, '周一1-2;周三3-4');
```

- [x] **Step 2: Run the focused test and confirm the missing-module failure**

Run `node --test tests/accountLearning.test.js` and expect failure because the shared service does not exist.

- [x] **Step 3: Extract pure normalization into `src/services/courseScheduleService.js`**

Export `courseScheduleHeaders` and `normalizeCourseScheduleRows`; keep upload byte and XLSX parsing logic in the Node server module.

- [x] **Step 4: Run `node --test tests/accountLearning.test.js` and expect all tests to pass**

### Task 2: Versioned Demo Repository And Seeds

- [x] **Step 1: Write repository tests for seed realism and identity isolation**

Cover `getAccount`, `getPrivateProfile`, `getPublicProfile`, persistence across service instances, `resetAccount`, and storage failure fallback.

```js
const cc98 = service.getPrivateProfile('cc98');
const email = service.getPrivateProfile('email');
assert.notDeepEqual(cc98.courses, email.courses);
service.removeCourse('cc98', cc98.courses[0].courseCode);
assert.equal(service.getPrivateProfile('email').courses.length, email.courses.length);
```

- [x] **Step 2: Run `node --test tests/demoAccountService.test.js` and confirm failure**

- [x] **Step 3: Add realistic seeds and repository read/reset behavior**

Seed four distinct personas with valid course-code routes, varied content statuses, comments, notifications, and shared moderation IDs. Store only the `study-platform-demo-accounts-v1` key.

- [x] **Step 4: Add profile, course, favorite, post, submission, comment, and notification mutations**

All methods return API-shaped results such as `{ ok: true, courses }` or `{ ok: false, message }` and enforce valid local state transitions.

- [x] **Step 5: Add cross-identity moderation and audit records**

Approval publishes new content or applies a revision, marks the source submission approved, and creates a submitter notification. Rejection records the note and notification.

- [x] **Step 6: Run `node --test tests/demoAccountService.test.js` and expect all tests to pass**

### Task 3: Browser File Workflows

- [x] **Step 1: Add failing tests for avatar validation and workbook-row preview**

Verify supported image MIME and the 2 MB limit. Test timetable preview through an injected workbook reader so Node tests do not require a browser file parser.

```js
const result = await service.previewCourseSchedule('cc98', file, async () => [rows]);
assert.equal(result.ok, true);
assert.equal(result.duplicateGroupCount, 1);
```

- [x] **Step 2: Implement Data URL avatar persistence and browser XLSX parsing**

Use `FileReader` for avatars and `read-excel-file/browser` for workbooks. Feed parsed rows into `normalizeCourseScheduleRows`; never persist the source workbook.

- [x] **Step 3: Run repository and account-learning tests and expect all tests to pass**

### Task 4: Application Demo Routing

- [x] **Step 1: Add App wiring assertions before implementation**

Assert that profile navigation uses `viewer.publicId`, demo branches call `demoAccountService`, and reset is wired from the account popover.

- [x] **Step 2: Route identity switching and account dataset loading locally**

On demo selection, clear stale real-account view state, load the selected courses/favorites/notifications, and reopen the current demo profile when applicable.

- [x] **Step 3: Route profile and account mutations through demo methods**

Cover nickname, avatar, CC98 binding, timetable preview/import, course changes, favorites, posts, submissions, comments, notification reads, and course-detail contribution/comment/favorite actions.

- [x] **Step 4: Add active-demo reset**

Reset only the selected identity, refresh all visible datasets, and preserve the selected identity and unrelated browser state.

- [x] **Step 5: Run `node --test tests/demoIdentityService.test.js tests/profileUi.test.js tests/demoAccountService.test.js` and expect all tests to pass**

### Task 5: Demo Administrator Injection

- [x] **Step 1: Add failing AdminPage contract assertions**

Check for `api-client` and `initial-user` props and ensure direct calls use the injected client.

- [x] **Step 2: Make authentication and API dependencies injectable**

Default props preserve existing real administrator behavior. With the demo administrator, skip backend authentication and use the demo admin adapter for content lists, submissions, review, and logs.

- [x] **Step 3: Pass demo admin dependencies from `App.vue`**

Render the existing `AdminPage` with the selected demo administrator and local adapter. Real mode passes no overrides.

- [x] **Step 4: Run `node --test tests/adminPlatform.test.js tests/demoAccountService.test.js` and expect all tests to pass**

### Task 6: UX, Documentation, And Verification

- [x] **Step 1: Add visible local-demo notices and reset control**

Use concise copy: `演示数据仅保存在当前浏览器，不会提交到服务器。` Add a compact danger-styled text button for resetting the selected identity.

- [x] **Step 2: Update handoff documentation**

Document the demo service boundary, seed location, browser persistence, reset behavior, and completed verification in the relevant READMEs and `PROJECT_STATUS.md`.

- [x] **Step 3: Run formatting and targeted checks**

Run `git diff --check` and the focused demo/profile/admin/account tests; expect zero failures.

- [x] **Step 4: Run full verification**

Run `npm.cmd test`, `npm.cmd run build`, and `npm.cmd run check`; expect all commands to pass.

- [x] **Step 5: Review the final diff**

Confirm no real API security decision moved into components, no backend endpoint accepts demo authority, and only the dedicated demo localStorage key is reset.
