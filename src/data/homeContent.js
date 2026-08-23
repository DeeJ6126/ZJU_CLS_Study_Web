export const homeSearchKinds = [
  { id: 'course', label: '课程', placeholder: '搜索课程名称或课程代码' },
  { id: 'resource', label: '资料', placeholder: '搜索复习资料、学习笔记或试卷' },
  { id: 'quiz', label: '题库', placeholder: '搜索课程题库' },
  { id: 'activity', label: '活动', placeholder: '搜索学生会活动' },
  { id: 'user', label: '用户', placeholder: '搜索用户昵称' },
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
