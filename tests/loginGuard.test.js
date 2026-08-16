import test from 'node:test';
import assert from 'node:assert/strict';

import { createLoginGuard, normalizeLoginKey } from '../server/loginGuard.js';

test('account locks after consecutive failures and rejects further logins', () => {
  let now = 1_000_000;
  const guard = createLoginGuard({ now: () => now });
  const key = 'cc98:someuser';
  const ip = '10.0.0.1';

  for (let attempt = 0; attempt < 5; attempt += 1) {
    guard.recordFailure(key, ip);
  }
  const blocked = guard.check(key, ip);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.status, 429);
});

test('locked account recovers after the lock window passes', () => {
  let now = 1_000_000;
  const guard = createLoginGuard({ now: () => now });
  const key = 'cc98:someuser';
  const ip = '10.0.0.1';

  for (let attempt = 0; attempt < 5; attempt += 1) {
    guard.recordFailure(key, ip);
  }
  assert.equal(guard.check(key, ip).ok, false);

  now += 15 * 60 * 1000 + 1;
  assert.equal(guard.check(key, ip).ok, true);
});

test('failures on one account do not lock a different account', () => {
  let now = 1_000_000;
  const guard = createLoginGuard({ now: () => now });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    guard.recordFailure('cc98:user-a', '10.0.0.1');
  }
  assert.equal(guard.check('cc98:user-a', '10.0.0.1').ok, false);
  assert.equal(guard.check('cc98:user-b', '10.0.0.1').ok, true);
});

test('successful login clears the account failure count', () => {
  let now = 1_000_000;
  const guard = createLoginGuard({ now: () => now });
  const key = 'cc98:someuser';

  guard.recordFailure(key, '10.0.0.1');
  guard.recordFailure(key, '10.0.0.1');
  guard.recordSuccess(key);
  assert.equal(guard.check(key, '10.0.0.1').ok, true);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    guard.recordFailure(key, '10.0.0.2');
  }
  assert.equal(guard.check(key, '10.0.0.2').ok, false);
});

test('ip failure frequency limit blocks bursts from one address', () => {
  let now = 1_000_000;
  const guard = createLoginGuard({ now: () => now });
  const ip = '10.0.0.9';

  for (let attempt = 0; attempt < 20; attempt += 1) {
    guard.recordFailure(`cc98:user-${attempt}`, ip);
  }
  const blocked = guard.check('cc98:user-other', ip);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.status, 429);
});

test('ip window expires so a fresh burst is allowed', () => {
  let now = 1_000_000;
  const guard = createLoginGuard({ now: () => now });
  const ip = '10.0.0.9';

  for (let attempt = 0; attempt < 20; attempt += 1) {
    guard.recordFailure(`cc98:user-${attempt}`, ip);
  }
  assert.equal(guard.check('cc98:user-other', ip).ok, false);

  now += 15 * 60 * 1000 + 1;
  assert.equal(guard.check('cc98:user-other', ip).ok, true);
});

test('normalizeLoginKey folds case and whitespace variants', () => {
  assert.equal(normalizeLoginKey('  Admin  ', 'cc98'), 'cc98:admin');
  assert.equal(normalizeLoginKey('3121000000', 'email'), 'email:3121000000');
  assert.equal(normalizeLoginKey('', 'email'), 'email:');
});
