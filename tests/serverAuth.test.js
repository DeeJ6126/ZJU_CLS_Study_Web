import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { createAuthStore } from '../server/authStore.js';
import {
  createSession,
  getCurrentUser,
  loginCc98,
  logout,
  registerCc98,
} from '../server/authService.js';

function createTestStore() {
  const store = createAuthStore({ filename: ':memory:' });
  store.initialize();
  store.seedVerificationCodes([
    { code: 'bio-cc98', cc98Name: 'cc98_bio_visitor' },
    { code: 'bio-cc98-extra', cc98Name: 'cc98_bio_visitor' },
  ]);
  return store;
}

test('cc98 registration stores a hashed password and consumes a valid code', async () => {
  const store = createTestStore();
  const result = await registerCc98(store, {
    code: 'bio-cc98',
    password: 'test-pass',
  });
  const user = store.findUserByCc98Name('cc98_bio_visitor');
  const code = store.findVerificationCode('bio-cc98');

  assert.equal(result.ok, true);
  assert.equal(result.user.cc98Nickname, 'cc98_bio_visitor');
  assert.notEqual(user.passwordHash, 'pass-123456');
  assert.equal(code.usedByUserId, user.id);
});

test('cc98 registration rejects invalid code and duplicate cc98 name', async () => {
  const store = createTestStore();
  const invalid = await registerCc98(store, {
    code: 'missing',
    password: 'pass-123456',
  });

  assert.equal(invalid.ok, false);
  assert.equal(invalid.status, 400);

  await registerCc98(store, {
    code: 'bio-cc98',
    password: 'pass-123456',
  });
  const duplicate = await registerCc98(store, {
    code: 'bio-cc98-extra',
    password: 'pass-abcdef',
  });

  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.status, 409);
});

test('cc98 login creates a session and logout invalidates it', async () => {
  const store = createTestStore();
  await registerCc98(store, {
    code: 'bio-cc98',
    password: 'pass-123456',
  });

  const failed = await loginCc98(store, {
    cc98Name: 'cc98_bio_visitor',
    password: 'wrong',
  });
  assert.equal(failed.ok, false);
  assert.equal(failed.status, 401);

  const loggedIn = await loginCc98(store, {
    cc98Name: 'cc98_bio_visitor',
    password: 'pass-123456',
  });
  assert.equal(loggedIn.ok, true);
  assert.equal(loggedIn.user.verifications.cc98, true);

  const currentUser = getCurrentUser(store, loggedIn.sessionId);
  assert.equal(currentUser.nickname, 'cc98_bio_visitor');

  logout(store, loggedIn.sessionId);
  assert.equal(getCurrentUser(store, loggedIn.sessionId).role, 'guest');
});

test('current user is guest without a valid session', () => {
  const store = createTestStore();
  assert.equal(getCurrentUser(store, '').role, 'guest');
  assert.equal(getCurrentUser(store, createSession(store, null)).role, 'guest');
});

test('expired sessions are rejected by the auth store', () => {
  const store = createTestStore();
  store.createSession({ id: 'expired', userId: 1, expiresAt: '2020-01-01T00:00:00.000Z' });
  assert.equal(store.findSession('expired'), undefined);
  store.close();
});

test('auth store migrates legacy users and preserves their student role', () => {
  const directory = mkdtempSync(join(tmpdir(), 'zjubio-auth-migration-'));
  const filename = join(directory, 'auth.sqlite');
  const legacyDb = new DatabaseSync(filename);
  legacyDb.exec(`
    create table users (
      id integer primary key autoincrement,
      cc98_name text unique not null,
      password_hash text not null,
      created_at text not null
    );
    insert into users (cc98_name, password_hash, created_at)
    values ('legacy_student', 'legacy-hash', '2026-01-01T00:00:00.000Z');
  `);
  legacyDb.close();

  const store = createAuthStore({ filename });
  try {
    store.initialize();
    assert.equal(store.findUserByCc98Name('legacy_student').role, 'student');
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('admin allowlist downgrades to student when the shared admin invite token is missing', async () => {
  const store = createTestStore();
  store.seedVerificationCodes([
    { code: 'admin-missing-invite', cc98Name: 'cc98_bio_visitor', usedByUserId: null },
  ]);

  // Without an invite token configured, even an allowlisted name + 10-char
  // password is downgraded to student role (Bug 3 mitigation).
  const noInvite = await registerCc98(store, {
    code: 'admin-missing-invite',
    password: 'admin-pass-123',
  }, {
    adminCc98Names: new Set(['cc98_bio_visitor']),
    expectedAdminInviteToken: '',
  });
  assert.equal(noInvite.user.role, 'student');
});

test('admin allowlist upgrades to admin when the correct invite token is provided', async () => {
  const store = createTestStore();
  // Use a different cc98Name for the wrong-token scenario so it doesn't
  // collide with the admin-namespace user we'll register next.
  store.seedVerificationCodes([
    { code: 'wrong-invite-code', cc98Name: 'cc98_test_other', usedByUserId: null },
  ]);

  // A non-admin cc98 name + wrong token lands in the student path
  // (Bug 3: wrong invite token alone does not demote — it's the
  // combination of "allowlisted name" AND "correct token" that promotes).
  const wrongInvite = await registerCc98(store, {
    code: 'wrong-invite-code',
    password: 'admin-pass-123',
    adminInviteToken: 'wrong-token',
  }, {
    adminCc98Names: new Set(['cc98_bio_visitor']),
    expectedAdminInviteToken: 'shared-admin-token',
  });
  assert.equal(wrongInvite.user.role, 'student');

  store.seedVerificationCodes([
    { code: 'admin-with-invite', cc98Name: 'cc98_bio_visitor', usedByUserId: null },
  ]);
  const registered = await registerCc98(store, {
    code: 'admin-with-invite',
    password: 'admin-pass-123',
    adminInviteToken: 'shared-admin-token',
  }, {
    adminCc98Names: new Set(['cc98_bio_visitor']),
    expectedAdminInviteToken: 'shared-admin-token',
  });
  assert.equal(registered.user.role, 'admin');

  const login = await loginCc98(store, {
    cc98Name: 'cc98_bio_visitor',
    password: 'admin-pass-123',
  });
  assert.equal(login.user.role, 'admin');
});
