import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyGuestMerge, buildGuestMergePreview, markGuestMergeConfirmed, wasGuestMergeConfirmed,
} from '../src/services/guestMergeService.js';

function storage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('merge preview lists only missing favorites and preserves existing account preferences', () => {
  const preview = buildGuestMergePreview({
    workspace: {
      majorId: 'biology', cohortYear: 2025, courseFavorites: ['BIO2011F', 'BIO2012F'],
      contentFavorites: [{ id: 'a', title: '心得' }, { id: 'b', title: '试卷' }], quizSessions: [],
    },
    quizGroups: [{ collectionSlug: 'botany-slice', mistakes: [{ sourceQuestionId: 'x' }], vocabulary: [] }],
    account: {
      user: { majorId: 'ecology', grade: 2024 }, courseFavorites: ['BIO2011F'], favorites: [{ id: 'a' }],
    },
  });
  assert.deepEqual(preview.courseFavorites, ['BIO2012F']);
  assert.deepEqual(preview.contentFavorites.map((item) => item.id), ['b']);
  assert.deepEqual(preview.studyProfile, { majorId: 'ecology', grade: 2024 });
  assert.equal(preview.profileWillChange, false);
  assert.equal(preview.hasChanges, true);
  const local = storage();
  assert.equal(wasGuestMergeConfirmed('email-1', preview.sourceFingerprint, local), false);
  markGuestMergeConfirmed('email-1', preview.sourceFingerprint, local);
  assert.equal(wasGuestMergeConfirmed('email-1', preview.sourceFingerprint, local), true);
});

test('merge writes only after confirmation and stops before marking failed work complete', async () => {
  const calls = [];
  const preview = {
    profileWillChange: true, studyProfile: { majorId: 'biology', grade: 2025 },
    courseFavorites: ['BIO2011F'], contentFavorites: [{ id: 'note-1' }],
    quiz: [{ collectionSlug: 'microbiology-final-review', mistakes: [{ sourceQuestionId: 'q1' }], vocabulary: [] }],
    quizSessions: [{ sessionId: `quiz_${'a'.repeat(32)}` }],
  };
  assert.deepEqual(calls, []);
  const clients = {
    profileClient: { updateMyStudyProfile: async (value) => { calls.push(['profile', value]); return { ok: true, user: { grade: 2025 } }; } },
    accountClient: {
      addCourseFavorite: async (code) => { calls.push(['course', code]); return { ok: true }; },
      addFavorite: async (id) => { calls.push(['content', id]); return { ok: true }; },
    },
    quizClient: {
      mergeQuizAccountState: async (value) => { calls.push(['quiz', value.collectionSlug]); return { ok: true }; },
      claimQuizSession: async (id) => { calls.push(['session', id]); return { ok: true }; },
    },
  };
  assert.equal((await applyGuestMerge(preview, clients)).ok, true);
  assert.deepEqual(calls.map(([kind]) => kind), ['profile', 'course', 'content', 'quiz', 'session']);
  clients.accountClient.addFavorite = async () => ({ ok: false, message: '网络中断' });
  assert.equal((await applyGuestMerge(preview, clients)).message, '网络中断');
});
