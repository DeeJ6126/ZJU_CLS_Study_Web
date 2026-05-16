const excludedLabels = new Set(['开课部门', '是否体育分项', '对应课程代码']);

const orderedFieldKeys = [
  ['code', '课程代码'],
  ['name', '课程名称'],
  ['englishName', '课程英文名称'],
  ['credits', '学分'],
  ['hoursPerWeek', '周学时'],
  ['totalHours', '总学时'],
  ['category', '课程类别'],
  ['type', '课程类型'],
  ['department', '开课部门'],
  ['affiliation', '课程归属'],
  ['tag', '课程标识'],
  ['recognition', '认定类别'],
  ['exemptionAllowed', '是否允许申请免听'],
  ['makeupAllowed', '是否允许补考'],
  ['suggestedYear', '建议修读年级'],
  ['honorCourse', '是否荣誉课程'],
  ['ckcCourse', '是否竺可桢学院课程'],
  ['sportsCategory', '是否体育分项'],
  ['sourceCode', '对应课程代码'],
  ['introduction', '课程简介'],
];

export function buildCourseOverviewFields(course) {
  if (!course) {
    return [];
  }

  return orderedFieldKeys
    .map(([key, label]) => ({
      key,
      label,
      value: course[key],
    }))
    .filter((field) => !excludedLabels.has(field.label))
    .filter((field) => field.value !== undefined && field.value !== null && String(field.value).trim() !== '');
}
