import test from 'node:test';
import assert from 'node:assert/strict';

import { createAuthStore } from '../server/authStore.js';
import { createAuthServer } from '../server/server.js';
import { createLoginGuard } from '../server/loginGuard.js';
import { createQuizStore } from '../server/quiz/quizStore.js';
import { createContentStore } from '../server/content/contentStore.js';
import { createStudentHomepageStore } from '../server/studentHomepage/studentHomepageStore.js';

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve(server.address().port);
    });
  });
}

function makeServer({ now } = {}) {
  const store = createAuthStore({ filename: ':memory:' });
  const quizStore = createQuizStore({ filename: ':memory:' });
  const contentStore = createContentStore({ filename: ':memory:' });
  const studentHomepageStore = createStudentHomepageStore({ filename: ':memory:' });
  store.initialize();
  store.seedVerificationCodes([
    { code: 'bio-cc98', cc98Name: 'cc98_bio_visitor' },
    { code: 'bio-cc98-rebind', cc98Name: 'cc98_bio_visitor_new' },
  ]);
  const guard = now ? createLoginGuard({ now }) : createLoginGuard();
  const { server } = createAuthServer({
    store,
    quizStore,
    contentStore,
    studentHomepageStore,
    loginGuard: guard,
  });
  return { server, store, guard };
}

async function postJson(url, body, headers = {}) {
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

async function putJson(url, body, headers = {}) {
  return fetch(url, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

test('cc98 login: 5 wrong passwords lock the account for 15 minutes', async () => {
  const { server, store } = makeServer();
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await postJson(`${baseUrl}/api/auth/register/cc98`, {
      code: 'bio-cc98', password: 'test-pass-12345',
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const res = await postJson(`${baseUrl}/api/auth/login/cc98`, {
        cc98Name: 'cc98_bio_visitor', password: 'wrong-password',
      });
      assert.equal(res.status, 401, `attempt ${attempt + 1} should be 401`);
    }

    const locked = await postJson(`${baseUrl}/api/auth/login/cc98`, {
      cc98Name: 'cc98_bio_visitor', password: 'test-pass-12345',
    });
    assert.equal(locked.status, 429, 'correct password should still be blocked during lockout');
    const lockedBody = await locked.json();
    assert.match(lockedBody.message ?? '', /15 分钟|过多|频繁/);

    assert.ok(store.findUserByCc98Name('cc98_bio_visitor'), 'user must still exist after lockout');
  } finally {
    server.close();
  }
});

test('cc98 login lockout recovers after the 15 minute window passes', async () => {
  let now = 1_700_000_000_000;
  const { server } = makeServer({ now: () => now });
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await postJson(`${baseUrl}/api/auth/register/cc98`, {
      code: 'bio-cc98', password: 'test-pass-12345',
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await postJson(`${baseUrl}/api/auth/login/cc98`, {
        cc98Name: 'cc98_bio_visitor', password: 'wrong',
      });
    }

    now += 15 * 60 * 1000 + 1;

    const recovered = await postJson(`${baseUrl}/api/auth/login/cc98`, {
      cc98Name: 'cc98_bio_visitor', password: 'test-pass-12345',
    });
    assert.equal(recovered.status, 200, 'login should succeed after lockout window');
  } finally {
    server.close();
  }
});

test('cc98 login: a successful login clears the account failure counter', async () => {
  const { server } = makeServer();
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await postJson(`${baseUrl}/api/auth/register/cc98`, {
      code: 'bio-cc98', password: 'test-pass-12345',
    });

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await postJson(`${baseUrl}/api/auth/login/cc98`, {
        cc98Name: 'cc98_bio_visitor', password: 'wrong',
      });
    }

    const ok = await postJson(`${baseUrl}/api/auth/login/cc98`, {
      cc98Name: 'cc98_bio_visitor', password: 'test-pass-12345',
    });
    assert.equal(ok.status, 200);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const res = await postJson(`${baseUrl}/api/auth/login/cc98`, {
        cc98Name: 'cc98_bio_visitor', password: 'wrong',
      });
      assert.equal(res.status, 401, `post-recovery attempt ${attempt + 1} should be 401, not locked`);
    }
  } finally {
    server.close();
  }
});

test('ip frequency limit: 20 wrong attempts across different accounts block the 21st', async () => {
  const { server } = makeServer();
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    for (let i = 0; i < 20; i += 1) {
      const res = await postJson(`${baseUrl}/api/auth/login/cc98`, {
        cc98Name: `ghost-${i}`, password: 'wrong',
      });
      assert.equal(res.status, 401, `attempt ${i + 1} should be 401`);
    }

    const blocked = await postJson(`${baseUrl}/api/auth/login/cc98`, {
      cc98Name: 'cc98_bio_visitor', password: 'wrong',
    });
    assert.equal(blocked.status, 429, 'ip-level rate limit should engage at 21st attempt');
  } finally {
    server.close();
  }
});

test('PUT /api/account/cc98: 5 wrong current passwords lock the bind for 15 minutes', async () => {
  const { server } = makeServer();
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await postJson(`${baseUrl}/api/auth/register/cc98`, {
      code: 'bio-cc98', password: 'test-pass-12345',
    });
    const login = await postJson(`${baseUrl}/api/auth/login/cc98`, {
      cc98Name: 'cc98_bio_visitor', password: 'test-pass-12345',
    });
    const cookie = login.headers.get('set-cookie');
    assert.ok(cookie, 'login should return a session cookie');

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const res = await putJson(
        `${baseUrl}/api/account/cc98`,
        { code: 'bio-cc98-rebind', password: 'wrong-current' },
        { cookie },
      );
      assert.equal(res.status, 401, `bind attempt ${attempt + 1} should be 401`);
    }

    const locked = await putJson(
      `${baseUrl}/api/account/cc98`,
      { code: 'bio-cc98-rebind', password: 'test-pass-12345' },
      { cookie },
    );
    assert.equal(locked.status, 429, 'correct current password must still be blocked during bind lockout');
  } finally {
    server.close();
  }
});

test('PUT /api/account/cc98: login lockout does not block bind (separate account counters)', async () => {
  const { server } = makeServer();
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await postJson(`${baseUrl}/api/auth/register/cc98`, {
      code: 'bio-cc98', password: 'test-pass-12345',
    });
    const login = await postJson(`${baseUrl}/api/auth/login/cc98`, {
      cc98Name: 'cc98_bio_visitor', password: 'test-pass-12345',
    });
    const cookie = login.headers.get('set-cookie');

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await postJson(`${baseUrl}/api/auth/login/cc98`, {
        cc98Name: 'cc98_bio_visitor', password: 'wrong',
      });
    }

    const loginLocked = await postJson(`${baseUrl}/api/auth/login/cc98`, {
      cc98Name: 'cc98_bio_visitor', password: 'test-pass-12345',
    });
    assert.equal(loginLocked.status, 429, 'login should be locked');

    const bind = await putJson(
      `${baseUrl}/api/account/cc98`,
      { code: 'bio-cc98-rebind', password: 'wrong' },
      { cookie },
    );
    assert.equal(bind.status, 401, 'bind should still respond with 401, not 429');
  } finally {
    server.close();
  }
});
