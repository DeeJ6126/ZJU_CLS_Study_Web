// Cross-source search across courses, content items, activities, and student
// homepages. The dataset is small enough (hundreds to low thousands) to keep
// the implementation simple: a single substring match per token, applied
// in-memory after the relevant store returns the published subset.

const MAX_QUERY_LENGTH = 64;
const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 30;

function normalizeQuery(raw) {
  return String(raw ?? '').trim().slice(0, MAX_QUERY_LENGTH);
}

function clampLimit(value) {
  const num = Number(value) || DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, num));
}

function filterByQuery(items, fields, tokens) {
  if (!tokens.length) return [];
  return items.filter((item) => tokens.every((token) => {
    return fields.some((field) => {
      const value = item?.[field];
      if (value == null) return false;
      return String(value).toLowerCase().includes(token);
    });
  }));
}

function routeForContent(item) {
  const tab = item.type === 'experience'
    ? 'experiences'
    : item.type === 'material'
      ? 'materials'
      : 'papers';
  return `/#/resources/#${item.courseCode}/${tab}/${item.id}`;
}

function routeForActivity(item) {
  return `#/activity/${item.slug}`;
}

function courseHref(course) {
  return course.href ?? `/#/resources/#${course.code}`;
}

export function searchAll({
  query,
  limit = DEFAULT_LIMIT,
  contentStore,
  courseCatalog,
  studentHomepageStore,
} = {}) {
  const safeQuery = normalizeQuery(query);
  const tokens = safeQuery ? [safeQuery.toLowerCase()] : [];
  const safeLimit = clampLimit(limit);

  if (!tokens.length) {
    return {
      query: '',
      total: 0,
      results: { courses: [], content: [], activities: [], homepages: [] },
    };
  }

  const courseMatches = filterByQuery(courseCatalog.courses ?? [], [
    'code', 'name', 'englishName', 'introduction', 'tag',
  ], tokens)
    .slice(0, safeLimit)
    .map((course) => ({
      kind: 'course',
      code: course.code,
      name: course.name,
      category: course.category ?? '',
      summary: course.introduction ? String(course.introduction).slice(0, 140) : '',
      href: courseHref(course),
    }));

  const contentItems = contentStore?.listAdmin?.({ status: 'published' }) ?? [];
  const contentMatches = filterByQuery(contentItems, [
    'title', 'summary', 'author', 'courseCode',
  ], tokens)
    .slice(0, safeLimit)
    .map((item) => ({
      kind: 'content',
      id: item.id,
      type: item.type,
      title: item.title,
      summary: item.summary ?? '',
      author: item.author ?? '',
      courseCode: item.courseCode,
      href: routeForContent(item),
    }));

  const activityItems = contentStore?.listAdminActivities?.({ status: 'published' }) ?? [];
  const activityMatches = filterByQuery(activityItems, [
    'title', 'summary', 'category',
  ], tokens)
    .slice(0, safeLimit)
    .map((item) => ({
      kind: 'activity',
      slug: item.slug,
      title: item.title,
      summary: item.summary ?? '',
      category: item.category,
      href: routeForActivity(item),
    }));

  const homepageItems = studentHomepageStore?.listHomepages?.() ?? [];
  const homepageMatches = filterByQuery(homepageItems, ['name', 'href'], tokens)
    .slice(0, safeLimit)
    .map((item) => ({
      kind: 'homepage',
      name: item.name,
      href: item.href,
    }));

  return {
    query: safeQuery,
    total: courseMatches.length + contentMatches.length + activityMatches.length + homepageMatches.length,
    results: {
      courses: courseMatches,
      content: contentMatches,
      activities: activityMatches,
      homepages: homepageMatches,
    },
  };
}
