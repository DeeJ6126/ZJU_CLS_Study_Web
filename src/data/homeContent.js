export const homeSearchKinds = [
  { id: 'course', label: '课程', placeholder: '搜索课程名称或课程代码' },
  { id: 'resource', label: '资料', placeholder: '搜索复习资料、学习笔记或试卷' },
  { id: 'quiz', label: '题库', placeholder: '搜索课程题库' },
  { id: 'activity', label: '活动', placeholder: '搜索学生会活动' },
];

export const homeActivities = [
  {
    id: 'lab-open-day',
    eyebrow: '学院活动',
    title: '实验室开放日',
    summary: '走进实验室，了解研究方向、团队日常与本科生参与机会。',
    actionLabel: '了解活动',
    href: '#about',
    tone: 'green',
  },
  {
    id: 'peer-support',
    eyebrow: '朋辈辅学',
    title: '课程答疑与学习小组',
    summary: '围绕核心课程组织经验分享、阶段答疑和同伴学习。',
    actionLabel: '查看安排',
    href: '#about',
    tone: 'amber',
  },
  {
    id: 'beautiful-notes',
    eyebrow: '学生会征集',
    title: '最美笔记与学习经验',
    summary: '分享你的课程笔记、复习方法与学习工具，让经验持续流动。',
    actionLabel: '查看征集',
    href: '#about',
    tone: 'blue',
  },
];

export const homePopularResources = [
  {
    id: 'microbiology-review',
    title: '微生物学期末复习',
    meta: 'BIO2110F · 题库与真题',
    href: '#quiz',
  },
  {
    id: 'botany-gallery',
    title: '植物学切片图库',
    meta: 'BIO2019F · 图像识别',
    href: '#quiz',
    image: '/resource/quiz/BIO2019F/botany-slice/assets/images/茎/椴树茎10X-1.jpg',
  },
  {
    id: 'molecular-review',
    title: '分子生物学复习题',
    meta: 'BIO2023M · 双语练习',
    href: '#quiz',
  },
];

export const homeQuizSearchItems = homePopularResources.map((item) => ({
  ...item,
  courseCode: item.meta.split(' · ')[0],
}));

export const homeResourceSearchItems = homePopularResources.map((item) => ({
  ...item,
  id: `${item.id}-resource`,
  href: item.meta.startsWith('BIO') ? `#resources/#${item.meta.split(' · ')[0]}` : item.href,
}));
