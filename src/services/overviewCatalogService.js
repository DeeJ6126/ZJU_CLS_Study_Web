import { buildResourceSections } from '../data/courses/resourceCatalog.js';
import { buildCourseRoute } from '../data/courses/resourcePaths.js';
import {
  flattenProgram,
  listAlternativeGroups,
  resolveAlternatives,
  semesterLabels,
  semesterOrder,
} from '../data/courses/programCatalog.js';

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

export function filterCoursesByProgram(courses, program, chosen = []) {
  const { courseCodes } = flattenProgram(program, chosen);
  const includedCodes = new Set(courseCodes);
  return courses.filter((course) => includedCodes.has(course.code));
}

/**
 * 按培养方案原文的章节结构展开成可渲染的扁平行列表。
 *
 * 各专业的章节层级深浅不一（生物科学到四层，求是三层，强基带互斥模块），用
 * 递归组件渲染会把模板搞复杂，所以这里压成带 depth 的行，模板按缩进渲染。
 *
 * 带「选择一个模块进行必修」说明的小节，其子节点是互斥分支：该行携带
 * options 供页面渲染页签，并且只展开选中的那一支。
 *
 * 整棵子树都没有课程的小节不输出。培养方案里「跨专业学习模块」「学生自主
 * 修读模块」这类只有文字要求、不列课程的条目属于此类，放进课程目录只是噪音。
 * 判断按子树而非按名字——2026 级生态学的「学生自主修读模块」确实列了课程。
 *
 * @param {Object[]} courses  来自 introduction.csv 的课程清单
 * @param {Object|null} program
 * @param {Iterable<string>} [chosen] 已选的互斥分支 tag
 * @returns {Object[]} 行列表
 */
export function buildProgramOutline(courses, program, chosen = []) {
  const byCode = new Map(courses.map((course) => [course.code, course]));
  const groupByTag = new Map(listAlternativeGroups(program).map((group) => [group.tag, group]));
  const { selectedByGroup } = resolveAlternatives(program, chosen);
  const rows = [];

  function hasAnyCourse(section) {
    if ((section.courses ?? []).some((entry) => byCode.has(entry.code))) return true;
    return (section.children ?? []).some(hasAnyCourse);
  }

  function resolveCourse(entry) {
    const course = byCode.get(entry.code);
    if (!course) return null;
    return {
      ...course,
      semester: entry.semester,
      semesterLabel: semesterLabels[entry.semester] ?? '',
      href: buildCourseRoute(course.code),
    };
  }

  function walk(sections, depth, fromTabs = false) {
    for (const section of sections ?? []) {
      if (!hasAnyCourse(section)) continue;
      const group = groupByTag.get(section.tag);
      const selected = group ? selectedByGroup.get(section.tag) : '';
      rows.push({
        id: `${section.tag}-${depth}`,
        depth,
        tag: section.tag,
        credits: section.credits,
        note: section.note ?? '',
        courses: (section.courses ?? []).map(resolveCourse).filter(Boolean),
        options: group ? group.options.map((option) => ({ tag: option.tag, credits: option.credits })) : null,
        selected,
        // 选中分支的标题与它上方的页签文字一字不差，重复渲染只是噪音。
        headingHidden: fromTabs,
      });
      if (group) {
        const chosen = group.options.find((option) => option.tag === selected) ?? group.options[0];
        walk([chosen], depth + 1, true);
      } else {
        walk(section.children, depth + 1);
      }
    }
  }

  walk(program?.sections, 0);
  return rows;
}

export function buildProgramSemesterSections(courses, program, chosen = []) {
  const { courseCodes, semesterByCourse } = flattenProgram(program, chosen);
  const byCode = new Map(courses.map((course) => [course.code, course]));

  return semesterOrder.map((semesterId) => ({
    id: semesterId,
    title: semesterLabels[semesterId],
    courses: courseCodes
      .filter((courseCode) => semesterByCourse[courseCode] === semesterId)
      .map((courseCode) => byCode.get(courseCode))
      .filter(Boolean)
      .map((course) => ({ ...course, href: buildCourseRoute(course.code) })),
  })).filter((section) => section.courses.length > 0);
}
