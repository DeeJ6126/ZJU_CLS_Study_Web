import test from 'node:test';
import assert from 'node:assert/strict';

import { createAuthStore } from '../server/authStore.js';
import {
  bindOrRebindCc98,
  createSession,
  getCurrentUser,
  loginCc98,
  registerCc98,
} from '../server/authService.js';
import {
  bindEmailIdentity,
  loginEmail,
  normalizeStudentId,
  registerEmail,
  requestEmailCode,
  resetPasswordByEmail,
} from '../server/emailAuthService.js';

function createTestStore() {
  const store = createAuthStore({ filename: ':memory:' });
  store.initialize();
  store.seedVerificationCodes([{ code: 'bio-cc98', cc98Name: 'cc98_bio_visitor' }]);
  return store;
}

function mailOptions() {
  const sent = [];
  return {
    sent,
    options: {
      codeGenerator: () => '123456',
      now: () => new Date('2026-07-30T12:00:00.000Z'),
      sendEmail: async (message) => sent.push(message),
    },
  };
}

test('student email identity accepts only a numeric student ID', () => {
  assert.equal(normalizeStudentId(' 3220100000 '), '3220100000');
  assert.equal(normalizeStudentId('student'), '');
  assert.equal(normalizeStudentId('3220100000.alias'), '');
  assert.equal(normalizeStudentId('3220100000@zju.edu.cn'), '');
});

test('email registration assigns a stable public id and enforces unique nicknames', async () => {
  const store = createTestStore();
  const firstMail = mailOptions();
  await requestEmailCode(store, { studentId: '3220100000', purpose: 'register' }, firstMail.options);
  const first = await registerEmail(store, {
    studentId: '3220100000',
    nickname: '生科同学',
    code: '123456',
    password: '12345678',
  }, firstMail.options);

  assert.equal(first.ok, true);
  assert.match(first.user.publicId, /^[0-9a-f-]{36}$/);
  assert.equal(first.user.nickname, '生科同学');
  const stablePublicId = store.findUserByEmail('3220100000@zju.edu.cn').publicId;
  assert.equal(store.findUserById(store.findUserByEmail('3220100000@zju.edu.cn').id).publicId, stablePublicId);

  const secondMail = {
    ...mailOptions().options,
    now: () => new Date('2026-07-30T13:00:00.000Z'),
  };
  await requestEmailCode(store, { studentId: '3220100001', purpose: 'register' }, secondMail);
  const duplicate = await registerEmail(store, {
    studentId: '3220100001',
    nickname: '生科同学',
    code: '123456',
    password: '12345678',
  }, secondMail);
  assert.equal(duplicate.status, 409);
  store.close();
});

test('email code requests construct the exact student mailbox and never store the plain code', async () => {
  const store = createTestStore();
  const mail = mailOptions();

  const invalid = await requestEmailCode(store, { studentId: 'student', purpose: 'register' }, mail.options);
  assert.equal(invalid.status, 400);

  const requested = await requestEmailCode(store, { studentId: ' 3220100000 ', purpose: 'register' }, mail.options);
  assert.equal(requested.ok, true);
  assert.equal(mail.sent[0].to, '3220100000@zju.edu.cn');
  assert.equal(mail.sent[0].code, '123456');
  const record = store.findLatestEmailCode('3220100000@zju.edu.cn', 'register');
  assert.notEqual(record.codeHash, '123456');
  assert.equal(record.expiresAt, '2026-07-30T12:10:00.000Z');

  const throttled = await requestEmailCode(store, { studentId: '3220100000', purpose: 'register' }, mail.options);
  assert.equal(throttled.status, 429);
  store.close();
});

test('email registration creates a shared user identity and supports password login', async () => {
  const store = createTestStore();
  const mail = mailOptions();
  await requestEmailCode(store, { studentId: '3220100000', purpose: 'register' }, mail.options);

  const shortPassword = await registerEmail(store, {
    studentId: '3220100000', nickname: '生科同学', code: '123456', password: '1234567',
  }, mail.options);
  assert.equal(shortPassword.status, 400);

  const registered = await registerEmail(store, {
    studentId: '3220100000', nickname: '生科同学', code: '123456', password: '12345678',
  }, mail.options);
  assert.equal(registered.ok, true);
  assert.equal(registered.user.nickname, '生科同学');
  assert.equal(registered.user.email, '32*****@zju.edu.cn');
  assert.equal(registered.user.verifications.email, true);
  assert.equal(registered.user.verifications.cc98, false);

  const loggedIn = await loginEmail(store, { studentId: '3220100000', password: '12345678' });
  assert.equal(loggedIn.ok, true);
  assert.equal(getCurrentUser(store, loggedIn.sessionId).email, '32*****@zju.edu.cn');
  store.close();
});

test('verified email codes reset passwords but cannot be reused', async () => {
  const store = createTestStore();
  const mail = mailOptions();
  await requestEmailCode(store, { studentId: '3220100000', purpose: 'register' }, mail.options);
  await registerEmail(store, {
    studentId: '3220100000', nickname: '生科同学', code: '123456', password: '12345678',
  }, mail.options);

  const resetMail = {
    ...mail.options,
    codeGenerator: () => '654321',
    now: () => new Date('2026-07-30T13:00:00.000Z'),
  };
  await requestEmailCode(store, { studentId: '3220100000', purpose: 'password-reset' }, resetMail);
  const reset = await resetPasswordByEmail(store, {
    studentId: '3220100000', code: '654321', password: 'new-pass',
  }, resetMail);
  assert.equal(reset.ok, true);
  assert.equal((await loginEmail(store, { studentId: '3220100000', password: 'new-pass' })).ok, true);
  assert.equal((await resetPasswordByEmail(store, {
    studentId: '3220100000', code: '654321', password: 'another-pass',
  }, resetMail)).status, 400);
  store.close();
});

test('a logged-in CC98 account can bind one verified email without creating another user', async () => {
  const store = createTestStore();
  await registerCc98(store, { code: 'bio-cc98', password: '12345678' });
  const login = await loginCc98(store, { cc98Name: 'cc98_bio_visitor', password: '12345678' });
  const internalUserId = store.findSession(login.sessionId).userId;
  const mail = mailOptions();
  await requestEmailCode(store, { studentId: '3220100000', purpose: 'bind' }, mail.options);

  const bound = await bindEmailIdentity(store, internalUserId, {
    studentId: '3220100000', code: '123456',
  }, mail.options);
  assert.equal(bound.ok, true);
  assert.equal(bound.user.verifications.cc98, true);
  assert.equal(bound.user.verifications.email, true);
  assert.equal(store.findUserByEmail('3220100000@zju.edu.cn').id, internalUserId);
  store.close();
});

test('CC98 binding requires the password, locks the nickname, and keeps only the current session', async () => {
  const store = createTestStore();
  store.seedVerificationCodes([
    { code: 'bind-new', cc98Name: 'new_cc98_name' },
    { code: 'rebind-next', cc98Name: 'next_cc98_name' },
  ]);
  const mail = mailOptions();
  await requestEmailCode(store, { studentId: '3220100000', purpose: 'register' }, mail.options);
  const registered = await registerEmail(store, {
    studentId: '3220100000',
    nickname: '原昵称',
    code: '123456',
    password: '12345678',
  }, mail.options);
  const user = store.findUserByPublicId(registered.user.publicId);
  const currentSessionId = createSession(store, user.id);
  const otherSessionId = createSession(store, user.id);

  const wrongPassword = await bindOrRebindCc98(store, user.id, currentSessionId, {
    code: 'bind-new',
    password: 'not-the-password',
  });
  assert.equal(wrongPassword.status, 401);

  const bound = await bindOrRebindCc98(store, user.id, currentSessionId, {
    code: 'bind-new',
    password: '12345678',
  });
  assert.equal(bound.ok, true);
  assert.equal(bound.user.nickname, 'new_cc98_name');
  assert.equal(bound.user.cc98Nickname, 'new_cc98_name');
  assert.ok(store.findSession(currentSessionId));
  assert.equal(store.findSession(otherSessionId), undefined);

  const rebound = await bindOrRebindCc98(store, user.id, currentSessionId, {
    code: 'rebind-next',
    password: '12345678',
  });
  assert.equal(rebound.ok, true);
  assert.equal(store.findUserByCc98Name('new_cc98_name'), null);
  assert.equal(store.findUserByCc98Name('next_cc98_name').id, user.id);
  assert.equal(rebound.user.nickname, 'next_cc98_name');
  store.close();
});

test('email code requests enforce hourly IP and service-wide limits', async () => {
  const now = '2026-07-30T12:00:00.000Z';
  const makeRecord = (id, requestIpHash) => ({
    id,
    email: `${id}@zju.edu.cn`,
    purpose: 'register',
    codeHash: '00',
    salt: 'salt',
    requestedAt: now,
    expiresAt: '2026-07-30T12:10:00.000Z',
    requestIpHash,
  });

  const ipStore = createTestStore();
  for (let index = 0; index < 20; index += 1) {
    ipStore.createEmailCode(makeRecord(`ip${index}`, 'same-ip'));
  }
  const ipLimited = await requestEmailCode(ipStore, {
    studentId: '3220109998', purpose: 'register', requestIpHash: 'same-ip',
  }, mailOptions().options);
  assert.equal(ipLimited.status, 429);
  ipStore.close();

  const globalStore = createTestStore();
  for (let index = 0; index < 200; index += 1) {
    globalStore.createEmailCode(makeRecord(`global${index}`, `ip-${index}`));
  }
  const globallyLimited = await requestEmailCode(globalStore, {
    studentId: '3220109999', purpose: 'register', requestIpHash: 'fresh-ip',
  }, mailOptions().options);
  assert.equal(globallyLimited.status, 429);
  globalStore.close();
});

test('email registration auto-derives grade from the 32X0 student id prefix', async () => {
  const store = createTestStore();
  const mail = mailOptions();
  await requestEmailCode(store, { studentId: '3240123', purpose: 'register' }, mail.options);
  const result = await registerEmail(store, {
    studentId: '3240123',
    nickname: '2024新生',
    code: '123456',
    password: '12345678',
  }, mail.options);
  assert.equal(result.ok, true);
  assert.equal(result.user.grade, 2024);
  const persisted = store.findUserByEmail('3240123@zju.edu.cn');
  assert.equal(persisted.grade, 2024);
  store.close();
});

test('email registration stores null grade for student ids without a year mapping', async () => {
  const store = createTestStore();
  const mail = mailOptions();
  await requestEmailCode(store, { studentId: '3230001', purpose: 'register' }, mail.options);
  const result = await registerEmail(store, {
    studentId: '3230001',
    nickname: '老生',
    code: '123456',
    password: '12345678',
  }, mail.options);
  assert.equal(result.ok, true);
  assert.equal(result.user.grade, null);
  store.close();
});

test('binding an email on a grade-less account fills the grade from the new student id', async () => {
  const store = createTestStore();
  await registerCc98(store, { code: 'bio-cc98', password: '12345678' });
  const login = await loginCc98(store, { cc98Name: 'cc98_bio_visitor', password: '12345678' });
  const internalUserId = store.findSession(login.sessionId).userId;
  const mail = mailOptions();
  await requestEmailCode(store, { studentId: '3250123', purpose: 'bind' }, mail.options);
  const bound = await bindEmailIdentity(store, internalUserId, {
    studentId: '3250123', code: '123456',
  }, mail.options);
  assert.equal(bound.ok, true);
  assert.equal(bound.user.grade, 2025);
  store.close();
});

test('binding an email does not overwrite an existing grade on the account', async () => {
  const store = createTestStore();
  await registerCc98(store, { code: 'bio-cc98', password: '12345678' });
  const login = await loginCc98(store, { cc98Name: 'cc98_bio_visitor', password: '12345678' });
  const internalUserId = store.findSession(login.sessionId).userId;
  store.updateGrade(internalUserId, 2024);

  const mail = mailOptions();
  await requestEmailCode(store, { studentId: '3250999', purpose: 'bind' }, mail.options);
  const bound = await bindEmailIdentity(store, internalUserId, {
    studentId: '3250999', code: '123456',
  }, mail.options);
  assert.equal(bound.ok, true);
  assert.equal(bound.user.grade, 2024);
  store.close();
});
