export const activityPrograms = [
  {
    id: 'academic-voyage',
    label: '学业领航',
    category: 'frontier',
    imageUrl: '/assets/activities/academic-voyage-lectures.webp',
    imageAlt: '学业领航系列讲座往期海报合集',
    summary: '聚焦学术前沿、科研路径与成长经验的系列分享。',
  },
  {
    id: 'laboratory-open-day',
    label: '实验室开放日',
    category: 'frontier',
    imageUrl: '/assets/activities/laboratory-open-day.webp',
    imageAlt: '生命科学学院实验室开放日师生合影',
    summary: '走进科研一线，了解实验室方向、环境与真实日常。',
  },
  {
    id: 'major-festival',
    label: '专业节宣讲',
    category: 'learning',
    imageUrl: '/assets/activities/major-festival.webp',
    imageAlt: '专业节现场的生命科学学院展位',
    summary: '面向专业选择与专业认知，集中呈现生命科学的学习图景。',
  },
  {
    id: 'peer-learning',
    label: '朋辈辅学',
    category: 'learning',
    imageUrl: '/assets/activities/peer-learning.webp',
    imageAlt: '朋辈辅学活动现场',
    summary: '由优秀学长学姐分享课程经验，为学习难点提供同伴支持。',
  },
  {
    id: 'beautiful-trio',
    label: '最美三件套',
    category: 'community',
    imageUrl: '/assets/activities/beautiful-trio.webp',
    imageAlt: '最美笔记、最美作息表和最美书桌作品',
    summary: '记录最美笔记、最美作息表与最美书桌，让学风进入日常。',
  },
  {
    id: 'joint-activities',
    label: '联合活动',
    category: 'exchange',
    imageUrl: '/assets/activities/botanical-keepsake.webp',
    imageAlt: '两校联合活动制作的植物滴胶标本',
    summary: '汇集跨学院、跨学校共同开展的主题交流与实践。',
  },
];

export const activityProgramIds = new Set(activityPrograms.map((program) => program.id));

export const activityImageOptions = [
  { value: '/assets/activities/academic-voyage-lectures.webp', label: '学业领航讲座海报' },
  { value: '/assets/activities/laboratory-open-day.webp', label: '实验室开放日合影' },
  { value: '/assets/activities/major-festival.webp', label: '专业节宣讲现场' },
  { value: '/assets/activities/peer-learning.webp', label: '朋辈辅学现场' },
  { value: '/assets/activities/beautiful-trio.webp', label: '最美三件套作品' },
  { value: '/assets/activities/botanical-keepsake.webp', label: '两校植物滴胶标本' },
];

export function activityProgram(programId) {
  return activityPrograms.find((item) => item.id === programId) ?? null;
}

export function activityProgramLabel(programId) {
  return activityProgram(programId)?.label ?? '学院活动';
}

export function activityCategoryLabel(categoryId, programId = '') {
  if (programId) return activityProgramLabel(programId);
  return {
    frontier: '学术前沿', learning: '学业支持', community: '互助学风', exchange: '联合交流',
  }[categoryId] ?? '学院活动';
}
