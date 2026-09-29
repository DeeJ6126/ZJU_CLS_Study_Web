import { buildCourseRoute } from '../../src/data/courses/resourcePaths.js';

const MAX_QUERY_LENGTH = 64;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 30;
const MAX_PAGE = 1000;
const TABS = { experience: 'experiences', material: 'materials', paper: 'papers' };
// BIO2009F was split into these courses; its existing posts still belong to
// the original course and must keep their original routes.
const historicalCourseAliases = {
  BIO2110F: ['BIO2009F'],
  BIO2113F: ['BIO2009F'],
};

function boundedText(value) {
  return String(value ?? '').trim().slice(0, MAX_QUERY_LENGTH);
}

function boundedInteger(value, fallback, maximum) {
  const text = String(value ?? '');
  if (!/^[1-9]\d*$/.test(text)) return fallback;
  return Math.min(maximum, Number(text));
}

function matchingCourseCodes(courses, term) {
  const needle = term.toLowerCase();
  const codes = courses.filter((course) => [course.code, course.name]
    .some((value) => String(value ?? '').toLowerCase().includes(needle)))
    .map((course) => course.code);
  return [...new Set(codes.flatMap((code) => [code, ...(historicalCourseAliases[code] ?? [])]))];
}

export function searchResources({ query = '', course = '', type = '', teacher = '', year = '', page = 1, pageSize = DEFAULT_PAGE_SIZE, contentStore, courseCatalog } = {}) {
  const safeQuery = boundedText(query);
  const safeCourse = boundedText(course);
  const safeTeacher = boundedText(teacher);
  const safeYear = boundedText(year);
  const safeType = String(type ?? '').trim();
  const safePage = boundedInteger(page, 1, MAX_PAGE);
  const safePageSize = boundedInteger(pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const base = { query: safeQuery, total: 0, page: safePage, pageSize: safePageSize, items: [] };
  if (safeType && !Object.hasOwn(TABS, safeType)) return base;

  const courses = courseCatalog?.courses ?? [];
  const names = new Map(courses.map((item) => [item.code, item.name]));
  const tokens = safeQuery.toLowerCase().split(/\s+/).filter(Boolean);
  const result = contentStore.searchPublishedResources({
    tokens,
    tokenCourseCodes: tokens.map((token) => matchingCourseCodes(courses, token)),
    course: safeCourse,
    courseCodes: safeCourse ? matchingCourseCodes(courses, safeCourse) : [],
    type: safeType,
    teacher: safeTeacher,
    year: safeYear,
    limit: safePageSize,
    offset: (safePage - 1) * safePageSize,
  });
  return {
    ...base,
    total: result.total,
    items: result.items.map((item) => ({
      id: item.id,
      routeId: item.routeId || item.id,
      courseCode: item.courseCode,
      courseName: names.get(item.courseCode) ?? '',
      type: item.type,
      title: item.title,
      summary: item.summary,
      author: item.author,
      teacher: item.teacher,
      year: item.year,
      updatedAt: item.updatedAt,
      href: buildCourseRoute(item.courseCode, TABS[item.type], item.routeId || item.id),
    })),
  };
}
