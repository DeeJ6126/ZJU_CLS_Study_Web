import {
  findCurriculumProgram,
  flattenProgram,
  majorOptions,
  semesterLabels,
} from '../data/courses/programCatalog.js';
import { buildCourseRoute } from '../data/courses/resourcePaths.js';

const majorIds = new Set(majorOptions.filter((item) => item.available).map((item) => item.id));

export function currentSchoolSemester(now = new Date()) {
  const date = new Date(now);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: 'numeric',
  }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
  const academicYear = parts.month >= 9 ? parts.year : parts.year - 1;
  const term = parts.month >= 9 || parts.month <= 2
    ? 'autumn-winter' : parts.month <= 6 ? 'spring-summer' : 'short';
  return { academicYear, term };
}

export function currentSemesterCourses({ majorId, cohortYear, courses = [], now = new Date(), chosenModules = [] } = {}) {
  if (!majorIds.has(majorId) || cohortYear == null || cohortYear === '' || !Number.isInteger(Number(cohortYear))) {
    return { status: 'missing-profile', courses: [], semesterId: '', label: '' };
  }
  const program = findCurriculumProgram(majorId, cohortYear);
  if (!program) return { status: 'no-program', courses: [], semesterId: '', label: '' };
  const schoolTerm = currentSchoolSemester(now);
  if (!schoolTerm) return { status: 'invalid-date', courses: [], semesterId: '', label: '' };
  const studyYear = schoolTerm.academicYear - Number(cohortYear) + 1;
  if (studyYear < 1 || studyYear > 4) {
    return { status: 'outside-program', courses: [], semesterId: '', label: '' };
  }
  const semesterId = `${studyYear}-${schoolTerm.term}`;
  const { semesterByCourse } = flattenProgram(program, chosenModules);
  const byCode = new Map(courses.map((course) => [course.code, course]));
  const recommendedCodes = Object.entries(semesterByCourse)
    .filter(([, semester]) => semester === semesterId)
    .flatMap(([code]) => {
      // The current teaching arrangement splits the historical combined course.
      return code === 'BIO2009F' && schoolTerm.academicYear >= 2026
        ? ['BIO2110F', 'BIO2113F'] : [code];
    });
  const visibleCourses = [...new Set(recommendedCodes)]
    .map((code) => byCode.get(code))
    .filter(Boolean)
    .map((course) => ({ ...course, href: buildCourseRoute(course.code) }));
  return {
    status: 'ready', courses: visibleCourses, semesterId,
    label: `${schoolTerm.academicYear} 学年 · ${semesterLabels[semesterId] ?? ''}`,
  };
}
