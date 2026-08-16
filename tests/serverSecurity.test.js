import test from 'node:test';
import assert from 'node:assert/strict';

import { createAuthStore } from '../server/authStore.js';
import { createQuizStore } from '../server/quiz/quizStore.js';
import { createContentStore } from '../server/content/contentStore.js';
import { createAuthServer, getClientIp, isHttpsRequest } from '../server/server.js';

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve(server.address().port);
    });
  });
}

function createTestServer() {
  const store = createAuthStore({ filename: ':memory:' });
  const quizStore = createQuizStore({ filename: ':memory:' });
  const contentStore = createContentStore({ filename: ':memory:' });
  const { server } = createAuthServer({ store, quizStore, contentStore });
  return { store, server };
}

const successfulEmailSender = async () => {};

async function postJson(baseUrl, path, body, headers = {}) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

test('health endpoint answers without authentication', async () => {
  const { server } = createTestServer();
  const port = await listen(server);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
  } finally {
    server.close();
  }
});

test('consecutive login failures lock the account at the http layer', async () => {
  const { server } = createTestServer();
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    const registration = await postJson(baseUrl, '/api/auth/register/cc98', {
      code: 'bio-cc98',
      password: 'test-pass-123',
    });
    assert.equal(registration.status, 201);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failed = await postJson(baseUrl, '/api/auth/login/cc98', {
        cc98Name: 'cc98_bio_visitor',
        password: 'wrong-password',
      });
      assert.equal(failed.status, 401);
    }

    const blocked = await postJson(baseUrl, '/api/auth/login/cc98', {
      cc98Name: 'cc98_bio_visitor',
      password: 'test-pass-123',
    });
    assert.equal(blocked.status, 429);
  } finally {
    server.close();
  }
});

test('session cookie gains Secure behind a https proxy and omits it otherwise', async () => {
  const { server } = createTestServer();
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await postJson(baseUrl, '/api/auth/register/cc98', {
      code: 'bio-cc98',
      password: 'test-pass-123',
    });

    const plain = await postJson(baseUrl, '/api/auth/login/cc98', {
      cc98Name: 'cc98_bio_visitor',
      password: 'test-pass-123',
    });
    assert.equal(plain.status, 200);
    assert.doesNotMatch(plain.headers.get('set-cookie'), /; Secure/);

    const secure = await postJson(baseUrl, '/api/auth/login/cc98', {
      cc98Name: 'cc98_bio_visitor',
      password: 'test-pass-123',
    }, { 'x-forwarded-proto': 'https' });
    assert.equal(secure.status, 200);
    assert.match(secure.headers.get('set-cookie'), /; Secure/);
  } finally {
    server.close();
  }
});

test('email code ip limit uses the forwarded client ip, not the proxy socket', async () => {
  const store = createAuthStore({ filename: ':memory:' });
  const quizStore = createQuizStore({ filename: ':memory:' });
  const contentStore = createContentStore({ filename: ':memory:' });
  const { server } = createAuthServer({
    store,
    quizStore,
    contentStore,
    emailSender: successfulEmailSender,
  });
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    const forwardedHeader = { 'x-forwarded-for': '198.51.100.7' };
    for (let index = 0; index < 20; index += 1) {
      const response = await postJson(baseUrl, '/api/auth/email/code', {
        studentId: String(31200000000 + index),
        purpose: 'register',
      }, forwardedHeader);
      assert.equal(response.status, 202, `request ${index} should be accepted`);
    }

    // A different forwarded ip is still allowed: the ip counter is per ip.
    const otherIp = await postJson(baseUrl, '/api/auth/email/code', {
      studentId: '31209999999',
      purpose: 'register',
    }, { 'x-forwarded-for': '198.51.100.8' });
    assert.equal(otherIp.status, 202);
  } finally {
    server.close();
  }
});

test('getClientIp prefers the first forwarded entry and falls back to socket', () => {
  const socketOnly = { socket: { remoteAddress: '127.0.0.1' } };
  assert.equal(getClientIp(socketOnly), '127.0.0.1');

  const forwarded = { headers: { 'x-forwarded-for': '198.51.100.9, 10.0.0.2' }, socket: { remoteAddress: '127.0.0.1' } };
  assert.equal(getClientIp(forwarded), '198.51.100.9');

  const emptyForwarded = { headers: { 'x-forwarded-for': ' ' }, socket: { remoteAddress: '127.0.0.1' } };
  assert.equal(getClientIp(emptyForwarded), '127.0.0.1');
});

test('isHttpsRequest reads the forwarded proto case-insensitively', () => {
  const https = { headers: { 'x-forwarded-proto': 'https' } };
  assert.equal(isHttpsRequest(https), true);
  const mixed = { headers: { 'x-forwarded-proto': 'HTTPS, http' } };
  assert.equal(isHttpsRequest(mixed), true);
  const plain = { headers: { 'x-forwarded-proto': 'http' } };
  assert.equal(isHttpsRequest(plain), false);
  const missing = { headers: {} };
  assert.equal(isHttpsRequest(missing), false);
});
