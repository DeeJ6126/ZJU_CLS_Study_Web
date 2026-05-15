import { buildCourseRoute } from './resourcePaths.js';

const CATEGORY_ORDER = ['basic', 'major', 'personal', 'general'];

const MAJOR_REQUIRED_CODES = [
  'BIO2028M',
  'BIO2029M',
  'BIO2110F',
  'BIO2113F',
  'BIO3015F',
  'BIO3026M',
  'BIO4032M',
  'BIO3109M',
  'BIO4031M',
];

const MAJOR_PRACTICE_CODES = ['BIO2085M', 'BIO2048M', 'BIO2080M', 'BIO3081M', 'BIO3082M'];
const MAJOR_THESIS_CODES = ['BIO4087M'];

const PERSONAL_SCIENCE_CODES = [
  'BIO3052M',
  'BIO3066M',
  'BIO2017F',
  'BIO3045M',
  'BIO3070M',
  'BIO3047M',
  'BIO3053M',
  'BIO3057M',
  'BIO3060M',
  'BIO3062M',
  'BIO3065M',
  'BIO3090M',
  'BIO3092M',
  'BIO3077M',
  'BIO3050M',
  'BIO3097M',
  'BIO3099M',
  'BIO4059M',
  'BIO4064M',
  'BIO3025M',
  'BIO3093M',
  'BIO3094M',
  'BIO3095M',
  'BIO3096M',
  'BIO3055M',
  'BIO3088M',
  'BIO3091M',
  'BIO3100M',
  'BIO4049M',
];

const PERSONAL_TECH_CODES = [
  'BIO3066M',
  'BIO3061M',
  'BIO3070M',
  'BIO2027M',
  'BIO3047M',
  'BIO3053M',
  'BIO3057M',
  'BIO3060M',
  'BIO3062M',
  'BIO3065M',
  'BIO3090M',
  'BIO3092M',
  'BIO3097M',
  'BIO4064M',
  'BIO3025M',
  'BIO3093M',
  'BIO3094M',
  'BIO3095M',
  'BIO3096M',
  'BIO3088M',
  'BIO3091M',
];

const PERSONAL_INFO_CODES = [
  'BIO3097M',
  'BIO3025M',
  'BIO3060M',
  'BIO3062M',
  'BIO3065M',
  'BIO3058M',
  'BIO3089M',
  'BIO4064M',
  'BIO4083M',
];

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function valueByHeader(row, headerIndex, name, fallbackIndex = -1) {
  const index = headerIndex.get(name);
  if (index !== undefined) {
    return row[index] ?? '';
  }

  return fallbackIndex >= 0 ? row[fallbackIndex] ?? '' : '';
}

function normalizeCourse(row, index, headerIndex = new Map()) {
  return {
    id: valueByHeader(row, headerIndex, '课程代码', 0) || `course-${index}`,
    code: valueByHeader(row, headerIndex, '课程代码', 0),
    name: valueByHeader(row, headerIndex, '课程名称', 1),
    englishName: valueByHeader(row, headerIndex, '课程英文名称', 2),
    credits: valueByHeader(row, headerIndex, '学分', 3),
    hoursPerWeek: valueByHeader(row, headerIndex, '周学时', 4),
    totalHours: valueByHeader(row, headerIndex, '总学时', 5),
    category: valueByHeader(row, headerIndex, '课程类别', 6),
    type: valueByHeader(row, headerIndex, '课程类型', 7),
    department: valueByHeader(row, headerIndex, '开课部门', 8),
    affiliation: valueByHeader(row, headerIndex, '课程归属', 9),
    tag: valueByHeader(row, headerIndex, '课程标识', 10),
    recognition: valueByHeader(row, headerIndex, '认定类别', 11),
    suggestedYear: valueByHeader(row, headerIndex, '建议修读年级', 14),
    sourceCode: valueByHeader(row, headerIndex, '对应课程代码', 18),
    introduction: valueByHeader(row, headerIndex, '课程简介', 19),
  };
}

function uniqueByCode(courses) {
  const seen = new Set();
  return courses.filter((course) => {
    if (!course.code || seen.has(course.code)) {
      return false;
    }
    seen.add(course.code);
    return true;
  });
}

function sortByCodeList(courses, codes) {
  const byCode = new Map(courses.map((course) => [course.code, course]));
  const sorted = codes.map((code) => byCode.get(code)).filter(Boolean);
  const included = new Set(sorted.map((course) => course.code));
  return [...sorted, ...courses.filter((course) => !included.has(course.code))];
}

function groupByCodes(title, courses, codes) {
  return {
    id: title,
    title,
    courses: sortByCodeList(courses.filter((course) => codes.includes(course.code)), codes),
  };
}

function createCourseUrl(course) {
  return buildCourseRoute(course.code);
}

function withLinks(courses, resourceCategory) {
  return courses.map((course) => ({
    ...course,
    resourceCategory,
    href: createCourseUrl({ ...course, resourceCategory }),
  }));
}

export function parseCourseCsv(csvText) {
  const lines = csvText.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0]);
  const headerIndex = new Map(headers.map((header, index) => [header, index]));
  return lines.slice(1).map((line, index) => normalizeCourse(parseCsvLine(line), index, headerIndex));
}

export function getCourseByCode(courses, courseCode) {
  return courses.find((course) => course.code === courseCode) ?? null;
}

export function buildResourceSections(courses) {
  const basicCourses = withLinks(courses.filter((course) => course.category === '专业基础课程'), 'basic');
  const generalCourses = withLinks(courses.filter((course) => course.category === '通识'), 'general');
  const professionalCourses = courses.filter((course) => course.category === '专业课');
  const majorCodes = new Set([...MAJOR_REQUIRED_CODES, ...MAJOR_PRACTICE_CODES, ...MAJOR_THESIS_CODES]);
  const majorCourses = withLinks(professionalCourses.filter((course) => majorCodes.has(course.code)), 'major');
  const personalCourses = withLinks(professionalCourses.filter((course) => !majorCodes.has(course.code)), 'personal');

  const majorGroups = [
    groupByCodes('专业必修课程', majorCourses, MAJOR_REQUIRED_CODES),
    groupByCodes('实践教学环节', majorCourses, MAJOR_PRACTICE_CODES),
    groupByCodes('毕业论文（设计）', majorCourses, MAJOR_THESIS_CODES),
  ];

  const personalGroups = [
    groupByCodes('本专业进阶模块：生物科学方向', personalCourses, PERSONAL_SCIENCE_CODES),
    groupByCodes('本专业进阶模块：生物技术方向', personalCourses, PERSONAL_TECH_CODES),
    groupByCodes('本专业进阶模块：生物信息学方向', personalCourses, PERSONAL_INFO_CODES),
  ];

  const groupedPersonalCodes = new Set(personalGroups.flatMap((group) => group.courses.map((course) => course.code)));
  const remainingPersonalCourses = personalCourses.filter((course) => !groupedPersonalCodes.has(course.code));

  const sections = [
    {
      id: 'basic',
      title: '专业基础课程',
      subtitle: 'Program Foundation',
      groups: [{ id: 'basic-core', title: '', courses: basicCourses }],
    },
    {
      id: 'major',
      title: '专业课',
      subtitle: 'Major Curriculum',
      groups: majorGroups,
    },
    {
      id: 'personal',
      title: '个性修读课程',
      subtitle: 'Personalized Study',
      groups: [
        ...personalGroups,
        { id: 'self-directed-module', title: '学生自主修读模块', courses: remainingPersonalCourses },
      ],
    },
    {
      id: 'general',
      title: '通识课',
      subtitle: 'General Education',
      groups: [{ id: 'general-core', title: '通识课程', courses: generalCourses }],
    },
  ];

  const byId = new Map(sections.map((section) => [section.id, section]));
  return CATEGORY_ORDER.map((id) => byId.get(id));
}

export const resourceProgramMeta = {
  source: '2024级生物科学专业培养方案',
  note: '按培养方案结构整理课程资源，便于快速查找专业学习材料。',
};

export const programOptions = [
  { year: '2023', label: '2023级培养方案', available: false },
  { year: '2024', label: '2024级培养方案', available: true },
  { year: '2025', label: '2025级培养方案', available: false },
];
