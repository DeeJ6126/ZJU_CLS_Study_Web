import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { getSeedVerificationCodes } from './verificationSeed.js';
import { createAuthStore } from './authStore.js';
import {
  bindOrRebindCc98,
  canLeaveSiteTrace,
  getCurrentUser,
  loginCc98,
  logout,
  registerCc98,
} from './authService.js';
import {
  bindEmailIdentity,
  loginEmail,
  registerEmail,
  requestEmailCode,
  resetPasswordByEmail,
} from './emailAuthService.js';
import { createSmtpEmailSender } from './smtpMailer.js';
import { createQuizStore } from './quiz/quizStore.js';
import { importConfiguredQuizCollections } from './quiz/quizImportService.js';
import {
  addManualMistake,
  createPracticeSession,
  getMistakes,
  getImageRevealGallery,
  getPracticeSession,
  getProgress,
  getTranslationReviewTerms,
  navigatePracticeSession,
  removeMistake,
  resetPracticeRecords,
  revealSessionAnswer,
  selfJudgeSessionAnswer,
  submitSessionAnswer,
} from './quiz/quizSessionService.js';
import {
  claimPracticeSession,
  getQuizAccountState,
  mergeQuizAccountState,
  removeVocabularyRecord,
  upsertVocabularyRecord,
} from './quiz/quizAccountService.js';
import {
  getMicrobiologyPastExamFeedback,
  getMicrobiologyPastExamQuestions,
  listMicrobiologyPastExamSummaries,
} from './quiz/microbiologyPastExamService.js';
import { createContentStore } from './content/contentStore.js';
import { importStaticCourseContent } from './content/contentImportService.js';
import { handleContentHttpRequest } from './content/contentHttpService.js';
import { handleActivityHttpRequest } from './activity/activityHttpService.js';
import { seedActivityCatalog } from './activity/activityService.js';
import { createStudentHomepageStore } from './studentHomepage/studentHomepageStore.js';
import { handleStudentHomepageHttpRequest } from './studentHomepage/studentHomepageHttpService.js';
import { handleSearchHttpRequest } from './search/searchHttpService.js';
import {
  maxAvatarBytes,
  readAvatarFile,
  removeAvatarFile,
  saveAvatarFile,
} from './profile/avatarService.js';
import { handleProfileHttpRequest } from './profile/profileHttpService.js';
import { handleAccountHttpRequest } from './account/accountHttpService.js';
import { loadServerCourseCatalog } from './account/courseCatalogService.js';
import { createLoginGuard, normalizeLoginKey } from './loginGuard.js';

const sessionCookieName = 'study_session';

function parseCookies(header = '') {
  return Object.fromEntries(
    header.split(';')
      .map((part) => part.trim().split('='))
      .filter(([key, value]) => key && value)
      .map(([key, value]) => [key, decodeURIComponent(value)]),
  );
}

// HI-SEC-1: cap JSON body size to prevent trivial memory-DoS via
//   unlimited for-await accumulation. The cap matches the largest
//   expected payload (a single submission with ~20 KB body + metadata).
const MAX_JSON_BODY_BYTES = 256 * 1024;

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

async function readJsonBody(request) {
  const declaredLength = Number(request.headers['content-length'] ?? 0);
  if (declaredLength > MAX_JSON_BODY_BYTES) {
    throw new HttpError(413, '请求体过大。');
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_JSON_BODY_BYTES) {
      throw new HttpError(413, '请求体过大。');
    }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

async function readBinaryBody(request, limit) {
  const declaredLength = Number(request.headers['content-length'] ?? 0);
  if (declaredLength > limit) return null;
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function sendJson(response, status, body, headers = {}) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    ...headers,
  });
  response.end(JSON.stringify(body));
}

// Client address for rate limiting. The server listens on 127.0.0.1 behind a
// reverse proxy, so the socket address is always local; read the first entry
// of X-Forwarded-For, which the proxy (Apache) injects and overwrites.
export function getClientIp(request) {
  const forwarded = request.headers?.['x-forwarded-for'];
  if (forwarded) {
    const first = String(forwarded).split(',')[0].trim();
    if (first) return first;
  }
  return request.socket?.remoteAddress ?? '';
}

// HTTPS detection behind the reverse proxy. The proxy terminates TLS and
// forwards X-Forwarded-Proto; only trust it for cookie flag decisions.
export function isHttpsRequest(request) {
  return String(request.headers['x-forwarded-proto'] ?? '')
    .split(',')[0]
    .trim()
    .toLowerCase() === 'https';
}

function setSessionCookie(sessionId, request) {
  const secure = isHttpsRequest(request) ? '; Secure' : '';
  return `${sessionCookieName}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`;
}

function clearSessionCookie(request) {
  const secure = isHttpsRequest(request) ? '; Secure' : '';
  return `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

function getAuthenticatedUserId(store, sessionId) {
  const session = sessionId ? store.findSession(sessionId) : null;
  return session?.userId ?? null;
}

function sendServiceResult(response, result, successStatus = 200, bodyKey = 'result') {
  if (!result?.ok && result?.status) {
    sendJson(response, result.status, { message: result.message });
    return;
  }

  sendJson(response, successStatus, { [bodyKey]: result });
}

function parseAdminCc98Names(value = '') {
  return new Set(String(value).split(',').map((name) => name.trim()).filter(Boolean));
}

function parseAdminStudentIds(value = '') {
  return new Set(String(value).split(',').map((id) => id.trim()).filter((id) => /^\d+$/.test(id)));
}

const staticCourseRoot = fileURLToPath(new URL('../public/resource/courses', import.meta.url));
const activityCatalog = JSON.parse(
  readFileSync(fileURLToPath(new URL('../public/content/activities/catalog.json', import.meta.url)), 'utf8'),
);

export function createAuthServer({
  store = createAuthStore({ filename: process.env.AUTH_DB_FILE ?? 'server/data/auth.sqlite' }),
  quizStore = createQuizStore({ filename: process.env.QUIZ_DB_FILE ?? process.env.AUTH_DB_FILE ?? 'server/data/auth.sqlite' }),
  contentStore = createContentStore({ filename: process.env.CONTENT_DB_FILE ?? 'server/data/content.sqlite' }),
  studentHomepageStore = createStudentHomepageStore({
    filename: process.env.STUDENT_HOMEPAGE_DB_FILE ?? 'server/data/student-homepages.sqlite',
  }),
  uploadDirectory = process.env.CONTENT_UPLOAD_DIR ?? 'server/data/content-uploads',
  avatarDirectory = process.env.PROFILE_AVATAR_DIR ?? 'server/data/profile-avatars',
  adminCc98Names = parseAdminCc98Names(process.env.ADMIN_CC98_NAMES),
  adminStudentIds = parseAdminStudentIds(process.env.ADMIN_STUDENT_IDS),
  adminInviteToken = String(process.env.ADMIN_INVITE_TOKEN ?? ''),
  emailSender = createSmtpEmailSender(),
  emailCodeGenerator,
  emailNow,
  // Tests can inject a custom guard; the runtime default uses createLoginGuard().
  loginGuard = createLoginGuard(),
  port = 5175,
} = {}) {
  store.initialize();
  store.seedVerificationCodes(getSeedVerificationCodes());
  for (const cc98Name of adminCc98Names) {
    store.promoteAdminByCc98Name(cc98Name);
  }
  for (const studentId of adminStudentIds) {
    store.promoteAdminByEmail(`${studentId}@zju.edu.cn`);
  }
  studentHomepageStore.initialize();
  studentHomepageStore.seedHomepages([
    {
      id: 'demo-homepage-1',
      name: '张明远',
      href: 'https://example.com/~zhangmy',
      sortOrder: 0,
    },
    {
      id: 'demo-homepage-2',
      name: '李雨桐',
      href: 'https://example.com/~liyutong',
      sortOrder: 1,
    },
    {
      id: 'demo-homepage-3',
      name: '王思源',
      href: 'https://example.com/~wangsy',
      sortOrder: 2,
    },
    {
      id: 'demo-homepage-4',
      name: '陈嘉宁',
      href: 'https://example.com/~chenjn',
      sortOrder: 3,
    },
  ]);
  quizStore.initialize();
  importConfiguredQuizCollections(quizStore);
  contentStore.initialize();
  importStaticCourseContent(contentStore, { rootDirectory: staticCourseRoot });
  seedActivityCatalog(contentStore, activityCatalog.activities);
  const courseCatalog = loadServerCourseCatalog();

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const cookies = parseCookies(request.headers.cookie);
      const sessionId = cookies[sessionCookieName] ?? '';
      const quizUserId = getAuthenticatedUserId(store, sessionId);
      const currentUser = getCurrentUser(store, sessionId);
      const quizAccountUserId = canLeaveSiteTrace(currentUser) ? quizUserId : null;

      if (request.method === 'GET' && url.pathname === '/api/health') {
        sendJson(response, 200, { ok: true });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/auth/me') {
        sendJson(response, 200, { user: getCurrentUser(store, sessionId) });
        return;
      }

      const avatarMatch = url.pathname.match(/^\/api\/profile-avatars\/([^/]+)$/);
      if (request.method === 'GET' && avatarMatch) {
        const storedName = decodeURIComponent(avatarMatch[1]);
        const avatar = readAvatarFile(avatarDirectory, storedName);
        if (!avatar) {
          sendJson(response, 404, { message: '头像不存在。' });
          return;
        }
        response.writeHead(200, {
          'content-type': 'image/webp',
          'content-length': avatar.length,
          'cache-control': 'public, max-age=86400',
          'x-content-type-options': 'nosniff',
        });
        response.end(avatar);
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/auth/register/cc98') {
        const result = await registerCc98(store, await readJsonBody(request), {
          adminCc98Names,
          expectedAdminInviteToken: adminInviteToken,
        });
        sendJson(response, result.status, result.ok ? { user: result.user } : { message: result.message });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/auth/login/cc98') {
        const body = await readJsonBody(request);
        const clientIp = getClientIp(request);
        const accountKey = normalizeLoginKey(body.cc98Name, 'cc98');
        const gate = loginGuard.check(accountKey, clientIp);
        if (!gate.ok) {
          sendJson(response, gate.status, { message: gate.message });
          return;
        }
        const result = await loginCc98(store, body);
        if (result.ok) {
          loginGuard.recordSuccess(accountKey);
          sendJson(
            response,
            result.status,
            { user: result.user },
            { 'set-cookie': setSessionCookie(result.sessionId, request) },
          );
        } else {
          loginGuard.recordFailure(accountKey, clientIp);
          sendJson(response, result.status, { message: result.message });
        }
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/auth/email/code') {
        const body = await readJsonBody(request);
        if (body.purpose === 'bind' && !quizUserId) {
          sendJson(response, 401, { message: '请先登录后绑定邮箱。' });
          return;
        }
        const remoteAddress = getClientIp(request);
        const result = await requestEmailCode(store, {
          ...body,
          requestIpHash: createHash('sha256').update(remoteAddress).digest('hex'),
        }, {
          sendEmail: emailSender,
          codeGenerator: emailCodeGenerator,
          now: emailNow,
        });
        sendJson(response, result.status, result.ok ? { message: result.message } : { message: result.message });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/auth/register/email') {
        const result = await registerEmail(store, await readJsonBody(request), {
          now: emailNow,
          adminStudentIds,
        });
        sendJson(response, result.status, result.ok ? { user: result.user } : { message: result.message });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/auth/login/email') {
        const body = await readJsonBody(request);
        const clientIp = getClientIp(request);
        const accountKey = normalizeLoginKey(body.studentId || body.email, 'email');
        const gate = loginGuard.check(accountKey, clientIp);
        if (!gate.ok) {
          sendJson(response, gate.status, { message: gate.message });
          return;
        }
        const result = await loginEmail(store, body);
        if (result.ok) {
          loginGuard.recordSuccess(accountKey);
          sendJson(
            response,
            result.status,
            { user: result.user },
            { 'set-cookie': setSessionCookie(result.sessionId, request) },
          );
        } else {
          loginGuard.recordFailure(accountKey, clientIp);
          sendJson(response, result.status, { message: result.message });
        }
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/auth/bind/email') {
        if (!quizUserId) {
          sendJson(response, 401, { message: '请先登录后绑定邮箱。' });
          return;
        }
        const result = await bindEmailIdentity(store, quizUserId, await readJsonBody(request), { now: emailNow });
        sendJson(response, result.status, result.ok ? { user: result.user } : { message: result.message });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/auth/password/reset/email') {
        const result = await resetPasswordByEmail(store, await readJsonBody(request), { now: emailNow });
        sendJson(response, result.status, result.ok ? { message: result.message } : { message: result.message });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
        logout(store, sessionId);
        sendJson(response, 200, { user: getCurrentUser(store, '') }, { 'set-cookie': clearSessionCookie(request) });
        return;
      }

      if (request.method === 'PUT' && url.pathname === '/api/account/cc98') {
        if (!quizUserId) {
          sendJson(response, 401, { message: '请先登录后绑定 CC98。' });
          return;
        }
        if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
          sendJson(response, 415, { message: '绑定请求格式无效。' });
          return;
        }
        // 0.1: 当前密码验证也走 loginGuard，否则攻击者可以无限重试
        // 暴力破解已登录账户的当前密码（用于 CC98 重绑/换绑场景）。
        // bind: 前缀只隔离账号失败计数；IP 频率窗口仍跨登录/绑定全局共享。
        const bindAccountKey = normalizeLoginKey(quizUserId, 'bind');
        const bindGate = loginGuard.check(bindAccountKey, getClientIp(request));
        if (!bindGate.ok) {
          sendJson(response, bindGate.status, { message: bindGate.message });
          return;
        }
        const result = await bindOrRebindCc98(
          store,
          quizUserId,
          sessionId,
          await readJsonBody(request),
        );
        if (result.ok) {
          loginGuard.recordSuccess(bindAccountKey);
        } else if (result.status === 401) {
          loginGuard.recordFailure(bindAccountKey, getClientIp(request));
        }
        sendJson(response, result.status, result.ok ? { user: result.user } : { message: result.message });
        return;
      }

      if (request.method === 'PUT' && url.pathname === '/api/account/profile/avatar') {
        if (!canLeaveSiteTrace(currentUser)) {
          sendJson(response, quizUserId ? 403 : 401, { message: '完成学号认证后才可以上传头像。' });
          return;
        }
        if (request.headers['x-profile-upload'] !== 'avatar') {
          sendJson(response, 415, { message: '头像上传请求格式无效。' });
          return;
        }
        const body = await readBinaryBody(request, maxAvatarBytes);
        if (!body) {
          sendJson(response, 413, { message: '头像不能超过 2 MB。' });
          return;
        }
        const saved = await saveAvatarFile({
          buffer: body,
          mimeType: request.headers['content-type'],
          uploadDirectory: avatarDirectory,
        });
        if (!saved.ok) {
          sendJson(response, saved.status, { message: saved.message });
          return;
        }
        const previous = store.findUserById(quizUserId);
        const next = store.updateAvatar(quizUserId, saved.file);
        if (previous?.avatarStoredName) removeAvatarFile(avatarDirectory, previous.avatarStoredName);
        sendJson(response, 200, { user: getCurrentUser(store, sessionId) });
        return;
      }

      if (request.method === 'DELETE' && url.pathname === '/api/account/profile/avatar') {
        if (!canLeaveSiteTrace(currentUser)) {
          sendJson(response, quizUserId ? 403 : 401, { message: '完成学号认证后才可以移除头像。' });
          return;
        }
        const previous = store.findUserById(quizUserId);
        store.updateAvatar(quizUserId, {});
        if (previous?.avatarStoredName) removeAvatarFile(avatarDirectory, previous.avatarStoredName);
        sendJson(response, 200, { user: getCurrentUser(store, sessionId) });
        return;
      }

      const accountHandled = await handleAccountHttpRequest({
        request,
        response,
        url,
        userId: quizUserId,
        user: currentUser,
        authStore: store,
        contentStore,
        sendJson,
        readJsonBody,
        readBinaryBody,
        catalogCodes: courseCatalog.codes,
      });
      if (accountHandled) {
        return;
      }
      const profileHandled = await handleProfileHttpRequest({
        request,
        response,
        url,
        sessionId,
        user: currentUser,
        userId: quizUserId,
        authStore: store,
        contentStore,
        sendJson,
        readJsonBody,
        uploadDirectory,
      });
      if (profileHandled) {
        return;
      }
      const activityHandled = await handleActivityHttpRequest({
        request,
        response,
        url,
        user: currentUser,
        userId: quizUserId,
        contentStore,
        sendJson,
        readJsonBody,
      });
      if (activityHandled) {
        return;
      }
      const studentHomepageHandled = await handleStudentHomepageHttpRequest({
        request,
        response,
        url,
        user: currentUser,
        userId: quizUserId,
        studentHomepageStore,
        sendJson,
        readJsonBody,
      });
      if (studentHomepageHandled) {
        return;
      }
      const searchHandled = handleSearchHttpRequest({
        request,
        response,
        url,
        contentStore,
        courseCatalog,
        studentHomepageStore,
        sendJson,
      });
      if (searchHandled) {
        return;
      }
      const contentHandled = await handleContentHttpRequest({
        request,
        response,
        url,
        user: currentUser,
        userId: quizUserId,
        contentStore,
        authStore: store,
        uploadDirectory,
        sendJson,
        readJsonBody,
      });
      if (contentHandled) {
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/quiz/collections') {
        const courseCode = url.searchParams.get('courseCode') ?? '';
        const collections = quizStore
          .listCollections()
          .filter((collection) => !courseCode || collection.courseCode === courseCode);
        sendJson(response, 200, { collections });
        return;
      }

      const categoriesMatch = url.pathname.match(/^\/api\/quiz\/collections\/([^/]+)\/categories$/);
      if (request.method === 'GET' && categoriesMatch) {
        const collection = quizStore.findCollectionBySlug(categoriesMatch[1]);
        if (!collection) {
          sendJson(response, 404, { message: '题库不存在。' });
          return;
        }
        sendJson(response, 200, { categories: quizStore.listCategories(collection.id) });
        return;
      }

      const reviewTermsMatch = url.pathname.match(/^\/api\/quiz\/collections\/([^/]+)\/review-terms$/);
      if (request.method === 'GET' && reviewTermsMatch) {
        const repeatedIds = url.searchParams.getAll('categorySourceIds');
        const commaIds = (url.searchParams.get('categorySourceIds') ?? '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
        const categorySourceIds = repeatedIds.length > 1 ? repeatedIds : commaIds;
        const result = getTranslationReviewTerms(quizStore, {
          collectionSlug: reviewTermsMatch[1],
          categorySourceIds,
        });
        if (!result?.ok && result?.status) {
          sendJson(response, result.status, { message: result.message });
          return;
        }
        sendJson(response, 200, { terms: result.terms });
        return;
      }

      const imageGalleryMatch = url.pathname.match(/^\/api\/quiz\/collections\/([^/]+)\/image-gallery$/);
      if (request.method === 'GET' && imageGalleryMatch) {
        const result = getImageRevealGallery(quizStore, {
          collectionSlug: imageGalleryMatch[1],
        });
        if (!result?.ok && result?.status) {
          sendJson(response, result.status, { message: result.message });
          return;
        }
        sendJson(response, 200, { items: result.items });
        return;
      }

      const pastExamsMatch = url.pathname.match(/^\/api\/quiz\/collections\/([^/]+)\/past-exams$/);
      if (request.method === 'GET' && pastExamsMatch) {
        const collection = quizStore.findCollectionBySlug(pastExamsMatch[1]);
        if (!collection || collection.slug !== 'microbiology-final-review') {
          sendJson(response, 404, { message: '真题题库不存在。' });
          return;
        }
        sendJson(response, 200, { exams: listMicrobiologyPastExamSummaries() });
        return;
      }

      const pastExamQuestionsMatch = url.pathname.match(/^\/api\/quiz\/collections\/([^/]+)\/past-exams\/([^/]+)\/questions$/);
      if (request.method === 'GET' && pastExamQuestionsMatch) {
        const collection = quizStore.findCollectionBySlug(pastExamQuestionsMatch[1]);
        if (!collection || collection.slug !== 'microbiology-final-review') {
          sendJson(response, 404, { message: '真题题库不存在。' });
          return;
        }
        const questions = getMicrobiologyPastExamQuestions(pastExamQuestionsMatch[2]);
        if (!questions.length) {
          sendJson(response, 404, { message: '真题不存在。' });
          return;
        }
        sendJson(response, 200, { questions });
        return;
      }

      const pastExamAnswersMatch = url.pathname.match(/^\/api\/quiz\/collections\/([^/]+)\/past-exams\/([^/]+)\/answers$/);
      if (request.method === 'POST' && pastExamAnswersMatch) {
        const collection = quizStore.findCollectionBySlug(pastExamAnswersMatch[1]);
        if (!collection || collection.slug !== 'microbiology-final-review') {
          sendJson(response, 404, { message: '真题题库不存在。' });
          return;
        }
        const body = await readJsonBody(request);
        const result = getMicrobiologyPastExamFeedback(pastExamAnswersMatch[2], {
          questionNumber: body.questionNumber,
          selectedKey: body.selectedKey,
        });
        sendServiceResult(response, result);
        return;
      }

      if (url.pathname.startsWith('/api/quiz/')) {
        if (request.method === 'GET' && url.pathname === '/api/quiz/account-state') {
          if (!quizAccountUserId) {
            sendJson(response, 401, { message: '请先登录后同步学习记录。' });
            return;
          }
          sendJson(response, 200, {
            state: getQuizAccountState(quizStore, {
              userId: quizAccountUserId,
              collectionSlug: url.searchParams.get('collectionSlug') ?? '',
            }),
          });
          return;
        }

        if (request.method === 'POST' && url.pathname === '/api/quiz/account-state/merge') {
          if (!quizAccountUserId) {
            sendJson(response, 401, { message: '请先登录后同步学习记录。' });
            return;
          }
          const body = await readJsonBody(request);
          const result = mergeQuizAccountState(quizStore, { userId: quizAccountUserId, ...body });
          sendJson(response, result.status, result.ok ? { state: result.state } : { message: result.message });
          return;
        }

        const claimSessionMatch = url.pathname.match(/^\/api\/quiz\/sessions\/([^/]+)\/claim$/);
        if (request.method === 'POST' && claimSessionMatch) {
          if (!quizAccountUserId) {
            sendJson(response, 401, { message: '请先登录后认领练习记录。' });
            return;
          }
          const result = claimPracticeSession(quizStore, {
            userId: quizAccountUserId,
            sessionId: decodeURIComponent(claimSessionMatch[1]),
          });
          sendJson(response, result.ok ? 200 : result.status, result.ok ? { session: result.session } : { message: result.message });
          return;
        }

        const vocabularyMatch = url.pathname.match(/^\/api\/quiz\/vocabulary\/([^/]+)\/([^/]+)$/);
        if ((request.method === 'PUT' || request.method === 'DELETE') && vocabularyMatch) {
          if (!quizAccountUserId) {
            sendJson(response, 401, { message: '请先登录后管理生词本。' });
            return;
          }
          const input = {
            userId: quizAccountUserId,
            collectionSlug: decodeURIComponent(vocabularyMatch[1]),
            recordKey: decodeURIComponent(vocabularyMatch[2]),
          };
          const result = request.method === 'PUT'
            ? upsertVocabularyRecord(quizStore, { ...input, ...(await readJsonBody(request)) })
            : removeVocabularyRecord(quizStore, input);
          sendJson(response, result.status, result.ok ? (result.record ? { record: result.record } : { ok: true }) : { message: result.message });
          return;
        }

        if (request.method === 'POST' && url.pathname === '/api/quiz/sessions') {
          const body = await readJsonBody(request);
          const result = createPracticeSession(quizStore, {
            userId: quizAccountUserId,
            collectionSlug: body.collectionSlug,
            mode: body.mode,
            categorySourceIds: body.categorySourceIds,
            sourceQuestionIds: body.sourceQuestionIds,
            limit: body.limit,
          });
          sendServiceResult(response, result, 201, 'session');
          return;
        }

        const sessionLookupMatch = url.pathname.match(/^\/api\/quiz\/sessions\/([^/]+)$/);
        if (request.method === 'GET' && sessionLookupMatch) {
          const result = getPracticeSession(quizStore, {
            userId: quizAccountUserId,
            sessionId: sessionLookupMatch[1],
          });
          sendServiceResult(response, result, 200, 'session');
          return;
        }

        const sessionNavigationMatch = url.pathname.match(/^\/api\/quiz\/sessions\/([^/]+)\/navigation$/);
        if (request.method === 'POST' && sessionNavigationMatch) {
          const body = await readJsonBody(request);
          const result = navigatePracticeSession(quizStore, {
            userId: quizAccountUserId,
            sessionId: sessionNavigationMatch[1],
            direction: body.direction,
            currentIndex: body.currentIndex,
          });
          sendServiceResult(response, result, 200, 'session');
          return;
        }

        const sessionAnswerMatch = url.pathname.match(/^\/api\/quiz\/sessions\/([^/]+)\/answers$/);
        if (request.method === 'POST' && sessionAnswerMatch) {
          const body = await readJsonBody(request);
          const result = submitSessionAnswer(quizStore, {
            userId: quizAccountUserId,
            sessionId: sessionAnswerMatch[1],
            sourceQuestionId: body.sourceQuestionId,
            answer: body.answer,
          });
          sendServiceResult(response, result);
          return;
        }

        const sessionRevealMatch = url.pathname.match(/^\/api\/quiz\/sessions\/([^/]+)\/reveals$/);
        if (request.method === 'POST' && sessionRevealMatch) {
          const body = await readJsonBody(request);
          const result = revealSessionAnswer(quizStore, {
            userId: quizAccountUserId,
            sessionId: sessionRevealMatch[1],
            sourceQuestionId: body.sourceQuestionId,
          });
          sendServiceResult(response, result);
          return;
        }

        const sessionSelfJudgeMatch = url.pathname.match(/^\/api\/quiz\/sessions\/([^/]+)\/self-judgements$/);
        if (request.method === 'POST' && sessionSelfJudgeMatch) {
          const body = await readJsonBody(request);
          const result = selfJudgeSessionAnswer(quizStore, {
            userId: quizAccountUserId,
            sessionId: sessionSelfJudgeMatch[1],
            sourceQuestionId: body.sourceQuestionId,
            isCorrect: body.isCorrect,
          });
          sendServiceResult(response, result);
          return;
        }

        if (request.method === 'POST' && url.pathname === '/api/quiz/mistakes') {
          if (!quizAccountUserId) {
            sendJson(response, 401, { message: '登录成为用户后可以保存错题本。' });
            return;
          }
          const body = await readJsonBody(request);
          const result = addManualMistake(quizStore, {
            userId: quizAccountUserId,
            collectionSlug: body.collectionSlug,
            sourceQuestionId: body.sourceQuestionId,
            answer: body.answer,
          });
          sendServiceResult(response, result, 201, 'mistake');
          return;
        }

        if (request.method === 'GET' && url.pathname === '/api/quiz/progress') {
          if (!quizAccountUserId) {
            sendJson(response, 401, { message: '登录成为用户后可以保存练习进度。' });
            return;
          }
          sendJson(response, 200, {
            progress: getProgress(quizStore, {
              userId: quizAccountUserId,
              collectionSlug: url.searchParams.get('collectionSlug') ?? '',
            }),
          });
          return;
        }

        const deleteMistakeMatch = url.pathname.match(/^\/api\/quiz\/mistakes\/([^/]+)$/);
        if (request.method === 'DELETE' && deleteMistakeMatch) {
          if (!quizAccountUserId) {
            sendJson(response, 401, { message: '登录成为用户后可以管理错题本。' });
            return;
          }
          const result = removeMistake(quizStore, {
            userId: quizAccountUserId,
            collectionSlug: url.searchParams.get('collectionSlug') ?? '',
            sourceQuestionId: deleteMistakeMatch[1],
          });
          sendServiceResult(response, result);
          return;
        }

        if (request.method === 'GET' && url.pathname === '/api/quiz/mistakes') {
          if (!quizAccountUserId) {
            sendJson(response, 401, { message: '登录成为用户后可以查看错题本。' });
            return;
          }
          sendJson(response, 200, {
            mistakes: getMistakes(quizStore, {
              userId: quizAccountUserId,
              collectionSlug: url.searchParams.get('collectionSlug') ?? '',
            }),
          });
          return;
        }

        if (request.method === 'POST' && url.pathname === '/api/quiz/progress/reset') {
          if (!quizAccountUserId) {
            sendJson(response, 401, { message: '登录成为用户后可以重置练习记录。' });
            return;
          }
          const body = await readJsonBody(request);
          const result = resetPracticeRecords(quizStore, {
            userId: quizAccountUserId,
            collectionSlug: body.collectionSlug,
            scope: body.scope,
          });
          sendServiceResult(response, result);
          return;
        }
      }

      sendJson(response, 404, { message: 'Not found' });
    } catch (error) {
      // HI-SEC-1: HttpError carries a client-safe status (e.g. 413 for
      // over-sized body) so we don't have to wrap every handler.
      if (error instanceof HttpError) {
        sendJson(response, error.statusCode, { message: error.message });
        return;
      }
      // Surface uncaught errors with structured context so production incidents
      // leave a trail. The generic 500 keeps the public surface stable.
      const ctx = {
        method: request.method,
        path: url?.pathname ?? '',
        userId: quizUserId || null,
        error: error?.message ?? String(error),
        stack: error?.stack,
      };
      console.error('[server] uncaught error', ctx);
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
  if (!scriptPath) {
    return false;
  }

  const isWindowsPath = /^[A-Za-z]:[\\/]/.test(scriptPath);
  return moduleUrl === pathToFileURL(scriptPath, { windows: isWindowsPath }).href;
}

if (isDirectRun(import.meta.url, process.argv[1])) {
  createAuthServer({ port: Number(process.env.PORT ?? 5175) }).listen();
}
