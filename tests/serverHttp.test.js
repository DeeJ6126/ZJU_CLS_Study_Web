import test from 'node:test';
import assert from 'node:assert/strict';

import { createAuthStore } from '../server/authStore.js';
import { createAuthServer, isDirectRun } from '../server/server.js';

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve(server.address().port);
    });
  });
}

test('auth http server registers, logs in, returns current user, and logs out', async () => {
  const store = createAuthStore({ filename: ':memory:' });
  const { server } = createAuthServer({ store });
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const registration = await fetch(`${baseUrl}/api/auth/register/cc98`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code: 'bio-cc98',
        password: 'test',
      }),
    });
    assert.equal(registration.status, 201);

    const login = await fetch(`${baseUrl}/api/auth/login/cc98`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        cc98Name: 'cc98_bio_visitor',
        password: 'test',
      }),
    });
    const cookie = login.headers.get('set-cookie');
    assert.equal(login.status, 200);
    assert.match(cookie, /study_session=/);

    const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie } });
    const meBody = await me.json();
    assert.equal(meBody.user.cc98Nickname, 'cc98_bio_visitor');
    assert.equal(meBody.user.verifications.cc98, true);

    const loggedOut = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { cookie },
    });
    const loggedOutBody = await loggedOut.json();
    assert.equal(loggedOutBody.user.role, 'guest');
  } finally {
    server.close();
  }
});

test('auth server direct-run detection handles windows script paths', () => {
  assert.equal(
    isDirectRun('file:///E:/Study_Web/server/server.js', 'E:\\Study_Web\\server\\server.js'),
    true,
  );
});
