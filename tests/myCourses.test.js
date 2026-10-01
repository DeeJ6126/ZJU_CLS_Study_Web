import test from 'node:test';
import assert from 'node:assert/strict';
import { loadServerCourseCatalog } from '../server/account/courseCatalogService.js';
import { cleanMyCourses, courseListPreset, myCourseViews, searchCoursePicker } from '../src/services/myCourseService.js';
import { readLocalWorkspace, updateLocalWorkspace } from '../src/services/localWorkspaceService.js';
import { initializeCourseWorkspace } from '../server/account/courseWorkspaceService.js';
import { createAuthStore } from '../server/authStore.js';
import { createAuthServer } from '../server/server.js';
import { createQuizStore } from '../server/quiz/quizStore.js';
import { createContentStore } from '../server/content/contentStore.js';
import { createStudentHomepageStore } from '../server/studentHomepage/studentHomepageStore.js';
import { createConsultationStore } from '../server/consultation/consultationStore.js';

const { allCourses: catalog } = loadServerCourseCatalog();
const profile = { majorId: 'biology', grade: 2025 };
const now = '2026-10-01T00:00:00+08:00';
const preset = () => courseListPreset({ majorId: profile.majorId, cohortYear: profile.grade, courses: catalog, now });

test('malformed browser course rows are discarded safely', () => {
  assert.deepEqual(cleanMyCourses([{ courseCode: 12345, courseName: '无效' }, { courseCode: 'BIO2011F', courseName: null }, null]), []);
});

test('preset uses professional sections including foundation courses, not personal electives', () => {
  const result = preset();
  assert.equal(result.status, 'ready');
  assert.deepEqual(result.courses.map((course) => course.courseCode), ['BIO2011F', 'BIO2012F', 'CHEM1007F', 'BIO2028M']);
  assert.ok(!result.courses.some((course) => course.courseName === '英语口语'));
  const views = myCourseViews(result.courses, catalog);
  assert.equal(views.find((course) => course.courseCode === 'CHEM1007F').href, '');
  assert.equal(views.find((course) => course.courseCode === 'BIO2011F').href, '#resources/#BIO2011F');
});

test('course picker searches full catalog by name or code and marks duplicates', () => {
  const english = searchCoursePicker(catalog, '英语口语')[0];
  assert.equal(english.code, 'BIO3066M');
  assert.equal(searchCoursePicker(catalog, 'bio3066m')[0].name, '英语口语');
  assert.equal(searchCoursePicker(catalog, 'ＢＩＯ３０６６Ｍ')[0].name, '英语口语');
  assert.equal(searchCoursePicker(catalog, '英语', [{ courseCode: 'BIO3066M' }])[0].selected, true);
  assert.deepEqual(searchCoursePicker(catalog, ''), []);
});

test('guest course edits and an intentionally empty list persist independently from favorites and accounts', () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
  updateLocalWorkspace('guest', { majorId: 'biology', cohortYear: 2025, myCourses: preset().courses, coursesInitialized: true, courseFavorites: ['BIO2110F'] }, storage);
  updateLocalWorkspace('guest', { myCourses: [], coursesInitialized: true }, storage);
  const local = readLocalWorkspace('guest', storage);
  assert.deepEqual(local.myCourses, []);
  assert.equal(local.coursesInitialized, true);
  assert.deepEqual(local.courseFavorites, ['BIO2110F']);
  assert.deepEqual(readLocalWorkspace('account-1', storage).myCourses, []);
  assert.equal(readLocalWorkspace('account-1', storage).coursesInitialized, false);
});

test('account initialization happens once, preserves custom and old imported lists, and does not refill deletions', () => {
  const store = createAuthStore({ filename: ':memory:' });
  store.initialize();
  try {
    const first = initializeCourseWorkspace(store, 1, profile, catalog, { now });
    assert.equal(first.courses.length, 4);
    for (const course of first.courses) store.removeUserCourse(1, course.courseCode);
    assert.deepEqual(initializeCourseWorkspace(store, 1, profile, catalog, { now }).courses, []);
    assert.equal(initializeCourseWorkspace(store, 1, profile, catalog, { now, reset: true }).courses.length, 4);
    store.upsertUserCourse(2, { courseCode: 'BIO3066M', courseName: '英语口语', teacherName: '老师', term: '原课表' });
    assert.equal(initializeCourseWorkspace(store, 2, profile, catalog, { now }).courses[0].courseName, '英语口语');
    assert.equal(initializeCourseWorkspace(store, 2, { majorId: 'biology', grade: 2023 }, catalog, { now, reset: true }).status, 'no-program');
    assert.equal(store.listUserCourses(2)[0].term, '原课表');
    assert.equal(store.countCourseFavoriteUsers('BIO2011F'), 0);
  } finally { store.close(); }
});

test('real account APIs initialize and edit personal courses without granting guest write access', async () => {
  const stores = { store: createAuthStore({ filename: ':memory:' }), quizStore: createQuizStore({ filename: ':memory:' }),
    contentStore: createContentStore({ filename: ':memory:' }), studentHomepageStore: createStudentHomepageStore({ filename: ':memory:' }),
    consultationStore: createConsultationStore({ filename: ':memory:' }) };
  const { server } = createAuthServer(stores);
  const user = stores.store.createUser({ email: '3250100900@zju.edu.cn', nickname: '课程测试', passwordHash: 'hash' });
  stores.store.updateStudyProfile(user.id, profile);
  stores.store.createSession({ id: 'course-session', userId: user.id });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, options = {}) => fetch(`${base}${path}`, { ...options, headers: { cookie: 'study_session=course-session', 'content-type': 'application/json', ...options.headers } });
  try {
    assert.equal((await fetch(`${base}/api/account/courses/preset`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status, 401);
    const initial = await (await request('/api/account/courses')).json();
    assert.ok(initial.courses.some((course) => course.courseCode === 'BIO2011F'));
    await request('/api/account/courses/BIO3066M', { method: 'POST', body: JSON.stringify({ courseName: '英语口语' }) });
    await request('/api/account/courses/BIO2011F', { method: 'DELETE' });
    const changed = await (await request('/api/account/courses')).json();
    assert.ok(changed.courses.some((course) => course.courseName === '英语口语'));
    assert.ok(!changed.courses.some((course) => course.courseCode === 'BIO2011F'));
    await request('/api/account/courses', { method: 'PUT', body: JSON.stringify({ courses: [] }) });
    assert.deepEqual((await (await request('/api/account/courses')).json()).courses, []);
    assert.equal((await request('/api/account/courses/preset', { method: 'POST', body: '{}' })).status, 200);
  } finally {
    server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
    for (const store of Object.values(stores)) store.close?.();
  }
});
