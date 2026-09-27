import { curriculumPrograms, walkSections } from '../data/courses/programCatalog.js';

const overviewCourseCodes = new Set();
const overviewCourseCodesByMajor = new Map();
for (const [majorId, programsByYear] of Object.entries(curriculumPrograms)) {
  const majorCodes = new Set();
  for (const program of Object.values(programsByYear)) {
    walkSections(program.sections, (section) => {
      for (const course of section.courses ?? []) {
        overviewCourseCodes.add(course.code);
        majorCodes.add(course.code);
      }
    });
  }
  overviewCourseCodesByMajor.set(majorId, majorCodes);
}

export function filterAdminCoursesToOverview(courses, majorId = '') {
  const allowedCodes = majorId ? overviewCourseCodesByMajor.get(majorId) : overviewCourseCodes;
  return courses.filter((course) => allowedCodes?.has(course.code));
}

export function courseOptionLabel(course) {
  if (!course) return '';
  return `${course.code} · ${course.name}`;
}

export function filterAdminCourses(courses, query) {
  const tokens = String(query ?? '')
    .trim()
    .toLocaleLowerCase('zh-CN')
    .split(/\s+/)
    .filter(Boolean);

  if (!tokens.length) return courses;

  return courses.filter((course) => {
    const searchable = `${course.code ?? ''} ${course.name ?? ''}`.toLocaleLowerCase('zh-CN');
    return tokens.every((token) => searchable.includes(token));
  });
}

export function countPendingSubmissionsByCourse(submissions) {
  return submissions.reduce((counts, submission) => {
    if (submission.status !== 'pending' || !submission.courseCode) return counts;
    counts[submission.courseCode] = (counts[submission.courseCode] ?? 0) + 1;
    return counts;
  }, {});
}

export function pendingCourseOrder(submissions, type) {
  const earliest = new Map();
  for (const submission of submissions) {
    if (submission.status !== 'pending' || submission.withdrawnAt || submission.type !== type || !submission.courseCode) continue;
    const time = Date.parse(submission.createdAt) || 0;
    earliest.set(submission.courseCode, Math.min(earliest.get(submission.courseCode) ?? Infinity, time));
  }
  return [...earliest].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).map(([code]) => code);
}
