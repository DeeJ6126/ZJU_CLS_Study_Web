import test from 'node:test';
import assert from 'node:assert/strict';

import { createAuthApiClient } from '../src/services/authApiClient.js';

test('auth API client exposes email code, registration, login, binding, and reset requests', async () => {
  const requests = [];
  const client = createAuthApiClient(async (path, options = {}) => {
    requests.push({ path, options });
    return { ok: true, status: 200, async json() { return { user: { id: 'email-1' } }; } };
  });

  await client.requestEmailCode({ studentId: '3220100000', purpose: 'register' });
  await client.registerEmail({
    studentId: '3220100000', nickname: '生科同学', code: '123456', password: '12345678',
  });
  await client.loginEmail({ studentId: '3220100000', password: '12345678' });
  await client.bindEmail({ studentId: '3220100000', code: '123456' });
  await client.resetEmailPassword({ studentId: '3220100000', code: '123456', password: 'new-pass' });

  assert.deepEqual(requests.map(({ path }) => path), [
    'api/auth/email/code',
    'api/auth/register/email',
    'api/auth/login/email',
    'api/auth/bind/email',
    'api/auth/password/reset/email',
  ]);
  assert.equal(requests.every(({ options }) => options.credentials === 'include'), true);
});
