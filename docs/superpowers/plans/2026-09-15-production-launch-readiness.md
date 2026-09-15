# Production Launch Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare 生科智学 so that enabling the outer-gateway `/api/` route is the only remaining infrastructure action before production use.

**Architecture:** Keep the Vue build under `/zjubio/`, proxy root `/api/` to the loopback-only Node service, and keep SQLite plus uploads private on the container. Add repeatable backup and operational checks without changing CellAnalyst or unrelated services.

**Tech Stack:** Vue 3, Vite, Node.js 22, Node built-in SQLite, Apache 2.4, Supervisor, cron, SMTP.

---

### Task 1: Establish and verify the deployed baseline

**Files:**
- Verify: `/etc/supervisor/conf.d/zjubio.ini`
- Verify: `/etc/apache2/sites-available/zjubio.conf`
- Verify: `/etc/zjubio/zjubio.env`

- [x] **Step 1: Restart the backend under Supervisor**

  Run `sudo -n supervisorctl -c /etc/supervisor/conf.d/supervisord.conf restart zjubio-node`.
  Expected: `zjubio-node: stopped` followed by `zjubio-node: started`.

- [x] **Step 2: Verify process and loopback health**

  Run Supervisor status plus `curl http://127.0.0.1:5175/api/health` and
  `curl http://127.0.0.1/api/health`.
  Expected: `RUNNING` and two `{"ok":true}` responses.

- [x] **Step 3: Verify the current production build**

  Run `npm test`, `npm run build`, and `npm run check` from
  `/var/www/html/zjubio`.
  Expected: 377 tests pass, Vite exits 0, and project checks report `passed`.

### Task 2: Remove production dependency vulnerabilities

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Upgrade only the vulnerable direct dependencies**

  Run `npm.cmd install nodemailer@^9.1.1 sharp@^0.35.4` locally. Do not take
  unrelated major upgrades.

- [ ] **Step 2: Verify security and behavior**

  Run `npm.cmd audit --omit=dev`, `npm.cmd test`, `npm.cmd run build`, and
  `npm.cmd run check`.
  Expected: zero production vulnerabilities and all project checks pass.

- [ ] **Step 3: Commit, push, and deploy**

  Commit only dependency manifests, pull with `--ff-only` on the server, run
  `npm ci`, repeat the audit/build/tests, and restart `zjubio-node`.

### Task 3: Add consistent daily backups and retention

**Files:**
- Create: `scripts/backup-production-data.mjs`
- Create: `tests/productionBackup.test.js`
- Create: `deploy/zjubio-backup.cron`
- Modify: `deploy/README.md`

- [ ] **Step 1: Add a failing backup test**

  Create temporary auth/content/homepage SQLite databases and upload folders,
  run the backup module with a temporary destination, and assert that each
  database passes `PRAGMA integrity_check`, uploads are copied, and expired
  snapshot directories are removed.

- [ ] **Step 2: Implement the backup module**

  Use `node:sqlite` `VACUUM INTO` for consistent database snapshots. Deduplicate
  `AUTH_DB_FILE` and `QUIZ_DB_FILE` when they point to the same file. Copy
  `CONTENT_UPLOAD_DIR` and `PROFILE_AVATAR_DIR`; default the destination to
  `/data/zjubio/backups` and retain 14 daily snapshots.

- [ ] **Step 3: Install the cron entry**

  Install a root-owned `/etc/cron.d/zjubio-backup` that runs at 03:20 daily:

  ```cron
  20 3 * * * root /opt/zjubio/node/bin/node --env-file=/etc/zjubio/zjubio.env /var/www/html/zjubio/scripts/backup-production-data.mjs >> /var/log/zjubio-backup.log 2>&1
  ```

- [ ] **Step 4: Run and verify one real snapshot**

  Run the command once manually, inspect the snapshot manifest, and open each
  copied database read-only to verify `PRAGMA integrity_check` returns `ok`.

### Task 4: Bound logs and verify persistent storage

**Files:**
- Modify: `deploy/supervisor-zjubio.ini`
- Modify: `/etc/supervisor/conf.d/zjubio.ini`

- [ ] **Step 1: Configure Supervisor log rotation**

  Add `stdout_logfile_maxbytes=10MB`, `stdout_logfile_backups=5`,
  `stderr_logfile_maxbytes=10MB`, and `stderr_logfile_backups=5`.

- [ ] **Step 2: Validate storage permissions**

  Confirm `zjubio_run` can read `/etc/zjubio/zjubio.env` and write the database,
  upload, avatar, and log directories while Node remains bound only to
  `127.0.0.1:5175`.

- [ ] **Step 3: Reread and restart safely**

  Run Supervisor `reread`, `update`, and `restart zjubio-node`; verify health and
  that no new startup stack trace is appended.

### Task 5: Verify SMTP and administrator provisioning internally

**Files:**
- Verify only: `/etc/zjubio/zjubio.env`
- Verify only: production SQLite databases

- [ ] **Step 1: Send one real registration code through loopback**

  POST JSON `{"studentId":"3240105782","purpose":"register"}` to
  `http://127.0.0.1:5175/api/auth/email/code` and require HTTP 200. Confirm the
  message arrives from the `SKZX` display name without logging its code.

- [ ] **Step 2: Complete the administrator account flow**

  Register student `3240105782` with a password of at least 10 characters, log
  in, and confirm `/api/auth/me` returns role `admin`.

- [ ] **Step 3: Exercise one reversible management workflow**

  Through loopback with the authenticated cookie, create a draft post, list it,
  publish it, archive it, and confirm an audit-log record exists. Do not use a
  public production course item for this smoke test.

### Task 6: Finalize the trusted-proxy contract

**Files:**
- Modify if required after observing the real header chain: `server/server.js`
- Test if modified: `tests/serverSecurity.test.js`
- Modify: `docs/deployment-checklist.md`

- [ ] **Step 1: Give the gateway owner the exact contract**

  Route public `/api/` to the same container HTTP upstream used by `/zjubio/`,
  preserve the `/api/` path, replace any client-supplied `X-Forwarded-For` with
  the gateway-observed client address, and set `X-Forwarded-Proto: https`.

- [ ] **Step 2: Observe the resulting header chain**

  After routing is enabled, make one request from an external network and verify
  Node identifies the external client rather than the gateway for rate limits.
  Adjust and test the trusted-hop selection only if the observed chain differs.

- [ ] **Step 3: Run the public launch gate**

  Verify `/api/health`, registration email, login/logout, quiz persistence,
  submission, administrator approval, comments/likes, PDFs/images, security
  headers, mobile access, and automatic Supervisor recovery.

### Task 7: Refresh operational documentation

**Files:**
- Modify: `PROJECT_STATUS.md`
- Modify: `docs/deployment-checklist.md`
- Modify: `deploy/README.md`

- [ ] **Step 1: Replace stale deployment statements**

  Record the active Node 22 runtime, Supervisor program, container Apache proxy,
  deployed commit, backup schedule, remaining outer-gateway route, and verified
  commands.

- [ ] **Step 2: Commit documentation with the corresponding implementation**

  Run `npm.cmd run check`, confirm the worktree contains no generated reports,
  and push the final launch-readiness documentation to `main`.
