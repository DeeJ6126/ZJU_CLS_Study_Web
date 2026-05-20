import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

import { getSeedVerificationCodes } from './verificationSeed.js';
import { createAuthStore } from './authStore.js';
import { getCurrentUser, loginCc98, logout, registerCc98 } from './authService.js';

const sessionCookieName = 'study_session';

function parseCookies(header = '') {
  return Object.fromEntries(
    header.split(';')
      .map((part) => part.trim().split('='))
      .filter(([key, value]) => key && value)
      .map(([key, value]) => [key, decodeURIComponent(value)]),
  );
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

function sendJson(response, status, body, headers = {}) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    ...headers,
  });
  response.end(JSON.stringify(body));
}

function setSessionCookie(sessionId) {
  return `${sessionCookieName}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax`;
}

function clearSessionCookie() {
  return `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function createAuthServer({ store = createAuthStore(), port = 5175 } = {}) {
  store.initialize();
  store.seedVerificationCodes(getSeedVerificationCodes());

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const cookies = parseCookies(request.headers.cookie);
      const sessionId = cookies[sessionCookieName] ?? '';

      if (request.method === 'GET' && url.pathname === '/api/auth/me') {
        sendJson(response, 200, { user: getCurrentUser(store, sessionId) });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/auth/register/cc98') {
        const result = await registerCc98(store, await readJsonBody(request));
        sendJson(response, result.status, result.ok ? { user: result.user } : { message: result.message });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/auth/login/cc98') {
        const result = await loginCc98(store, await readJsonBody(request));
        sendJson(
          response,
          result.status,
          result.ok ? { user: result.user } : { message: result.message },
          result.ok ? { 'set-cookie': setSessionCookie(result.sessionId) } : {},
        );
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
        logout(store, sessionId);
        sendJson(response, 200, { user: getCurrentUser(store, '') }, { 'set-cookie': clearSessionCookie() });
        return;
      }

      sendJson(response, 404, { message: 'Not found' });
    } catch (error) {
      sendJson(response, 500, { message: 'Server error' });
    }
  });

  return {
    server,
    listen() {
      server.listen(port, '127.0.0.1', () => {
        console.log(`Auth server listening at http://127.0.0.1:${port}`);
      });
    },
  };
}

export function isDirectRun(moduleUrl, scriptPath) {
  return Boolean(scriptPath && moduleUrl === pathToFileURL(scriptPath).href);
}

if (isDirectRun(import.meta.url, process.argv[1])) {
  createAuthServer({ port: Number(process.env.PORT ?? 5175) }).listen();
}
