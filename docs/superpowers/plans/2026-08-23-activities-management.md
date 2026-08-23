# Activities Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the activity placeholder with a source-backed activity experience and add convenient administrator management for the activity page and homepage recent activities.

**Architecture:** A dedicated activity table and API own durable records. A public browser client reads published records with a static JSON fallback, while the existing admin page and demo admin adapter use matching activity CRUD methods.

**Tech Stack:** Vue 3, JavaScript ESM, plain CSS, Node.js HTTP, Node SQLite, Node test runner, Playwright.

---

### Task 1: Source Catalog And Assets

**Files:**
- Create: `public/content/activities/catalog.json`
- Create: `public/assets/activities/*`
- Modify: `src/data/homeContent.js`
- Test: `tests/activityCatalog.test.js`

- [ ] **Step 1: Write a failing catalog test**

Assert that the six source-backed activities have unique slugs, valid categories, summaries and bodies, accessible images, stable display order, and no unsupported schedule fields.

- [ ] **Step 2: Run `node --test tests/activityCatalog.test.js` and confirm failure**

- [ ] **Step 3: Add the JSON catalog and extract selected DOCX images**

Use these category IDs: `frontier`, `learning`, `community`, and `exchange`. Use `#activities/<slug>` for every activity link and retain `homePopularResources` unchanged.

- [ ] **Step 4: Run the catalog test and confirm it passes**

### Task 2: Activity Store, Validation, And HTTP API

**Files:**
- Create: `server/activity/activityService.js`
- Create: `server/activity/activityHttpService.js`
- Modify: `server/content/contentStore.js`
- Modify: `server/server.js`
- Test: `tests/activityPlatform.test.js`
- Test: `tests/serverHttp.test.js`

- [ ] **Step 1: Write failing service/store tests**

Cover create, partial update, publish, archive, feature toggle, integer ordering, `listPublishedActivities`, `listFeaturedActivities`, and idempotent catalog seeding.

- [ ] **Step 2: Run focused tests and confirm the missing APIs fail**

- [ ] **Step 3: Add the activity table and validation service**

Use the fields and limits from the design. Map database rows to camelCase and sort published results by `display_order`, then `updated_at desc`, then `id`.

- [ ] **Step 4: Add public and administrator endpoints**

Implement `GET api/activities`, `GET api/activities/:slug`, `GET api/admin/activities`, `POST api/admin/activities`, `PATCH api/admin/activities/:id`, and `POST api/admin/activities/:id/publish|archive`. Reuse the existing administrator authorization and audit log store.

- [ ] **Step 5: Seed the catalog during server startup and run focused tests**

### Task 3: Public Client And Activity Page

**Files:**
- Create: `src/services/activityApiClient.js`
- Create: `src/components/ActivityPage.vue`
- Create: `src/styles/activities.css`
- Modify: `src/services/demoNavigationService.js`
- Modify: `src/App.vue`
- Modify: `src/main.js`
- Test: `tests/activityUi.test.js`

- [ ] **Step 1: Write failing client and component contract tests**

Verify API-first/static-fallback semantics, nested activity hash parsing, category filters, active detail rendering, image alt text, and absence of speculative dates.

- [ ] **Step 2: Implement the public client**

Return API data when the response is successful, including a valid empty list. Fetch `/content/activities/catalog.json` only after transport or non-OK API failure.

- [ ] **Step 3: Build the responsive activity page**

Render a restrained editorial index with source images, four filter controls, stable cards, and an in-page story detail selected by route slug.

- [ ] **Step 4: Wire the route through `App.vue` and run focused tests**

### Task 4: Homepage Recent Activities

**Files:**
- Modify: `src/components/HomePage.vue`
- Modify: `src/data/homeContent.js`
- Modify: `src/styles/home.css`
- Test: `tests/demoShell.test.js`
- Test: `tests/homeSearchService.test.js`

- [ ] **Step 1: Write failing homepage assertions**

Require `HomePage` to load published featured activities through the activity client, link `全部活动` to `#activities`, and keep the popular-resource list unchanged.

- [ ] **Step 2: Replace static recent activity rendering with shared records**

Use the top three featured records and include the complete published activity list in activity-mode search.

- [ ] **Step 3: Run homepage tests**

### Task 5: Administrator Activity Workspace

**Files:**
- Modify: `src/services/adminApiClient.js`
- Modify: `src/components/admin/AdminPage.vue`
- Modify: `src/styles/admin.css`
- Modify: `src/services/demoAccountService.js`
- Test: `tests/adminPlatform.test.js`
- Test: `tests/demoAccountService.test.js`

- [ ] **Step 1: Add failing API and UI contract tests**

Require activity list/create/update/publish/archive methods plus title, category, image, alt, homepage recommendation, order, status, and search controls.

- [ ] **Step 2: Extend the real admin client and page**

Add a dedicated `活动管理` view and activity editor without changing course content, submissions, or popular resources.

- [ ] **Step 3: Extend the demo administrator adapter**

Store demo activities in the administrator demo account, keep local persistence isolated, and expose API-shaped methods identical to the real client.

- [ ] **Step 4: Run admin and demo tests**

### Task 6: Documentation And End-To-End Verification

**Files:**
- Modify: `src/components/README.md`
- Modify: `src/data/README.md`
- Modify: `src/services/README.md`
- Modify: `server/README.md`
- Modify: `server/content/README.md`
- Modify: `PROJECT_STATUS.md`
- Create: `project-checks/evaluators/browser/activity-management-flow.spec.js`

- [ ] **Step 1: Add browser flows**

Open `#activities/lab-open-day`, verify the source-backed story and image, then use the demo administrator to archive or feature an activity and verify the public surfaces update after reload.

- [ ] **Step 2: Update handoff documentation**

Document the activity source, API/store boundary, homepage feature rules, fallback semantics, and demo behavior.

- [ ] **Step 3: Run `git diff --check` and focused tests**

- [ ] **Step 4: Run full verification**

Run `npm.cmd test`, `npm.cmd run build`, `npm.cmd run check`, and `npm.cmd run check:browser`; all must exit zero.

- [ ] **Step 5: Review the final diff**

Confirm all initial public claims are traceable to the supplied DOCX, popular resources are unchanged, Vue files contain no long activity bodies, and public endpoints expose only published activities.
