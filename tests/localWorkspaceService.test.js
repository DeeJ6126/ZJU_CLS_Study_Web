import test from 'node:test';
import assert from 'node:assert/strict';

import {
  readLocalWorkspace, recordLocalQuiz, toggleLocalContentFavorite, toggleLocalCourseFavorite, updateLocalWorkspace,
} from '../src/services/localWorkspaceService.js';

function storage() {
  const entries = new Map();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    entries,
  };
}

test('guest profile and favorites persist locally without mixing demo scopes', () => {
  const local = storage();
  assert.equal(updateLocalWorkspace('guest', { majorId: 'biology', cohortYear: 2025 }, local).ok, true);
  toggleLocalCourseFavorite('guest', 'BIO2011F', local);
  toggleLocalContentFavorite('guest', {
    id: 'note-1', routeId: '1', type: 'experience', courseCode: 'BIO2011F', title: '学习心得', summary: '期末',
  }, local);
  assert.deepEqual(readLocalWorkspace('guest', local).courseFavorites, ['BIO2011F']);
  assert.deepEqual(readLocalWorkspace('guest', local).contentFavorites.map((item) => item.id), ['note-1']);
  recordLocalQuiz('guest', { courseCode: 'BIO2110F', collectionSlug: 'microbiology-final-review', sessionId: `quiz_${'a'.repeat(32)}` }, local);
  assert.equal(readLocalWorkspace('guest', local).quizSessions.length, 1);
  assert.equal(readLocalWorkspace('guest', local).lastQuiz.courseCode, 'BIO2110F');
  assert.equal(readLocalWorkspace('guest', local).cohortYear, 2025);
  assert.equal(readLocalWorkspace('demo-student', local).majorId, '');
  assert.deepEqual([...local.entries.keys()], ['zjubio:local-workspace:v1:guest']);
  toggleLocalCourseFavorite('guest', 'BIO2011F', local);
  toggleLocalContentFavorite('guest', { id: 'note-1' }, local);
  assert.deepEqual(readLocalWorkspace('guest', local).courseFavorites, []);
  assert.deepEqual(readLocalWorkspace('guest', local).contentFavorites, []);
});

test('invalid or unavailable local storage never grants fake persisted state', () => {
  const local = storage();
  local.setItem('zjubio:local-workspace:v1:guest', '{invalid');
  assert.equal(readLocalWorkspace('guest', local).majorId, '');
  assert.equal(updateLocalWorkspace('guest', { majorId: 'unknown', cohortYear: 1900 }, local).value.cohortYear, null);
  assert.equal(updateLocalWorkspace('guest', { majorId: 'biology' }, null).ok, false);
});
