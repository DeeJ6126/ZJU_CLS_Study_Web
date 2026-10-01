import { courseListPreset } from '../../src/services/myCourseService.js';

export function initializeCourseWorkspace(authStore, userId, user, catalog, { reset = false, now = new Date() } = {}) {
  const current = authStore.listUserCourses(userId);
  if (!reset && (authStore.userCoursesInitialized(userId) || current.length)) {
    if (current.length) authStore.markUserCoursesInitialized(userId);
    return { status: 'existing', courses: current };
  }
  const preset = courseListPreset({ majorId: user.majorId, cohortYear: user.grade, courses: catalog, now });
  if (preset.status !== 'ready') return { ...preset, courses: current };
  return { ...preset, courses: authStore.replaceUserCourses(userId, preset.courses) };
}
