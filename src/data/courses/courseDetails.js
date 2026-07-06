import { buildCourseRoute, courseMaterialPaths } from './resourcePaths.js';
import { buildCourseOverviewFields, buildSummaryFacts } from '../../services/courseOverviewService.js';

const courseContentIndexes = {
  BIO2110F: {
    overviewUrl: courseMaterialPaths.BIO2110F.overviewFile,
    experiences: ['1', '2', '3'].map((id) => ({
      id,
      url: `${courseMaterialPaths.BIO2110F.experiences}/${id}.md`,
    })),
    materials: ['1', '2', '3'].map((id) => ({
      id,
      url: `${courseMaterialPaths.BIO2110F.materials}/${id}.md`,
    })),
    papers: ['1'].map((id) => ({
      id,
      url: `${courseMaterialPaths.BIO2110F.papers}/${id}.md`,
    })),
  },
};

export const supportedCourseCodes = Object.keys(courseContentIndexes);

function withRoutes(courseCode, tabId, items) {
  return items.map((item) => ({
    ...item,
    href: buildCourseRoute(courseCode, tabId, item.id),
  }));
}

export function getCourseDetail(course) {
  if (!course) {
    return null;
  }

  const content = courseContentIndexes[course.code] ?? {
    overviewUrl: '',
    experiences: [],
    materials: [],
    papers: [],
  };

  return {
    ...course,
    courseType: course.type,
    semester: course.suggestedYear || '待整理',
    overview: course.introduction || '课程简介待整理。',
    summaryFacts: buildSummaryFacts(course),
    overviewFields: buildCourseOverviewFields(course),
    content,
    experiences: withRoutes(course.code, 'experiences', content.experiences),
    materials: withRoutes(course.code, 'materials', content.materials),
    papers: withRoutes(course.code, 'papers', content.papers),
  };
}
