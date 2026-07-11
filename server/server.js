import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

import { getSeedVerificationCodes } from './verificationSeed.js';
import { createAuthStore } from './authStore.js';
import { getCurrentUser, loginCc98, logout, registerCc98 } from './authService.js';
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
  getMicrobiologyPastExamFeedback,
  getMicrobiologyPastExamQuestions,
  listMicrobiologyPastExamSummaries,
} from './quiz/microbiologyPastExamService.js';

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

export function createAuthServer({ store = createAuthStore(), quizStore = createQuizStore(), port = 5175 } = {}) {
  store.initialize();
  store.seedVerificationCodes(getSeedVerificationCodes());
  quizStore.initialize();
  importConfiguredQuizCollections(quizStore);

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const cookies = parseCookies(request.headers.cookie);
      const sessionId = cookies[sessionCookieName] ?? '';
      const quizUserId = getAuthenticatedUserId(store, sessionId);

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
        if (request.method === 'POST' && url.pathname === '/api/quiz/sessions') {
          const body = await readJsonBody(request);
          const result = createPracticeSession(quizStore, {
            userId: quizUserId,
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
            userId: quizUserId,
            sessionId: sessionLookupMatch[1],
          });
          sendServiceResult(response, result, 200, 'session');
          return;
        }

        const sessionNavigationMatch = url.pathname.match(/^\/api\/quiz\/sessions\/([^/]+)\/navigation$/);
        if (request.method === 'POST' && sessionNavigationMatch) {
          const body = await readJsonBody(request);
          const result = navigatePracticeSession(quizStore, {
            userId: quizUserId,
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
            userId: quizUserId,
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
            userId: quizUserId,
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
            userId: quizUserId,
            sessionId: sessionSelfJudgeMatch[1],
            sourceQuestionId: body.sourceQuestionId,
            isCorrect: body.isCorrect,
          });
          sendServiceResult(response, result);
          return;
        }

        if (request.method === 'POST' && url.pathname === '/api/quiz/mistakes') {
          if (!quizUserId) {
            sendJson(response, 401, { message: '登录成为用户后可以保存错题本。' });
            return;
          }
          const body = await readJsonBody(request);
          const result = addManualMistake(quizStore, {
            userId: quizUserId,
            collectionSlug: body.collectionSlug,
            sourceQuestionId: body.sourceQuestionId,
            answer: body.answer,
          });
          sendServiceResult(response, result, 201, 'mistake');
          return;
        }

        if (request.method === 'GET' && url.pathname === '/api/quiz/progress') {
          if (!quizUserId) {
            sendJson(response, 401, { message: '登录成为用户后可以保存练习进度。' });
            return;
          }
          sendJson(response, 200, {
            progress: getProgress(quizStore, {
              userId: quizUserId,
              collectionSlug: url.searchParams.get('collectionSlug') ?? '',
            }),
          });
          return;
        }

        const deleteMistakeMatch = url.pathname.match(/^\/api\/quiz\/mistakes\/([^/]+)$/);
        if (request.method === 'DELETE' && deleteMistakeMatch) {
          if (!quizUserId) {
            sendJson(response, 401, { message: '登录成为用户后可以管理错题本。' });
            return;
          }
          const result = removeMistake(quizStore, {
            userId: quizUserId,
            collectionSlug: url.searchParams.get('collectionSlug') ?? '',
            sourceQuestionId: deleteMistakeMatch[1],
          });
          sendServiceResult(response, result);
          return;
        }

        if (request.method === 'GET' && url.pathname === '/api/quiz/mistakes') {
          if (!quizUserId) {
            sendJson(response, 401, { message: '登录成为用户后可以查看错题本。' });
            return;
          }
          sendJson(response, 200, {
            mistakes: getMistakes(quizStore, {
              userId: quizUserId,
              collectionSlug: url.searchParams.get('collectionSlug') ?? '',
            }),
          });
          return;
        }

        if (request.method === 'POST' && url.pathname === '/api/quiz/progress/reset') {
          if (!quizUserId) {
            sendJson(response, 401, { message: '登录成为用户后可以重置练习记录。' });
            return;
          }
          const body = await readJsonBody(request);
          const result = resetPracticeRecords(quizStore, {
            userId: quizUserId,
            collectionSlug: body.collectionSlug,
            scope: body.scope,
          });
          sendServiceResult(response, result);
          return;
        }
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
