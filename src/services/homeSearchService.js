import { buildCourseRoute } from '../data/courses/resourcePaths.js';

const SEARCH_KIND_LABELS = {
  course: '课程',
  resource: '资料',
  quiz: '题库',
  activity: '活动',
};

function normalize(value) {
  return String(value ?? '').trim().toLocaleLowerCase();
}

function searchableItem(item) {
  return {
    ...item,
    searchText: normalize([
      item.title,
      item.subtitle,
      item.code,
      item.courseCode,
      item.summary,
    ].filter(Boolean).join(' ')),
  };
}

export function buildHomeSearchIndex({ courses = [], resources = [], quizzes = [], activities = [] }) {
  const courseItems = courses.map((course) => searchableItem({
    id: course.code,
    kind: 'course',
    kindLabel: SEARCH_KIND_LABELS.course,
    code: course.code,
    title: course.name,
    subtitle: course.englishName,
    href: buildCourseRoute(course.code),
  }));

  const contextualItems = [
    ...resources.map((item) => ({ ...item, kind: 'resource' })),
    ...quizzes.map((item) => ({ ...item, kind: 'quiz' })),
    ...activities.map((item) => ({ ...item, kind: 'activity' })),
  ].map((item) => searchableItem({
    ...item,
    kindLabel: SEARCH_KIND_LABELS[item.kind],
  }));

  return [...courseItems, ...contextualItems];
}

export function searchHomeIndex(index, query, kind = 'course', limit = 6) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) {
    return [];
  }

  return index
    .filter((item) => item.kind === kind && item.searchText.includes(normalizedQuery))
    .slice(0, limit);
}
