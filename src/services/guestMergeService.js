import { readBotanyMistakes } from './botanyQuizService.js';
import { readMicrobiologyMistakes, readMicrobiologyVocabularyRecords } from './microbiologyQuizService.js';
import { readMolecularMistakes, readVocabularyRecords } from './molecularQuizService.js';

const markerPrefix = 'zjubio:guest-merge:v1:';

function browserStorage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

export function readLocalQuizForMerge(scope = 'guest', storage = browserStorage()) {
  return [
    { collectionSlug: 'molecular-biology-review', mistakes: readMolecularMistakes(scope, storage), vocabulary: readVocabularyRecords(scope, storage) },
    { collectionSlug: 'botany-slice', mistakes: readBotanyMistakes(scope, storage), vocabulary: [] },
    { collectionSlug: 'microbiology-final-review', mistakes: readMicrobiologyMistakes(scope, storage), vocabulary: readMicrobiologyVocabularyRecords(scope, storage) },
  ];
}

function fingerprint(value) {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${text.length}:${(hash >>> 0).toString(16)}`;
}

export function buildGuestMergePreview({ workspace, quizGroups, account }) {
  const existingCourses = new Set(account.courseFavorites ?? []);
  const existingContent = new Set((account.favorites ?? []).map((item) => item.id));
  const courseFavorites = workspace.courseFavorites.filter((code) => !existingCourses.has(code));
  const contentFavorites = workspace.contentFavorites.filter((item) => !existingContent.has(item.id));
  const studyProfile = {
    majorId: account.user?.majorId || workspace.majorId || '',
    grade: account.user?.grade ?? workspace.cohortYear ?? null,
  };
  const profileWillChange = Boolean((!account.user?.majorId && workspace.majorId)
    || (account.user?.grade == null && workspace.cohortYear != null));
  const quiz = quizGroups.filter((group) => group.mistakes.length || group.vocabulary.length);
  const quizSessions = workspace.quizSessions ?? [];
  return {
    courseFavorites, contentFavorites, studyProfile, profileWillChange,
    quiz, quizSessions,
    hasChanges: Boolean(courseFavorites.length || contentFavorites.length || profileWillChange
      || quiz.length || quizSessions.length),
    sourceFingerprint: fingerprint({ workspace, quizGroups }),
  };
}

export function wasGuestMergeConfirmed(userId, sourceFingerprint, storage = browserStorage()) {
  try { return storage?.getItem(`${markerPrefix}${userId}`) === sourceFingerprint; }
  catch { return false; }
}

export function markGuestMergeConfirmed(userId, sourceFingerprint, storage = browserStorage()) {
  try { storage?.setItem(`${markerPrefix}${userId}`, sourceFingerprint); return true; }
  catch { return false; }
}

export async function applyGuestMerge(preview, { accountClient, profileClient, quizClient }) {
  try {
    let updatedUser = null;
    if (preview.profileWillChange) {
      const result = await profileClient.updateMyStudyProfile(preview.studyProfile);
      if (!result.ok) throw new Error(result.message || '专业与年级同步失败。');
      updatedUser = result.user;
    }
    for (const courseCode of preview.courseFavorites) {
      const result = await accountClient.addCourseFavorite(courseCode);
      if (!result.ok) throw new Error(result.message || '课程收藏同步失败。');
    }
    for (const item of preview.contentFavorites) {
      const result = await accountClient.addFavorite(item.id);
      if (!result.ok) throw new Error(result.message || '资料收藏同步失败。');
    }
    for (const group of preview.quiz) {
      const result = await quizClient.mergeQuizAccountState({
        collectionSlug: group.collectionSlug,
        mistakes: group.mistakes,
        vocabulary: group.vocabulary.map((record) => ({
          ...record, recordKey: record.recordKey ?? record.id, context: { ...record },
        })),
      });
      if (!result.ok) throw new Error(result.message || '刷题记录同步失败。');
    }
    for (const session of preview.quizSessions) {
      const result = await quizClient.claimQuizSession(session.sessionId);
      if (!result.ok) {
        throw new Error(result.message || '练习进度同步失败。');
      }
    }
    return { ok: true, user: updatedUser };
  } catch (error) {
    return { ok: false, message: error.message || '本机记录合并失败，请稍后重试。' };
  }
}
