import catalog from '../data/courses/courseTeachers.json' with { type: 'json' };

const uniqueNames = (names) => [...new Set(names)].sort((a, b) => a.localeCompare(b, 'zh-CN'));
const allTeachers = uniqueNames(Object.values(catalog.teachersByCourse).flat());
const normalize = (value) => String(value ?? '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();

export function courseTeacherNames(courseCode = '') {
  return courseCode ? [...(catalog.teachersByCourse[courseCode] ?? [])] : [...allTeachers];
}

export function searchTeacherNames(courseQuery = '', courses = []) {
  const query = normalize(courseQuery);
  if (!query) return courseTeacherNames();
  const matches = courses.filter((course) => [course.code, course.name].some((value) => normalize(value).includes(query)));
  return uniqueNames(matches.flatMap((course) => courseTeacherNames(course.code)));
}

export function filterTeacherSuggestions(names, input = '') {
  const prefix = String(input ?? '').trim();
  return uniqueNames(names).filter((name) => name.startsWith(prefix));
}
