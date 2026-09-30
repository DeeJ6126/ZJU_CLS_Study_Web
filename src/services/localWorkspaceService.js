import { majorOptions } from '../data/courses/programCatalog.js';

const storagePrefix = 'zjubio:local-workspace:v1:';
const majorIds = new Set(majorOptions.filter((option) => option.available).map((option) => option.id));
const contentTypes = new Set(['experience', 'material', 'paper']);

function browserStorage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

function emptyWorkspace() {
  return {
    majorId: '', cohortYear: null, onboardingDismissed: false,
    courseFavorites: [], contentFavorites: [], lastQuiz: null,
  };
}

function cleanWorkspace(value) {
  const data = value && typeof value === 'object' ? value : {};
  const year = Number(data.cohortYear);
  const courseFavorites = Array.isArray(data.courseFavorites) ? data.courseFavorites : [];
  const contentFavorites = Array.isArray(data.contentFavorites) ? data.contentFavorites : [];
  const lastQuiz = data.lastQuiz && typeof data.lastQuiz === 'object' ? data.lastQuiz : null;
  return {
    majorId: majorIds.has(data.majorId) ? data.majorId : '',
    cohortYear: data.cohortYear != null && Number.isInteger(year) && year >= 2023 && year <= 2035 ? year : null,
    onboardingDismissed: data.onboardingDismissed === true,
    courseFavorites: [...new Set(courseFavorites.filter((code) => typeof code === 'string' && /^[A-Z0-9-]{3,24}$/.test(code)))],
    contentFavorites: [...new Map(contentFavorites.filter((item) => item && typeof item.id === 'string'
      && item.id && contentTypes.has(item.type) && typeof item.courseCode === 'string')
      .map((item) => [item.id, {
        id: item.id, routeId: String(item.routeId ?? item.id), courseCode: item.courseCode,
        type: item.type, title: String(item.title ?? '').slice(0, 120), summary: String(item.summary ?? '').slice(0, 240),
      }])).values()],
    lastQuiz: lastQuiz && /^[A-Z0-9-]{3,24}$/.test(String(lastQuiz.courseCode ?? ''))
      ? {
        courseCode: lastQuiz.courseCode,
        collectionSlug: String(lastQuiz.collectionSlug ?? '').slice(0, 100),
        sessionId: String(lastQuiz.sessionId ?? '').slice(0, 100),
        updatedAt: String(lastQuiz.updatedAt ?? ''),
      } : null,
  };
}

export function readLocalWorkspace(scope = 'guest', storage = browserStorage()) {
  if (!storage) return emptyWorkspace();
  try { return cleanWorkspace(JSON.parse(storage.getItem(`${storagePrefix}${scope}`))); }
  catch { return emptyWorkspace(); }
}

export function updateLocalWorkspace(scope, changes, storage = browserStorage()) {
  if (!storage) return { ok: false, message: '当前浏览器不允许保存本机数据。' };
  const value = cleanWorkspace({ ...readLocalWorkspace(scope, storage), ...changes });
  try {
    storage.setItem(`${storagePrefix}${scope}`, JSON.stringify(value));
    return { ok: true, value };
  } catch {
    return { ok: false, message: '本机数据保存失败，请检查浏览器的站点存储设置。' };
  }
}

export function toggleLocalCourseFavorite(scope, courseCode, storage = browserStorage()) {
  const current = readLocalWorkspace(scope, storage);
  const courseFavorites = current.courseFavorites.includes(courseCode)
    ? current.courseFavorites.filter((code) => code !== courseCode)
    : [...current.courseFavorites, courseCode];
  return updateLocalWorkspace(scope, { courseFavorites }, storage);
}

export function toggleLocalContentFavorite(scope, item, storage = browserStorage()) {
  const current = readLocalWorkspace(scope, storage);
  const contentFavorites = current.contentFavorites.some((favorite) => favorite.id === item?.id)
    ? current.contentFavorites.filter((favorite) => favorite.id !== item.id)
    : [...current.contentFavorites, item];
  return updateLocalWorkspace(scope, { contentFavorites }, storage);
}

export function recordLocalQuiz(scope, quiz, storage = browserStorage()) {
  const entry = {
    courseCode: quiz.courseCode,
    collectionSlug: quiz.collectionSlug ?? '',
    sessionId: quiz.sessionId ?? '',
    updatedAt: new Date().toISOString(),
  };
  return updateLocalWorkspace(scope, { lastQuiz: entry }, storage);
}
