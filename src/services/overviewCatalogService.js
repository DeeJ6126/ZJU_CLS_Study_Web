import { buildResourceSections } from '../data/courses/resourceCatalog.js';
import { semesterLabels, semesterOrder } from '../data/courses/programCatalog.js';

function countCourses(groups) {
  return new Set(groups.flatMap((group) => group.courses.map((course) => course.code))).size;
}

function withCount(section) {
  return {
    ...section,
    courseCount: countCourses(section.groups),
  };
}

function mergeProfessionalSections(majorSection, personalSection) {
  const personalGroups = personalSection.groups.map((group) => ({
    ...group,
    title: group.id === 'self-directed-module' ? '其他专业课程' : group.title,
  }));

  return withCount({
    id: 'major',
    title: '专业课',
    subtitle: 'Major Curriculum',
    groups: [...majorSection.groups, ...personalGroups].filter((group) => group.courses.length),
  });
}

export function buildAllCourseSections(courses) {
  const [basic, major, personal, general] = buildResourceSections(courses);
  return [
    withCount(basic),
    mergeProfessionalSections(major, personal),
    withCount({ ...general, title: '通识课' }),
  ].filter((section) => section.courseCount > 0);
}

export function filterCoursesByProgram(courses, program) {
  const includedCodes = new Set(program?.courseCodes ?? []);
  return courses.filter((course) => includedCodes.has(course.code));
}

export function buildProgramCategorySections(courses, program) {
  return buildAllCourseSections(filterCoursesByProgram(courses, program));
}

export function buildProgramSemesterSections(courses, program) {
  const selectedCourses = filterCoursesByProgram(courses, program);
  const byCode = new Map(selectedCourses.map((course) => [course.code, course]));

  return semesterOrder.map((semesterId) => ({
    id: semesterId,
    title: semesterLabels[semesterId],
    courses: program.courseCodes
      .filter((courseCode) => program.semesterByCourse[courseCode] === semesterId)
      .map((courseCode) => byCode.get(courseCode))
      .filter(Boolean),
  }));
}
