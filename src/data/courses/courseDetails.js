import { buildCourseRoute } from './resourcePaths.js';
import { buildCourseOverviewFields, buildSummaryFacts } from '../../services/courseOverviewService.js';

export const supportedCourseCodes = [];

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

  const content = {
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
