export const activityCategories = [
  { id: 'all', label: '全部活动', shortLabel: '全部' },
  { id: 'frontier', label: '学术前沿', shortLabel: '前沿' },
  { id: 'learning', label: '学业支持', shortLabel: '学习' },
  { id: 'community', label: '互助学风', shortLabel: '学风' },
  { id: 'exchange', label: '联合交流', shortLabel: '交流' },
];

export const activityImageOptions = [
  { value: '/assets/activities/academic-voyage-lectures.webp', label: '学业领航讲座海报' },
  { value: '/assets/activities/laboratory-open-day.webp', label: '实验室开放日合影' },
  { value: '/assets/activities/major-festival.webp', label: '专业节宣讲现场' },
  { value: '/assets/activities/peer-learning.webp', label: '朋辈辅学现场' },
  { value: '/assets/activities/beautiful-trio.webp', label: '最美三件套作品' },
  { value: '/assets/activities/botanical-keepsake.webp', label: '两校植物滴胶标本' },
];

export function activityCategoryLabel(categoryId) {
  return activityCategories.find((item) => item.id === categoryId)?.label ?? '学院活动';
}
