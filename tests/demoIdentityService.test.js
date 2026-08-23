import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  buildDemoUser,
  demoIdentityStorageKey,
  getDemoIdentityOptions,
  loadDemoIdentityId,
  realIdentityId,
  saveDemoIdentityId,
} from '../src/services/demoIdentityService.js';

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

function withWindow(storage) {
  globalThis.window = { localStorage: storage };
  return () => {
    delete globalThis.window;
  };
}

test('demo options expose the five identity choices with labels', () => {
  const options = getDemoIdentityOptions();
  assert.deepEqual(
    options.map((option) => option.id),
    ['guest', 'cc98', 'email', 'dual', 'admin'],
  );
  for (const option of options) {
    assert.ok(option.label);
    assert.ok(option.description);
  }
});

test('demo users cover guest, single auth, dual auth, and admin states', () => {
  const guest = buildDemoUser('guest');
  assert.equal(guest.role, 'guest');
  assert.deepEqual(guest.verifications, { cc98: false, email: false });
  assert.equal(guest.isDemo, true);

  const cc98 = buildDemoUser('cc98');
  assert.equal(cc98.role, 'student');
  assert.deepEqual(cc98.verifications, { cc98: true, email: false });

  const email = buildDemoUser('email');
  assert.deepEqual(email.verifications, { cc98: false, email: true });

  const dual = buildDemoUser('dual');
  assert.deepEqual(dual.verifications, { cc98: true, email: true });

  const admin = buildDemoUser('admin');
  assert.equal(admin.role, 'admin');
});

test('demo account switcher exposes local persistence and reset controls', () => {
  const popover = readFileSync('src/components/account/AccountPopover.vue', 'utf8');
  const switcher = readFileSync('src/components/account/AccountSwitcher.vue', 'utf8');
  assert.match(popover, /reset-demo/);
  assert.match(switcher, /重置当前演示账号/);
  assert.match(switcher, /不会提交到服务器/);
});

test('unknown demo identity builds no user', () => {
  assert.equal(buildDemoUser('missing'), null);
  assert.equal(buildDemoUser(''), null);
});

test('saved demo identity survives reload and clearing restores real identity', () => {
  const cleanup = withWindow(createMemoryStorage());
  try {
    assert.equal(loadDemoIdentityId(), realIdentityId);

    saveDemoIdentityId('admin');
    assert.equal(loadDemoIdentityId(), 'admin');

    saveDemoIdentityId('');
    assert.equal(loadDemoIdentityId(), realIdentityId);
  } finally {
    cleanup();
  }
});

test('invalid stored identity falls back to the real identity', () => {
  const storage = createMemoryStorage();
  storage.setItem(demoIdentityStorageKey, 'not-a-demo-id');
  const cleanup = withWindow(storage);
  try {
    assert.equal(loadDemoIdentityId(), realIdentityId);
  } finally {
    cleanup();
  }
});

test('service is a no-op without a browser storage', () => {
  saveDemoIdentityId('guest');
  assert.equal(loadDemoIdentityId(), realIdentityId);
});
