import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyCc98Verification,
  mergeUserAuthOverride,
  sanitizeAuthOverrides,
} from '../src/services/accountStateService.js';
import { getTestUserById } from '../src/data/config/testUsers.js';

test('account auth overrides merge by user id without leaking to other users', () => {
  const guest = getTestUserById('guest');
  const emailUser = getTestUserById('email-user');
  const overrides = {
    guest: {
      verifications: { cc98: true },
      cc98Nickname: 'cc98_bio_visitor',
    },
  };

  const mergedGuest = mergeUserAuthOverride(guest, overrides);
  const mergedEmailUser = mergeUserAuthOverride(emailUser, overrides);

  assert.equal(mergedGuest.verifications.cc98, true);
  assert.equal(mergedGuest.verifications.email, false);
  assert.equal(mergedGuest.cc98Nickname, 'cc98_bio_visitor');
  assert.equal(mergedEmailUser.verifications.cc98, false);
  assert.equal(mergedEmailUser.cc98Nickname, '待绑定');
});

test('successful cc98 verification only stores allowed front-end auth fields', () => {
  const guest = getTestUserById('guest');
  const override = applyCc98Verification(guest, {
    ok: true,
    provider: 'cc98',
    cc98Nickname: 'cc98_bio_visitor',
    role: 'developer',
    email: 'changed@example.com',
  });

  assert.deepEqual(override, {
    verifications: { cc98: true },
    cc98Nickname: 'cc98_bio_visitor',
  });
});

test('failed cc98 verification does not create an auth override', () => {
  const guest = getTestUserById('guest');
  const override = applyCc98Verification(guest, {
    ok: false,
    provider: 'cc98',
  });

  assert.equal(override, null);
});

test('auth override sanitizer keeps only cc98 prototype fields', () => {
  assert.deepEqual(sanitizeAuthOverrides(null), {});
  assert.deepEqual(sanitizeAuthOverrides([]), {});
  assert.deepEqual(
    sanitizeAuthOverrides({
      guest: {
        role: 'developer',
        email: 'changed@example.com',
        verifications: { cc98: true, email: true },
        cc98Nickname: 'cc98_bio_visitor',
      },
      broken: 'value',
    }),
    {
      guest: {
        verifications: { cc98: true },
        cc98Nickname: 'cc98_bio_visitor',
      },
    },
  );
});
