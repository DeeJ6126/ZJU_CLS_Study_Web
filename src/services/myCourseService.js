import { currentSemesterCourses } from './currentSemesterService.js';
import { filterSiteCourses } from '../data/courses/resourceCatalog.js';
import { buildCourseRoute } from '../data/courses/resourcePaths.js';

export function courseListPreset({ majorId, cohortYear, courses = [], now = new Date() } = {}) {
  const overview = currentSemesterCourses({ majorId, cohortYear, courses, now, professionalOnly: true });
  return { ...overview, courses: overview.courses.map((course) => ({
    courseCode: course.code, courseName: course.name, teacherName: '',
    term: overview.label, classTime: '', classLocation: '',
  })) };
}

export function cleanMyCourses(courses = []) {
  if (!Array.isArray(courses)) return [];
  return [...new Map(courses.filter((course) => course && typeof course.courseCode === 'string' && /^[A-Z0-9-]{3,24}$/.test(course.courseCode.toUpperCase())
    && typeof course.courseName === 'string' && course.courseName.trim()).slice(0, 100).map((course) => {
    const value = { courseCode: course.courseCode.toUpperCase(), courseName: course.courseName.trim().slice(0, 100) };
    for (const field of ['teacherName', 'term', 'classTime', 'classLocation']) value[field] = String(course[field] ?? '').slice(0, 500);
    return [value.courseCode, value];
  })).values()];
}

export function myCourseViews(courses, catalog = []) {
  const codes = new Set(filterSiteCourses(catalog).map((course) => course.code));
  return cleanMyCourses(courses).map((course) => ({ ...course, catalogMatched: codes.has(course.courseCode),
    href: codes.has(course.courseCode) ? buildCourseRoute(course.courseCode) : '',
  }));
}

export function searchCoursePicker(catalog = [], input = '', selected = []) {
  const query = String(input).normalize('NFKC').trim().toLowerCase();
  if (!query) return [];
  const existing = new Set(selected.map((course) => course.courseCode));
  return catalog.filter((course) => [course.name, course.code].some((value) => value.toLowerCase().includes(query)))
    .sort((a, b) => Number(b.code.toLowerCase() === query || b.name.toLowerCase() === query)
      - Number(a.code.toLowerCase() === query || a.name.toLowerCase() === query))
    .slice(0, 30).map((course) => ({ ...course, selected: existing.has(course.code) }));
}
